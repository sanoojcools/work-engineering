"""The Work Graph: dependencies between Work Units (F3)."""
import enum

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class EdgeType(str, enum.Enum):
    sequence = "sequence"              # B cannot start until A completes
    shared_object = "shared_object"    # same business object (contention)
    shared_resource = "shared_resource"  # same actor/capability
    reciprocal = "reciprocal"          # mutual outputs (iteration protocol)


class WorkEdge(Base):
    __tablename__ = "work_edges"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    target_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    edge_type: Mapped[EdgeType] = mapped_column(Enum(EdgeType), default=EdgeType.sequence)
    # Slice 2 PR 2c: why an automated detector drew this edge — Sequence
    # edges (from import dependencies[]) leave both blank; shared_object /
    # shared_resource detectors always set both.
    reason: Mapped[str] = mapped_column(Text, default="")
    detection_method: Mapped[str] = mapped_column(String(60), default="")

    source: Mapped["WorkUnit"] = relationship(back_populates="edges_out", foreign_keys=[source_id])
    target: Mapped["WorkUnit"] = relationship(back_populates="edges_in", foreign_keys=[target_id])
