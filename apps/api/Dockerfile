FROM python:3.12-slim

WORKDIR /app/api

COPY requirements.txt .
COPY ./ .

RUN pip install --no-cache-dir -r requirements.txt

ENV FLASK_APP=run.py
ENV FLASK_ENV=development
ENV PYTHONPATH=/app/api

CMD ["sh", "-c", "gunicorn --workers=$(( 2 * $(nproc) + 1 )) --threads=4 --bind=0.0.0.0:5000 run:app"]
