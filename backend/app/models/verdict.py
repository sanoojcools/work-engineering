"""H1-H2: VERDICT scores and the deterministic autonomy derivation."""
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class VerdictScore(Base):
    """Seven supply properties, 1-5 each (anchors in spec Annexure C).
    Lower score = harder to trust to automation."""
    __tablename__ = "verdict_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"), unique=True)

    verifiability: Mapped[int] = mapped_column(Integer, default=1)  # V
    evidence: Mapped[int] = mapped_column(Integer, default=1)       # E
    reversibility: Mapped[int] = mapped_column(Integer, default=1)  # R
    determinism: Mapped[int] = mapped_column(Integer, default=1)    # D
    impact_scope: Mapped[int] = mapped_column(Integer, default=1)   # I
    compliance: Mapped[int] = mapped_column(Integer, default=1)     # C
    tacitness: Mapped[int] = mapped_column(Integer, default=1)      # T

    recommended_level: Mapped[int] = mapped_column(Integer, default=1)
    applied_gates: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of gate ids
    allocation: Mapped[str] = mapped_column(String(20), default="make")  # make|agent|automate|buy

    work_unit: Mapped["WorkUnit"] = relationship(back_populates="verdict")
