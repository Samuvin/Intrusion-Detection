"""
Model Manager for handling ML model lifecycle and predictions.
"""

import logging
import pickle
import os
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib

from app.core.config import settings
from app.ml.hybrid_classifier import HybridNIDSClassifier
from app.ml.crow_search import CrowSearchOptimizer
from app.ml.feature_selector import XGBoostFeatureSelector
from app.core.logging import get_logger

logger = get_logger(__name__)


class ModelManager:
    """
    Manages ML model lifecycle including training, optimization, and prediction.
    """
    
    def __init__(self):
        """Initialize Model Manager."""
        self.hybrid_classifier = None
        self.feature_selector = None
        self.csa_optimizer = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.feature_names = []
        self.is_trained = False
        
        # Create model directory
        os.makedirs(settings.MODEL_PATH, exist_ok=True)
        
        logger.info("Model Manager initialized")
    
    async def train_model(
        self,
        data: pd.DataFrame,
        target_column: str = 'class',
        optimize_hyperparameters: bool = True
    ) -> Dict[str, Any]:
        """
        Train the hybrid NIDS model.
        
        Args:
            data: Training dataset
            target_column: Name of the target column
            optimize_hyperparameters: Whether to run CSA optimization
            
        Returns:
            Training results and performance metrics
        """
        logger.info("Starting model training")
        
        try:
            # Prepare data
            X, y = self._prepare_data(data, target_column)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.3, random_state=42, stratify=y
            )
            
            # Feature selection
            logger.info("Performing feature selection")
            self.feature_selector = XGBoostFeatureSelector(
                n_features=settings.MAX_FEATURES
            )
            X_train_selected = self.feature_selector.fit_transform(X_train, y_train)
            X_test_selected = self.feature_selector.transform(X_test)
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train_selected)
            X_test_scaled = self.scaler.transform(X_test_selected)
            
            # Initialize hybrid classifier
            self.hybrid_classifier = HybridNIDSClassifier()
            
            # Hyperparameter optimization
            best_params = None
            if optimize_hyperparameters:
                try:
                    logger.info("Starting hyperparameter optimization with CSA")
                    self.csa_optimizer = CrowSearchOptimizer(
                        population_size=min(10, settings.CSA_POPULATION_SIZE),  # Reduce for faster testing
                        max_iterations=min(10, settings.CSA_MAX_ITERATIONS)      # Reduce for faster testing
                    )
                    best_params = self.csa_optimizer.optimize(
                        X_train_scaled, y_train, self.hybrid_classifier
                    )
                    logger.info(f"Best parameters found: {best_params}")
                except Exception as e:
                    logger.error(f"CSA optimization failed: {str(e)}")
                    logger.info("Falling back to default parameters")
                    best_params = None
            
            # Train model
            self.hybrid_classifier.fit(
                X_train_scaled, y_train, best_params=best_params
            )
            
            # Evaluate model
            y_pred = self.hybrid_classifier.predict(X_test_scaled)
            
            # Calculate metrics
            metrics = {
                'accuracy': accuracy_score(y_test, y_pred),
                'precision': precision_score(y_test, y_pred, average='weighted'),
                'recall': recall_score(y_test, y_pred, average='weighted'),
                'f1_score': f1_score(y_test, y_pred, average='weighted'),
                'selected_features': self.feature_selector.get_selected_features(),
                'feature_importance': self.feature_selector.get_feature_importance(),
                'best_hyperparameters': best_params or {}
            }
            
            self.is_trained = True
            logger.info(f"Model training completed. Accuracy: {metrics['accuracy']:.4f}")
            
            # Save model
            await self._save_model()
            
            return {
                'status': 'success',
                'metrics': metrics,
                'training_samples': len(X_train),
                'test_samples': len(X_test)
            }
            
        except Exception as e:
            logger.error(f"Model training failed: {str(e)}")
            return {
                'status': 'error',
                'message': str(e)
            }
    
    async def predict(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Make predictions on new data.
        
        Args:
            data: Input data for prediction
            
        Returns:
            Prediction results
        """
        if not self.is_trained:
            raise ValueError("Model is not trained. Please train the model first.")
        
        try:
            # Prepare data
            X = self._prepare_prediction_data(data)
            
            # Apply feature selection and scaling
            X_selected = self.feature_selector.transform(X)
            X_scaled = self.scaler.transform(X_selected)
            
            # Make predictions
            predictions = self.hybrid_classifier.predict(X_scaled)
            probabilities = self.hybrid_classifier.predict_proba(X_scaled)
            
            # Convert predictions back to original labels
            predicted_labels = self.label_encoder.inverse_transform(predictions)
            
            return {
                'predictions': predicted_labels.tolist(),
                'probabilities': probabilities.tolist(),
                'attack_types': self._categorize_attacks(predicted_labels)
            }
            
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            raise ValueError(f"Prediction failed: {str(e)}")
    
    async def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the current model.
        
        Returns:
            Model information and status
        """
        return {
            'is_trained': self.is_trained,
            'feature_count': len(self.feature_names) if self.feature_names else 0,
            'selected_features': (
                self.feature_selector.get_selected_features() 
                if self.feature_selector else []
            ),
            'model_type': 'Hybrid SVM + XGBoost',
            'optimization': 'Crow Search Algorithm'
        }
    
    def _prepare_data(self, data: pd.DataFrame, target_column: str) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare data for training."""
        # Separate features and target
        X = data.drop(columns=[target_column])
        y = data[target_column]
        
        # Store feature names
        self.feature_names = X.columns.tolist()
        
        # Handle categorical features
        X = pd.get_dummies(X, drop_first=True)
        
        # Encode target labels
        y_encoded = self.label_encoder.fit_transform(y)
        
        return X.values, y_encoded
    
    def _prepare_prediction_data(self, data: pd.DataFrame) -> np.ndarray:
        """Prepare data for prediction."""
        # Handle categorical features (same as training)
        X = pd.get_dummies(data, drop_first=True)
        
        # Ensure same columns as training
        if hasattr(self, 'feature_names') and self.feature_names:
            missing_cols = set(self.feature_names) - set(X.columns)
            for col in missing_cols:
                X[col] = 0
            
            # Select only training columns in the same order
            X = X[self.feature_names]
        
        return X.values
    
    def _categorize_attacks(self, predictions: np.ndarray) -> Dict[str, int]:
        """Categorize predictions into attack types."""
        categories = {
            'Normal': 0,
            'DoS': 0,
            'Probe': 0,
            'U2R': 0,
            'R2L': 0
        }
        
        for pred in predictions:
            if pred == 'normal':
                categories['Normal'] += 1
            elif pred in ['back', 'land', 'neptune', 'pod', 'smurf', 'teardrop']:
                categories['DoS'] += 1
            elif pred in ['ipsweep', 'nmap', 'portsweep', 'satan']:
                categories['Probe'] += 1
            elif pred in ['buffer_overflow', 'loadmodule', 'perl', 'rootkit']:
                categories['U2R'] += 1
            elif pred in ['ftp_write', 'guess_passwd', 'imap', 'multihop', 'phf', 'spy', 'warezclient', 'warezmaster']:
                categories['R2L'] += 1
        
        return categories
    
    async def _save_model(self):
        """Save trained model components."""
        try:
            model_data = {
                'hybrid_classifier': self.hybrid_classifier,
                'feature_selector': self.feature_selector,
                'scaler': self.scaler,
                'label_encoder': self.label_encoder,
                'feature_names': self.feature_names
            }
            
            model_path = os.path.join(settings.MODEL_PATH, 'nids_model.pkl')
            with open(model_path, 'wb') as f:
                pickle.dump(model_data, f)
            
            logger.info(f"Model saved to {model_path}")
            
        except Exception as e:
            logger.error(f"Failed to save model: {str(e)}")
    
    async def load_model(self, model_path: Optional[str] = None):
        """Load a trained model."""
        try:
            if model_path is None:
                model_path = os.path.join(settings.MODEL_PATH, 'nids_model.pkl')
            
            if not os.path.exists(model_path):
                logger.warning(f"Model file not found: {model_path}")
                return False
            
            with open(model_path, 'rb') as f:
                model_data = pickle.load(f)
            
            self.hybrid_classifier = model_data['hybrid_classifier']
            self.feature_selector = model_data['feature_selector']
            self.scaler = model_data['scaler']
            self.label_encoder = model_data['label_encoder']
            self.feature_names = model_data['feature_names']
            self.is_trained = True
            
            logger.info(f"Model loaded from {model_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            return False
