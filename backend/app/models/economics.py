"""H5-H7: cost to do, cost to verify, exceptions, ontology maintenance."""
from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class CostProfile(Base):
    """Per-unit economics. All costs in hours per month unless noted."""
    __tablename__ = "cost_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"), unique=True)

    executions_per_month: Mapped[float] = mapped_column(Float, default=0)
    minutes_per_execution: Mapped[float] = mapped_column(Float, default=0)

    # Discipline 1: cost to verify (often 30-60% of total)
    verification_minutes: Mapped[float] = mapped_column(Float, default=0)
    # Discipline 2: exception handling
    failure_rate: Mapped[float] = mapped_column(Float, default=0)        # 0..1
    exception_minutes: Mapped[float] = mapped_column(Float, default=0)   # per failure
    # Discipline 3: ontology/contract maintenance (hours per month for this unit)
    maintenance_hours: Mapped[float] = mapped_column(Float, default=0)
    # Discipline 4: attribution credibility — fraction of time directly attributable
    attribution_confidence: Mapped[float] = mapped_column(Float, default=1.0)  # 0..1

    work_unit: Mapped["WorkUnit"] = relationship(back_populates="cost_profile")
