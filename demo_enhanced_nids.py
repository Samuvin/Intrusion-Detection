#!/usr/bin/env python3
"""
Enhanced NIDS Demo Script - Demonstrates log analysis and SGM capabilities.

This script demonstrates the enhanced NIDS system with:
1. Log ingestion and processing
2. SGM (Statistical Gaussian Mixture) analysis
3. Enhanced CSA optimization
4. Threat detection and visualization
"""

import asyncio
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
import logging
import sys
import os
from pathlib import Path

# Add the backend directory to Python path
sys.path.append('backend')

from app.data.log_ingestion import LogProcessor, LogFormat, LogAggregator, LogEntry
from app.ml.sgm_analyzer import SGMNetworkAnalyzer, SGMThreatDetector
from app.ml.enhanced_csa_optimizer import EnhancedCSAOptimizer, OptimizationObjective
from app.data.enhanced_pipeline import EnhancedDataPipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class NIDSDemo:
    """Comprehensive NIDS system demonstration."""
    
    def __init__(self):
        """Initialize the demo environment."""
        self.log_processor = LogProcessor()
        self.log_aggregator = LogAggregator(window_size=600)  # 10 minute window
        self.sgm_analyzer = None
        self.threat_detector = SGMThreatDetector()
        self.enhanced_pipeline = EnhancedDataPipeline(
            db_path="demo_data/nids_demo.db",
            data_dir="demo_data/pipeline"
        )
        self.results = {}
        
        # Ensure demo data directory exists
        Path("demo_data").mkdir(exist_ok=True)
        
        logger.info("Enhanced NIDS Demo initialized")
    
    async def generate_sample_logs(self, count: int = 1000) -> list:
        """Generate sample network logs with various patterns."""
        logger.info(f"Generating {count} sample log entries...")
        
        np.random.seed(42)  # For reproducible results
        logs = []
        
        # Define different traffic patterns
        patterns = {
            'normal': 0.7,      # 70% normal traffic
            'dos_attack': 0.1,  # 10% DoS attacks
            'probe': 0.1,       # 10% probing/scanning
            'suspicious': 0.1   # 10% other suspicious activity
        }
        
        base_time = datetime.now(timezone.utc) - timedelta(hours=2)
        
        for i in range(count):
            # Determine pattern type
            rand_val = np.random.random()
            if rand_val < patterns['normal']:
                pattern_type = 'normal'
            elif rand_val < patterns['normal'] + patterns['dos_attack']:
                pattern_type = 'dos_attack'
            elif rand_val < patterns['normal'] + patterns['dos_attack'] + patterns['probe']:
                pattern_type = 'probe'
            else:
                pattern_type = 'suspicious'
            
            # Generate log entry based on pattern
            log_entry = self._generate_log_by_pattern(pattern_type, base_time + timedelta(seconds=i*2))
            logs.append(log_entry)
        
        logger.info(f"Generated {len(logs)} log entries with various threat patterns")
        return logs
    
    def _generate_log_by_pattern(self, pattern: str, timestamp: datetime) -> dict:
        """Generate a log entry based on the specified pattern."""
        base_log = {
            "timestamp": timestamp.isoformat(),
            "log_source": "demo_generator"
        }
        
        if pattern == 'normal':
            # Normal web traffic
            source_ips = ["192.168.1." + str(np.random.randint(10, 50)) for _ in range(20)]
            base_log.update({
                "source_ip": np.random.choice(source_ips),
                "destination_ip": "10.0.0.1",
                "source_port": np.random.choice([80, 443, 8080]),
                "destination_port": np.random.choice([80, 443]),
                "protocol": "tcp",
                "method": np.random.choice(["GET", "POST", "PUT"]),
                "uri": np.random.choice(["/", "/api/users", "/api/data", "/static/js/app.js"]),
                "status_code": np.random.choice([200, 201, 304], p=[0.8, 0.1, 0.1]),
                "bytes_sent": np.random.randint(100, 5000),
                "bytes_received": np.random.randint(50, 2000),
                "duration": np.random.exponential(0.5),
                "user_agent": "Mozilla/5.0 (Normal Browser)"
            })
        
        elif pattern == 'dos_attack':
            # DoS attack pattern - high frequency from few IPs
            attacker_ips = ["203.0.113." + str(i) for i in range(5, 10)]
            base_log.update({
                "source_ip": np.random.choice(attacker_ips),
                "destination_ip": "10.0.0.1",
                "source_port": np.random.randint(1024, 65535),
                "destination_port": 80,
                "protocol": "tcp",
                "method": "GET",
                "uri": "/",
                "status_code": np.random.choice([200, 503, 429], p=[0.3, 0.5, 0.2]),
                "bytes_sent": np.random.randint(10, 100),  # Small requests
                "bytes_received": np.random.randint(5, 50),
                "duration": np.random.exponential(0.1),  # Very fast requests
                "user_agent": "AttackBot/1.0"
            })
        
        elif pattern == 'probe':
            # Port scanning / probing activity
            scanner_ips = ["198.51.100." + str(i) for i in range(20, 25)]
            base_log.update({
                "source_ip": np.random.choice(scanner_ips),
                "destination_ip": "10.0.0." + str(np.random.randint(1, 10)),
                "source_port": np.random.randint(1024, 65535),
                "destination_port": np.random.choice([22, 23, 25, 53, 80, 110, 143, 443, 993, 995]),
                "protocol": np.random.choice(["tcp", "udp"]),
                "method": "GET" if np.random.random() > 0.3 else None,
                "status_code": np.random.choice([404, 403, 400], p=[0.6, 0.3, 0.1]),
                "bytes_sent": np.random.randint(1, 50),
                "bytes_received": np.random.randint(1, 20),
                "duration": np.random.exponential(2.0),  # Slower responses
                "user_agent": "Scanner/2.1"
            })
        
        else:  # suspicious
            # Various suspicious activities
            suspicious_ips = ["172.16.0." + str(i) for i in range(100, 110)]
            base_log.update({
                "source_ip": np.random.choice(suspicious_ips),
                "destination_ip": "10.0.0.1",
                "source_port": np.random.randint(1024, 65535),
                "destination_port": np.random.choice([80, 443, 8080]),
                "protocol": "tcp",
                "method": np.random.choice(["POST", "PUT", "DELETE"]),
                "uri": np.random.choice(["/admin", "/api/admin", "/config", "/backup"]),
                "status_code": np.random.choice([401, 403, 500], p=[0.5, 0.3, 0.2]),
                "bytes_sent": np.random.randint(500, 10000),  # Larger requests
                "bytes_received": np.random.randint(100, 1000),
                "duration": np.random.exponential(1.0),
                "user_agent": "curl/7.68.0"
            })
        
        return base_log
    
    async def demonstrate_log_ingestion(self):
        """Demonstrate log ingestion and processing capabilities."""
        logger.info("\n=== Demonstrating Log Ingestion ===")
        
        # Generate sample logs
        sample_logs = await self.generate_sample_logs(500)
        
        # Convert to JSON lines format
        log_lines = [json.dumps(log) for log in sample_logs]
        
        # Set up callback to capture processed entries
        processed_entries = []
        
        async def capture_entries(entries):
            processed_entries.extend(entries)
            await self.log_aggregator.add_log_entries(entries)
        
        self.log_processor.add_processing_callback(capture_entries)
        
        # Process the logs
        entries = await self.log_processor.process_log_stream(
            log_lines, LogFormat.JSON, "demo_logs"
        )
        
        # Store in enhanced pipeline
        metadata = await self.enhanced_pipeline.store_log_batch(
            processed_entries, "demo_batch", extract_features=True
        )
        
        logger.info(f"Processed {len(entries)} log entries")
        logger.info(f"Unique source IPs: {len(set(e.source_ip for e in entries if e.source_ip))}")
        logger.info(f"Stored batch ID: {metadata.log_id}")
        
        # Get aggregated features
        features = await self.log_aggregator.get_aggregated_features()
        logger.info(f"Extracted feature types: {list(features.keys())}")
        
        self.results['log_ingestion'] = {
            'entries_processed': len(entries),
            'batch_id': metadata.log_id,
            'features': features
        }
        
        return entries, features
    
    async def demonstrate_sgm_analysis(self, features: dict):
        """Demonstrate SGM (Statistical Gaussian Mixture) analysis."""
        logger.info("\n=== Demonstrating SGM Analysis ===")
        
        if not features:
            logger.warning("No features available for SGM analysis")
            return None
        
        # Use the largest feature set for demonstration
        feature_type = max(features.keys(), key=lambda k: len(features[k]))
        feature_data = np.array(features[feature_type])
        
        logger.info(f"Using {feature_type} features: {feature_data.shape}")
        
        # Create and train SGM analyzer
        self.sgm_analyzer = SGMNetworkAnalyzer(
            n_components=5,
            covariance_type='full',
            anomaly_threshold=0.05,
            adaptation_rate=0.1,
            window_size=200
        )
        
        # Generate feature names
        feature_names = [f"{feature_type}_{i}" for i in range(feature_data.shape[1])]
        
        # Fit the model
        logger.info("Training SGM model...")
        self.sgm_analyzer.fit(feature_data, feature_names)
        
        # Store the model
        model_metadata = await self.enhanced_pipeline.store_sgm_model(
            self.sgm_analyzer, "demo_sgm_model", "1.0",
            tags=["demo", "baseline"],
            performance_metrics={"training_samples": len(feature_data)}
        )
        
        logger.info(f"SGM model trained and stored: {model_metadata.model_id}")
        
        # Perform anomaly detection on the same data (normally you'd use new data)
        logger.info("Performing anomaly detection...")
        analysis_results = self.sgm_analyzer.predict_anomaly(feature_data)
        
        logger.info(f"Anomalies detected: {analysis_results['anomaly_count']}")
        logger.info(f"Anomaly percentage: {analysis_results['anomaly_percentage']:.2f}%")
        logger.info(f"Anomaly threshold: {analysis_results['threshold']:.4f}")
        logger.info(f"Max anomaly score: {analysis_results['max_score']:.4f}")
        
        # Get model info
        model_info = self.sgm_analyzer.get_model_info()
        logger.info(f"Model components: {model_info['n_components']}")
        logger.info(f"Features used: {model_info['feature_count']}")
        
        self.results['sgm_analysis'] = {
            'model_id': model_metadata.model_id,
            'anomalies_detected': analysis_results['anomaly_count'],
            'anomaly_percentage': analysis_results['anomaly_percentage'],
            'model_info': model_info
        }
        
        return analysis_results
    
    async def demonstrate_threat_detection(self, features: dict):
        """Demonstrate comprehensive threat detection."""
        logger.info("\n=== Demonstrating Threat Detection ===")
        
        if not features:
            logger.warning("No features available for threat detection")
            return None
        
        # Initialize threat detector
        self.threat_detector.initialize_analyzers(features)
        
        # Perform threat detection
        logger.info("Analyzing threats across multiple categories...")
        threat_results = self.threat_detector.detect_threats(features)
        
        logger.info(f"Overall threat detected: {threat_results['overall_threat_detected']}")
        logger.info(f"Total anomalies: {threat_results['anomaly_summary']['total_anomalies']}")
        logger.info(f"High severity count: {threat_results['anomaly_summary']['high_severity_count']}")
        logger.info(f"Categories affected: {threat_results['anomaly_summary']['categories_affected']}")
        
        # Display recommendations
        if threat_results['recommendations']:
            logger.info("Security Recommendations:")
            for i, rec in enumerate(threat_results['recommendations'], 1):
                logger.info(f"  {i}. {rec}")
        
        # Display category-specific results
        for category, results in threat_results['threat_categories'].items():
            if results['anomaly_detected']:
                logger.info(f"  {category}: {results['anomaly_count']} anomalies "
                          f"({results['anomaly_percentage']:.2f}%)")
        
        self.results['threat_detection'] = threat_results
        
        return threat_results
    
    async def demonstrate_csa_optimization(self, features: dict):
        """Demonstrate enhanced CSA optimization."""
        logger.info("\n=== Demonstrating Enhanced CSA Optimization ===")
        
        if not features or not self.sgm_analyzer:
            logger.warning("Prerequisites not met for CSA optimization")
            return None
        
        # Prepare data for optimization
        feature_type = max(features.keys(), key=lambda k: len(features[k]))
        X_data = np.array(features[feature_type])
        
        # Create dummy labels for demonstration (in practice, you'd have real labels)
        y_data = np.zeros(len(X_data))
        # Add some positive labels for variety
        y_data[np.random.choice(len(y_data), size=len(y_data)//10, replace=False)] = 1
        
        logger.info(f"Optimizing with {len(X_data)} samples, {X_data.shape[1]} features")
        
        # Define optimization objectives
        objectives = [
            OptimizationObjective("accuracy", 0.3, minimize=False),
            OptimizationObjective("sgm_detection_rate", 0.3, minimize=False),
            OptimizationObjective("sgm_stability", 0.2, minimize=False),
            OptimizationObjective("sgm_adaptation", 0.2, minimize=False)
        ]
        
        # Create enhanced CSA optimizer
        optimizer = EnhancedCSAOptimizer(
            population_size=10,  # Small for demo
            max_iterations=15,   # Few iterations for demo
            objectives=objectives,
            parallel_evaluation=False,  # Disable for demo simplicity
            adaptive_parameters=True
        )
        
        logger.info("Starting multi-objective optimization (this may take a while)...")
        
        # Create a simple dummy classifier for demonstration
        from sklearn.ensemble import RandomForestClassifier
        dummy_classifier = RandomForestClassifier(random_state=42, n_estimators=10)
        
        try:
            # Run optimization
            optimization_results = optimizer.optimize_multi_objective(
                X_data[:200],  # Use subset for faster demo
                y_data[:200], 
                dummy_classifier,
                self.sgm_analyzer,
                cv_folds=3,
                include_sgm=True
            )
            
            logger.info(f"Optimization completed in {optimization_results.optimization_time:.2f} seconds")
            logger.info(f"Best fitness: {optimization_results.best_fitness:.4f}")
            logger.info(f"Iterations completed: {optimization_results.iterations_completed}")
            logger.info(f"Pareto front size: {len(optimization_results.pareto_front)}")
            
            # Display best parameters
            logger.info("Best parameters found:")
            for param, value in optimization_results.best_parameters.items():
                logger.info(f"  {param}: {value}")
            
            # Display objective scores
            logger.info("Objective scores:")
            for obj, score in optimization_results.objective_scores.items():
                logger.info(f"  {obj}: {score:.4f}")
            
            self.results['csa_optimization'] = {
                'best_fitness': optimization_results.best_fitness,
                'optimization_time': optimization_results.optimization_time,
                'best_parameters': optimization_results.best_parameters,
                'pareto_front_size': len(optimization_results.pareto_front)
            }
            
            return optimization_results
            
        except Exception as e:
            logger.error(f"Optimization failed: {str(e)}")
            return None
    
    async def demonstrate_pipeline_capabilities(self):
        """Demonstrate enhanced data pipeline capabilities."""
        logger.info("\n=== Demonstrating Enhanced Data Pipeline ===")
        
        # Get pipeline statistics
        stats = await self.enhanced_pipeline.get_pipeline_statistics()
        
        logger.info("Pipeline Statistics:")
        logger.info(f"  Total log batches: {stats.get('total_log_batches', 0)}")
        logger.info(f"  Total log entries: {stats.get('total_log_entries', 0)}")
        logger.info(f"  Active SGM models: {stats.get('active_models', 0)}")
        logger.info(f"  Total analyses performed: {stats.get('total_analyses', 0)}")
        logger.info(f"  Anomalies detected: {stats.get('anomalies_detected', 0)}")
        
        # Show recent activity
        logger.info(f"  Recent log batches (24h): {stats.get('recent_log_batches', 0)}")
        logger.info(f"  Recent analyses (24h): {stats.get('recent_analyses', 0)}")
        
        # Storage information
        data_size_mb = stats.get('data_directory_size', 0) / (1024 * 1024)
        db_size_mb = stats.get('database_size', 0) / (1024 * 1024)
        logger.info(f"  Data directory size: {data_size_mb:.2f} MB")
        logger.info(f"  Database size: {db_size_mb:.2f} MB")
        
        self.results['pipeline_stats'] = stats
        
        return stats
    
    def generate_report(self):
        """Generate a comprehensive demo report."""
        logger.info("\n" + "="*60)
        logger.info("ENHANCED NIDS DEMONSTRATION REPORT")
        logger.info("="*60)
        
        if 'log_ingestion' in self.results:
            logger.info(f"\nLog Ingestion Results:")
            logger.info(f"  Entries Processed: {self.results['log_ingestion']['entries_processed']}")
            logger.info(f"  Feature Types: {len(self.results['log_ingestion']['features'])}")
        
        if 'sgm_analysis' in self.results:
            logger.info(f"\nSGM Analysis Results:")
            logger.info(f"  Anomalies Detected: {self.results['sgm_analysis']['anomalies_detected']}")
            logger.info(f"  Anomaly Rate: {self.results['sgm_analysis']['anomaly_percentage']:.2f}%")
            logger.info(f"  Model Components: {self.results['sgm_analysis']['model_info']['n_components']}")
        
        if 'threat_detection' in self.results:
            logger.info(f"\nThreat Detection Results:")
            threat_res = self.results['threat_detection']
            logger.info(f"  Overall Threat: {threat_res['overall_threat_detected']}")
            logger.info(f"  Total Anomalies: {threat_res['anomaly_summary']['total_anomalies']}")
            logger.info(f"  High Severity: {threat_res['anomaly_summary']['high_severity_count']}")
            logger.info(f"  Recommendations: {len(threat_res['recommendations'])}")
        
        if 'csa_optimization' in self.results:
            logger.info(f"\nCSA Optimization Results:")
            opt_res = self.results['csa_optimization']
            logger.info(f"  Best Fitness: {opt_res['best_fitness']:.4f}")
            logger.info(f"  Optimization Time: {opt_res['optimization_time']:.2f}s")
            logger.info(f"  Pareto Solutions: {opt_res['pareto_front_size']}")
        
        if 'pipeline_stats' in self.results:
            logger.info(f"\nPipeline Statistics:")
            stats = self.results['pipeline_stats']
            logger.info(f"  Log Entries: {stats.get('total_log_entries', 0)}")
            logger.info(f"  SGM Models: {stats.get('active_models', 0)}")
            logger.info(f"  Analyses: {stats.get('total_analyses', 0)}")
        
        logger.info("\n" + "="*60)
        logger.info("Demo completed successfully!")
        logger.info("="*60)
    
    async def run_full_demo(self):
        """Run the complete Enhanced NIDS demonstration."""
        logger.info("Starting Enhanced NIDS System Demonstration...")
        
        try:
            # Step 1: Log Ingestion
            entries, features = await self.demonstrate_log_ingestion()
            
            # Step 2: SGM Analysis
            sgm_results = await self.demonstrate_sgm_analysis(features)
            
            # Step 3: Threat Detection
            threat_results = await self.demonstrate_threat_detection(features)
            
            # Step 4: CSA Optimization
            opt_results = await self.demonstrate_csa_optimization(features)
            
            # Step 5: Pipeline Statistics
            pipeline_stats = await self.demonstrate_pipeline_capabilities()
            
            # Generate final report
            self.generate_report()
            
        except Exception as e:
            logger.error(f"Demo failed: {str(e)}")
            import traceback
            traceback.print_exc()
        
        finally:
            logger.info("Demo cleanup completed")


async def main():
    """Main demo entry point."""
    print("Enhanced NIDS System - Comprehensive Demonstration")
    print("=" * 60)
    print("This demo showcases:")
    print("  • Multi-format log ingestion and processing")
    print("  • SGM (Statistical Gaussian Mixture) anomaly detection")
    print("  • Enhanced CSA multi-objective optimization")
    print("  • Comprehensive threat detection and analysis")
    print("  • Advanced data pipeline with metadata management")
    print("=" * 60)
    
    # Create and run demo
    demo = NIDSDemo()
    await demo.run_full_demo()


if __name__ == '__main__':
    # Run the demo
    asyncio.run(main())
