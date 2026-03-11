"""Hosted Registry routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field
from app.models.auth import UserContext
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/registries/hosted", tags=["hosted"])

class HostedRegistryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    environment: str = Field(default="DEV")

@router.post("", status_code=201)
async def create_hosted_registry(payload: HostedRegistryCreate, user: UserContext = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="Hosted registries are coming soon.")

@router.delete("/{registry_id}", status_code=204)
async def delete_hosted_registry(registry_id: str, user: UserContext = Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="Not yet implemented.")
