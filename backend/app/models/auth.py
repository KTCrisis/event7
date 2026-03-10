"""
User authentication context models.

Placement: backend/app/models/auth.py
"""

from uuid import UUID
from pydantic import BaseModel


class UserContext(BaseModel):
    """Authenticated user context extracted from Supabase JWT."""
    user_id: UUID
    email: str | None = None
    role: str = "authenticated"