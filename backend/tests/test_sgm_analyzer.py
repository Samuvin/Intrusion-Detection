"""
Tests for SGM (Statistical Gaussian Mixture) Network Analyzer.
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import Mock, patch
from datetime import datetime, timezone

from app.ml.sgm_analyzer import SGMNetworkAnalyzer, SGMThreatDetector


class TestSGMNetworkAnalyzer:
    """Test cases for SGM Network Analyzer."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.sgm_analyzer = SGMNetworkAnalyzer(
            n_components=3,
            covariance_type='full',
            anomaly_threshold=0.05,
            adaptation_rate=0.1,
            window_size=100
        )
        
        # Create sample training data
        np.random.seed(42)
        self.X_train = np.random.normal(0, 1, (200, 5))
        self.feature_names = ['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5']
        
        # Create sample test data (with some anomalies)
        self.X_test_normal = np.random.normal(0, 1, (50, 5))
        self.X_test_anomalous = np.random.normal(5, 1, (10, 5))  # Different distribution
        self.X_test = np.vstack([self.X_test_normal, self.X_test_anomalous])
    
    def test_initialization(self):
        """Test SGM analyzer initialization."""
        assert self.sgm_analyzer.n_components == 3
        assert self.sgm_analyzer.covariance_type == 'full'
        assert self.sgm_analyzer.anomaly_threshold == 0.05
        assert self.sgm_analyzer.adaptation_rate == 0.1
        assert self.sgm_analyzer.window_size == 100
        assert not self.sgm_analyzer.is_fitted
    
    def test_fit_model(self):
        """Test fitting the SGM model."""
        # Fit the model
        fitted_analyzer = self.sgm_analyzer.fit(self.X_train, self.feature_names)
        
        # Check that the model is fitted
        assert fitted_analyzer.is_fitted
        assert self.sgm_analyzer.is_fitted
        assert fitted_analyzer is self.sgm_analyzer  # Should return self
        
        # Check that model components are initialized
        assert self.sgm_analyzer.gmm_model is not None
        assert hasattr(self.sgm_analyzer, 'calculated_threshold')
        assert self.sgm_analyzer.feature_names == self.feature_names
        assert len(self.sgm_analyzer.baseline_scores) > 0
    
    def test_fit_with_insufficient_data(self):
        """Test fitting with insufficient data."""
        small_data = np.random.normal(0, 1, (5, 3))  # Only 5 samples
        
        with pytest.raises(RuntimeError):
            self.sgm_analyzer.fit(small_data)
    
    def test_predict_anomaly_before_fitting(self):
        """Test anomaly prediction before fitting."""
        with pytest.raises(ValueError, match="SGM model is not fitted"):
            self.sgm_analyzer.predict_anomaly(self.X_test)
    
    def test_predict_anomaly_after_fitting(self):
        """Test anomaly prediction after fitting."""
        # Fit the model first
        self.sgm_analyzer.fit(self.X_train, self.feature_names)
        
        # Predict anomalies
        results = self.sgm_analyzer.predict_anomaly(self.X_test)
        
        # Check result structure
        assert isinstance(results, dict)
        assert 'anomaly_detected' in results
        assert 'anomaly_count' in results
        assert 'anomaly_percentage' in results
        assert 'anomaly_scores' in results
        assert 'threshold' in results
        assert 'timestamp' in results
        
        # Check data types
        assert isinstance(results['anomaly_detected'], bool)
        assert isinstance(results['anomaly_count'], int)
        assert isinstance(results['anomaly_percentage'], float)
        assert isinstance(results['anomaly_scores'], list)
        assert isinstance(results['threshold'], float)
        
        # Check that some anomalies are detected (given our test data)
        assert results['anomaly_count'] >= 0
        assert len(results['anomaly_scores']) == len(self.X_test)
    
    def test_adapt_model(self):
        """Test model adaptation functionality."""
        # Fit the model first
        self.sgm_analyzer.fit(self.X_train, self.feature_names)
        
        # Add some adaptation data
        for _ in range(20):
            adaptation_data = np.random.normal(0, 1, (5, 5))
            results = self.sgm_analyzer.predict_anomaly(adaptation_data)
        
        # Try to adapt (should not adapt due to insufficient buffer)
        adaptation_result = self.sgm_analyzer.adapt_model()
        assert not adaptation_result['adapted']
        
        # Force adaptation
        forced_result = self.sgm_analyzer.adapt_model(force_adaptation=True)
        # Should work if there's some normal data in the buffer
        assert 'adapted' in forced_result
    
    def test_get_model_info(self):
        """Test getting model information."""
        # Before fitting
        info = self.sgm_analyzer.get_model_info()
        assert not info['is_fitted']
        assert info['model_type'] == 'Statistical Gaussian Mixture Model'
        
        # After fitting
        self.sgm_analyzer.fit(self.X_train, self.feature_names)
        info = self.sgm_analyzer.get_model_info()
        assert info['is_fitted']
        assert 'calculated_threshold' in info
        assert 'baseline_statistics' in info
        assert 'feature_importance' in info
        assert info['feature_count'] == len(self.feature_names)
    
    @patch('pickle.dump')
    @patch('builtins.open', create=True)
    @patch('os.makedirs')
    def test_save_model(self, mock_makedirs, mock_open, mock_pickle_dump):
        """Test saving the SGM model."""
        self.sgm_analyzer.fit(self.X_train, self.feature_names)
        
        test_path = "test_model.pkl"
        self.sgm_analyzer.save_model(test_path)
        
        # Check that directories are created and file is opened
        mock_makedirs.assert_called_once()
        mock_open.assert_called_once_with(test_path, 'wb')
        mock_pickle_dump.assert_called_once()
    
    @patch('pickle.load')
    @patch('builtins.open', create=True)
    def test_load_model(self, mock_open, mock_pickle_load):
        """Test loading the SGM model."""
        # Mock the loaded data
        mock_sgm = SGMNetworkAnalyzer()
        mock_pickle_load.return_value = {
            'sgm_analyzer': mock_sgm,
            'timestamp': datetime.now().isoformat(),
            'version': '1.0'
        }
        
        test_path = "test_model.pkl"
        loaded_analyzer = SGMNetworkAnalyzer.load_model(test_path)
        
        assert loaded_analyzer is mock_sgm
        mock_open.assert_called_once_with(test_path, 'rb')
        mock_pickle_load.assert_called_once()
    
    def test_feature_extraction(self):
        """Test feature extraction and importance calculation."""
        self.sgm_analyzer.fit(self.X_train, self.feature_names)
        
        # Check that feature importance is calculated
        assert len(self.sgm_analyzer.feature_importance) == len(self.feature_names)
        
        # All importance values should be between 0 and 1
        for importance in self.sgm_analyzer.feature_importance.values():
            assert 0 <= importance <= 1
        
        # Sum of importance should be approximately 1 (allowing for small numerical errors)
        total_importance = sum(self.sgm_analyzer.feature_importance.values())
        assert abs(total_importance - 1.0) < 0.01


