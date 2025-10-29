"""
Crow Search Algorithm (CSA) for hyperparameter optimization.
"""

import numpy as np
from typing import Dict, Any, Callable, Tuple, List
import logging
from sklearn.model_selection import cross_val_score
from sklearn.metrics import f1_score, make_scorer

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class CrowSearchOptimizer:
    """
    Crow Search Algorithm for optimizing ML hyperparameters.
    
    Based on the intelligent behavior of crows in hiding and retrieving food.
    The algorithm balances exploration and exploitation through awareness probability
    and flight length parameters.
    """
    
    def __init__(
        self,
        population_size: int = None,
        max_iterations: int = None,
        awareness_probability: float = None,
        flight_length: float = None
    ):
        """
        Initialize Crow Search Algorithm.
        
        Args:
            population_size: Number of crows (solutions) in the population
            max_iterations: Maximum number of iterations
            awareness_probability: Probability of a crow being aware of being followed
            flight_length: Flight length parameter controlling step size
        """
        self.population_size = population_size or settings.CSA_POPULATION_SIZE
        self.max_iterations = max_iterations or settings.CSA_MAX_ITERATIONS
        self.awareness_probability = awareness_probability or settings.CSA_AWARENESS_PROBABILITY
        self.flight_length = flight_length or settings.CSA_FLIGHT_LENGTH
        
        # Optimization bounds for different parameters
        self.parameter_bounds = {
            'svm_C': (settings.SVM_C_MIN, settings.SVM_C_MAX),
            'svm_gamma': (settings.SVM_GAMMA_MIN, settings.SVM_GAMMA_MAX),
            'xgb_n_estimators': (50, 300),
            'xgb_max_depth': (3, 10),
            'xgb_learning_rate': (0.01, 0.3)
        }
        
        # Algorithm state
        self.population = None
        self.fitness_values = None
        self.memory_positions = None
        self.memory_fitness = None
        self.best_position = None
        self.best_fitness = float('-inf')
        self.convergence_history = []
        
        logger.info(f"CSA initialized: pop_size={self.population_size}, "
                   f"max_iter={self.max_iterations}, AP={self.awareness_probability}")
    
    def optimize(
        self,
        X: np.ndarray,
        y: np.ndarray,
        classifier,
        cv_folds: int = 5
    ) -> Dict[str, Any]:
        """
        Optimize hyperparameters using Crow Search Algorithm.
        
        Args:
            X: Training features
            y: Training labels
            classifier: Classifier instance to optimize
            cv_folds: Number of cross-validation folds
            
        Returns:
            Best hyperparameters found
        """
        logger.info("Starting CSA optimization")
        
        try:
            # Initialize population
            self._initialize_population()
            
            # Define objective function
            def objective_function(params: Dict[str, float]) -> float:
                return self._evaluate_parameters(params, X, y, classifier, cv_folds)
            
            # Main optimization loop
            for iteration in range(self.max_iterations):
                # Evaluate current population
                for i in range(self.population_size):
                    params = self._position_to_params(self.population[i])
                    fitness = objective_function(params)
                    self.fitness_values[i] = fitness
                    
                    # Update memory if current position is better
                    if fitness > self.memory_fitness[i]:
                        self.memory_positions[i] = self.population[i].copy()
                        self.memory_fitness[i] = fitness
                    
                    # Update global best
                    if fitness > self.best_fitness:
                        self.best_fitness = fitness
                        self.best_position = self.population[i].copy()
                
                # Update crow positions
                self._update_population()
                
                # Record convergence
                self.convergence_history.append(self.best_fitness)
                
                # Log progress
                if (iteration + 1) % 10 == 0:
                    logger.info(f"Iteration {iteration + 1}/{self.max_iterations}, "
                              f"Best fitness: {self.best_fitness:.6f}")
            
            # Convert best position to parameters
            if self.best_position is not None:
                best_params = self._position_to_params(self.best_position)
                logger.info(f"CSA optimization completed. Best fitness: {self.best_fitness:.6f}")
                logger.info(f"Best parameters: {best_params}")
                return best_params
            else:
                # If no valid solution found, return default parameters
                logger.warning("CSA optimization found no valid solutions, using default parameters")
                return {
                    'svm_C': 1.0,
                    'svm_gamma': 'scale',
                    'xgb_n_estimators': 100,
                    'xgb_max_depth': 6,
                    'xgb_learning_rate': 0.1
                }
            
        except Exception as e:
            logger.error(f"CSA optimization failed: {str(e)}")
            raise RuntimeError(f"Optimization failed: {str(e)}")
    
    def _initialize_population(self):
        """Initialize the crow population randomly within bounds."""
        n_params = len(self.parameter_bounds)
        
        # Initialize positions randomly within bounds
        self.population = np.random.random((self.population_size, n_params))
        
        # Scale to parameter bounds
        for i, (param_name, (min_val, max_val)) in enumerate(self.parameter_bounds.items()):
            self.population[:, i] = (
                self.population[:, i] * (max_val - min_val) + min_val
            )
        
        # Initialize memory and fitness arrays
        self.memory_positions = self.population.copy()
        self.fitness_values = np.full(self.population_size, float('-inf'))
        self.memory_fitness = np.full(self.population_size, float('-inf'))
        
        logger.debug(f"Population initialized with shape: {self.population.shape}")
    
    def _update_population(self):
        """Update crow positions using CSA rules."""
        new_population = self.population.copy()
        
        for i in range(self.population_size):
            # Select random crow to follow
            j = np.random.randint(0, self.population_size)
            while j == i:  # Ensure different crow
                j = np.random.randint(0, self.population_size)
            
            # Generate random number for awareness check
            r = np.random.random()
            
            if r >= self.awareness_probability:
                # Crow j is not aware, follow it to its memory position
                r_fl = np.random.random()  # Random flight length
                new_position = (
                    self.population[i] + 
                    r_fl * self.flight_length * 
                    (self.memory_positions[j] - self.population[i])
                )
            else:
                # Crow j is aware, generate random position
                new_position = self._generate_random_position()
            
            # Apply bounds constraint
            new_position = self._apply_bounds(new_position)
            new_population[i] = new_position
        
        self.population = new_population
    
    def _generate_random_position(self) -> np.ndarray:
        """Generate a random position within parameter bounds."""
        position = np.random.random(len(self.parameter_bounds))
        
        for i, (param_name, (min_val, max_val)) in enumerate(self.parameter_bounds.items()):
            position[i] = position[i] * (max_val - min_val) + min_val
        
        return position
    
    def _apply_bounds(self, position: np.ndarray) -> np.ndarray:
        """Apply parameter bounds to a position."""
        bounded_position = position.copy()
        
        for i, (param_name, (min_val, max_val)) in enumerate(self.parameter_bounds.items()):
            bounded_position[i] = np.clip(bounded_position[i], min_val, max_val)
        
        return bounded_position
    
    def _position_to_params(self, position: np.ndarray) -> Dict[str, Any]:
        """Convert position vector to parameter dictionary."""
        params = {}
        param_names = list(self.parameter_bounds.keys())
        
        for i, param_name in enumerate(param_names):
            value = position[i]
            
            # Handle integer parameters
            if param_name in ['xgb_n_estimators', 'xgb_max_depth']:
                params[param_name] = int(round(value))
            else:
                params[param_name] = float(value)
        
        return params
    
    def _evaluate_parameters(
        self,
        params: Dict[str, Any],
        X: np.ndarray,
        y: np.ndarray,
        classifier,
        cv_folds: int
    ) -> float:
        """
        Evaluate parameter configuration using cross-validation.
        
        Args:
            params: Parameter configuration
            X: Training features
            y: Training labels
            classifier: Classifier instance
            cv_folds: Number of CV folds
            
        Returns:
            F1-score (fitness value)
        """
        try:
            # Create temporary classifier with given parameters
            temp_classifier = classifier.__class__()
            temp_classifier.set_params(**params)
            
            # Fit temporary classifier
            temp_classifier.fit(X, y, best_params=params)
            
            # Use F1-score as fitness (weighted average for multi-class)
            f1_scorer = make_scorer(f1_score, average='weighted')
            scores = cross_val_score(temp_classifier, X, y, cv=cv_folds, scoring=f1_scorer)
            
            # Return mean F1-score
            fitness = np.mean(scores)
            
            return fitness
            
        except Exception as e:
            logger.warning(f"Parameter evaluation failed: {str(e)}")
            return float('-inf')  # Return worst possible fitness
    
    def get_optimization_history(self) -> Dict[str, Any]:
        """
        Get optimization history and statistics.
        
        Returns:
            Optimization history and final results
        """
        return {
            'convergence_history': self.convergence_history,
            'best_fitness': self.best_fitness,
            'best_parameters': self._position_to_params(self.best_position) if self.best_position is not None else {},
            'total_iterations': len(self.convergence_history),
            'population_size': self.population_size,
            'final_improvement': (
                self.convergence_history[-1] - self.convergence_history[0]
                if len(self.convergence_history) > 1 else 0
            )
        }
