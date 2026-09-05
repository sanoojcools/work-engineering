from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import models as _models  # noqa: F401  — register ORM tables
from .config import settings
from .db import engine
from .routers import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is Alembic-owned as of the P0 foundation migration — no more
    # Base.metadata.create_all() here. A missing/unapplied migration should
    # fail loudly (db_ready=False), not be silently papered over.
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        # bootstrap_tenants clones catalog Work Units across clients — an
        # inherently cross-tenant maintenance step, so it deliberately runs
        # on the RLS-bypassing system session, not the per-request one. Uses
        # SystemSessionLocal directly rather than the get_system_db()
        # dependency (this isn't a request handler), so the app.system_bypass
        # GUC (see get_system_db's docstring, alembic 68c3926e1143) has to be
        # set here too — without it this silently failed on every Render
        # deploy/restart, caught by the broad except below into
        # db_ready=False with no visible error.
        from .db import SystemSessionLocal
        from .services.tenants import bootstrap_tenants
        db = SystemSessionLocal()
        try:
            db.execute(text("SET app.system_bypass = 'on'"))
            bootstrap_tenants(db)
        finally:
            db.close()
        app.state.db_ready = True
    except Exception:
        app.state.db_ready = False
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Work Engineering V8 — specification layer between enterprise intent and execution. "
            "The Work Unit is the primitive."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix="/api")
    return app


app = create_app()
