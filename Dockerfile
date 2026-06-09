FROM python:3.11-slim

# Install system dependencies including Tesseract OCR
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements from the backend folder
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all code from the backend folder into the container working directory
COPY backend/ .

# Ensure Python treats the app directory as the root path
ENV PYTHONPATH=/app
EXPOSE 5000

CMD ["gunicorn", "--workers", "1", "--timeout", "60", "--bind", "0.0.0.0:5000", "app:app"]