"""
API routes for the NIDS application.
"""

from fastapi import APIRouter

from app.api.endpoints import models, datasets, monitoring

api_router = APIRouter()

# Include endpoint routes
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])
