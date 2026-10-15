# ponytail: tag-pinned; pin by digest (python:3.12-slim@sha256:...) once the registry is reachable from CI
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# wheels are vendored: Docker's DNS on this host can't reach files.pythonhosted.org
# refresh with: pip download -r requirements.txt -d wheels
COPY requirements.txt .
COPY wheels ./wheels
RUN pip install --no-cache-dir --no-index --find-links wheels -r requirements.txt && rm -rf wheels
COPY main.py .
USER nobody
EXPOSE 8000
# only the frontend container (and loopback) can reach this port, so its X-Forwarded-For is trusted
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header", "--forwarded-allow-ips", "*"]
