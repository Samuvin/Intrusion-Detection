"""
API endpoints for log analysis and SGM model management.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
import asyncio
import json
import os
import tempfile
import numpy as np
from pathlib import Path

from app.core.logging import get_logger
from app.data.log_ingestion import LogProcessor, LogFormat, LogAggregator
from app.ml.sgm_analyzer import SGMNetworkAnalyzer, SGMThreatDetector
from app.ml.enhanced_csa_optimizer import EnhancedCSAOptimizer, OptimizationObjective

logger = get_logger(__name__)
router = APIRouter()

# Global instances (in production, these would be managed differently)
log_processor = LogProcessor()
log_aggregator = LogAggregator()
sgm_threat_detector = SGMThreatDetector()

# WebSocket manager (imported after to avoid circular dependency)
websocket_manager = None

def get_websocket_manager():
    """Get WebSocket manager (lazy import to avoid circular dependency)."""
    global websocket_manager
    if websocket_manager is None:
        from app.api.endpoints.monitoring import manager
        websocket_manager = manager
    return websocket_manager


class LogSubmissionRequest(BaseModel):
    """Request model for log submission."""
    log_lines: List[str] = Field(..., description="List of log lines to process")
    log_format: str = Field("json", description="Format of the logs (json, csv, syslog, apache, nginx, custom)")
    source_name: str = Field("api_submission", description="Name of the log source")
    real_time: bool = Field(True, description="Whether to process logs in real-time")


class SGMModelRequest(BaseModel):
    """Request model for SGM model operations."""
    model_name: str = Field(..., description="Name of the SGM model")
    n_components: Optional[int] = Field(5, description="Number of Gaussian components")
    covariance_type: Optional[str] = Field("full", description="Type of covariance parameters")
    anomaly_threshold: Optional[float] = Field(0.05, description="Anomaly detection threshold")
    adaptation_rate: Optional[float] = Field(0.1, description="Model adaptation rate")
    window_size: Optional[int] = Field(1000, description="Sliding window size")


class OptimizationRequest(BaseModel):
    """Request model for SGM optimization."""
    include_ml_params: bool = Field(True, description="Include ML hyperparameters in optimization")
    include_sgm_params: bool = Field(True, description="Include SGM parameters in optimization")
    max_iterations: int = Field(50, description="Maximum optimization iterations")
    population_size: int = Field(20, description="Population size for CSA")
    objectives: Optional[List[Dict[str, Any]]] = Field(None, description="Custom optimization objectives")


class ThreatAnalysisRequest(BaseModel):
    """Request model for threat analysis."""
    analyze_historical: bool = Field(True, description="Analyze historical log data")
    time_window_hours: int = Field(24, description="Time window for analysis in hours")
    threat_categories: Optional[List[str]] = Field(None, description="Specific threat categories to analyze")


# Log Processing Endpoints

@router.post("/logs/submit")
async def submit_logs(request: LogSubmissionRequest) -> Dict[str, Any]:
    """
    Submit log lines for processing and analysis.
    """
    try:
        # Validate log format
        try:
            log_format = LogFormat(request.log_format.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid log format. Supported formats: {[f.value for f in LogFormat]}"
            )
        
        # Process logs
        processed_entries = await log_processor.process_log_stream(
            request.log_lines,
            log_format,
            request.source_name
        )
        
        # Add to aggregator for analysis
        if request.real_time:
            await log_aggregator.add_log_entries(processed_entries)
            
            # Broadcast to all connected WebSocket clients in real-time
            try:
                manager = get_websocket_manager()
                
                # Format entries for frontend display with comprehensive network data
                network_flow_data = []
                for entry in processed_entries[:10]:  # Last 10 entries
                    if entry:
                        entry_dict = entry.to_dict()
                        network_flow_data.append({
                            'timestamp': entry_dict.get('timestamp', datetime.now().isoformat()),
                            'requests': 1,
                            'source_ip': entry_dict.get('source_ip', 'unknown'),
                            'destination_ip': entry_dict.get('destination_ip', 'unknown'),
                            'source_port': entry_dict.get('source_port'),
                            'destination_port': entry_dict.get('destination_port'),
                            'bytes': (entry_dict.get('bytes_sent', 0) or 0) + (entry_dict.get('bytes_received', 0) or 0),
                            'bytes_sent': entry_dict.get('bytes_sent', 0) or 0,
                            'bytes_received': entry_dict.get('bytes_received', 0) or 0,
                            'response_time': entry_dict.get('duration', 0) * 1000 if entry_dict.get('duration') else 0,  # Convert to ms
                            'status_code': entry_dict.get('status_code'),
                            'method': entry_dict.get('method'),
                            'protocol': entry_dict.get('protocol'),
                            'connection_type': entry_dict.get('connection_type'),
                            'http_version': entry_dict.get('http_version'),
                            'scheme': entry_dict.get('scheme'),
                            'hostname': entry_dict.get('hostname'),
                            'path': entry_dict.get('path'),
                            'user_agent': entry_dict.get('user_agent'),
                            'content_type': entry_dict.get('content_type'),
                            'server': entry_dict.get('server'),
                            'dns_time_ms': entry_dict.get('dns_time_ms', 0) or 0,
                            'tcp_connect_time_ms': entry_dict.get('tcp_connect_time_ms', 0) or 0,
                            'ssl_handshake_time_ms': entry_dict.get('ssl_handshake_time_ms', 0) or 0,
                            'redirect_count': entry_dict.get('redirect_count', 0) or 0,
                            'is_secure': entry_dict.get('is_secure', False),
                            'request_id': entry_dict.get('request_id'),
                        })
                
                # Prepare log analysis data for dashboard
                log_data = {
                    'type': 'log_analysis',
                    'timestamp': datetime.now().isoformat(),
                    'source': request.source_name,
                    'entries_count': len(processed_entries),
                    'anomalies': [],  # Will be populated by SGM analysis
                    'networkFlow': network_flow_data,
                    'threatAlerts': []
                }
                
                # Get statistics
                try:
                    stats = log_aggregator.get_statistics()
                    log_data['statistics'] = {
                        'total_entries': stats.get('total_entries', 0),
                        'entries_per_second': stats.get('entries_per_second', 0),
                        'unique_sources': stats.get('unique_sources', 0),
                        'error_rate': stats.get('error_rate', 0)
                    }
                except:
                    pass
                
                # Send to all connected clients via WebSocket
                await manager.broadcast(json.dumps(log_data))
                logger.debug(f"Broadcasted {len(processed_entries)} log entries to dashboard")
            except Exception as e:
                logger.debug(f"WebSocket broadcast failed (non-critical): {str(e)}")
        
        # Generate basic statistics
        stats = {
            'total_processed': len(processed_entries),
            'successful_parses': len([e for e in processed_entries if e is not None]),
            'source_ips': len(set(e.source_ip for e in processed_entries if e and e.source_ip)),
            'time_range': {
                'start': min(e.timestamp for e in processed_entries if e).isoformat() if processed_entries else None,
                'end': max(e.timestamp for e in processed_entries if e).isoformat() if processed_entries else None
            }
        }
        
        return {
            'status': 'success',
            'message': f'Processed {len(processed_entries)} log entries',
            'statistics': stats,
            'processed_entries': [entry.to_dict() for entry in processed_entries if entry][:10]  # Return first 10 for preview
        }
        
    except Exception as e:
        logger.error(f"Log submission failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Log processing failed: {str(e)}")


@router.post("/logs/upload")
async def upload_log_file(
    file: UploadFile = File(...),
    log_format: str = "auto",
    source_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Upload and process a log file.
    """
    try:
        # Determine log format
        if log_format == "auto":
            # Auto-detect based on file extension or content
            filename = file.filename.lower()
            if filename.endswith('.json'):
                log_format_enum = LogFormat.JSON
            elif filename.endswith('.csv'):
                log_format_enum = LogFormat.CSV
            else:
                log_format_enum = LogFormat.CUSTOM
        else:
            try:
                log_format_enum = LogFormat(log_format.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid log format. Supported formats: {[f.value for f in LogFormat]}"
                )
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Process the log file
            source_name = source_name or file.filename
            processed_entries = await log_processor.process_log_file(
                tmp_file_path,
                log_format_enum,
                source_name
            )
            
            # Add to aggregator
            await log_aggregator.add_log_entries(processed_entries)
            
            # Generate statistics
            stats = {
                'file_name': file.filename,
                'file_size': len(content),
                'total_processed': len(processed_entries),
                'successful_parses': len([e for e in processed_entries if e is not None]),
                'unique_sources': len(set(e.source_ip for e in processed_entries if e and e.source_ip)),
                'time_range': {
                    'start': min(e.timestamp for e in processed_entries if e).isoformat() if processed_entries else None,
                    'end': max(e.timestamp for e in processed_entries if e).isoformat() if processed_entries else None
                }
            }
            
            return {
                'status': 'success',
                'message': f'Processed log file: {file.filename}',
                'statistics': stats
            }
            
        finally:
            # Clean up temporary file
            os.unlink(tmp_file_path)
        
    except Exception as e:
        logger.error(f"Log file upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")


