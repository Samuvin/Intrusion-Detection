"""
XGBoost-based Feature Selection for Network Intrusion Detection.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
import xgboost as xgb
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import cross_val_score
from sklearn.metrics import accuracy_score
import logging

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class XGBoostFeatureSelector(BaseEstimator, TransformerMixin):
    """
    XGBoost-based feature selection using intrinsic feature importance.
    
    This implementation follows the research paper's approach of using
    XGBoost's built-in feature importance to select the most relevant features
    for intrusion detection.
    """
    
    def __init__(
        self,
        n_features: int = None,
        importance_type: str = 'gain',
        xgb_params: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize XGBoost Feature Selector.
        
        Args:
            n_features: Number of top features to select
            importance_type: Type of importance ('gain', 'weight', 'cover')
            xgb_params: XGBoost parameters for feature importance calculation
        """
        self.n_features = n_features or settings.MAX_FEATURES
        self.importance_type = importance_type
        self.xgb_params = xgb_params or {
            'n_estimators': 100,
            'max_depth': 6,
            'learning_rate': 0.1,
            'random_state': 42,
            'eval_metric': 'logloss'
        }
        
        # Internal state
        self.feature_importances_ = None
        self.selected_features_ = None
        self.feature_names_ = None
        self.xgb_model_ = None
        self.is_fitted_ = False
        
        logger.info(f"XGBoost Feature Selector initialized: n_features={self.n_features}, "
                   f"importance_type={self.importance_type}")
    
    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: Optional[List[str]] = None) -> 'XGBoostFeatureSelector':
        """
        Fit the feature selector on training data.
        
        Args:
            X: Training features
            y: Training labels
            feature_names: Optional feature names
            
        Returns:
            Self for method chaining
        """
        logger.info(f"Fitting feature selector on {X.shape[0]} samples with {X.shape[1]} features")
        
        try:
            # Store feature names
            if feature_names is not None:
                self.feature_names_ = feature_names
            else:
                self.feature_names_ = [f'feature_{i}' for i in range(X.shape[1])]
            
            # Train XGBoost model for feature importance
            self.xgb_model_ = xgb.XGBClassifier(**self.xgb_params)
            self.xgb_model_.fit(X, y)
            
            # Get feature importance
            if self.importance_type == 'gain':
                importance_dict = self.xgb_model_.get_booster().get_score(importance_type='gain')
            elif self.importance_type == 'weight':
                importance_dict = self.xgb_model_.get_booster().get_score(importance_type='weight')
            elif self.importance_type == 'cover':
                importance_dict = self.xgb_model_.get_booster().get_score(importance_type='cover')
            else:
                raise ValueError(f"Invalid importance_type: {self.importance_type}")
            
            # Convert to array format
            self.feature_importances_ = np.zeros(len(self.feature_names_))
            for feature_name, importance in importance_dict.items():
                # XGBoost uses f0, f1, f2, ... naming
                if feature_name.startswith('f'):
                    try:
                        idx = int(feature_name[1:])
                        if idx < len(self.feature_importances_):
                            self.feature_importances_[idx] = importance
                    except (ValueError, IndexError):
                        continue
            
            # Select top features
            self._select_top_features()
            
            self.is_fitted_ = True
            
            logger.info(f"Feature selection completed. Selected {len(self.selected_features_)} features")
            logger.info(f"Top 5 features: {[self.feature_names_[i] for i in self.selected_features_[:5]]}")
            
            return self
            
        except Exception as e:
            logger.error(f"Feature selection fitting failed: {str(e)}")
            raise RuntimeError(f"Failed to fit feature selector: {str(e)}")
    
    def transform(self, X: np.ndarray) -> np.ndarray:
        """
        Transform data by selecting only the important features.
        
        Args:
            X: Input features
            
        Returns:
            Transformed data with selected features only
        """
        if not self.is_fitted_:
            raise ValueError("Feature selector is not fitted. Call 'fit' first.")
        
        try:
            # Select features
            X_selected = X[:, self.selected_features_]
            
            logger.debug(f"Transformed data from {X.shape[1]} to {X_selected.shape[1]} features")
            
            return X_selected
            
        except Exception as e:
            logger.error(f"Feature transformation failed: {str(e)}")
            raise RuntimeError(f"Failed to transform features: {str(e)}")
    
    def fit_transform(self, X: np.ndarray, y: np.ndarray, feature_names: Optional[List[str]] = None) -> np.ndarray:
        """
        Fit the selector and transform the data in one step.
        
        Args:
            X: Training features
            y: Training labels
            feature_names: Optional feature names
            
        Returns:
            Transformed data with selected features
        """
        return self.fit(X, y, feature_names).transform(X)
    
    def _select_top_features(self):
        """Select the top N features based on importance scores."""
        # Get indices of features sorted by importance (descending)
        feature_indices = np.argsort(self.feature_importances_)[::-1]
        
        # Select top N features
        n_select = min(self.n_features, len(feature_indices))
        self.selected_features_ = feature_indices[:n_select]
        
        # Log feature selection results
        logger.debug(f"Selected features: {self.selected_features_}")
        if self.feature_names_:
            selected_names = [self.feature_names_[i] for i in self.selected_features_]
            logger.debug(f"Selected feature names: {selected_names}")
    
    def get_feature_importance(self, normalize: bool = True) -> Dict[str, float]:
        """
        Get feature importance scores.
        
        Args:
            normalize: Whether to normalize importance scores to sum to 1
            
        Returns:
            Dictionary mapping feature names to importance scores
        """
        if not self.is_fitted_:
            raise ValueError("Feature selector is not fitted. Call 'fit' first.")
        
        importance_dict = {}
        
        # Get importance for selected features only
        for i, feature_idx in enumerate(self.selected_features_):
            feature_name = self.feature_names_[feature_idx]
            importance = self.feature_importances_[feature_idx]
            importance_dict[feature_name] = importance
        
        # Normalize if requested
        if normalize and importance_dict:
            total_importance = sum(importance_dict.values())
            if total_importance > 0:
                importance_dict = {
                    name: importance / total_importance
                    for name, importance in importance_dict.items()
                }
        
        return importance_dict
    
    def get_selected_features(self) -> List[str]:
        """
        Get names of selected features.
        
        Returns:
            List of selected feature names
        """
        if not self.is_fitted_:
            return []
        
        return [self.feature_names_[i] for i in self.selected_features_]
    
    def get_feature_ranking(self) -> List[Tuple[str, float]]:
        """
        Get all features ranked by importance.
        
        Returns:
            List of (feature_name, importance) tuples sorted by importance
        """
        if not self.is_fitted_:
            return []
        
        # Create list of (name, importance) tuples
        feature_ranking = [
            (self.feature_names_[i], self.feature_importances_[i])
            for i in range(len(self.feature_names_))
        ]
        
        # Sort by importance (descending)
        feature_ranking.sort(key=lambda x: x[1], reverse=True)
        
        return feature_ranking
    
    def evaluate_feature_selection(
        self,
        X: np.ndarray,
        y: np.ndarray,
        classifier,
        cv_folds: int = 5
    ) -> Dict[str, Any]:
        """
        Evaluate the effectiveness of feature selection.
        
        Args:
            X: Original features
            y: Labels
            classifier: Classifier to evaluate with
            cv_folds: Number of cross-validation folds
            
        Returns:
            Evaluation results comparing original vs selected features
        """
        if not self.is_fitted_:
            raise ValueError("Feature selector is not fitted. Call 'fit' first.")
        
        try:
            # Evaluate with original features
            scores_original = cross_val_score(classifier, X, y, cv=cv_folds)
            
            # Evaluate with selected features
            X_selected = self.transform(X)
            scores_selected = cross_val_score(classifier, X_selected, y, cv=cv_folds)
            
            results = {
                'original_features': X.shape[1],
                'selected_features': X_selected.shape[1],
                'reduction_ratio': (X.shape[1] - X_selected.shape[1]) / X.shape[1],
                'original_accuracy': {
                    'mean': np.mean(scores_original),
                    'std': np.std(scores_original),
                    'scores': scores_original.tolist()
                },
                'selected_accuracy': {
                    'mean': np.mean(scores_selected),
                    'std': np.std(scores_selected),
                    'scores': scores_selected.tolist()
                },
                'accuracy_change': np.mean(scores_selected) - np.mean(scores_original),
                'efficiency_gain': X.shape[1] / X_selected.shape[1]
            }
            
            logger.info(f"Feature selection evaluation: "
                       f"Reduced from {X.shape[1]} to {X_selected.shape[1]} features "
                       f"({results['reduction_ratio']:.2%} reduction)")
            logger.info(f"Accuracy change: {results['accuracy_change']:+.4f} "
                       f"({np.mean(scores_original):.4f} → {np.mean(scores_selected):.4f})")
            
            return results
            
        except Exception as e:
            logger.error(f"Feature selection evaluation failed: {str(e)}")
            raise RuntimeError(f"Failed to evaluate feature selection: {str(e)}")
    
    def plot_feature_importance(self, top_n: int = 20) -> Dict[str, Any]:
        """
        Generate data for plotting feature importance.
        
        Args:
            top_n: Number of top features to include
            
        Returns:
            Plot data for feature importance visualization
        """
        if not self.is_fitted_:
            raise ValueError("Feature selector is not fitted. Call 'fit' first.")
        
        # Get top N features by importance
        feature_ranking = self.get_feature_ranking()[:top_n]
        
        features = [name for name, _ in feature_ranking]
        importances = [importance for _, importance in feature_ranking]
        
        plot_data = {
            'features': features,
            'importances': importances,
            'selected_features': self.get_selected_features(),
            'title': f'Top {top_n} Feature Importance Scores',
            'xlabel': 'Features',
            'ylabel': f'Importance Score ({self.importance_type})'
        }
        
        return plot_data
    
    def get_selection_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the feature selection process.
        
        Returns:
            Summary statistics and information
        """
        if not self.is_fitted_:
            return {'status': 'not_fitted'}
        
        # Calculate statistics
        total_features = len(self.feature_names_)
        selected_count = len(self.selected_features_)
        reduction_ratio = (total_features - selected_count) / total_features
        
        # Get importance statistics
        importances = self.feature_importances_[self.selected_features_]
        
        summary = {
            'status': 'fitted',
            'total_features': total_features,
            'selected_features': selected_count,
            'reduction_ratio': reduction_ratio,
            'importance_type': self.importance_type,
            'importance_stats': {
                'mean': float(np.mean(importances)) if len(importances) > 0 else 0,
                'std': float(np.std(importances)) if len(importances) > 0 else 0,
                'min': float(np.min(importances)) if len(importances) > 0 else 0,
                'max': float(np.max(importances)) if len(importances) > 0 else 0
            },
            'top_features': self.get_selected_features()[:10]  # Top 10 selected features
        }
        
        return summary
