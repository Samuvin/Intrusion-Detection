"""
Statistical Gaussian Mixture (SGM) Model for Network Behavior Analysis and Anomaly Detection.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.base import BaseEstimator
import logging
import json
from datetime import datetime, timedelta
import pickle
import os

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SGMNetworkAnalyzer(BaseEstimator):
    """
    Statistical Gaussian Mixture Model for network behavior analysis and anomaly detection.
    
    This implementation uses Gaussian Mixture Models to establish baseline network behavior
    and detect anomalies through statistical deviation analysis.
    """
    
    def __init__(
        self,
        n_components: int = 5,
        covariance_type: str = 'full',
        anomaly_threshold: float = 0.05,
        adaptation_rate: float = 0.1,
        window_size: int = 1000,
        feature_subset: Optional[List[str]] = None
    ):
        """
        Initialize SGM Network Analyzer.
        
        Args:
            n_components: Number of Gaussian components for mixture model
            covariance_type: Type of covariance parameters ('full', 'tied', 'diag', 'spherical')
            anomaly_threshold: Threshold for anomaly detection (percentile)
            adaptation_rate: Rate at which model adapts to new normal behavior
            window_size: Size of sliding window for continuous learning
            feature_subset: Specific features to use for analysis
        """
        self.n_components = n_components
        self.covariance_type = covariance_type
        self.anomaly_threshold = anomaly_threshold
        self.adaptation_rate = adaptation_rate
        self.window_size = window_size
        self.feature_subset = feature_subset
        
        # Model components
        self.gmm_model = None
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=0.95)  # Keep 95% of variance
        self.baseline_scores = []
        self.adaptation_buffer = []
        
        # Feature analysis
        self.feature_names = []
        self.feature_importance = {}
        self.anomaly_patterns = {}
        
        # Model state
        self.is_fitted = False
        self.last_update = None
        self.baseline_statistics = {}
        
        logger.info(f"SGM Network Analyzer initialized: n_components={n_components}, "
                   f"threshold={anomaly_threshold}, adaptation_rate={adaptation_rate}")
    
    def fit(self, X: np.ndarray, feature_names: Optional[List[str]] = None) -> 'SGMNetworkAnalyzer':
        """
        Fit the SGM model on network behavior data.
        
        Args:
            X: Network behavior features
            feature_names: Names of the features
            
        Returns:
            Self for method chaining
        """
        logger.info(f"Fitting SGM model on {X.shape[0]} samples with {X.shape[1]} features")
        
        try:
            # Store feature names
            if feature_names is not None:
                self.feature_names = feature_names
            else:
                self.feature_names = [f'feature_{i}' for i in range(X.shape[1])]
            
            # Apply feature subset if specified
            if self.feature_subset:
                feature_indices = [i for i, name in enumerate(self.feature_names) 
                                 if name in self.feature_subset]
                X = X[:, feature_indices]
                self.feature_names = [self.feature_names[i] for i in feature_indices]
                logger.info(f"Using feature subset: {len(feature_indices)} features")
            
            # Preprocess data
            X_processed = self._preprocess_data(X, fit=True)
            
            # Fit Gaussian Mixture Model
            self.gmm_model = GaussianMixture(
                n_components=self.n_components,
                covariance_type=self.covariance_type,
                random_state=42,
                max_iter=200,
                tol=1e-4
            )
            
            self.gmm_model.fit(X_processed)
            
            # Calculate baseline anomaly scores
            baseline_scores = -self.gmm_model.score_samples(X_processed)
            self.baseline_scores = baseline_scores
            
            # Calculate anomaly threshold
            self._calculate_anomaly_threshold()
            
            # Calculate baseline statistics
            self._calculate_baseline_statistics(X, baseline_scores)
            
            # Calculate feature importance
            self._calculate_feature_importance(X_processed)
            
            self.is_fitted = True
            self.last_update = datetime.now()
            
            logger.info(f"SGM model fitted successfully. Anomaly threshold: {self.calculated_threshold:.4f}")
            logger.info(f"Model components: {self.gmm_model.n_components}, "
                       f"Features: {len(self.feature_names)}")
            
            return self
            
        except Exception as e:
            logger.error(f"SGM model fitting failed: {str(e)}")
            raise RuntimeError(f"Failed to fit SGM model: {str(e)}")
    
    def predict_anomaly(self, X: np.ndarray) -> Dict[str, Any]:
        """
        Predict anomalies in network behavior data.
        
        Args:
            X: Network behavior features
            
        Returns:
            Anomaly detection results
        """
        if not self.is_fitted:
            raise ValueError("SGM model is not fitted. Call 'fit' first.")
        
        try:
            # Preprocess data
            X_processed = self._preprocess_data(X, fit=False)
            
            # Calculate anomaly scores
            log_probs = self.gmm_model.score_samples(X_processed)
            anomaly_scores = -log_probs
            
            # Determine anomalies
            anomalies = anomaly_scores > self.calculated_threshold
            anomaly_severity = self._calculate_anomaly_severity(anomaly_scores)
            
            # Analyze anomaly patterns
            anomaly_patterns = self._analyze_anomaly_patterns(X, anomaly_scores, anomalies)
            
            # Calculate component probabilities
            component_probs = self.gmm_model.predict_proba(X_processed)
            
            # Generate detailed results
            results = {
                'anomaly_detected': np.any(anomalies),
                'anomaly_count': int(np.sum(anomalies)),
                'anomaly_percentage': float(np.mean(anomalies) * 100),
                'anomaly_indices': np.where(anomalies)[0].tolist(),
                'anomaly_scores': anomaly_scores.tolist(),
                'anomaly_severity': anomaly_severity,
                'threshold': float(self.calculated_threshold),
                'max_score': float(np.max(anomaly_scores)),
                'mean_score': float(np.mean(anomaly_scores)),
                'component_probabilities': component_probs.tolist(),
                'anomaly_patterns': anomaly_patterns,
                'timestamp': datetime.now().isoformat()
            }
            
            # Update adaptation buffer for continuous learning
            self._update_adaptation_buffer(X, anomaly_scores, anomalies)
            
            logger.debug(f"SGM anomaly detection: {results['anomaly_count']} anomalies detected "
                        f"({results['anomaly_percentage']:.2f}%)")
            
            return results
            
        except Exception as e:
            logger.error(f"SGM anomaly prediction failed: {str(e)}")
            raise RuntimeError(f"Failed to predict anomalies: {str(e)}")
    
    def adapt_model(self, force_adaptation: bool = False) -> Dict[str, Any]:
        """
        Adapt the model to new normal behavior patterns.
        
        Args:
            force_adaptation: Force adaptation regardless of buffer size
            
        Returns:
            Adaptation results
        """
        if not self.is_fitted:
            raise ValueError("SGM model is not fitted. Cannot adapt.")
        
        if len(self.adaptation_buffer) < self.window_size and not force_adaptation:
            logger.debug(f"Adaptation buffer not full: {len(self.adaptation_buffer)}/{self.window_size}")
            return {'adapted': False, 'reason': 'insufficient_data'}
        
        try:
            logger.info("Starting SGM model adaptation")
            
            # Extract normal samples from adaptation buffer
            normal_samples = []
            for sample_data in self.adaptation_buffer:
                if not sample_data['is_anomaly']:
                    normal_samples.append(sample_data['features'])
            
            if len(normal_samples) < 10:  # Minimum samples for adaptation
                logger.warning("Insufficient normal samples for adaptation")
                return {'adapted': False, 'reason': 'insufficient_normal_samples'}
            
            # Convert to numpy array
            X_new = np.array(normal_samples)
            
            # Preprocess new data
            X_new_processed = self._preprocess_data(X_new, fit=False)
            
            # Partially fit the model with new data
            # Create a new model with weighted combination of old and new data
            old_weight = 1.0 - self.adaptation_rate
            new_weight = self.adaptation_rate
            
            # Get current model parameters
            old_means = self.gmm_model.means_
            old_covariances = self.gmm_model.covariances_
            old_weights = self.gmm_model.weights_
            
            # Fit temporary model on new data
            temp_model = GaussianMixture(
                n_components=self.n_components,
                covariance_type=self.covariance_type,
                random_state=42
            )
            temp_model.fit(X_new_processed)
            
            # Weighted combination of parameters
            self.gmm_model.means_ = (old_weight * old_means + 
                                   new_weight * temp_model.means_)
            
            # Update covariances (simplified approach)
            if self.covariance_type == 'full':
                self.gmm_model.covariances_ = (old_weight * old_covariances + 
                                             new_weight * temp_model.covariances_)
            
            # Update weights
            self.gmm_model.weights_ = (old_weight * old_weights + 
                                     new_weight * temp_model.weights_)
            
            # Recalculate threshold with updated model
            combined_data = np.vstack([
                self._preprocess_data(np.random.multivariate_normal(
                    self.gmm_model.means_[i], 
                    self.gmm_model.covariances_[i], 
                    size=100
                ), fit=False) for i in range(self.n_components)
            ])
            
            new_baseline_scores = -self.gmm_model.score_samples(combined_data)
            self.baseline_scores = new_baseline_scores
            self._calculate_anomaly_threshold()
            
            # Clear adaptation buffer
            self.adaptation_buffer.clear()
            self.last_update = datetime.now()
            
            adaptation_results = {
                'adapted': True,
                'new_threshold': float(self.calculated_threshold),
                'normal_samples_used': len(normal_samples),
                'adaptation_timestamp': self.last_update.isoformat()
            }
            
            logger.info(f"SGM model adapted successfully. New threshold: {self.calculated_threshold:.4f}")
            
            return adaptation_results
            
        except Exception as e:
            logger.error(f"SGM model adaptation failed: {str(e)}")
            return {'adapted': False, 'reason': f'adaptation_error: {str(e)}'}
    
    def _preprocess_data(self, X: np.ndarray, fit: bool = False) -> np.ndarray:
        """Preprocess data with scaling and dimensionality reduction."""
        # Handle missing values
        X_clean = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)
        
        # Scale features
        if fit:
            X_scaled = self.scaler.fit_transform(X_clean)
        else:
            X_scaled = self.scaler.transform(X_clean)
        
        # Apply PCA for dimensionality reduction
        if fit:
            X_processed = self.pca.fit_transform(X_scaled)
            logger.debug(f"PCA reduced dimensions from {X_scaled.shape[1]} to {X_processed.shape[1]}")
        else:
            X_processed = self.pca.transform(X_scaled)
        
        return X_processed
    
    def _calculate_anomaly_threshold(self):
        """Calculate anomaly threshold based on baseline scores."""
        self.calculated_threshold = np.percentile(
            self.baseline_scores, 
            (1 - self.anomaly_threshold) * 100
        )
    
    def _calculate_baseline_statistics(self, X: np.ndarray, scores: np.ndarray):
        """Calculate baseline statistics for the network behavior."""
        self.baseline_statistics = {
            'sample_count': len(X),
            'feature_means': np.mean(X, axis=0).tolist(),
            'feature_stds': np.std(X, axis=0).tolist(),
            'score_mean': float(np.mean(scores)),
            'score_std': float(np.std(scores)),
            'score_percentiles': {
                '95': float(np.percentile(scores, 95)),
                '99': float(np.percentile(scores, 99)),
                '99.9': float(np.percentile(scores, 99.9))
            }
        }
    
    def _calculate_feature_importance(self, X_processed: np.ndarray):
        """Calculate feature importance based on component contributions."""
        try:
            # Calculate component-wise feature importance
            importance_scores = np.zeros(len(self.feature_names))
            
            for i in range(self.n_components):
                # Use component means as importance indicators
                component_contribution = np.abs(self.gmm_model.means_[i])
                component_weight = self.gmm_model.weights_[i]
                
                # Weight by component probability
                weighted_contribution = component_contribution * component_weight
                
                # Map back to original features through PCA
                if hasattr(self.pca, 'components_'):
                    # Project PCA components back to original feature space
                    original_importance = np.sum(
                        np.abs(self.pca.components_) * weighted_contribution[:, np.newaxis], 
                        axis=0
                    )
                    importance_scores += original_importance[:len(self.feature_names)]
            
            # Normalize importance scores
            if np.sum(importance_scores) > 0:
                importance_scores = importance_scores / np.sum(importance_scores)
            
            # Create feature importance dictionary
            self.feature_importance = {
                name: float(score) for name, score in 
                zip(self.feature_names, importance_scores)
            }
            
        except Exception as e:
            logger.warning(f"Could not calculate feature importance: {str(e)}")
            # Fallback to equal importance
            self.feature_importance = {
                name: 1.0 / len(self.feature_names) 
                for name in self.feature_names
            }
    
    def _calculate_anomaly_severity(self, anomaly_scores: np.ndarray) -> List[str]:
        """Calculate severity levels for anomaly scores."""
        severity_levels = []
        
        # Define severity thresholds based on statistical distribution
        high_threshold = self.calculated_threshold * 2.0
        critical_threshold = self.calculated_threshold * 3.0
        
        for score in anomaly_scores:
            if score < self.calculated_threshold:
                severity_levels.append('normal')
            elif score < high_threshold:
                severity_levels.append('low')
            elif score < critical_threshold:
                severity_levels.append('medium')
            else:
                severity_levels.append('high')
        
        return severity_levels
    
    def _analyze_anomaly_patterns(
        self, 
        X: np.ndarray, 
        scores: np.ndarray, 
        anomalies: np.ndarray
    ) -> Dict[str, Any]:
        """Analyze patterns in detected anomalies."""
        if not np.any(anomalies):
            return {}
        
        try:
            anomaly_indices = np.where(anomalies)[0]
            anomaly_features = X[anomaly_indices]
            
            patterns = {
                'most_anomalous_features': [],
                'anomaly_clusters': {},
                'temporal_patterns': {},
                'statistical_deviations': {}
            }
            
            # Find most anomalous features
            if len(self.feature_names) == X.shape[1]:
                feature_deviations = []
                for i, feature_name in enumerate(self.feature_names):
                    baseline_mean = self.baseline_statistics['feature_means'][i]
                    baseline_std = self.baseline_statistics['feature_stds'][i]
                    
                    if baseline_std > 0:
                        anomaly_values = anomaly_features[:, i]
                        deviation = np.mean(np.abs(anomaly_values - baseline_mean) / baseline_std)
                        feature_deviations.append((feature_name, float(deviation)))
                
                # Sort by deviation and take top 5
                feature_deviations.sort(key=lambda x: x[1], reverse=True)
                patterns['most_anomalous_features'] = feature_deviations[:5]
            
            # Statistical deviations
            patterns['statistical_deviations'] = {
                'mean_anomaly_score': float(np.mean(scores[anomalies])),
                'max_anomaly_score': float(np.max(scores[anomalies])),
                'anomaly_score_std': float(np.std(scores[anomalies]))
            }
            
            return patterns
            
        except Exception as e:
            logger.warning(f"Pattern analysis failed: {str(e)}")
            return {}
    
    def _update_adaptation_buffer(
        self, 
        X: np.ndarray, 
        scores: np.ndarray, 
        anomalies: np.ndarray
    ):
        """Update the adaptation buffer with new samples."""
        for i in range(len(X)):
            sample_data = {
                'features': X[i].tolist(),
                'score': float(scores[i]),
                'is_anomaly': bool(anomalies[i]),
                'timestamp': datetime.now().isoformat()
            }
            
            self.adaptation_buffer.append(sample_data)
            
            # Keep buffer size limited
            if len(self.adaptation_buffer) > self.window_size * 2:
                # Remove oldest samples
                self.adaptation_buffer = self.adaptation_buffer[-self.window_size:]
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the SGM model."""
        info = {
            'is_fitted': self.is_fitted,
            'model_type': 'Statistical Gaussian Mixture Model',
            'n_components': self.n_components,
            'covariance_type': self.covariance_type,
            'anomaly_threshold': self.anomaly_threshold,
            'adaptation_rate': self.adaptation_rate,
            'window_size': self.window_size,
            'feature_count': len(self.feature_names),
            'feature_names': self.feature_names,
            'last_update': self.last_update.isoformat() if self.last_update else None
        }
        
        if self.is_fitted:
            info.update({
                'calculated_threshold': float(self.calculated_threshold),
                'baseline_statistics': self.baseline_statistics,
                'feature_importance': self.feature_importance,
                'adaptation_buffer_size': len(self.adaptation_buffer),
                'pca_components': int(self.pca.n_components_) if hasattr(self.pca, 'n_components_') else 0
            })
        
        return info
    
    def save_model(self, filepath: str):
        """Save the SGM model to disk."""
        try:
            model_data = {
                'sgm_analyzer': self,
                'timestamp': datetime.now().isoformat(),
                'version': '1.0'
            }
            
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            with open(filepath, 'wb') as f:
                pickle.dump(model_data, f)
            
            logger.info(f"SGM model saved to {filepath}")
            
        except Exception as e:
            logger.error(f"Failed to save SGM model: {str(e)}")
            raise
    
    @classmethod
    def load_model(cls, filepath: str) -> 'SGMNetworkAnalyzer':
        """Load an SGM model from disk."""
        try:
            with open(filepath, 'rb') as f:
                model_data = pickle.load(f)
            
            sgm_analyzer = model_data['sgm_analyzer']
            logger.info(f"SGM model loaded from {filepath}")
            
            return sgm_analyzer
            
        except Exception as e:
            logger.error(f"Failed to load SGM model: {str(e)}")
            raise


