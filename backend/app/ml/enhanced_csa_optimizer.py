"""
Enhanced Crow Search Algorithm (CSA) for Multi-Objective Optimization.
Supports optimization of both ML hyperparameters and SGM parameters.
"""

import numpy as np
from typing import Dict, Any, List, Tuple, Optional, Union, Callable
import logging
from dataclasses import dataclass
from sklearn.model_selection import cross_val_score
from sklearn.metrics import f1_score, accuracy_score, precision_score, recall_score, make_scorer
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor
import time

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.crow_search import CrowSearchOptimizer  # Import base class

logger = get_logger(__name__)


@dataclass
class OptimizationObjective:
    """Represents a single optimization objective."""
    name: str
    weight: float
    minimize: bool = False  # True if we want to minimize, False if maximize
    target_range: Optional[Tuple[float, float]] = None
    

@dataclass
class OptimizationResult:
    """Results from multi-objective optimization."""
    best_parameters: Dict[str, Any]
    best_fitness: float
    objective_scores: Dict[str, float]
    convergence_history: List[Dict[str, Any]]
    pareto_front: List[Dict[str, Any]]
    optimization_time: float
    iterations_completed: int


class EnhancedCSAOptimizer(CrowSearchOptimizer):
    """
    Enhanced Crow Search Algorithm supporting multi-objective optimization
    for both ML hyperparameters and SGM parameters.
    """
    
    def __init__(
        self,
        population_size: int = None,
        max_iterations: int = None,
        awareness_probability: float = None,
        flight_length: float = None,
        objectives: List[OptimizationObjective] = None,
        parallel_evaluation: bool = True,
        adaptive_parameters: bool = True
    ):
        """
        Initialize Enhanced CSA Optimizer.
        
        Args:
            population_size: Number of crows (solutions) in the population
            max_iterations: Maximum number of iterations
            awareness_probability: Probability of a crow being aware of being followed
            flight_length: Flight length parameter controlling step size
            objectives: List of optimization objectives
            parallel_evaluation: Whether to evaluate solutions in parallel
            adaptive_parameters: Whether to adapt CSA parameters during optimization
        """
        super().__init__(population_size, max_iterations, awareness_probability, flight_length)
        
        # Multi-objective optimization settings
        self.objectives = objectives or [
            OptimizationObjective("accuracy", 0.4, minimize=False),
            OptimizationObjective("f1_score", 0.3, minimize=False),
            OptimizationObjective("precision", 0.15, minimize=False),
            OptimizationObjective("recall", 0.15, minimize=False)
        ]
        
        # Enhanced parameter bounds for SGM
        self.sgm_parameter_bounds = {
            'sgm_n_components': (2, 20),
            'sgm_covariance_type_encoded': (0, 3),  # 'full', 'tied', 'diag', 'spherical'
            'sgm_anomaly_threshold': (0.01, 0.2),
            'sgm_adaptation_rate': (0.01, 0.5),
            'sgm_window_size': (100, 2000)
        }
        
        # Combine all parameter bounds
        self.all_parameter_bounds = {**self.parameter_bounds, **self.sgm_parameter_bounds}
        
        # Multi-objective optimization state
        self.pareto_front = []
        self.objective_history = []
        self.parallel_evaluation = parallel_evaluation
        self.adaptive_parameters = adaptive_parameters
        self.executor = ThreadPoolExecutor(max_workers=4) if parallel_evaluation else None
        
        # Adaptive CSA parameters
        self.initial_awareness_probability = self.awareness_probability
        self.initial_flight_length = self.flight_length
        
        logger.info(f"Enhanced CSA initialized with {len(self.objectives)} objectives, "
                   f"parallel_evaluation={parallel_evaluation}, adaptive={adaptive_parameters}")
    
    def optimize_multi_objective(
        self,
        X: np.ndarray,
        y: np.ndarray,
        ml_classifier,
        sgm_analyzer=None,
        cv_folds: int = 5,
        include_sgm: bool = True
    ) -> OptimizationResult:
        """
        Multi-objective optimization for both ML and SGM parameters.
        
        Args:
            X: Training features
            y: Training labels
            ml_classifier: ML classifier instance
            sgm_analyzer: SGM analyzer instance
            cv_folds: Number of cross-validation folds
            include_sgm: Whether to include SGM parameters in optimization
            
        Returns:
            OptimizationResult with best parameters and metrics
        """
        logger.info("Starting enhanced multi-objective CSA optimization")
        start_time = time.time()
        
        try:
            # Set parameter bounds based on what we're optimizing
            if include_sgm and sgm_analyzer:
                self.parameter_bounds = self.all_parameter_bounds
            else:
                # Use only ML parameters
                self.parameter_bounds = {
                    k: v for k, v in self.all_parameter_bounds.items()
                    if not k.startswith('sgm_')
                }
            
            # Initialize population
            self._initialize_population()
            
            # Multi-objective evaluation function
            def evaluate_solution(params: Dict[str, Any]) -> Dict[str, float]:
                return self._evaluate_multi_objective(
                    params, X, y, ml_classifier, sgm_analyzer, cv_folds, include_sgm
                )
            
            # Main optimization loop
            for iteration in range(self.max_iterations):
                iteration_start = time.time()
                
                # Evaluate population
                if self.parallel_evaluation and self.executor:
                    # Parallel evaluation
                    futures = []
                    for i in range(self.population_size):
                        params = self._position_to_params(self.population[i])
                        future = self.executor.submit(evaluate_solution, params)
                        futures.append((i, future))
                    
                    # Collect results
                    for i, future in futures:
                        try:
                            objective_scores = future.result(timeout=300)  # 5 minute timeout
                            fitness = self._calculate_weighted_fitness(objective_scores)
                            self.fitness_values[i] = fitness
                            
                            # Update memory if better
                            if fitness > self.memory_fitness[i]:
                                self.memory_positions[i] = self.population[i].copy()
                                self.memory_fitness[i] = fitness
                                
                                # Update Pareto front
                                self._update_pareto_front(
                                    self._position_to_params(self.population[i]),
                                    objective_scores,
                                    fitness
                                )
                        
                        except concurrent.futures.TimeoutError:
                            logger.warning(f"Evaluation timeout for solution {i}")
                            self.fitness_values[i] = float('-inf')
                        except Exception as e:
                            logger.warning(f"Evaluation error for solution {i}: {str(e)}")
                            self.fitness_values[i] = float('-inf')
                else:
                    # Sequential evaluation
                    for i in range(self.population_size):
                        params = self._position_to_params(self.population[i])
                        try:
                            objective_scores = evaluate_solution(params)
                            fitness = self._calculate_weighted_fitness(objective_scores)
                            self.fitness_values[i] = fitness
                            
                            # Update memory if better
                            if fitness > self.memory_fitness[i]:
                                self.memory_positions[i] = self.population[i].copy()
                                self.memory_fitness[i] = fitness
                                
                                # Update Pareto front
                                self._update_pareto_front(params, objective_scores, fitness)
                        
                        except Exception as e:
                            logger.warning(f"Evaluation error for solution {i}: {str(e)}")
                            self.fitness_values[i] = float('-inf')
                
                # Update global best
                best_idx = np.argmax(self.fitness_values)
                if self.fitness_values[best_idx] > self.best_fitness:
                    self.best_fitness = self.fitness_values[best_idx]
                    self.best_position = self.population[best_idx].copy()
                
                # Update crow positions
                self._update_population()
                
                # Adaptive parameter adjustment
                if self.adaptive_parameters:
                    self._adapt_csa_parameters(iteration)
                
                # Record convergence
                iteration_time = time.time() - iteration_start
                convergence_info = {
                    'iteration': iteration + 1,
                    'best_fitness': self.best_fitness,
                    'population_diversity': self._calculate_population_diversity(),
                    'iteration_time': iteration_time,
                    'pareto_size': len(self.pareto_front)
                }
                self.convergence_history.append(convergence_info)
                
                # Log progress
                if (iteration + 1) % 10 == 0:
                    logger.info(
                        f"Iteration {iteration + 1}/{self.max_iterations}: "
                        f"Best fitness={self.best_fitness:.6f}, "
                        f"Pareto size={len(self.pareto_front)}, "
                        f"Diversity={convergence_info['population_diversity']:.4f}"
                    )
            
            # Prepare final results
            optimization_time = time.time() - start_time
            best_params = self._position_to_params(self.best_position) if self.best_position is not None else {}
            
            # Get final objective scores for best solution
            if best_params:
                best_objective_scores = evaluate_solution(best_params)
            else:
                best_objective_scores = {obj.name: 0.0 for obj in self.objectives}
            
            result = OptimizationResult(
                best_parameters=best_params,
                best_fitness=self.best_fitness,
                objective_scores=best_objective_scores,
                convergence_history=self.convergence_history,
                pareto_front=self.pareto_front,
                optimization_time=optimization_time,
                iterations_completed=self.max_iterations
            )
            
            logger.info(f"Enhanced CSA optimization completed in {optimization_time:.2f}s")
            logger.info(f"Best fitness: {self.best_fitness:.6f}")
            logger.info(f"Pareto front size: {len(self.pareto_front)}")
            
            return result
            
        except Exception as e:
            logger.error(f"Enhanced CSA optimization failed: {str(e)}")
            raise RuntimeError(f"Multi-objective optimization failed: {str(e)}")
        
        finally:
            if self.executor:
                self.executor.shutdown(wait=True)
    
    def _evaluate_multi_objective(
        self,
        params: Dict[str, Any],
        X: np.ndarray,
        y: np.ndarray,
        ml_classifier,
        sgm_analyzer,
        cv_folds: int,
        include_sgm: bool
    ) -> Dict[str, float]:
        """
        Evaluate multiple objectives for a parameter configuration.
        
        Returns:
            Dictionary of objective scores
        """
        objective_scores = {}
        
        try:
            # Split parameters
            ml_params = {k: v for k, v in params.items() if not k.startswith('sgm_')}
            sgm_params = {k: v for k, v in params.items() if k.startswith('sgm_')}
            
            # Evaluate ML classifier objectives
            if ml_classifier:
                ml_scores = self._evaluate_ml_objectives(
                    ml_params, X, y, ml_classifier, cv_folds
                )
                objective_scores.update(ml_scores)
            
            # Evaluate SGM objectives if included
            if include_sgm and sgm_analyzer and sgm_params:
                sgm_scores = self._evaluate_sgm_objectives(
                    sgm_params, X, sgm_analyzer
                )
                objective_scores.update(sgm_scores)
            
            # Add default scores for missing objectives
            for obj in self.objectives:
                if obj.name not in objective_scores:
                    objective_scores[obj.name] = 0.0
            
            return objective_scores
            
        except Exception as e:
            logger.warning(f"Multi-objective evaluation failed: {str(e)}")
            return {obj.name: 0.0 for obj in self.objectives}
    
    def _evaluate_ml_objectives(
        self,
        ml_params: Dict[str, Any],
        X: np.ndarray,
        y: np.ndarray,
        classifier,
        cv_folds: int
    ) -> Dict[str, float]:
        """Evaluate ML classifier objectives."""
        try:
            # Create temporary classifier with parameters
            temp_classifier = classifier.__class__()
            
            # Convert parameter names back to classifier format
            classifier_params = {}
            for param_name, value in ml_params.items():
                if param_name == 'svm_C':
                    classifier_params['C'] = value
                elif param_name == 'svm_gamma':
                    classifier_params['gamma'] = value
                elif param_name.startswith('xgb_'):
                    # Handle XGBoost parameters
                    xgb_param = param_name[4:]  # Remove 'xgb_' prefix
                    classifier_params[xgb_param] = value
            
            # Fit classifier
            temp_classifier.set_params(**classifier_params)
            
            # Calculate cross-validation scores for different metrics
            scores = {}
            
            # Accuracy
            accuracy_scores = cross_val_score(
                temp_classifier, X, y, cv=cv_folds, scoring='accuracy'
            )
            scores['accuracy'] = np.mean(accuracy_scores)
            
            # F1 Score (weighted for multi-class)
            f1_scorer = make_scorer(f1_score, average='weighted')
            f1_scores = cross_val_score(
                temp_classifier, X, y, cv=cv_folds, scoring=f1_scorer
            )
            scores['f1_score'] = np.mean(f1_scores)
            
            # Precision (weighted)
            precision_scorer = make_scorer(precision_score, average='weighted')
            precision_scores = cross_val_score(
                temp_classifier, X, y, cv=cv_folds, scoring=precision_scorer
            )
            scores['precision'] = np.mean(precision_scores)
            
            # Recall (weighted)
            recall_scorer = make_scorer(recall_score, average='weighted')
            recall_scores = cross_val_score(
                temp_classifier, X, y, cv=cv_folds, scoring=recall_scorer
            )
            scores['recall'] = np.mean(recall_scores)
            
            return scores
            
        except Exception as e:
            logger.warning(f"ML evaluation failed: {str(e)}")
            return {'accuracy': 0.0, 'f1_score': 0.0, 'precision': 0.0, 'recall': 0.0}
    
    def _evaluate_sgm_objectives(
        self,
        sgm_params: Dict[str, Any],
        X: np.ndarray,
        sgm_analyzer
    ) -> Dict[str, float]:
        """Evaluate SGM analyzer objectives."""
        try:
            # Convert SGM parameters
            converted_params = {}
            
            if 'sgm_n_components' in sgm_params:
                converted_params['n_components'] = int(sgm_params['sgm_n_components'])
            
            if 'sgm_covariance_type_encoded' in sgm_params:
                covariance_types = ['full', 'tied', 'diag', 'spherical']
                type_idx = int(sgm_params['sgm_covariance_type_encoded'])
                converted_params['covariance_type'] = covariance_types[min(type_idx, len(covariance_types)-1)]
            
            if 'sgm_anomaly_threshold' in sgm_params:
                converted_params['anomaly_threshold'] = sgm_params['sgm_anomaly_threshold']
            
            if 'sgm_adaptation_rate' in sgm_params:
                converted_params['adaptation_rate'] = sgm_params['sgm_adaptation_rate']
            
            if 'sgm_window_size' in sgm_params:
                converted_params['window_size'] = int(sgm_params['sgm_window_size'])
            
            # Create temporary SGM analyzer with parameters
            from app.ml.sgm_analyzer import SGMNetworkAnalyzer
            temp_sgm = SGMNetworkAnalyzer(**converted_params)
            
            # Use subset of data for faster evaluation
            subset_size = min(1000, len(X))
            X_subset = X[:subset_size]
            
            # Fit SGM model
            temp_sgm.fit(X_subset)
            
            # Evaluate on the same data (in practice, you'd use validation data)
            results = temp_sgm.predict_anomaly(X_subset)
            
            # Calculate SGM-specific objectives
            scores = {}
            
            # Anomaly detection effectiveness (balance between detection and false positives)
            anomaly_rate = results['anomaly_percentage'] / 100.0
            scores['sgm_detection_rate'] = anomaly_rate
            
            # Model stability (inverse of threshold sensitivity)
            scores['sgm_stability'] = 1.0 / (1.0 + abs(results['threshold'] - temp_sgm.calculated_threshold))
            
            # Adaptation efficiency (based on buffer utilization)
            model_info = temp_sgm.get_model_info()
            adaptation_efficiency = model_info.get('adaptation_buffer_size', 0) / converted_params.get('window_size', 1000)
            scores['sgm_adaptation'] = min(adaptation_efficiency, 1.0)
            
            return scores
            
        except Exception as e:
            logger.warning(f"SGM evaluation failed: {str(e)}")
            return {'sgm_detection_rate': 0.0, 'sgm_stability': 0.0, 'sgm_adaptation': 0.0}
    
    def _calculate_weighted_fitness(self, objective_scores: Dict[str, float]) -> float:
        """Calculate weighted fitness from multiple objectives."""
        total_fitness = 0.0
        total_weight = 0.0
        
        for objective in self.objectives:
            if objective.name in objective_scores:
                score = objective_scores[objective.name]
                
                # Convert to maximization problem if needed
                if objective.minimize:
                    score = 1.0 - score  # Simple inversion for [0,1] range
                
                # Apply target range normalization if specified
                if objective.target_range:
                    min_val, max_val = objective.target_range
                    score = (score - min_val) / (max_val - min_val)
                    score = np.clip(score, 0.0, 1.0)
                
                total_fitness += objective.weight * score
                total_weight += objective.weight
        
        # Normalize by total weight
        if total_weight > 0:
            return total_fitness / total_weight
        else:
            return 0.0
    
    def _update_pareto_front(
        self,
        params: Dict[str, Any],
        objective_scores: Dict[str, float],
        fitness: float
    ):
        """Update the Pareto front with new solution."""
        solution = {
            'parameters': params.copy(),
            'objectives': objective_scores.copy(),
            'fitness': fitness
        }
        
        # Check if solution dominates any existing solutions
        dominated_indices = []
        is_dominated = False
        
        for i, existing in enumerate(self.pareto_front):
            if self._dominates(objective_scores, existing['objectives']):
                dominated_indices.append(i)
            elif self._dominates(existing['objectives'], objective_scores):
                is_dominated = True
                break
        
        # Add solution if it's not dominated
        if not is_dominated:
            # Remove dominated solutions
            for i in reversed(dominated_indices):
                self.pareto_front.pop(i)
            
            # Add new solution
            self.pareto_front.append(solution)
            
            # Limit Pareto front size to avoid memory issues
            if len(self.pareto_front) > 50:
                # Keep solutions with highest fitness
                self.pareto_front.sort(key=lambda x: x['fitness'], reverse=True)
                self.pareto_front = self.pareto_front[:50]
    
    def _dominates(self, scores1: Dict[str, float], scores2: Dict[str, float]) -> bool:
        """Check if scores1 dominates scores2 (Pareto dominance)."""
        better_in_any = False
        
        for objective in self.objectives:
            if objective.name in scores1 and objective.name in scores2:
                s1, s2 = scores1[objective.name], scores2[objective.name]
                
                if objective.minimize:
                    if s1 > s2:  # Worse in minimization
                        return False
                    elif s1 < s2:  # Better in minimization
                        better_in_any = True
                else:
                    if s1 < s2:  # Worse in maximization
                        return False
                    elif s1 > s2:  # Better in maximization
                        better_in_any = True
        
        return better_in_any
    
    def _adapt_csa_parameters(self, iteration: int):
        """Adapt CSA parameters during optimization."""
        progress = iteration / self.max_iterations
        
        # Adaptive awareness probability (start high, decrease over time)
        self.awareness_probability = self.initial_awareness_probability * (1.0 - 0.5 * progress)
        
        # Adaptive flight length (start high for exploration, decrease for exploitation)
        self.flight_length = self.initial_flight_length * (1.0 - 0.3 * progress)
        
        # Ensure minimum values
        self.awareness_probability = max(0.05, self.awareness_probability)
        self.flight_length = max(1.0, self.flight_length)
    
    def _calculate_population_diversity(self) -> float:
        """Calculate population diversity metric."""
        if len(self.population) < 2:
            return 0.0
        
        # Calculate average pairwise distance
        total_distance = 0.0
        pairs = 0
        
        for i in range(len(self.population)):
            for j in range(i + 1, len(self.population)):
                distance = np.linalg.norm(self.population[i] - self.population[j])
                total_distance += distance
                pairs += 1
        
        return total_distance / pairs if pairs > 0 else 0.0
    
    def _position_to_params(self, position: np.ndarray) -> Dict[str, Any]:
        """Convert position vector to parameter dictionary (enhanced version)."""
        params = {}
        param_names = list(self.parameter_bounds.keys())
        
        for i, param_name in enumerate(param_names):
            if i < len(position):
                value = position[i]
                
                # Handle integer parameters
                if param_name in ['xgb_n_estimators', 'xgb_max_depth', 'sgm_n_components', 'sgm_window_size']:
                    params[param_name] = int(round(value))
                # Handle encoded categorical parameters
                elif param_name == 'sgm_covariance_type_encoded':
                    params[param_name] = int(round(value))
                else:
                    params[param_name] = float(value)
        
        return params
    
    def get_optimization_summary(self) -> Dict[str, Any]:
        """Get comprehensive optimization summary."""
        summary = super().get_optimization_history()
        
        # Add multi-objective specific information
        summary.update({
            'objectives': [
                {
                    'name': obj.name,
                    'weight': obj.weight,
                    'minimize': obj.minimize,
                    'target_range': obj.target_range
                }
                for obj in self.objectives
            ],
            'pareto_front_size': len(self.pareto_front),
            'pareto_solutions': self.pareto_front,
            'parameter_bounds': self.parameter_bounds,
            'adaptive_parameters': self.adaptive_parameters,
            'parallel_evaluation': self.parallel_evaluation
        })
        
        return summary
