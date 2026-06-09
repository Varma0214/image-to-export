from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import io
import base64
import re
import platform
import numpy as np

# PDF
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch

# Excel
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def preprocess_image(image):
    """Enhance image for better OCR accuracy."""
    # Convert to RGB if needed
    if image.mode != 'RGB':
        image = image.convert('RGB')

    # Upscale small images for better OCR
    w, h = image.size
    if w < 1200:
        scale = 1200 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Enhance contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)

    # Sharpen
    enhancer = ImageEnhance.Sharpness(image)
    image = enhancer.enhance(2.0)

    # Convert to grayscale
    image = image.convert('L')

    # Apply slight sharpening filter
    image = image.filter(ImageFilter.SHARPEN)

    return image


def cluster_values(values, gap_threshold=None):
    """Cluster sorted numeric values with adaptive gap detection."""
    if not values:
        return []
    sorted_vals = sorted(set(values))
    if len(sorted_vals) == 1:
        return [sorted_vals]

    gaps = [sorted_vals[i+1] - sorted_vals[i] for i in range(len(sorted_vals)-1)]
    if gap_threshold is None:
        # Use median gap * 1.5 as threshold
        median_gap = sorted(gaps)[len(gaps)//2]
        gap_threshold = max(median_gap * 1.5, 5)

    clusters = [[sorted_vals[0]]]
    for i, val in enumerate(sorted_vals[1:]):
        if gaps[i] <= gap_threshold:
            clusters[-1].append(val)
        else:
            clusters.append([val])
    return clusters


def extract_table_with_bbox(image):
    """
    Use Tesseract bounding box data to reconstruct exact table structure.
    Groups words by row (Y) then by column (X) using gap clustering.
    """
    # Try with LSTM engine (better for handwriting too)
    custom_config = r'--oem 1 --psm 6'
    try:
        data = pytesseract.image_to_data(image, config=custom_config, output_type=pytesseract.Output.DICT)
    except Exception:
        # Fallback to default engine
        data = pytesseract.image_to_data(image, config='--psm 6', output_type=pytesseract.Output.DICT)

    # Collect valid word entries
    words = []
    n = len(data['text'])
    for i in range(n):
        text = str(data['text'][i]).strip()
        conf = int(data['conf'][i]) if str(data['conf'][i]).lstrip('-').isdigit() else -1
        if text and conf > 10:  # Filter low-confidence noise
            words.append({
                'text': text,
                'left': data['left'][i],
                'top': data['top'][i],
                'width': data['width'][i],
                'height': data['height'][i],
                'right': data['left'][i] + data['width'][i],
                'bottom': data['top'][i] + data['height'][i],
                'conf': conf,
            })

    if not words:
        return [], ""

    # --- Step 1: Cluster words into ROWS by top Y position ---
    tops = [w['top'] for w in words]
    avg_height = sum(w['height'] for w in words) / len(words)
    row_gap = avg_height * 0.6  # Words in same row within 60% of avg height

    row_clusters = cluster_values(tops, gap_threshold=row_gap)
    # Map each top value to its row index
    top_to_row = {}
    for row_idx, cluster in enumerate(row_clusters):
        for v in cluster:
            top_to_row[v] = row_idx

    num_rows = len(row_clusters)

    # Group words by row
    rows_words = [[] for _ in range(num_rows)]
    for w in words:
        ri = top_to_row[w['top']]
        rows_words[ri].append(w)

    # Sort words within each row by left X
    for ri in range(num_rows):
        rows_words[ri].sort(key=lambda w: w['left'])

    # --- Step 2: Detect COLUMNS using X positions across all rows ---
    # Collect all word left-x and right-x positions
    all_lefts = [w['left'] for w in words]
    img_width = image.size[0]

    # Use average char width to set column gap threshold
    avg_char_width = sum(w['width'] / max(len(w['text']), 1) for w in words) / len(words)
    col_gap_threshold = avg_char_width * 2.5

    left_clusters = cluster_values(all_lefts, gap_threshold=col_gap_threshold)
    num_cols = len(left_clusters)

    # Build column boundaries: each column spans from its cluster min to next cluster min
    col_starts = [min(c) for c in left_clusters]
    col_ends = col_starts[1:] + [img_width]

    def get_col_idx(left_x):
        for ci, (cs, ce) in enumerate(zip(col_starts, col_ends)):
            # Allow some tolerance
            if cs - col_gap_threshold/2 <= left_x <= ce:
                return ci
        # Assign to nearest
        dists = [abs(left_x - cs) for cs in col_starts]
        return dists.index(min(dists))

    # --- Step 3: Build the grid ---
    grid = [[""] * num_cols for _ in range(num_rows)]

    for ri, row_ws in enumerate(rows_words):
        for w in row_ws:
            ci = get_col_idx(w['left'])
            if grid[ri][ci]:
                grid[ri][ci] += " " + w['text']
            else:
                grid[ri][ci] = w['text']

    # Remove completely empty rows/cols
    grid = [row for row in grid if any(c.strip() for c in row)]
    if not grid:
        return [], ""

    # Remove columns that are empty in ALL rows
    max_cols = max(len(r) for r in grid)
    grid = [r + [""] * (max_cols - len(r)) for r in grid]
    non_empty_cols = [ci for ci in range(max_cols) if any(grid[ri][ci].strip() for ri in range(len(grid)))]
    grid = [[row[ci] for ci in non_empty_cols] for row in grid]

    raw_text = pytesseract.image_to_string(image, config=custom_config)
    return grid, raw_text


def fallback_line_parse(text):
    """Fallback: split lines and detect columns by consistent spacing."""
    lines = [l.strip() for l in text.strip().split('\n') if l.strip()]
    if not lines:
        return []

    table = []
    for line in lines:
        # Try tab split first
        if '\t' in line:
            cols = [c.strip() for c in line.split('\t') if c.strip()]
        else:
            # Split by 2+ spaces
            cols = re.split(r'\s{2,}', line)
            cols = [c.strip() for c in cols if c.strip()]
        if cols:
            table.append(cols)

    if not table:
        return []

    # Normalize column count to most common
    from collections import Counter
    col_counts = Counter(len(r) for r in table)
    target_cols = col_counts.most_common(1)[0][0]

    normalized = []
    for row in table:
        if len(row) >= target_cols:
            normalized.append(row[:target_cols])
        else:
            normalized.append(row + [""] * (target_cols - len(row)))
    return normalized


@app.route('/ocr', methods=['POST'])
def ocr_image():
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({'error': 'No image provided'}), 400

    try:
        img_data = data['image']
        if ',' in img_data:
            img_data = img_data.split(',')[1]
        img_bytes = base64.b64decode(img_data)
        image = Image.open(io.BytesIO(img_bytes))

        # Store original for display
        processed = preprocess_image(image.copy())

        # Try bbox-based table extraction
        table, raw_text = extract_table_with_bbox(processed)

        # If bbox extraction failed or gave only 1 column, try fallback
        if not table or (len(table) > 0 and max(len(r) for r in table) <= 1):
            fallback = fallback_line_parse(raw_text)
            if fallback and max(len(r) for r in fallback) > max((len(r) for r in table), default=0):
                table = fallback

        if not table:
            # Last resort: put raw text in single cell
            table = [[raw_text or "No text detected"]]

        return jsonify({
            'raw_text': raw_text,
            'table': table,
            'rows': len(table),
            'cols': max(len(r) for r in table) if table else 0
        })

    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@app.route('/export/pdf', methods=['POST'])
def export_pdf():
    data = request.get_json()
    table_data = data.get('table', [])
    title = data.get('title', 'Exported Data')

    if not table_data:
        return jsonify({'error': 'No table data'}), 400

    try:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                leftMargin=0.75*inch, rightMargin=0.75*inch,
                                topMargin=0.75*inch, bottomMargin=0.75*inch)
        styles = getSampleStyleSheet()
        elements = []

        title_style = ParagraphStyle('Title', parent=styles['Heading1'],
                                     fontSize=16, spaceAfter=16,
                                     textColor=colors.HexColor('#1a1a2e'))
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 0.2*inch))

        max_cols = max(len(row) for row in table_data)
        norm = [row + [''] * (max_cols - len(row)) for row in table_data]

        page_w = A4[0] - 1.5*inch
        col_w = page_w / max_cols

        t = Table(norm, colWidths=[col_w]*max_cols, repeatRows=1)

        style_cmds = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a1a2e')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 10),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f0f4ff')]),
            ('FONTSIZE', (0,1), (-1,-1), 9),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#c0c8e0')),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]
        t.setStyle(TableStyle(style_cmds))
        elements.append(t)

        doc.build(elements)
        buf.seek(0)
        pdf_b64 = base64.b64encode(buf.read()).decode('utf-8')
        return jsonify({'pdf': pdf_b64, 'filename': f'{title}.pdf'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/export/excel', methods=['POST'])
def export_excel():
    data = request.get_json()
    table_data = data.get('table', [])
    title = data.get('title', 'Exported Data')

    if not table_data:
        return jsonify({'error': 'No table data'}), 400

    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = title[:31]

        header_fill = PatternFill("solid", fgColor="1A1A2E")
        alt_fill = PatternFill("solid", fgColor="F0F4FF")
        header_font = Font(bold=True, color="FFFFFF", size=11)
        body_font = Font(size=10)
        center = Alignment(horizontal='center', vertical='center')
        thin = Side(style='thin', color='C0C8E0')
        border = Border(left=thin, right=thin, top=thin, bottom=thin)

        for r_idx, row in enumerate(table_data, start=1):
            for c_idx, val in enumerate(row, start=1):
                cell = ws.cell(row=r_idx, column=c_idx, value=val)
                cell.border = border
                cell.alignment = center
                if r_idx == 1:
                    cell.fill = header_fill
                    cell.font = header_font
                else:
                    cell.font = body_font
                    if r_idx % 2 == 0:
                        cell.fill = alt_fill

        for col in ws.columns:
            max_len = 0
            for cell in col:
                try:
                    if cell.value:
                        max_len = max(max_len, len(str(cell.value)))
                except:
                    pass
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)

        for row in ws.iter_rows():
            ws.row_dimensions[row[0].row].height = 22

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        xl_b64 = base64.b64encode(buf.read()).decode('utf-8')
        return jsonify({'excel': xl_b64, 'filename': f'{title}.xlsx'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)