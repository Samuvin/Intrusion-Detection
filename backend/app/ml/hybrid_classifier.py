"""
Hybrid SVM + XGBoost Classifier for Network Intrusion Detection.
"""

import numpy as np
from typing import Dict, Any, Optional, Tuple
from sklearn.svm import SVC
from sklearn.ensemble import VotingClassifier
from sklearn.metrics import accuracy_score, classification_report
import xgboost as xgb
import logging

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class HybridNIDSClassifier:
    """
    Hybrid classifier combining SVM and XGBoost for improved intrusion detection.
    
    This implementation follows the research paper's approach of using:
    1. SVM for robust boundary-based classification
    2. XGBoost for high-performance gradient boosting
    3. Ensemble voting for final predictions
    """
    
    def __init__(self):
        """Initialize the hybrid classifier."""
        self.svm_classifier = None
        self.xgboost_classifier = None
        self.ensemble_classifier = None
        self.is_fitted = False
        self.classes_ = None
        
        logger.info("Hybrid NIDS Classifier initialized")
    
    def fit(
        self, 
        X: np.ndarray, 
        y: np.ndarray, 
        best_params: Optional[Dict[str, Any]] = None
    ) -> 'HybridNIDSClassifier':
        """
        Train the hybrid classifier.
        
        Args:
            X: Training features
            y: Training labels
            best_params: Optimized hyperparameters from CSA
            
        Returns:
            Self for method chaining
        """
        logger.info(f"Training hybrid classifier on {X.shape[0]} samples with {X.shape[1]} features")
        
        try:
            # Default parameters
            svm_params = {
                'kernel': settings.SVM_KERNEL,
                'C': 1.0,
                'gamma': 'scale',
                'random_state': 42,
                'probability': True  # Enable probability estimates
            }
            
            xgb_params = {
                'n_estimators': settings.XGBOOST_N_ESTIMATORS,
                'max_depth': settings.XGBOOST_MAX_DEPTH,
                'learning_rate': settings.XGBOOST_LEARNING_RATE,
                'random_state': 42,
                'eval_metric': 'logloss'
            }
            
            # Update with optimized parameters if available
            if best_params:
                if 'svm_C' in best_params:
                    svm_params['C'] = best_params['svm_C']
                if 'svm_gamma' in best_params:
                    svm_params['gamma'] = best_params['svm_gamma']
                if 'xgb_n_estimators' in best_params:
                    xgb_params['n_estimators'] = int(best_params['xgb_n_estimators'])
                if 'xgb_max_depth' in best_params:
                    xgb_params['max_depth'] = int(best_params['xgb_max_depth'])
                if 'xgb_learning_rate' in best_params:
                    xgb_params['learning_rate'] = best_params['xgb_learning_rate']
                
                logger.info(f"Using optimized parameters: {best_params}")
            
            # Initialize individual classifiers
            self.svm_classifier = SVC(**svm_params)
            self.xgboost_classifier = xgb.XGBClassifier(**xgb_params)
            
            # Create ensemble classifier with soft voting
            self.ensemble_classifier = VotingClassifier(
                estimators=[
                    ('svm', self.svm_classifier),
                    ('xgboost', self.xgboost_classifier)
                ],
                voting='soft'  # Use predicted probabilities
            )
            
            # Train the ensemble
            self.ensemble_classifier.fit(X, y)
            
            # Store classes for later use
            self.classes_ = self.ensemble_classifier.classes_
            self.is_fitted = True
            
            # Log training completion
            train_accuracy = self.ensemble_classifier.score(X, y)
            logger.info(f"Hybrid classifier training completed. Training accuracy: {train_accuracy:.4f}")
            
            return self
            
        except Exception as e:
            logger.error(f"Training failed: {str(e)}")
            raise RuntimeError(f"Failed to train hybrid classifier: {str(e)}")
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Make predictions using the hybrid classifier.
        
        Args:
            X: Input features
            
        Returns:
            Predicted class labels
        """
        if not self.is_fitted:
            raise ValueError("Classifier is not fitted. Call 'fit' first.")
        
        try:
            predictions = self.ensemble_classifier.predict(X)
            logger.debug(f"Made predictions for {X.shape[0]} samples")
            return predictions
            
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            raise RuntimeError(f"Failed to make predictions: {str(e)}")
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Predict class probabilities using the hybrid classifier.
        
        Args:
            X: Input features
            
        Returns:
            Predicted class probabilities
        """
        if not self.is_fitted:
            raise ValueError("Classifier is not fitted. Call 'fit' first.")
        
        try:
            probabilities = self.ensemble_classifier.predict_proba(X)
            logger.debug(f"Generated probabilities for {X.shape[0]} samples")
            return probabilities
            
        except Exception as e:
            logger.error(f"Probability prediction failed: {str(e)}")
            raise RuntimeError(f"Failed to predict probabilities: {str(e)}")
    
    def evaluate(self, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """
        Evaluate the hybrid classifier performance.
        
        Args:
            X: Test features
            y: True labels
            
        Returns:
            Evaluation metrics
        """
        if not self.is_fitted:
            raise ValueError("Classifier is not fitted. Call 'fit' first.")
        
        try:
            # Make predictions
            y_pred = self.predict(X)
            y_proba = self.predict_proba(X)
            
            # Calculate metrics
            accuracy = accuracy_score(y, y_pred)
            report = classification_report(y, y_pred, output_dict=True)
            
            # Individual classifier performance
            svm_pred = self.svm_classifier.predict(X)
            xgb_pred = self.xgboost_classifier.predict(X)
            
            svm_accuracy = accuracy_score(y, svm_pred)
            xgb_accuracy = accuracy_score(y, xgb_pred)
            
            results = {
                'ensemble_accuracy': accuracy,
                'svm_accuracy': svm_accuracy,
                'xgboost_accuracy': xgb_accuracy,
                'classification_report': report,
                'improvement_over_svm': accuracy - svm_accuracy,
                'improvement_over_xgboost': accuracy - xgb_accuracy
            }
            
            logger.info(f"Evaluation completed. Ensemble accuracy: {accuracy:.4f}")
            logger.info(f"SVM accuracy: {svm_accuracy:.4f}, XGBoost accuracy: {xgb_accuracy:.4f}")
            
            return results
            
        except Exception as e:
            logger.error(f"Evaluation failed: {str(e)}")
            raise RuntimeError(f"Failed to evaluate classifier: {str(e)}")
    
    def get_feature_importance(self) -> Dict[str, float]:
        """
        Get feature importance from the XGBoost component.
        
        Returns:
            Feature importance scores
        """
        if not self.is_fitted:
            raise ValueError("Classifier is not fitted. Call 'fit' first.")
        
        try:
            # Get importance from XGBoost
            importance_dict = self.xgboost_classifier.get_booster().get_score(importance_type='weight')
            
            # Normalize importance scores
            total_importance = sum(importance_dict.values())
            if total_importance > 0:
                importance_dict = {
                    k: v / total_importance 
                    for k, v in importance_dict.items()
                }
            
            return importance_dict
            
        except Exception as e:
            logger.error(f"Failed to get feature importance: {str(e)}")
            return {}
    
    def get_params(self, deep=True):
        """
        Get parameters for this estimator (scikit-learn compatibility).
        
        Args:
            deep: If True, return parameters for sub-estimators too
            
        Returns:
            Parameter dictionary
        """
        params = {
            'svm_kernel': getattr(self, 'svm_kernel', 'rbf'),
            'svm_C': getattr(self, 'svm_C', 1.0),
            'svm_gamma': getattr(self, 'svm_gamma', 'scale'),
            'xgb_n_estimators': getattr(self, 'xgb_n_estimators', 100),
            'xgb_max_depth': getattr(self, 'xgb_max_depth', 6),
            'xgb_learning_rate': getattr(self, 'xgb_learning_rate', 0.1)
        }
        return params
    
    def set_params(self, **parameters):
        """
        Set parameters for this estimator (scikit-learn compatibility).
        
        Args:
            parameters: Parameter dictionary
            
        Returns:
            Self
        """
        for key, value in parameters.items():
            setattr(self, key, value)
        return self

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the hybrid model.
        
        Returns:
            Model information
        """
        info = {
            'is_fitted': self.is_fitted,
            'model_type': 'Hybrid SVM + XGBoost Ensemble',
            'voting_type': 'Soft Voting',
            'n_classes': len(self.classes_) if self.classes_ is not None else 0,
            'classes': self.classes_.tolist() if self.classes_ is not None else []
        }
        
        if self.is_fitted:
            # Add individual classifier info
            info['svm_params'] = self.svm_classifier.get_params()
            info['xgboost_params'] = self.xgboost_classifier.get_params()
        
        return info
