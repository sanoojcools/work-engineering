FROM python:3.12-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
# The schema is Alembic-owned — the P0 foundation migration removed
# create_all(), so an image without these builds no tables at all and every
# request fails against an empty database.
COPY alembic.ini .
COPY alembic ./alembic
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
