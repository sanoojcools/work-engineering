from fastapi import APIRouter

from . import (
    admin,
    discovery,
    economics,
    health,
    ontology,
    projections,
    regulatory,
    spec,
    verification,
    verdict,
    work_graph,
    work_units,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(ontology.router, prefix="/ontology", tags=["ontology"])
api_router.include_router(work_units.router, prefix="/work-units", tags=["work-units"])
api_router.include_router(work_graph.router, prefix="/work-graph", tags=["work-graph"])
api_router.include_router(verdict.router, prefix="/verdict", tags=["verdict"])
api_router.include_router(economics.router, prefix="/economics", tags=["economics"])
api_router.include_router(regulatory.router, prefix="/regulatory", tags=["regulatory"])
api_router.include_router(discovery.router, prefix="/discovery", tags=["discovery"])
api_router.include_router(verification.router, prefix="/verification", tags=["verification"])
api_router.include_router(spec.router, prefix="/spec", tags=["spec"])
api_router.include_router(projections.router, prefix="/projections", tags=["projections"])