class SGMThreatDetector:
    """
    Threat detection system using SGM for comprehensive network security analysis.
    """
    
    def __init__(self):
        """Initialize SGM Threat Detector."""
        self.analyzers = {}
        self.threat_categories = {
            'dos_attacks': ['back', 'land', 'neptune', 'pod', 'smurf', 'teardrop'],
            'probe_attacks': ['ipsweep', 'nmap', 'portsweep', 'satan'],
            'u2r_attacks': ['buffer_overflow', 'loadmodule', 'perl', 'rootkit'],
            'r2l_attacks': ['ftp_write', 'guess_passwd', 'imap', 'multihop', 'phf', 'spy'],
            'modern_threats': ['ddos', 'apt', 'web_attack', 'botnet', 'insider_threat'],
            'zero_day': ['unknown_pattern', 'polymorphic', 'social_engineering']
        }
        
        logger.info("SGM Threat Detector initialized")
    
    def initialize_analyzers(self, network_data: Dict[str, np.ndarray]):
        """Initialize SGM analyzers for different threat categories."""
        try:
            for category, data in network_data.items():
                if len(data) > 50:  # Minimum samples required
                    analyzer = SGMNetworkAnalyzer(
                        n_components=min(5, len(data) // 20),  # Adaptive components
                        anomaly_threshold=0.05
                    )
                    
                    # Generate feature names
                    feature_names = [f'{category}_feature_{i}' for i in range(data.shape[1])]
                    
                    analyzer.fit(data, feature_names)
                    self.analyzers[category] = analyzer
                    
                    logger.info(f"SGM analyzer initialized for {category}: {len(data)} samples")
            
        except Exception as e:
            logger.error(f"Failed to initialize SGM analyzers: {str(e)}")
            raise
    
    def detect_threats(self, network_data: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """Detect threats using SGM analysis across multiple categories."""
        results = {
            'overall_threat_detected': False,
            'threat_categories': {},
            'anomaly_summary': {},
            'recommendations': []
        }
        
        try:
            total_anomalies = 0
            high_severity_count = 0
            
            for category, data in network_data.items():
                if category in self.analyzers:
                    analyzer = self.analyzers[category]
                    detection_result = analyzer.predict_anomaly(data)
                    
                    results['threat_categories'][category] = detection_result
                    
                    if detection_result['anomaly_detected']:
                        total_anomalies += detection_result['anomaly_count']
                        
                        # Count high severity anomalies
                        high_severity = sum(1 for severity in detection_result['anomaly_severity'] 
                                          if severity in ['high', 'critical'])
                        high_severity_count += high_severity
            
            # Overall threat assessment
            results['overall_threat_detected'] = total_anomalies > 0
            results['anomaly_summary'] = {
                'total_anomalies': total_anomalies,
                'high_severity_count': high_severity_count,
                'categories_affected': len([cat for cat in results['threat_categories'] 
                                          if results['threat_categories'][cat]['anomaly_detected']])
            }
            
            # Generate recommendations
            results['recommendations'] = self._generate_recommendations(results)
            
            return results
            
        except Exception as e:
            logger.error(f"Threat detection failed: {str(e)}")
            raise
    
    def _generate_recommendations(self, detection_results: Dict[str, Any]) -> List[str]:
        """Generate security recommendations based on detection results."""
        recommendations = []
        
        try:
            anomaly_summary = detection_results['anomaly_summary']
            
            if anomaly_summary['high_severity_count'] > 0:
                recommendations.append("Immediate investigation required for high-severity anomalies")
                recommendations.append("Consider implementing automated response measures")
            
            if anomaly_summary['categories_affected'] > 2:
                recommendations.append("Multi-vector attack detected - review security posture")
                recommendations.append("Activate incident response procedures")
            
            if anomaly_summary['total_anomalies'] > 10:
                recommendations.append("High anomaly volume detected - potential coordinated attack")
                recommendations.append("Review and update anomaly detection thresholds")
            
            # Add category-specific recommendations
            for category, results in detection_results['threat_categories'].items():
                if results['anomaly_detected']:
                    if 'dos' in category:
                        recommendations.append("Implement rate limiting and DDoS protection")
                    elif 'probe' in category:
                        recommendations.append("Enhance network monitoring and access controls")
                    elif 'u2r' in category:
                        recommendations.append("Review privilege escalation controls")
                    elif 'r2l' in category:
                        recommendations.append("Strengthen authentication mechanisms")
            
        except Exception as e:
            logger.warning(f"Could not generate recommendations: {str(e)}")
        
        return recommendations
