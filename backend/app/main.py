"""
Main FastAPI application entry point for NIDS backend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.api.routes import api_router
from app.core.config import settings
from app.core.logging import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting NIDS Backend Application")
    logger.info(f"Version: {settings.VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    # Initialize ML models on startup
    try:
        from app.ml.model_manager import ModelManager
        model_manager = ModelManager()
        app.state.model_manager = model_manager
        
        # Try to auto-load pre-trained model
        # Resolve model path relative to backend directory
        if not os.path.isabs(settings.MODEL_PATH):
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_dir = os.path.join(backend_dir, settings.MODEL_PATH.lstrip('./'))
        else:
            model_dir = settings.MODEL_PATH
        
        default_model_path = os.path.join(model_dir, 'nids_model.pkl')
        if os.path.exists(default_model_path):
            try:
                result = await model_manager.load_model(default_model_path)
                if result:
                    logger.info(f"Pre-trained model auto-loaded successfully from {default_model_path}")
                else:
                    logger.info("Pre-trained model file exists but failed to load")
            except Exception as e:
                logger.warning(f"Failed to auto-load pre-trained model: {str(e)}")
        
        logger.info("ML Model Manager initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize ML models: {e}")
        raise
    
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down NIDS Backend Application")


# Create FastAPI application
app = FastAPI(
    title="Network Intrusion Detection System API",
    description="Hybrid ML-based NIDS using SVM + XGBoost with Crow Search Algorithm optimization",
    version=settings.VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Network Intrusion Detection System API",
        "version": settings.VERSION,
        "docs_url": "/api/docs"
    }
