"""Company / tenant: the census boundary. Not login."""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class Client(Base):
    """One organisation. Catalog holds mixed test samples; other rows are real or demo clients."""
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    industry: Mapped[str] = mapped_column(String(80), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(20), default="client")  # catalog | client

    work_units: Mapped[list["WorkUnit"]] = relationship(back_populates="client")