@router.get("/logs/statistics")
async def get_log_statistics() -> Dict[str, Any]:
    """
    Get current log processing statistics.
    """
    try:
        stats = log_aggregator.get_statistics()
        
        return {
            'status': 'success',
            'statistics': stats,
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get log statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Statistics retrieval failed: {str(e)}")


@router.get("/logs/all")
async def get_all_logs(
    limit: Optional[int] = 1000,
    offset: Optional[int] = 0,
    source_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get all processed log entries with full network data.
    """
    try:
        # Get all entries from aggregator
        all_entries = log_aggregator.get_all_entries()
        
        # Filter by source if provided
        if source_name:
            all_entries = [e for e in all_entries if e and e.log_source == source_name]
        
        # Sort by timestamp (newest first)
        all_entries.sort(key=lambda x: x.timestamp if x and x.timestamp else datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        
        # Apply pagination
        total_count = len(all_entries)
        paginated_entries = all_entries[offset:offset + limit]
        
        # Convert to dictionaries with all fields
        log_data = []
        for entry in paginated_entries:
            if entry:
                entry_dict = entry.to_dict()
                # Include all network data
                log_data.append({
                    **entry_dict,
                    # Ensure response_time is in milliseconds
                    'response_time_ms': (entry_dict.get('duration', 0) * 1000) if entry_dict.get('duration') else 0,
                    'bytes_total': (entry_dict.get('bytes_sent', 0) or 0) + (entry_dict.get('bytes_received', 0) or 0),
                })
        
        return {
            'status': 'success',
            'logs': log_data,
            'total_count': total_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total_count,
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get all logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Log retrieval failed: {str(e)}")


# SGM Model Management Endpoints

@router.post("/sgm/models")
async def create_sgm_model(request: SGMModelRequest) -> Dict[str, Any]:
    """
    Create a new SGM model for network behavior analysis.
    """
    try:
        # Get aggregated features for training
        network_features = await log_aggregator.get_aggregated_features()
        
        if not network_features:
            raise HTTPException(
                status_code=400,
                detail="No network data available for model training. Please submit logs first."
            )
        
        # Create SGM analyzer
        sgm_analyzer = SGMNetworkAnalyzer(
            n_components=request.n_components,
            covariance_type=request.covariance_type,
            anomaly_threshold=request.anomaly_threshold,
            adaptation_rate=request.adaptation_rate,
            window_size=request.window_size
        )
        
        # Train on available data
        training_data = None
        feature_names = []
        
        # Use the largest available feature set for training
        for feature_type, data in network_features.items():
            if len(data) > 0 and (training_data is None or len(data) > len(training_data)):
                training_data = data
                feature_names = [f"{feature_type}_{i}" for i in range(data.shape[1])]
        
        if training_data is None or len(training_data) < 10:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for model training. Need at least 10 samples."
            )
        
        # Fit the model
        sgm_analyzer.fit(training_data, feature_names)
        
        # Save model
        model_dir = Path("models/sgm")
        model_dir.mkdir(parents=True, exist_ok=True)
        model_path = model_dir / f"{request.model_name}.pkl"
        sgm_analyzer.save_model(str(model_path))
        
        # Get model info
        model_info = sgm_analyzer.get_model_info()
        
        return {
            'status': 'success',
            'message': f'SGM model "{request.model_name}" created successfully',
            'model_info': model_info,
            'model_path': str(model_path),
            'training_samples': len(training_data)
        }
        
    except Exception as e:
        logger.error(f"SGM model creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model creation failed: {str(e)}")


@router.get("/sgm/models")
async def list_sgm_models() -> Dict[str, Any]:
    """
    List available SGM models.
    """
    try:
        model_dir = Path("models/sgm")
        models = []
        
        if model_dir.exists():
            for model_file in model_dir.glob("*.pkl"):
                try:
                    # Load model to get info
                    sgm_analyzer = SGMNetworkAnalyzer.load_model(str(model_file))
                    model_info = sgm_analyzer.get_model_info()
                    
                    models.append({
                        'name': model_file.stem,
                        'path': str(model_file),
                        'info': model_info,
                        'last_modified': datetime.fromtimestamp(model_file.stat().st_mtime).isoformat()
                    })
                except Exception as e:
                    logger.warning(f"Could not load model {model_file}: {str(e)}")
        
        return {
            'status': 'success',
            'models': models,
            'total_models': len(models)
        }
        
    except Exception as e:
        logger.error(f"Model listing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model listing failed: {str(e)}")


@router.post("/sgm/models/{model_name}/analyze")
async def analyze_with_sgm_model(model_name: str) -> Dict[str, Any]:
    """
    Analyze current network data with specified SGM model.
    """
    try:
        # Load the model
        model_path = Path("models/sgm") / f"{model_name}.pkl"
        if not model_path.exists():
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
        
        sgm_analyzer = SGMNetworkAnalyzer.load_model(str(model_path))
        
        # Get current network features
        network_features = await log_aggregator.get_aggregated_features()
        
        if not network_features:
            raise HTTPException(
                status_code=400,
                detail="No network data available for analysis. Please submit logs first."
            )
        
        # Analyze with each feature type
        analysis_results = {}
        
        for feature_type, data in network_features.items():
            if len(data) > 0:
                try:
                    result = sgm_analyzer.predict_anomaly(data)
                    analysis_results[feature_type] = result
                except Exception as e:
                    logger.warning(f"Analysis failed for {feature_type}: {str(e)}")
                    analysis_results[feature_type] = {'error': str(e)}
        
        # Generate summary
        total_anomalies = sum(
            result.get('anomaly_count', 0) 
            for result in analysis_results.values() 
            if 'anomaly_count' in result
        )
        
        return {
            'status': 'success',
            'model_name': model_name,
            'analysis_results': analysis_results,
            'summary': {
                'total_anomalies': total_anomalies,
                'feature_types_analyzed': len(analysis_results),
                'analysis_timestamp': datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"SGM analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/sgm/optimize")
async def optimize_sgm_parameters(
    background_tasks: BackgroundTasks,
    request: OptimizationRequest
) -> Dict[str, Any]:
    """
    Optimize SGM parameters using enhanced CSA optimizer.
    """
    try:
        # Get network features for optimization
        network_features = await log_aggregator.get_aggregated_features()
        
        if not network_features:
            raise HTTPException(
                status_code=400,
                detail="No network data available for optimization. Please submit logs first."
            )
        
        # Prepare optimization objectives
        objectives = []
        if request.objectives:
            # Use custom objectives
            for obj_data in request.objectives:
                objectives.append(OptimizationObjective(
                    name=obj_data['name'],
                    weight=obj_data.get('weight', 1.0),
                    minimize=obj_data.get('minimize', False)
                ))
        else:
            # Use default objectives
            objectives = [
                OptimizationObjective("accuracy", 0.3, minimize=False),
                OptimizationObjective("sgm_detection_rate", 0.3, minimize=False),
                OptimizationObjective("sgm_stability", 0.2, minimize=False),
                OptimizationObjective("sgm_adaptation", 0.2, minimize=False)
            ]
        
        # Create enhanced CSA optimizer
        optimizer = EnhancedCSAOptimizer(
            population_size=request.population_size,
            max_iterations=request.max_iterations,
            objectives=objectives,
            parallel_evaluation=True,
            adaptive_parameters=True
        )
        
        # Use largest feature set for optimization
        X_data = None
        for feature_type, data in network_features.items():
            if len(data) > 0 and (X_data is None or len(data) > len(X_data)):
                X_data = data
        
        if X_data is None or len(X_data) < 50:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for optimization. Need at least 50 samples."
            )
        
        # Create dummy labels for optimization (in practice, you'd have real labels)
        y_data = np.zeros(len(X_data))  # Placeholder labels
        
        # Create dummy classifier if ML optimization is included
        ml_classifier = None
        if request.include_ml_params:
            from sklearn.ensemble import RandomForestClassifier
            ml_classifier = RandomForestClassifier(random_state=42)
        
        # Create SGM analyzer for optimization
        sgm_analyzer = None
        if request.include_sgm_params:
            sgm_analyzer = SGMNetworkAnalyzer()
        
        # Start optimization in background
        def run_optimization():
            try:
                result = optimizer.optimize_multi_objective(
                    X_data, y_data, ml_classifier, sgm_analyzer,
                    include_sgm=request.include_sgm_params
                )
                
                # Save results
                results_dir = Path("models/optimization_results")
                results_dir.mkdir(parents=True, exist_ok=True)
                
                result_file = results_dir / f"optimization_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                
                # Convert result to serializable format
                result_data = {
                    'best_parameters': result.best_parameters,
                    'best_fitness': result.best_fitness,
                    'objective_scores': result.objective_scores,
                    'optimization_time': result.optimization_time,
                    'iterations_completed': result.iterations_completed,
                    'pareto_front_size': len(result.pareto_front),
                    'timestamp': datetime.now().isoformat()
                }
                
                with open(result_file, 'w') as f:
                    json.dump(result_data, f, indent=2)
                
                logger.info(f"Optimization completed and saved to {result_file}")
                
            except Exception as e:
                logger.error(f"Background optimization failed: {str(e)}")
        
        # Add optimization task to background
        background_tasks.add_task(run_optimization)
        
        return {
            'status': 'success',
            'message': 'Optimization started in background',
            'expected_duration_minutes': request.max_iterations * 0.5,  # Rough estimate
            'objectives': [{'name': obj.name, 'weight': obj.weight} for obj in objectives]
        }
        
    except Exception as e:
        logger.error(f"SGM optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


# Threat Analysis Endpoints

@router.post("/threats/analyze")
async def analyze_threats(request: ThreatAnalysisRequest) -> Dict[str, Any]:
    """
    Perform comprehensive threat analysis on network data.
    """
    try:
        # Get aggregated network features
        network_features = await log_aggregator.get_aggregated_features()
        
        if not network_features:
            raise HTTPException(
                status_code=400,
                detail="No network data available for threat analysis. Please submit logs first."
            )
        
        # Initialize threat detector if not already done
        if not sgm_threat_detector.analyzers:
            sgm_threat_detector.initialize_analyzers(network_features)
        
        # Perform threat detection
        threat_results = sgm_threat_detector.detect_threats(network_features)
        
        # Add additional analysis
        log_stats = log_aggregator.get_statistics()
        
        analysis_summary = {
            'threat_analysis': threat_results,
            'log_statistics': log_stats,
            'analysis_metadata': {
                'time_window_hours': request.time_window_hours,
                'categories_analyzed': len(network_features),
                'total_data_points': sum(len(data) for data in network_features.values()),
                'analysis_timestamp': datetime.now().isoformat()
            }
        }
        
        return {
            'status': 'success',
            'analysis': analysis_summary
        }
        
    except Exception as e:
        logger.error(f"Threat analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Threat analysis failed: {str(e)}")


@router.get("/threats/categories")
async def get_threat_categories() -> Dict[str, Any]:
    """
    Get supported threat categories and their descriptions.
    """
    try:
        categories = {
            'dos_attacks': {
                'name': 'DoS Attacks',
                'description': 'Denial of Service attacks including back, land, neptune, pod, smurf, teardrop',
                'severity': 'high',
                'indicators': ['high request rate', 'resource exhaustion', 'connection flooding']
            },
            'probe_attacks': {
                'name': 'Probe Attacks',
                'description': 'Network probing and scanning attacks including ipsweep, nmap, portsweep, satan',
                'severity': 'medium',
                'indicators': ['port scanning', 'network enumeration', 'service discovery']
            },
            'u2r_attacks': {
                'name': 'User to Root Attacks',
                'description': 'Privilege escalation attacks including buffer_overflow, loadmodule, perl, rootkit',
                'severity': 'critical',
                'indicators': ['privilege escalation', 'system compromise', 'unauthorized access']
            },
            'r2l_attacks': {
                'name': 'Remote to Local Attacks',
                'description': 'Remote access attacks including ftp_write, guess_passwd, imap, multihop',
                'severity': 'high',
                'indicators': ['unauthorized login attempts', 'password attacks', 'remote exploitation']
            },
            'modern_threats': {
                'name': 'Modern Threats',
                'description': 'Advanced threats including DDoS, APT, web attacks, botnet activity',
                'severity': 'critical',
                'indicators': ['coordinated attacks', 'persistent threats', 'advanced techniques']
            },
            'zero_day': {
                'name': 'Zero-day Threats',
                'description': 'Unknown attack patterns detected through behavioral analysis',
                'severity': 'critical',
                'indicators': ['anomalous behavior', 'unknown signatures', 'statistical deviations']
            }
        }
        
        return {
            'status': 'success',
            'threat_categories': categories,
            'total_categories': len(categories)
        }
        
    except Exception as e:
        logger.error(f"Failed to get threat categories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Categories retrieval failed: {str(e)}")


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check for log analysis service.
    """
    return {
        'status': 'healthy',
        'service': 'log_analysis_api',
        'timestamp': datetime.now().isoformat(),
        'components': {
            'log_processor': 'active',
            'log_aggregator': f'active ({len(log_aggregator.log_buffer)} entries in buffer)',
            'sgm_threat_detector': f'active ({len(sgm_threat_detector.analyzers)} analyzers)'
        }
    }
