"""Layer 0: Enterprise Ecosystem Representation — Ontology + Enterprise Graph."""
import enum

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class EntityKind(str, enum.Enum):
    business_object = "business_object"
    actor = "actor"
    capability = "capability"
    resource = "resource"
    policy = "policy"
    state = "state"


class Provenance(str, enum.Enum):
    observed = "observed"      # from traces, systems, interviews
    declared = "declared"      # from policy documents
    inferred = "inferred"      # model-generated candidate
    designed = "designed"      # newly designed during Work Engineering


class EntityType(Base):
    """Ontology: what kinds of things exist and what they mean."""
    __tablename__ = "entity_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    kind: Mapped[EntityKind] = mapped_column(Enum(EntityKind))
    description: Mapped[str] = mapped_column(Text, default="")
    # For business_object types: ordered state machine, e.g. ["draft","validated","committed","fulfilled"]
    state_machine: Mapped[str] = mapped_column(Text, default="[]")  # JSON list

    instances: Mapped[list["Entity"]] = relationship(back_populates="type")


class Entity(Base):
    """Enterprise Graph node: an instance with current state and provenance."""
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(primary_key=True)
    type_id: Mapped[int] = mapped_column(ForeignKey("entity_types.id"))
    external_ref: Mapped[str] = mapped_column(String(200), default="")  # e.g. Order#12345
    current_state: Mapped[str] = mapped_column(String(80), default="")
    provenance: Mapped[Provenance] = mapped_column(Enum(Provenance), default=Provenance.observed)

    type: Mapped[EntityType] = relationship(back_populates="instances")
    edges_out: Mapped[list["EntityEdge"]] = relationship(
        back_populates="source", foreign_keys="EntityEdge.source_id", cascade="all, delete-orphan")
    edges_in: Mapped[list["EntityEdge"]] = relationship(
        back_populates="target", foreign_keys="EntityEdge.target_id", cascade="all, delete-orphan")


class RelationKind(str, enum.Enum):
    """A2: Enterprise Graph edges are semantic or structural — not Work Graph edges."""
    semantic = "semantic"
    structural = "structural"


class EntityEdge(Base):
    """Enterprise Graph edge: how ontology instances connect (A2)."""
    __tablename__ = "entity_edges"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("entities.id"))
    target_id: Mapped[int] = mapped_column(ForeignKey("entities.id"))
    relation_type: Mapped[str] = mapped_column(String(80), default="related_to")
    kind: Mapped[RelationKind] = mapped_column(Enum(RelationKind), default=RelationKind.structural)
    provenance: Mapped[Provenance] = mapped_column(Enum(Provenance), default=Provenance.observed)

    source: Mapped[Entity] = relationship(back_populates="edges_out", foreign_keys=[source_id])
    target: Mapped[Entity] = relationship(back_populates="edges_in", foreign_keys=[target_id])
