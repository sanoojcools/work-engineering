from fastapi import APIRouter, Request, Response

from ..config import settings
from ..schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(request: Request, response: Response) -> HealthResponse:
    # render.yaml points healthCheckPath at this route, but Render's health
    # check only looks at the HTTP status — it never parses this body. This
    # used to return 200 unconditionally, so a failed startup bootstrap
    # (db_ready=False, set in main.py's lifespan) was invisible to Render's
    # own health-check-driven deploy gating and dashboard status. A non-2xx
    # here is what makes that native monitoring capable of firing at all.
    db_ready = bool(getattr(request.app.state, "db_ready", False))
    if not db_ready:
        response.status_code = 503
    return HealthResponse(
        status="ok" if db_ready else "db_unavailable",
        version=settings.app_version,
        db_ready=db_ready,
    )
