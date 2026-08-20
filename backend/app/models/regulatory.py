"""E6: Regulatory Register. A compliance score without a register entry is an opinion."""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class RegulatoryEntry(Base):
    __tablename__ = "regulatory_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    regulation: Mapped[str] = mapped_column(String(200))       # e.g. "SOX", "GDPR"
    clause: Mapped[str] = mapped_column(String(200))           # e.g. "Article 32"
    control_objective: Mapped[str] = mapped_column(Text)       # what the control must achieve
    requires_licensed_human: Mapped[bool] = mapped_column(default=False)
