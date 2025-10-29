"""
Dataset loader for NSL-KDD and UNR-IDD datasets.
"""

import pandas as pd
import numpy as np
import os
from typing import Dict, Any, Tuple, Optional, List
from pathlib import Path
import logging

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class DatasetLoader:
    """
    Loads and preprocesses intrusion detection datasets.
    Supports NSL-KDD and UNR-IDD formats.
    """
    
    def __init__(self):
        """Initialize dataset loader."""
        self.dataset_path = Path(settings.DATASET_PATH)
        self.dataset_path.mkdir(exist_ok=True)
        
        # NSL-KDD feature names
        self.nsl_kdd_features = [
            'duration', 'protocol_type', 'service', 'flag', 'src_bytes', 'dst_bytes',
            'land', 'wrong_fragment', 'urgent', 'hot', 'num_failed_logins',
            'logged_in', 'num_compromised', 'root_shell', 'su_attempted', 'num_root',
            'num_file_creations', 'num_shells', 'num_access_files', 'num_outbound_cmds',
            'is_host_login', 'is_guest_login', 'count', 'srv_count', 'serror_rate',
            'srv_serror_rate', 'rerror_rate', 'srv_rerror_rate', 'same_srv_rate',
            'diff_srv_rate', 'srv_diff_host_rate', 'dst_host_count', 'dst_host_srv_count',
            'dst_host_same_srv_rate', 'dst_host_diff_srv_rate', 'dst_host_same_src_port_rate',
            'dst_host_srv_diff_host_rate', 'dst_host_serror_rate', 'dst_host_srv_serror_rate',
            'dst_host_rerror_rate', 'dst_host_srv_rerror_rate', 'class'
        ]
        
        logger.info("Dataset loader initialized")
    
    def load_nsl_kdd(self, train_file: str = None, test_file: str = None) -> Dict[str, pd.DataFrame]:
        """
        Load NSL-KDD dataset.
        
        Args:
            train_file: Path to training file
            test_file: Path to test file
            
        Returns:
            Dictionary containing train and test DataFrames
        """
        try:
            datasets = {}
            
            # Default file paths
            if train_file is None:
                train_file = self.dataset_path / "nsl_kdd_train.csv"
            if test_file is None:
                test_file = self.dataset_path / "nsl_kdd_test.csv"
            
            # Load training data if exists
            if os.path.exists(train_file):
                logger.info(f"Loading NSL-KDD training data from {train_file}")
                datasets['train'] = pd.read_csv(train_file, names=self.nsl_kdd_features)
                logger.info(f"Loaded training data: {datasets['train'].shape}")
            else:
                logger.warning(f"Training file not found: {train_file}")
                datasets['train'] = self._create_sample_nsl_kdd()
            
            # Load test data if exists
            if os.path.exists(test_file):
                logger.info(f"Loading NSL-KDD test data from {test_file}")
                datasets['test'] = pd.read_csv(test_file, names=self.nsl_kdd_features)
                logger.info(f"Loaded test data: {datasets['test'].shape}")
            else:
                logger.warning(f"Test file not found: {test_file}")
                datasets['test'] = self._create_sample_nsl_kdd(is_test=True)
            
            return datasets
            
        except Exception as e:
            logger.error(f"Failed to load NSL-KDD dataset: {str(e)}")
            raise RuntimeError(f"NSL-KDD loading failed: {str(e)}")
    
    def load_unr_idd(self, file_path: str = None) -> pd.DataFrame:
        """
        Load UNR-IDD dataset.
        
        Args:
            file_path: Path to UNR-IDD file
            
        Returns:
            UNR-IDD DataFrame
        """
        try:
            if file_path is None:
                file_path = self.dataset_path / "unr_idd.csv"
            
            if os.path.exists(file_path):
                logger.info(f"Loading UNR-IDD data from {file_path}")
                df = pd.read_csv(file_path)
                logger.info(f"Loaded UNR-IDD data: {df.shape}")
                return df
            else:
                logger.warning(f"UNR-IDD file not found: {file_path}")
                return self._create_sample_unr_idd()
                
        except Exception as e:
            logger.error(f"Failed to load UNR-IDD dataset: {str(e)}")
            raise RuntimeError(f"UNR-IDD loading failed: {str(e)}")
    
    def preprocess_dataset(self, df: pd.DataFrame, dataset_type: str = 'nsl_kdd') -> pd.DataFrame:
        """
        Preprocess dataset for ML training.
        
        Args:
            df: Raw dataset
            dataset_type: Type of dataset ('nsl_kdd' or 'unr_idd')
            
        Returns:
            Preprocessed DataFrame
        """
        logger.info(f"Preprocessing {dataset_type} dataset: {df.shape}")
        
        try:
            df_processed = df.copy()
            
            if dataset_type == 'nsl_kdd':
                df_processed = self._preprocess_nsl_kdd(df_processed)
            elif dataset_type == 'unr_idd':
                df_processed = self._preprocess_unr_idd(df_processed)
            else:
                raise ValueError(f"Unknown dataset type: {dataset_type}")
            
            logger.info(f"Preprocessing completed: {df_processed.shape}")
            return df_processed
            
        except Exception as e:
            logger.error(f"Preprocessing failed: {str(e)}")
            raise RuntimeError(f"Preprocessing failed: {str(e)}")
    
    def _preprocess_nsl_kdd(self, df: pd.DataFrame) -> pd.DataFrame:
        """Preprocess NSL-KDD specific format."""
        # Handle missing values
        df = df.dropna()
        
        # Encode categorical features
        categorical_features = ['protocol_type', 'service', 'flag']
        for feature in categorical_features:
            if feature in df.columns:
                df = pd.get_dummies(df, columns=[feature], drop_first=True)
        
        # Normalize attack labels
        if 'class' in df.columns:
            df['class'] = df['class'].apply(self._normalize_attack_label)
        
        return df
    
    def _preprocess_unr_idd(self, df: pd.DataFrame) -> pd.DataFrame:
        """Preprocess UNR-IDD specific format."""
        # Handle missing values
        df = df.dropna()
        
        # Encode categorical features (assuming similar structure)
        categorical_columns = df.select_dtypes(include=['object']).columns
        for col in categorical_columns:
            if col != 'class' and col != 'label':  # Preserve target column
                df = pd.get_dummies(df, columns=[col], drop_first=True)
        
        return df
    
    def _normalize_attack_label(self, label: str) -> str:
        """
        Normalize attack labels to standard categories.
        
        Args:
            label: Original attack label
            
        Returns:
            Normalized attack category
        """
        label = label.lower().strip()
        
        # Normal traffic
        if label == 'normal':
            return 'normal'
        
        # DoS attacks
        dos_attacks = ['back', 'land', 'neptune', 'pod', 'smurf', 'teardrop']
        if label in dos_attacks:
            return 'dos'
        
        # Probe attacks
        probe_attacks = ['ipsweep', 'nmap', 'portsweep', 'satan']
        if label in probe_attacks:
            return 'probe'
        
        # U2R attacks
        u2r_attacks = ['buffer_overflow', 'loadmodule', 'perl', 'rootkit']
        if label in u2r_attacks:
            return 'u2r'
        
        # R2L attacks
        r2l_attacks = ['ftp_write', 'guess_passwd', 'imap', 'multihop', 'phf', 'spy', 'warezclient', 'warezmaster']
        if label in r2l_attacks:
            return 'r2l'
        
        # Default to original label if not recognized
        return label
    
    def _create_sample_nsl_kdd(self, is_test: bool = False) -> pd.DataFrame:
        """Create sample NSL-KDD data for demonstration."""
        np.random.seed(42 if not is_test else 43)
        
        n_samples = 1000 if not is_test else 300
        
        # Generate synthetic data with realistic patterns
        data = {
            'duration': np.random.exponential(10, n_samples),
            'protocol_type': np.random.choice(['tcp', 'udp', 'icmp'], n_samples, p=[0.7, 0.2, 0.1]),
            'service': np.random.choice(['http', 'ftp', 'smtp', 'ssh', 'telnet'], n_samples),
            'flag': np.random.choice(['SF', 'S0', 'REJ', 'RSTO'], n_samples, p=[0.6, 0.2, 0.1, 0.1]),
            'src_bytes': np.random.lognormal(5, 2, n_samples),
            'dst_bytes': np.random.lognormal(4, 2, n_samples),
            'land': np.random.choice([0, 1], n_samples, p=[0.95, 0.05]),
            'wrong_fragment': np.random.poisson(0.1, n_samples),
            'urgent': np.random.poisson(0.05, n_samples),
            'hot': np.random.poisson(0.2, n_samples),
            'num_failed_logins': np.random.poisson(0.1, n_samples),
            'logged_in': np.random.choice([0, 1], n_samples, p=[0.3, 0.7]),
            'num_compromised': np.random.poisson(0.05, n_samples),
            'root_shell': np.random.choice([0, 1], n_samples, p=[0.98, 0.02]),
            'su_attempted': np.random.choice([0, 1], n_samples, p=[0.99, 0.01]),
            'num_root': np.random.poisson(0.1, n_samples),
            'num_file_creations': np.random.poisson(0.5, n_samples),
            'num_shells': np.random.poisson(0.1, n_samples),
            'num_access_files': np.random.poisson(0.2, n_samples),
            'num_outbound_cmds': np.random.poisson(0.01, n_samples),
            'is_host_login': np.random.choice([0, 1], n_samples, p=[0.9, 0.1]),
            'is_guest_login': np.random.choice([0, 1], n_samples, p=[0.95, 0.05]),
            'count': np.random.randint(1, 500, n_samples),
            'srv_count': np.random.randint(1, 500, n_samples),
            'serror_rate': np.random.beta(1, 10, n_samples),
            'srv_serror_rate': np.random.beta(1, 10, n_samples),
            'rerror_rate': np.random.beta(1, 10, n_samples),
            'srv_rerror_rate': np.random.beta(1, 10, n_samples),
            'same_srv_rate': np.random.beta(5, 2, n_samples),
            'diff_srv_rate': np.random.beta(2, 5, n_samples),
            'srv_diff_host_rate': np.random.beta(2, 5, n_samples),
            'dst_host_count': np.random.randint(1, 256, n_samples),
            'dst_host_srv_count': np.random.randint(1, 256, n_samples),
            'dst_host_same_srv_rate': np.random.beta(5, 2, n_samples),
            'dst_host_diff_srv_rate': np.random.beta(2, 5, n_samples),
            'dst_host_same_src_port_rate': np.random.beta(3, 3, n_samples),
            'dst_host_srv_diff_host_rate': np.random.beta(2, 5, n_samples),
            'dst_host_serror_rate': np.random.beta(1, 10, n_samples),
            'dst_host_srv_serror_rate': np.random.beta(1, 10, n_samples),
            'dst_host_rerror_rate': np.random.beta(1, 10, n_samples),
            'dst_host_srv_rerror_rate': np.random.beta(1, 10, n_samples),
        }
        
        # Generate realistic class distribution
        classes = np.random.choice(
            ['normal', 'dos', 'probe', 'u2r', 'r2l'],
            n_samples,
            p=[0.6, 0.25, 0.1, 0.025, 0.025]
        )
        data['class'] = classes
        
        df = pd.DataFrame(data)
        
        # Save sample data
        filename = f"sample_nsl_kdd_{'test' if is_test else 'train'}.csv"
        filepath = self.dataset_path / filename
        df.to_csv(filepath, index=False)
        logger.info(f"Created sample NSL-KDD data: {filepath}")
        
        return df
    
    def _create_sample_unr_idd(self) -> pd.DataFrame:
        """Create sample UNR-IDD data for demonstration."""
        np.random.seed(44)
        n_samples = 800
        
        # Generate synthetic UNR-IDD style data
        data = {
            'flow_duration': np.random.exponential(15, n_samples),
            'total_fwd_packets': np.random.poisson(10, n_samples),
            'total_backward_packets': np.random.poisson(8, n_samples),
            'total_length_fwd_packets': np.random.lognormal(6, 1.5, n_samples),
            'total_length_bwd_packets': np.random.lognormal(5, 1.5, n_samples),
            'fwd_packet_length_max': np.random.gamma(2, 100, n_samples),
            'fwd_packet_length_min': np.random.gamma(1, 20, n_samples),
            'fwd_packet_length_mean': np.random.normal(200, 50, n_samples),
            'fwd_packet_length_std': np.random.gamma(2, 30, n_samples),
            'bwd_packet_length_max': np.random.gamma(2, 80, n_samples),
            'bwd_packet_length_min': np.random.gamma(1, 15, n_samples),
            'bwd_packet_length_mean': np.random.normal(150, 40, n_samples),
            'bwd_packet_length_std': np.random.gamma(2, 25, n_samples),
            'flow_bytes_per_s': np.random.lognormal(8, 2, n_samples),
            'flow_packets_per_s': np.random.gamma(2, 5, n_samples),
            'flow_iat_mean': np.random.exponential(100, n_samples),
            'flow_iat_std': np.random.gamma(2, 50, n_samples),
            'flow_iat_max': np.random.gamma(3, 200, n_samples),
            'flow_iat_min': np.random.exponential(5, n_samples),
            'fwd_iat_total': np.random.gamma(2, 100, n_samples),
            'fwd_iat_mean': np.random.exponential(80, n_samples),
            'fwd_iat_std': np.random.gamma(2, 40, n_samples),
            'fwd_iat_max': np.random.gamma(3, 150, n_samples),
            'fwd_iat_min': np.random.exponential(3, n_samples),
            'bwd_iat_total': np.random.gamma(2, 80, n_samples),
            'bwd_iat_mean': np.random.exponential(60, n_samples),
            'bwd_iat_std': np.random.gamma(2, 30, n_samples),
            'bwd_iat_max': np.random.gamma(3, 120, n_samples),
            'bwd_iat_min': np.random.exponential(2, n_samples)
        }
        
        # Generate class labels
        classes = np.random.choice(
            ['normal', 'dos', 'probe', 'u2r', 'r2l'],
            n_samples,
            p=[0.65, 0.2, 0.1, 0.025, 0.025]
        )
        data['class'] = classes
        
        df = pd.DataFrame(data)
        
        # Save sample data
        filepath = self.dataset_path / "sample_unr_idd.csv"
        df.to_csv(filepath, index=False)
        logger.info(f"Created sample UNR-IDD data: {filepath}")
        
        return df
    
    def get_dataset_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Get comprehensive statistics about a dataset.
        
        Args:
            df: Dataset to analyze
            
        Returns:
            Dataset statistics
        """
        try:
            stats = {
                'shape': df.shape,
                'columns': df.columns.tolist(),
                'dtypes': df.dtypes.astype(str).to_dict(),
                'missing_values': df.isnull().sum().to_dict(),
                'memory_usage': df.memory_usage(deep=True).sum(),
                'numeric_stats': df.describe().to_dict(),
            }
            
            # Class distribution if available
            if 'class' in df.columns:
                stats['class_distribution'] = df['class'].value_counts().to_dict()
                stats['class_balance'] = df['class'].value_counts(normalize=True).to_dict()
            
            # Categorical feature info
            categorical_cols = df.select_dtypes(include=['object']).columns
            stats['categorical_features'] = {
                col: df[col].unique().tolist()[:10]  # First 10 unique values
                for col in categorical_cols
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to generate dataset statistics: {str(e)}")
            return {'error': str(e)}
