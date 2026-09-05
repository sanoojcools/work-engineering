from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# System/maintenance connection only (bootstrap_tenants at startup, and
# get_system_db()'s app.system_bypass GUC below). Never expose this via a
# bare module-level dependency; per-request handlers must use
# get_db()/SessionLocal.
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


def get_system_db():
    """Cross-tenant session for the handful of endpoints that legitimately
    write across tenant boundaries (demo seeding, the consent purge sweep).

    Sets app.system_bypass='on', which every tenant_isolation policy (see
    alembic 68c3926e1143) ORs alongside its app.current_client_id check.
    Previously this docstring said "bypasses RLS by connecting as the
    migration superuser" — true only when that role happens to be a real
    Postgres superuser, which no managed Postgres provider grants to its
    app-facing owner role (confirmed on Render: rolsuper=false,
    rolbypassrls=false). Plain SET, not SET LOCAL: prepare_demo() flushes
    more than once per session before its single commit, and SET LOCAL
    reverts at the end of each transaction the same way it would for
    app.current_client_id (see dependencies.py::tenant_db).

    A FastAPI dependency rather than a bare `SystemSessionLocal()` call so it
    participates in dependency_overrides — calling the sessionmaker directly
    inside a handler silently escapes the test override and sends the request
    to the developer's real Postgres, which is exactly how
    test_client_list_and_demo_prepare_stay_open started asserting against
    live database state instead of its own fixture."""
    db = SystemSessionLocal()
    try:
        db.execute(text("SET app.system_bypass = 'on'"))
        yield db
    finally:
        db.close()
