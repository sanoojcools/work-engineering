from fastapi import APIRouter

from . import (
    admin,
    census,
    censuses,
    clients,
    consent,
    discovery,
    economics,
    evidence,
    field_ratifications,
    files,
    genome,
    health,
    moderation,
    ontology,
    org,
    outcome,
    pointers,
    projections,
    regulatory,
    scout,
    spec,
    verification,
    verification_design,
    verdict,
    work_graph,
    work_systems,
    work_units,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(genome.router, prefix="/genome", tags=["genome"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(census.router, prefix="/census", tags=["census"])
api_router.include_router(censuses.router, prefix="/censuses", tags=["censuses"])
api_router.include_router(ontology.router, prefix="/ontology", tags=["ontology"])
api_router.include_router(work_units.router, prefix="/work-units", tags=["work-units"])
api_router.include_router(pointers.router, prefix="/work-units", tags=["pointers"])
api_router.include_router(field_ratifications.router, prefix="/work-units", tags=["field-ratifications"])
api_router.include_router(verification_design.router, prefix="/work-units", tags=["verification-design"])
api_router.include_router(work_graph.router, prefix="/work-graph", tags=["work-graph"])
api_router.include_router(verdict.router, prefix="/verdict", tags=["verdict"])
api_router.include_router(economics.router, prefix="/economics", tags=["economics"])
api_router.include_router(regulatory.router, prefix="/regulatory", tags=["regulatory"])
api_router.include_router(discovery.router, prefix="/discovery", tags=["discovery"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["evidence"])
api_router.include_router(verification.router, prefix="/verification", tags=["verification"])
api_router.include_router(spec.router, prefix="/spec", tags=["spec"])
api_router.include_router(projections.router, prefix="/projections", tags=["projections"])
api_router.include_router(org.router, prefix="/org", tags=["org"])
api_router.include_router(consent.router, prefix="/consent", tags=["consent"])
api_router.include_router(scout.router, prefix="/scout", tags=["scout"])
api_router.include_router(work_systems.router, prefix="/work-systems", tags=["work-systems"])
api_router.include_router(outcome.router, prefix="/work-systems", tags=["outcome"])
api_router.include_router(moderation.router, prefix="/moderation", tags=["moderation"])
