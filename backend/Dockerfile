FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        postgresql-client \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY pyproject.toml .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir .

# Copy application code
COPY . .

EXPOSE 8000

# Start server (migrations run separately)
CMD uvicorn app.main:app --host 0.0.0.0 --port 8000
