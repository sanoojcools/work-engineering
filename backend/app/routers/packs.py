"""D-1: Pack endpoints. Hard-anchors are a published constant (YAML in
packs/hr/), not tenant data or LLM-generated content -- unauthenticated read."""
from __future__ import annotations

import json
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("/hr/hard-anchors")
def get_hard_anchors() -> dict:
    """D-1: GET hard anchors pack. Returns YAML as JSON. Can be
    unauthenticated read (no tenant data, no LLM content -- published
    constant from packs/hr/hard_anchors.yaml)."""
    pack_path = Path(__file__).parent.parent.parent.parent / "packs" / "hr" / "hard_anchors.yaml"
    if not pack_path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hard anchors pack not found")

    with open(pack_path, "r") as f:
        data = yaml.safe_load(f)

    return data
