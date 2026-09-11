"""V10-13 (docs/contracts/v10-13-simulator.md): GET /api/simulations/offer-day1."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from ..dependencies import TenantDbDep
from ..schemas.simulator import SimulationOut
from ..services import simulator as simulator_svc

router = APIRouter()


@router.get("/offer-day1", response_model=SimulationOut)
def offer_day1(
    db: TenantDbDep,
    scenario: str = Query(default=simulator_svc.DEFAULT_SCENARIO),
) -> SimulationOut:
    try:
        resolved = simulator_svc.resolve_scenario(scenario)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    return simulator_svc.build_simulation(db, resolved)
