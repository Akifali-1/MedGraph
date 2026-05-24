# Stage 1: Build stage
FROM python:3.12-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Production runner stage
FROM python:3.12-slim as runner

WORKDIR /app

# Create non-root system group and user
RUN groupadd -g 10001 medgraph && \
    useradd -u 10001 -g medgraph -s /bin/sh -m medgraph

# Copy dependencies from builder
COPY --from=builder /root/.local /home/medgraph/.local
COPY . .

# Set paths and env configurations
ENV PATH=/home/medgraph/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Change ownership of app directory to non-root user
RUN chown -R medgraph:medgraph /app

USER medgraph

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
