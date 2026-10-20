# Backend Django para el servidor (deploy/docker-compose.yml). Sin secretos en la imagen: todo
# llega por variables de entorno (deploy/.env).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.12.23 /uv /usr/local/bin/uv

WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./

# Usuario sin privilegios: el proceso no puede escribir fuera de lo que se le monta.
RUN useradd --system --uid 10001 credimpacto && mkdir -p /app/staticfiles && chown credimpacto /app/staticfiles
USER credimpacto
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000
# Las migraciones corren aparte con su propio rol (servicio "migrar" en deploy/docker-compose.yml).
CMD ["sh", "-c", "python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60 --access-logfile -"]
