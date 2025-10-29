"""
Model management API endpoints.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
import pandas as pd
import io
import logging

from app.ml.model_manager import ModelManager
from app.core.dependencies import get_model_manager
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/train-from-dataset")
async def train_model_from_dataset(
    dataset_name: str = Form(...),
    target_column: str = Form("class"),
    optimize_hyperparameters: bool = Form(True),
    model_manager: ModelManager = Depends(get_model_manager)
) -> Dict[str, Any]:
    """
    Train the hybrid NIDS model using a dataset by name.
    
    Args:
        dataset_name: Name of the dataset in the datasets folder
        target_column: Name of the target column (default: 'class')
        optimize_hyperparameters: Whether to run CSA optimization
        model_manager: Model manager instance
        
    Returns:
        Training results and performance metrics
    """
    from app.core.config import settings
    import os
    
    try:
        # Find the dataset file
        dataset_name_normalized = dataset_name.lower().replace('-', '_')
        dataset_files = os.listdir(settings.DATASET_PATH) if os.path.exists(settings.DATASET_PATH) else []
        
        dataset_file = None
        for f in dataset_files:
            if dataset_name_normalized in f.lower() and f.endswith('.csv'):
                dataset_file = f
                break
        
        if not dataset_file:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_name}' not found. Please upload it first."
            )
        
        file_path = os.path.join(settings.DATASET_PATH, dataset_file)
        
        # Read dataset
        df = pd.read_csv(file_path)
        
        logger.info(f"Training model with dataset: {dataset_file}, shape: {df.shape}")
        
        # Validate dataset
        if target_column not in df.columns:
            # Try common target column names
            common_targets = ['class', 'label', 'target', 'attack_type', 'type']
            found_target = None
            for col in common_targets:
                if col in df.columns:
                    found_target = col
                    break
            
            if found_target:
                target_column = found_target
                logger.info(f"Using target column '{target_column}' instead")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Target column '{target_column}' not found. Available columns: {', '.join(df.columns[:10])}"
                )
        
        # Train model
        results = await model_manager.train_model(
            data=df,
            target_column=target_column,
            optimize_hyperparameters=optimize_hyperparameters,
            dataset_name=dataset_name  # Pass dataset name to track it
        )
        
        if results['status'] == 'error':
            raise HTTPException(status_code=500, detail=results['message'])
        
        logger.info(f"Model training completed: {results.get('status')}")
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train")
async def train_model(
    dataset: UploadFile = File(...),
    target_column: str = Form("class"),
    optimize_hyperparameters: bool = Form(True),
    model_manager: ModelManager = Depends(get_model_manager)
) -> Dict[str, Any]:
    """
    Train the hybrid NIDS model.
    
    Args:
        dataset: CSV file containing the training dataset
        target_column: Name of the target column (default: 'class')
        optimize_hyperparameters: Whether to run CSA optimization
        model_manager: Model manager instance
        
    Returns:
        Training results and performance metrics
    """
    try:
        # Read uploaded dataset
        contents = await dataset.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        logger.info(f"Training model with dataset shape: {df.shape}")
        
        # Validate dataset
        if target_column not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Target column '{target_column}' not found in dataset"
            )
        
        # Train model
        results = await model_manager.train_model(
            data=df,
            target_column=target_column,
            optimize_hyperparameters=optimize_hyperparameters
        )
        
        if results['status'] == 'error':
            raise HTTPException(status_code=500, detail=results['message'])
        
        return results
        
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict")
async def predict(
    data: UploadFile = File(...),
    model_manager: ModelManager = Depends(get_model_manager)
) -> Dict[str, Any]:
    """
    Make predictions on new data.
    
    Args:
        data: CSV file containing data for prediction
        model_manager: Model manager instance
        
    Returns:
        Prediction results
    """
    try:
        # Read uploaded data
        contents = await data.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        logger.info(f"Making predictions on data shape: {df.shape}")
        
        # Make predictions
        results = await model_manager.predict(df)
        
        return {
            'status': 'success',
            'predictions': results['predictions'],
            'probabilities': results['probabilities'],
            'attack_summary': results['attack_types'],
            'total_samples': len(df)
        }
        
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info")
async def get_model_info(
    model_manager: ModelManager = Depends(get_model_manager)
) -> Dict[str, Any]:
    """
    Get information about the current model.
    
    Args:
        model_manager: Model manager instance
        
    Returns:
        Model information and status
    """
    try:
        info = await model_manager.get_model_info()
        return {
            'status': 'success',
            'model_info': info
        }
        
    except Exception as e:
        logger.error(f"Failed to get model info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/load")
async def load_model(
    model_path: Optional[str] = None,
    model_manager: ModelManager = Depends(get_model_manager)
) -> Dict[str, Any]:
    """
    Load a pre-trained model.
    
    Args:
        model_path: Optional path to model file
        model_manager: Model manager instance
        
    Returns:
        Load status
    """
    try:
        success = await model_manager.load_model(model_path)
        
        if success:
            return {
                'status': 'success',
                'message': 'Model loaded successfully'
            }
        else:
            return {
                'status': 'error',
                'message': 'Failed to load model'
            }
            
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
