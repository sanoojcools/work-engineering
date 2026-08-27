from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# System/maintenance connection only (bootstrap_tenants at startup) — uses
# the wep superuser and therefore bypasses RLS on purpose. Never expose this
# via a FastAPI dependency; per-request handlers must use get_db()/SessionLocal.
system_engine = create_engine(settings.system_database_url, pool_pre_ping=True)
SystemSessionLocal = sessionmaker(bind=system_engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
