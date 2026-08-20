"""C4 + A4 + G6: spec consumption by execution systems. Work Engineering does not execute."""
import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .workunit import ActorType


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CheckType(str, enum.Enum):
    authority = "authority"
    evidence = "evidence"
    condition = "condition"
    acceptance = "acceptance"


class SpecCheckResult(str, enum.Enum):
    allowed = "allowed"
    denied = "denied"


class SpecCheck(Base):
    """Enforcement Gateway call from an execution system (G6: governance by construction)."""
    __tablename__ = "spec_checks"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    check_type: Mapped[CheckType] = mapped_column(Enum(CheckType), default=CheckType.authority)
    result: Mapped[SpecCheckResult] = mapped_column(
        Enum(SpecCheckResult), default=SpecCheckResult.denied)
    reason: Mapped[str] = mapped_column(Text, default="")
    caller: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()


class Trajectory(Base):
    """Execution Layer 3: observability and trajectory audit. Logged here, judged later."""
    __tablename__ = "trajectories"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    actor_type: Mapped[ActorType] = mapped_column(Enum(ActorType), default=ActorType.agent)
    actor_ref: Mapped[str] = mapped_column(String(120), default="")
    steps: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of steps
    llm_judge_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    flagged: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()
