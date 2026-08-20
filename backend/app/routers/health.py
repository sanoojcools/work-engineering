from fastapi import APIRouter, Request

from ..config import settings
from ..schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        db_ready=bool(getattr(request.app.state, "db_ready", False)),
    )
