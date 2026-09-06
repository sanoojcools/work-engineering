import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from . import models as _models  # noqa: F401  — register ORM tables
from .config import settings
from .db import engine
from .routers import api_router

# Explicit rather than relying on logging's WARNING+-to-stderr last-resort
# fallback: uvicorn's own default config (start.sh runs plain `uvicorn
# app.main:app`, no --log-config) never touches the root logger, so without
# this, "app.errors" surfacing to stdout/stderr — where Render's log
# collector reads from — would depend on an implicit stdlib behaviour no one
# reading this file would know to look for.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("app.errors")


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


def _install_error_handling(app: FastAPI) -> None:
    """Slice 6.1: a 500 must be visible within ~5 minutes. Render's own
    traceback dump for an unhandled exception is a 90-line multi-line blob
    with nothing to grep for and no way to tie it back to the one request
    that hit it. This adds:

    - a request id (caller-supplied X-Request-Id, or a fresh one), echoed
      back on every response so a founder reproducing a bug by hand can
      quote it straight into Render's log search;
    - one structured, single-line log for every *unhandled* exception
      (request id, method, path, exception type — never the exception's
      own message/args). Deliberately never str(exc): this app's error
      paths run through SQLAlchemy and consent/PII services, and a
      SQLAlchemy statement error can echo bound parameter values — the
      safe default is to log nothing that might be an API key or a
      consent/PII payload, not to trust every exception type to stay
      clean.

    Both live in ONE middleware, not a middleware plus a separate
    `@app.exception_handler(Exception)`. Starlette's own
    `build_middleware_stack` special-cases any handler registered for the
    bare `Exception` class (or status 500): it hands that one to the
    outermost `ServerErrorMiddleware`, not `ExceptionMiddleware` — which
    sits *outside* every `@app.middleware("http")`, this one included. A
    two-piece version silently never attaches the request-id header to an
    error response, because control never returns to this middleware's
    post-`call_next` line at all; it unwinds straight past it to that
    outer layer instead (confirmed empirically, not just from the source).
    Catching the exception right here, before it ever reaches that outer
    layer, sidesteps the split entirely.

    Router-level `HTTPException`s (401/403/404/409/...) already raised on
    purpose keep behaving exactly as before: FastAPI/Starlette resolve
    those via their own registered handlers *inside* `call_next`, so they
    come back as normal responses and never reach this `except` clause —
    it only ever catches what nothing more specific already turned into a
    deliberate response.
    """

    @app.middleware("http")
    async def _request_id_and_errors(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(
                "unhandled_exception request_id=%s method=%s path=%s exc_type=%s",
                request_id,
                request.method,
                request.url.path,
                type(exc).__name__,
            )
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal Server Error", "request_id": request_id},
            )
        response.headers["X-Request-Id"] = request_id
        return response


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
    _install_error_handling(app)
    app.include_router(api_router, prefix="/api")
    return app


app = create_app()
