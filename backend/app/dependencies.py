from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db

DbDep = Annotated[Session, Depends(get_db)]


def require_spec_key(x_spec_key: str | None = Header(default=None, alias="X-Spec-Key")) -> str:
    """Shared secret for execution systems calling the Spec API / Enforcement Gateway."""
    if not x_spec_key or x_spec_key != settings.spec_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing spec API key",
        )
    return x_spec_key


SpecKeyDep = Annotated[str, Depends(require_spec_key)]
