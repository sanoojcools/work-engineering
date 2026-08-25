import re

from fastapi import APIRouter, status

from ..dependencies import DbDep
from ..models.client import Client
from ..models.workunit import WorkUnit
from ..schemas.client import ClientCreate, ClientOut
from ..schemas.common import Page
from ..services.tenants import bootstrap_tenants, get_or_create_catalog

router = APIRouter()


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "company"


def _out(row: Client, count: int) -> ClientOut:
    data = ClientOut.model_validate(row)
    return data.model_copy(update={"work_unit_count": count})


@router.get("/", response_model=Page[ClientOut])
def list_clients(db: DbDep) -> Page[ClientOut]:
    try:
        bootstrap_tenants(db)
    except Exception:
        return Page(total=0, items=[])
    rows = db.query(Client).order_by(Client.id).all()
    items = []
    for row in rows:
        n = db.query(WorkUnit).filter(WorkUnit.client_id == row.id).count()
        items.append(_out(row, n))
    return Page(total=len(items), items=items)


@router.post("/", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreate, db: DbDep) -> ClientOut:
    get_or_create_catalog(db)
    slug = payload.slug or _slugify(payload.name)
    existing = db.query(Client).filter(Client.slug == slug).one_or_none()
    if existing:
        slug = f"{slug}-{db.query(Client).count() + 1}"
    row = Client(
        slug=slug,
        name=payload.name,
        industry=payload.industry,
        description=payload.description,
        kind="client",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _out(row, 0)
