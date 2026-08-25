"""Layer 1 core: the Work Unit — the 18-attribute machine-readable contract."""
import enum

from sqlalchemy import Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .ontology import Provenance


class UnitStatus(str, enum.Enum):
    draft = "draft"                # discovered/declared but unreconciled
    reconciled = "reconciled"      # discovered and declared merged
    authoritative = "authoritative"  # reconciled + verified


class ActorType(str, enum.Enum):
    human = "human"
    agent = "agent"
    deterministic = "deterministic"
    external = "external"


class AutonomyLevel(int, enum.Enum):
    L1_human_only = 1
    L2_human_led_agent_assists = 2
    L3_agent_led_human_approves = 3
    L4_agent_autonomous_human_reviews = 4
    L5_agent_autonomous_exception_only = 5
    L6_fully_deterministic = 6


class VerificationMethod(str, enum.Enum):
    """G3: seven verification methods. Independence is what makes them worth their cost."""
    deterministic_rule = "deterministic_rule"
    database_constraint = "database_constraint"
    cross_system_reconciliation = "cross_system_reconciliation"
    human_spot_check = "human_spot_check"
    llm_as_judge = "llm_as_judge"
    outcome_delay = "outcome_delay"
    counterparty_confirmation = "counterparty_confirmation"


class WorkUnit(Base):
    """The primitive. One accountable commitment to move one business object
    from a stated current condition to a stated desired condition."""
    __tablename__ = "work_units"
    __table_args__ = (UniqueConstraint("client_id", "code", name="uq_work_units_client_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))

    # 1-2: identity
    code: Mapped[str] = mapped_column(String(40))          # 1. ID
    name: Mapped[str] = mapped_column(String(200))                      # 2. Name

    # 3-5: state transition commitment
    business_object_type_id: Mapped[int] = mapped_column(ForeignKey("entity_types.id"))  # 3
    current_condition: Mapped[str] = mapped_column(String(80))          # 4. pre-state
    desired_condition: Mapped[str] = mapped_column(String(80))          # 5. post-state

    # 6-8: applicability
    context: Mapped[str] = mapped_column(Text, default="")              # 6
    trigger: Mapped[str] = mapped_column(Text, default="")              # 7
    inputs: Mapped[str] = mapped_column(Text, default="")               # 8. data required

    # 9-10: authority & execution
    authority: Mapped[str] = mapped_column(Text, default="")            # 9. who authorizes
    actor_constraints: Mapped[str] = mapped_column(Text, default="")    # 10. who/what may perform

    # 11-13: verification contract (G2: directly usable as agent eval contract)
    acceptance_criteria: Mapped[str] = mapped_column(Text, default="")  # 11
    evidence_required: Mapped[str] = mapped_column(Text, default="")    # 12
    verification_method: Mapped[VerificationMethod] = mapped_column(
        Enum(VerificationMethod), default=VerificationMethod.deterministic_rule)  # 13

    # 14-16: operations
    sla_hours: Mapped[float] = mapped_column(Float, default=0)          # 14
    failure_semantics: Mapped[str] = mapped_column(Text, default="")    # 16

    # 17: compliance (E6) — null means unregulated
    regulatory_entry_id: Mapped[int | None] = mapped_column(ForeignKey("regulatory_entries.id"), nullable=True)

    # 18: provenance (E7)
    provenance: Mapped[Provenance] = mapped_column(Enum(Provenance), default=Provenance.designed)

    # H4: accountability boundary vs execution boundary — kept separate
    owner: Mapped[str] = mapped_column(String(120), default="")         # accountable human
    actor_type: Mapped[ActorType] = mapped_column(Enum(ActorType), default=ActorType.human)

    status: Mapped[UnitStatus] = mapped_column(Enum(UnitStatus), default=UnitStatus.draft)
    autonomy_level: Mapped[int] = mapped_column(Integer, default=1)
    is_sustaining: Mapped[bool] = mapped_column(default=False)          # G5 sustaining unit

    edges_out: Mapped[list["WorkEdge"]] = relationship(
        back_populates="source", foreign_keys="WorkEdge.source_id", cascade="all, delete-orphan")
    edges_in: Mapped[list["WorkEdge"]] = relationship(
        back_populates="target", foreign_keys="WorkEdge.target_id", cascade="all, delete-orphan")
    variants: Mapped[list["WorkUnitVariant"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan")
    verdict: Mapped["VerdictScore"] = relationship(
        back_populates="work_unit", uselist=False, cascade="all, delete-orphan")
    cost_profile: Mapped["CostProfile"] = relationship(
        back_populates="work_unit", uselist=False, cascade="all, delete-orphan")
    business_object_type: Mapped["EntityType"] = relationship()
    regulatory_entry: Mapped["RegulatoryEntry"] = relationship()
    client: Mapped["Client"] = relationship(back_populates="work_units")


class WorkUnitVariant(Base):
    """E5: variants share the core contract, differ in context/authority/verification."""
    __tablename__ = "work_unit_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    name: Mapped[str] = mapped_column(String(200))
    overrides: Mapped[str] = mapped_column(Text, default="{}")  # JSON patch of contract fields

    parent: Mapped[WorkUnit] = relationship(back_populates="variants")
