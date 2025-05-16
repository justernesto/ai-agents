# Use the official Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies and cleanup
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first for Docker cache efficiency
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Default command to start the agent
ENTRYPOINT ["uvicorn", "agent_langchain:app", "--host", "0.0.0.0", "--port", "8000"]