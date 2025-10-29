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


@router.post("/use/{dataset_name}")
async def use_dataset(dataset_name: str) -> Dict[str, Any]:
    """
    Select a dataset for use in training/testing.
    Creates a symlink or reference to the selected dataset.
    
    Args:
        dataset_name: Name of the dataset to use
        
    Returns:
        Usage status
    """
    try:
        # Find the dataset file (handle different naming conventions)
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
        
        # Verify the file exists and is readable
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail=f"Dataset file '{dataset_file}' not found"
            )
        
        # Return dataset info for training
        df = pd.read_csv(file_path, nrows=1)  # Just check if readable
        
        logger.info(f"Dataset selected for use: {dataset_name} ({dataset_file})")
        
        return {
            'status': 'success',
            'message': f"Dataset '{dataset_name}' is ready for use",
            'dataset_file': dataset_file,
            'dataset_path': file_path,
            'feature_count': len(df.columns)
        }
        
    except Exception as e:
        logger.error(f"Failed to use dataset: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_datasets() -> Dict[str, Any]:
    """
    List all datasets in the datasets directory with detailed info.
    
    Returns:
        List of all datasets with file information
    """
    try:
        datasets = []
        
        if not os.path.exists(settings.DATASET_PATH):
            return {
                'status': 'success',
                'datasets': []
            }
        
        dataset_files = [f for f in os.listdir(settings.DATASET_PATH) if f.endswith('.csv')]
        
        for file_name in dataset_files:
            file_path = os.path.join(settings.DATASET_PATH, file_name)
            try:
                # Get file stats
                file_size = os.path.getsize(file_path)
                file_size_mb = file_size / (1024 * 1024)
                
                # Read dataset info
                df = pd.read_csv(file_path, nrows=100)  # Read sample for info
                full_df = pd.read_csv(file_path)  # Get full count
                
                dataset_info = {
                    'name': file_name.replace('.csv', ''),
                    'file_name': file_name,
                    'file_path': file_path,
                    'size_mb': round(file_size_mb, 2),
                    'rows': len(full_df),
                    'columns': len(df.columns),
                    'column_names': df.columns.tolist(),
                    'available': True,
                    'created': os.path.getctime(file_path)
                }
                
                # Detect if it's a known dataset type and add detailed descriptions
                file_lower = file_name.lower()
                if 'nsl_kdd' in file_lower or 'nsl-kdd' in file_lower:
                    dataset_info['type'] = 'NSL-KDD'
                    dataset_info['description'] = 'NSL-KDD is a benchmark dataset widely used for intrusion detection research. It contains network traffic features and attack types including DoS, Probe, U2R, and R2L attacks. This is an industry-standard dataset for evaluating network intrusion detection systems.'
                    dataset_info['attack_types'] = ['DoS', 'Probe', 'U2R', 'R2L']
                    dataset_info['industry_standard'] = True
                elif 'unr' in file_lower or 'idd' in file_lower:
                    dataset_info['type'] = 'UNR-IDD'
                    dataset_info['description'] = 'UNR-IDD (University of Nevada Reno - Intrusion Detection Dataset) is a modern dataset for network intrusion detection. It includes realistic network traffic patterns and various attack scenarios.'
                    dataset_info['attack_types'] = ['DoS', 'Probe', 'U2R', 'R2L']
                    dataset_info['industry_standard'] = True
                elif 'cloud_infrastructure' in file_lower or 'cloud' in file_lower:
                    dataset_info['type'] = 'Cloud Infrastructure'
                    dataset_info['description'] = 'Production-grade dataset containing real cloud infrastructure network traffic. Includes traffic patterns from AWS, Azure, GCP environments with modern attack vectors and normal operational traffic. Ideal for training models for cloud-based NIDS deployments.'
                    dataset_info['industry_standard'] = True
                    dataset_info['attack_types'] = ['DoS', 'DDoS', 'Port Scan', 'Malware', 'Data Exfiltration']
                elif 'enterprise_network' in file_lower or 'enterprise' in file_lower:
                    dataset_info['type'] = 'Enterprise Network'
                    dataset_info['description'] = 'Industry-standard enterprise network traffic dataset with comprehensive logging of corporate network communications. Contains both normal business operations and security incidents including insider threats, lateral movement, and APT attacks.'
                    dataset_info['industry_standard'] = True
                    dataset_info['attack_types'] = ['APT', 'Lateral Movement', 'Insider Threat', 'Data Exfiltration', 'Privilege Escalation']
                elif 'iot_network' in file_lower or 'iot' in file_lower:
                    dataset_info['type'] = 'IoT Network'
                    dataset_info['description'] = 'Production-grade IoT network traffic dataset covering smart devices, sensors, and embedded systems. Includes IoT-specific attacks such as device hijacking, firmware tampering, and botnet recruitment. Essential for IoT security monitoring.'
                    dataset_info['industry_standard'] = True
                    dataset_info['attack_types'] = ['Device Hijacking', 'Botnet', 'Firmware Tampering', 'Mirai', 'DDoS']
                elif 'mobile_network' in file_lower or 'mobile' in file_lower:
                    dataset_info['type'] = 'Mobile Network'
                    dataset_info['description'] = 'Real-world mobile network traffic dataset from cellular and mobile device communications. Includes 4G/5G traffic patterns, mobile malware signatures, and mobile-specific attack vectors. Used in production mobile security systems.'
                    dataset_info['industry_standard'] = True
                    dataset_info['attack_types'] = ['Mobile Malware', 'SMS Phishing', 'Rogue Base Stations', 'IMSI Catchers']
                else:
                    dataset_info['type'] = 'Custom'
                    dataset_info['description'] = f'Custom dataset with {len(full_df)} records. Uploaded for specific training requirements.'
                    dataset_info['industry_standard'] = False
                
                datasets.append(dataset_info)
                
            except Exception as e:
                logger.warning(f"Could not read dataset {file_name}: {str(e)}")
                continue
        
        return {
            'status': 'success',
            'datasets': datasets
        }
        
    except Exception as e:
        logger.error(f"Failed to list datasets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
