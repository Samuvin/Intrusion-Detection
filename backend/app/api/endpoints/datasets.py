"""
Dataset management API endpoints.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, UploadFile, File
import pandas as pd
import io
import os
import logging

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/available")
async def get_available_datasets() -> Dict[str, Any]:
    """
    Get list of available sample datasets.
    
    Returns:
        List of available datasets
    """
    try:
        datasets = []
        
        # Sample datasets info
        sample_datasets = [
            {
                'name': 'NSL-KDD',
                'description': 'Benchmark intrusion detection dataset',
                'size': 'Training: 125,973 records, Testing: 22,544 records',
                'attack_types': ['DoS', 'Probe', 'U2R', 'R2L'],
                'features': 41,
                'available': False  # Will be True when dataset is present
            },
            {
                'name': 'UNR-IDD',
                'description': 'Modern intrusion detection dataset',
                'size': 'Training: 100,000+ records',
                'attack_types': ['DoS', 'Probe', 'U2R', 'R2L'],
                'features': 30,
                'available': False
            }
        ]
        
        # Check if datasets directory exists
        if os.path.exists(settings.DATASET_PATH):
            dataset_files = os.listdir(settings.DATASET_PATH)
            for dataset in sample_datasets:
                dataset_name = dataset['name'].lower().replace('-', '_')
                if any(dataset_name in f.lower() for f in dataset_files):
                    dataset['available'] = True
        
        return {
            'status': 'success',
            'datasets': sample_datasets
        }
        
    except Exception as e:
        logger.error(f"Failed to get available datasets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = "custom_dataset"
) -> Dict[str, Any]:
    """
    Upload a custom dataset.
    
    Args:
        file: CSV file containing the dataset
        name: Name for the dataset
        
    Returns:
        Upload status and dataset info
    """
    try:
        # Create datasets directory
        os.makedirs(settings.DATASET_PATH, exist_ok=True)
        
        # Read and validate dataset
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Basic validation
        if len(df) < 100:
            raise HTTPException(
                status_code=400,
                detail="Dataset must contain at least 100 samples"
            )
        
        # Save dataset
        file_path = os.path.join(settings.DATASET_PATH, f"{name}.csv")
        df.to_csv(file_path, index=False)
        
        # Get dataset info
        dataset_info = {
            'name': name,
            'shape': df.shape,
            'columns': df.columns.tolist(),
            'file_path': file_path,
            'sample_data': df.head().to_dict()
        }
        
        logger.info(f"Dataset uploaded: {name}, shape: {df.shape}")
        
        return {
            'status': 'success',
            'message': f"Dataset '{name}' uploaded successfully",
            'dataset_info': dataset_info
        }
        
    except Exception as e:
        logger.error(f"Dataset upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info/{dataset_name}")
async def get_dataset_info(dataset_name: str) -> Dict[str, Any]:
    """
    Get information about a specific dataset.
    
    Args:
        dataset_name: Name of the dataset
        
    Returns:
        Dataset information
    """
    try:
        file_path = os.path.join(settings.DATASET_PATH, f"{dataset_name}.csv")
        
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_name}' not found"
            )
        
        # Load and analyze dataset
        df = pd.read_csv(file_path)
        
        # Get basic statistics
        info = {
            'name': dataset_name,
            'shape': df.shape,
            'columns': df.columns.tolist(),
            'data_types': df.dtypes.astype(str).to_dict(),
            'missing_values': df.isnull().sum().to_dict(),
            'sample_data': df.head(5).to_dict()
        }
        
        # Get target column statistics if available
        common_target_cols = ['class', 'label', 'target', 'attack_type']
        for col in common_target_cols:
            if col in df.columns:
                info['target_column'] = col
                info['class_distribution'] = df[col].value_counts().to_dict()
                break
        
        return {
            'status': 'success',
            'dataset_info': info
        }
        
    except Exception as e:
        logger.error(f"Failed to get dataset info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{dataset_name}")
async def delete_dataset(dataset_name: str) -> Dict[str, Any]:
    """
    Delete a dataset.
    
    Args:
        dataset_name: Name of the dataset to delete
        
    Returns:
        Deletion status
    """
    try:
        file_path = os.path.join(settings.DATASET_PATH, f"{dataset_name}.csv")
        
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_name}' not found"
            )
        
        os.remove(file_path)
        
        logger.info(f"Dataset deleted: {dataset_name}")
        
        return {
            'status': 'success',
            'message': f"Dataset '{dataset_name}' deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to delete dataset: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
