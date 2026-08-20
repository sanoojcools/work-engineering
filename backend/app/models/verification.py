"""G3–G4: verification runs, and the promotion/demotion ladder."""
import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .workunit import VerificationMethod


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class VerificationOutcome(str, enum.Enum):
    passed = "passed"
    failed = "failed"
    inconclusive = "inconclusive"


class VerificationRun(Base):
    """One check of a Work Unit against its contract (G3)."""
    __tablename__ = "verification_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    method: Mapped[VerificationMethod] = mapped_column(Enum(VerificationMethod))
    independent: Mapped[bool] = mapped_column(default=True)
    outcome: Mapped[VerificationOutcome] = mapped_column(
        Enum(VerificationOutcome), default=VerificationOutcome.inconclusive)
    evidence_ref: Mapped[str] = mapped_column(String(200), default="")
    actor_ref: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    ran_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()


class ChangeKind(str, enum.Enum):
    promotion = "promotion"  # human decision (G4)
    demotion = "demotion"    # automatic (G4)


class AutonomyChange(Base):
    """Audit trail for the autonomy ladder. Promotion needs a human; demotion does not."""
    __tablename__ = "autonomy_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    kind: Mapped[ChangeKind] = mapped_column(Enum(ChangeKind))
    from_level: Mapped[int] = mapped_column(Integer)
    to_level: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text, default="")
    approved_by: Mapped[str] = mapped_column(String(120), default="")  # empty on automatic demotion
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()
