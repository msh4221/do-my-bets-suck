"""
Optimizer schemas for strategy optimization requests and responses.
"""

from typing import Optional
from pydantic import BaseModel, Field


class MonteCarloProjection(BaseModel):
    """Monte Carlo simulation results for future projection."""
    n_simulations: int
    bets_per_simulation: int

    # Probability metrics
    probability_of_profit: float

    # ROI confidence intervals
    roi_median: float
    roi_5th_percentile: float
    roi_25th_percentile: float
    roi_75th_percentile: float
    roi_95th_percentile: float

    # Profit in units
    profit_median: float
    profit_5th_percentile: float
    profit_95th_percentile: float

    # Drawdown risk
    max_drawdown_median: float
    max_drawdown_95th_percentile: float

    # Win rate distribution
    win_rate_median: float
    win_rate_5th_percentile: float
    win_rate_95th_percentile: float

    # Kelly Criterion
    kelly_fraction: float
    kelly_half: float

    # Risk of ruin
    risk_of_ruin_25: float
    risk_of_ruin_50: float

    # Expected value
    expected_value_per_bet: float

    # Streak analysis
    avg_max_losing_streak: float
    worst_losing_streak_95th: int


class OptimizedStrategyResult(BaseModel):
    """Single optimized strategy result with Monte Carlo projection."""
    name: str
    market: str
    bet_side: str
    filters_description: str
    total_bets: int
    wins: int
    losses: int
    pushes: int
    win_rate_pct: float
    roi_pct: float
    sharpe_ratio: float
    train_roi_pct: float
    validation_roi_pct: float
    train_sharpe: float
    validation_sharpe: float
    filters: list[dict]
    # Monte Carlo projection (optional, computed on demand)
    projection: Optional[MonteCarloProjection] = None


class FilterSearchConfig(BaseModel):
    """Configuration for which filters to search and their ranges."""
    # Which filters to include in search
    include_spread: bool = True
    include_temperature: bool = True
    include_wind: bool = True

    # Custom ranges (optional, uses defaults if not provided)
    spread_min: Optional[float] = None
    spread_max: Optional[float] = None
    total_min: Optional[float] = None
    total_max: Optional[float] = None
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    wind_min: Optional[float] = None
    wind_max: Optional[float] = None


class OptimizerRequest(BaseModel):
    """Request to run the optimizer."""
    market: str = Field(..., description="Market type: spread, total, or moneyline")
    season_start: int = Field(2000, description="First season to include")
    season_end: int = Field(2017, description="Last season to include")
    n_folds: int = Field(5, description="Number of cross-validation folds")
    min_bets: int = Field(50, description="Minimum bets required per strategy")
    max_combinations: int = Field(5000, description="Maximum parameter combinations to test")
    top_n: int = Field(10, description="Number of top strategies to return")
    # User-controlled search configuration
    filter_config: Optional[FilterSearchConfig] = None
    # Monte Carlo settings
    run_monte_carlo: bool = Field(True, description="Run Monte Carlo projection on top strategies")
    monte_carlo_simulations: int = Field(10000, description="Number of MC simulations")
    monte_carlo_bets: int = Field(100, description="Bets per simulation (e.g., 100 = 1 season)")


class MonteCarloRequest(BaseModel):
    """Request to run Monte Carlo on a specific strategy."""
    market: str
    bet_side: str
    filters: list[dict]
    season_start: int = 2000
    season_end: int = 2017
    n_simulations: int = 10000
    bets_per_simulation: int = 100


class OptimizerResponse(BaseModel):
    """Response from the optimizer."""
    strategies: list[OptimizedStrategyResult]
    combinations_tested: int
    total_combinations: int
    market: str
    message: str


class ComparisonRequest(BaseModel):
    """Request to compare multiple strategies with Monte Carlo."""
    strategies: list[MonteCarloRequest]
    n_simulations: int = 10000
    bets_per_simulation: int = 100


class ComparisonResult(BaseModel):
    """Single strategy comparison result."""
    name: str
    filters_description: str
    historical_roi: float
    historical_win_rate: float
    projection: MonteCarloProjection


class ComparisonResponse(BaseModel):
    """Response comparing multiple strategies."""
    comparisons: list[ComparisonResult]
    bets_per_simulation: int
    recommendation: str