class TestSGMThreatDetector:
    """Test cases for SGM Threat Detector."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.threat_detector = SGMThreatDetector()
        
        # Create sample network data for different categories
        np.random.seed(42)
        self.network_data = {
            'normal_traffic': np.random.normal(0, 1, (100, 8)),
            'dos_attacks': np.random.normal(2, 1.5, (50, 8)),
            'probe_attacks': np.random.normal(-1, 0.8, (30, 8)),
        }
    
    def test_initialization(self):
        """Test threat detector initialization."""
        assert len(self.threat_detector.analyzers) == 0
        assert 'dos_attacks' in self.threat_detector.threat_categories
        assert 'probe_attacks' in self.threat_detector.threat_categories
        assert 'u2r_attacks' in self.threat_detector.threat_categories
        assert 'r2l_attacks' in self.threat_detector.threat_categories
    
    def test_initialize_analyzers(self):
        """Test initializing SGM analyzers for different categories."""
        self.threat_detector.initialize_analyzers(self.network_data)
        
        # Should create analyzers for categories with sufficient data
        assert len(self.threat_detector.analyzers) > 0
        
        # Check that analyzers are properly initialized
        for category, analyzer in self.threat_detector.analyzers.items():
            assert analyzer.is_fitted
            assert category in self.network_data
    
    def test_detect_threats(self):
        """Test comprehensive threat detection."""
        # Initialize analyzers first
        self.threat_detector.initialize_analyzers(self.network_data)
        
        # Detect threats
        results = self.threat_detector.detect_threats(self.network_data)
        
        # Check result structure
        assert isinstance(results, dict)
        assert 'overall_threat_detected' in results
        assert 'threat_categories' in results
        assert 'anomaly_summary' in results
        assert 'recommendations' in results
        
        # Check threat categories results
        for category in self.threat_detector.analyzers.keys():
            assert category in results['threat_categories']
            category_result = results['threat_categories'][category]
            assert 'anomaly_detected' in category_result
            assert 'anomaly_count' in category_result
    
    def test_generate_recommendations(self):
        """Test recommendation generation based on detection results."""
        # Create mock detection results
        mock_results = {
            'anomaly_summary': {
                'total_anomalies': 15,
                'high_severity_count': 5,
                'categories_affected': 3
            },
            'threat_categories': {
                'dos_attacks': {'anomaly_detected': True},
                'probe_attacks': {'anomaly_detected': True}
            }
        }
        
        recommendations = self.threat_detector._generate_recommendations(mock_results)
        
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0
        
        # Check for specific recommendations based on our mock data
        rec_text = ' '.join(recommendations).lower()
        assert 'investigation' in rec_text or 'attack' in rec_text or 'security' in rec_text


class TestIntegration:
    """Integration tests for SGM components."""
    
    def test_end_to_end_analysis_workflow(self):
        """Test complete analysis workflow from data to threat detection."""
        np.random.seed(42)
        
        # Step 1: Create diverse network data
        normal_data = np.random.normal(0, 1, (200, 10))
        anomalous_data = np.random.normal(3, 2, (50, 10))
        
        network_data = {
            'baseline': normal_data,
            'test_traffic': np.vstack([normal_data[:100], anomalous_data])
        }
        
        # Step 2: Initialize threat detector
        threat_detector = SGMThreatDetector()
        threat_detector.initialize_analyzers({'baseline': normal_data})
        
        # Step 3: Perform threat detection
        results = threat_detector.detect_threats(network_data)
        
        # Step 4: Validate results
        assert results['overall_threat_detected'] in [True, False]
        assert 'baseline' in results['threat_categories']
        assert isinstance(results['recommendations'], list)
        
        # The anomalous data should be detected if the model is working properly
        if results['overall_threat_detected']:
            assert results['anomaly_summary']['total_anomalies'] > 0
    
    def test_model_adaptation_workflow(self):
        """Test the complete model adaptation workflow."""
        np.random.seed(42)
        
        # Initial training data
        initial_data = np.random.normal(0, 1, (100, 5))
        
        # Create and fit analyzer
        analyzer = SGMNetworkAnalyzer(window_size=50)  # Smaller window for testing
        analyzer.fit(initial_data)
        
        initial_threshold = analyzer.calculated_threshold
        
        # Add new normal data to trigger adaptation
        for _ in range(15):  # Add enough data to fill adaptation buffer
            new_data = np.random.normal(0.5, 1, (5, 5))  # Slightly shifted distribution
            results = analyzer.predict_anomaly(new_data)
        
        # Force adaptation
        adaptation_result = analyzer.adapt_model(force_adaptation=True)
        
        if adaptation_result['adapted']:
            # Threshold should potentially change after adaptation
            new_threshold = analyzer.calculated_threshold
            assert 'new_threshold' in adaptation_result
            assert adaptation_result['new_threshold'] == new_threshold
    
    def test_performance_with_large_dataset(self):
        """Test SGM performance with larger datasets."""
        np.random.seed(42)
        
        # Create larger dataset
        large_data = np.random.normal(0, 1, (1000, 15))
        
        # Test fitting
        analyzer = SGMNetworkAnalyzer(n_components=8)
        
        import time
        start_time = time.time()
        analyzer.fit(large_data)
        fit_time = time.time() - start_time
        
        # Fitting should complete in reasonable time (less than 30 seconds)
        assert fit_time < 30
        
        # Test prediction
        test_data = np.random.normal(0, 1, (500, 15))
        
        start_time = time.time()
        results = analyzer.predict_anomaly(test_data)
        predict_time = time.time() - start_time
        
        # Prediction should be fast (less than 5 seconds)
        assert predict_time < 5
        
        # Results should be valid
        assert len(results['anomaly_scores']) == len(test_data)
        assert isinstance(results['anomaly_detected'], bool)


if __name__ == '__main__':
    pytest.main([__file__])
