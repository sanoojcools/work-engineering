"""Company / tenant: the census boundary. Not login."""
from __future__ import annotations

from sqlalchemy import Integer, String, Text
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
    # V10-2 (docs/V10_BUILD.md): "not a 12-metric dashboard" -- one tenant
    # counter, incremented by services/pointers.py whenever a field pointer
    # claiming observed/reconstructed fails to resolve. Never decremented.
    fabrication_count: Mapped[int] = mapped_column(Integer, default=0)
    # V10-12 (docs/contracts/v10-12-discovery.md): four delinquency counters
    # -- invention, omission, distortion, flattery -- for extraction as a
    # performer, not a silent author. Not a 12-counter table: four, same
    # "not a dashboard" restraint as fabrication_count above. Bumped by
    # services/scout_story.py's scoring pass, only when the caller posts
    # commit=true or the extraction actually used a live model. Never
    # decremented.
    invention_count: Mapped[int] = mapped_column(Integer, default=0)
    omission_count: Mapped[int] = mapped_column(Integer, default=0)
    distortion_count: Mapped[int] = mapped_column(Integer, default=0)
    flattery_count: Mapped[int] = mapped_column(Integer, default=0)

    work_units: Mapped[list["WorkUnit"]] = relationship(back_populates="client")
