"""
Dependency injection for FastAPI application.
"""

from fastapi import Depends, Request
from app.ml.model_manager import ModelManager

# Global model manager instance
_model_manager = None


def get_model_manager(request: Request = None) -> ModelManager:
    """
    Dependency to get the model manager from application state.
    
    Args:
        request: FastAPI request object (optional)
        
    Returns:
        ModelManager instance
    """
    global _model_manager
    
    if request and hasattr(request.app.state, 'model_manager'):
        return request.app.state.model_manager
    
    # Fallback to global singleton
    if _model_manager is None:
        _model_manager = ModelManager()
    
    return _model_manager
