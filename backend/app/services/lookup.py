from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from .errors import ConflictError, NotFoundError, RuleError


def get_or_404(db: Session, model, ident, name: str | None = None):
    obj = db.get(model, ident)
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{name or model.__name__} {ident} not found",
        )
    return obj


def get_by_code_or_404(db: Session, model, code: str):
    obj = db.query(model).filter(model.code == code).one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} {code} not found")
    return obj


def http_rule(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    if isinstance(exc, ConflictError):
        return HTTPException(status.HTTP_409_CONFLICT, str(exc))
    if isinstance(exc, RuleError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    raise exc
