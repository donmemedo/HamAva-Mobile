FROM python:3.12-slim
WORKDIR /app
# wheels are vendored: Docker's DNS on this host can't reach files.pythonhosted.org
# refresh with: pip download -r requirements.txt -d wheels
COPY requirements.txt .
COPY wheels ./wheels
RUN pip install --no-cache-dir --no-index --find-links wheels -r requirements.txt && rm -rf wheels
COPY main.py .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
