FROM python:3.11-slim

# Install system dependencies including Tesseract OCR
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files
COPY . .

# Force Python to look at the current working directory for modules
ENV PYTHONPATH=/app

# Expose the port Render expects
EXPOSE 5000

# Run gunicorn. 
# NOTE: If your main flask file is NOT named "app.py" (e.g., it's server.py), change "app:app" to "server:app"
CMD ["gunicorn", "--workers", "1", "--timeout", "60", "--bind", "0.0.0.0:5000", "app:app"]