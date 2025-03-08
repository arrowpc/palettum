FROM python:3.12-slim

WORKDIR /app/api

COPY requirements.txt .
COPY ./ .

RUN pip install --no-cache-dir -r requirements.txt

ENV FLASK_APP=run.py
ENV FLASK_ENV=development
ENV PYTHONPATH=/app/api

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "run:app"]
