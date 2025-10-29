"""
Configuration settings for the NIDS application.
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Application Info
    VERSION: str = "1.0.0"
    APP_NAME: str = "NIDS Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",  # React dev server
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ]
    
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./nids.db"
    DATABASE_ECHO: bool = False
    
    # ML Model Configuration
    MODEL_PATH: str = "./models"
    DATASET_PATH: str = "./datasets"
    
    # Feature Selection
    MAX_FEATURES: int = 20
    FEATURE_SELECTION_METHOD: str = "xgboost"
    
    # SVM Configuration
    SVM_KERNEL: str = "rbf"
    SVM_C_MIN: float = 0.1
    SVM_C_MAX: float = 100.0
    SVM_GAMMA_MIN: float = 0.001
    SVM_GAMMA_MAX: float = 1.0
    
    # XGBoost Configuration
    XGBOOST_N_ESTIMATORS: int = 100
    XGBOOST_MAX_DEPTH: int = 6
    XGBOOST_LEARNING_RATE: float = 0.1
    
    # Crow Search Algorithm Configuration
    CSA_POPULATION_SIZE: int = 20
    CSA_MAX_ITERATIONS: int = 50
    CSA_AWARENESS_PROBABILITY: float = 0.1
    CSA_FLIGHT_LENGTH: float = 2.0
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Security
    SECRET_KEY: str = "your-secret-key-here"  # Change in production
    
    # Real-time Monitoring
    WEBSOCKET_TIMEOUT: int = 60
    MAX_CONCURRENT_CONNECTIONS: int = 100
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()
