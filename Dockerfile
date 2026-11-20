FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent_langchain.py ops_copilot.py ./
COPY chat-ui/src/lib/runbooks.json ./chat-ui/src/lib/runbooks.json

USER 10001:10001
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn agent_langchain:app --host 0.0.0.0 --port ${PORT:-8000}"]
