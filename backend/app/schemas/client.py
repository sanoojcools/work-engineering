from pydantic import BaseModel, Field


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = None
    industry: str = ""
    description: str = ""


class ClientOut(BaseModel):
    id: int
    slug: str
    name: str
    industry: str
    description: str
    kind: str
    work_unit_count: int = 0

    model_config = {"from_attributes": True}


class CensusRunIn(BaseModel):
    client_id: int
    function: str = "HR & People Ops"
    sop_text: str = ""
    executions_per_month: float = 50
