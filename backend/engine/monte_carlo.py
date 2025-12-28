"""
Monte Carlo Simulation Engine.

Simulates future betting performance using bootstrap resampling from historical data.
Provides confidence intervals, probability of profit, and risk metrics.
"""

import math
import random
from dataclasses import dataclass
from typing import Optional

from .metrics import calculate_sharpe_ratio, calculate_max_drawdown


@dataclass
class MonteCarloResult:
    """Results from Monte Carlo simulation."""
    # Simulation parameters
    n_simulations: int
    bets_per_simulation: int

    # Probability metrics
    probability_of_profit: float  # % of simulations that were profitable

    # ROI confidence intervals
    roi_median: float
    roi_5th_percentile: float  # 5% worst case
    roi_25th_percentile: float
    roi_75th_percentile: float
    roi_95th_percentile: float  # 5% best case

    # Profit in units
    profit_median: float
    profit_5th_percentile: float
    profit_95th_percentile: float

    # Drawdown risk
    max_drawdown_median: float
    max_drawdown_95th_percentile: float  # 5% worst case drawdown

    # Win rate distribution
    win_rate_median: float
    win_rate_5th_percentile: float
    win_rate_95th_percentile: float

    # Kelly Criterion
    kelly_fraction: float  # Optimal bet size as fraction of bankroll
    kelly_half: float  # Half-Kelly (more conservative)

    # Risk of ruin
    risk_of_ruin_25: float  # % chance of losing 25% of bankroll
    risk_of_ruin_50: float  # % chance of losing 50% of bankroll

    # Expected value per bet
    expected_value_per_bet: float

    # Streak analysis
    avg_max_losing_streak: float
    worst_losing_streak_95th: int


def calculate_kelly_criterion(win_rate: float, avg_win: float, avg_loss: float) -> float:
    """
    Calculate Kelly Criterion for optimal bet sizing.

    Kelly % = (bp - q) / b
    where:
        b = odds received on bet (ratio of win to loss)
        p = probability of winning
        q = probability of losing (1 - p)

    For -110 odds (standard spread), you risk 1.1 to win 1.0
    """
    if avg_loss == 0 or win_rate <= 0 or win_rate >= 1:
        return 0.0

    p = win_rate
    q = 1 - p
    b = abs(avg_win / avg_loss)  # Odds ratio

    kelly = (b * p - q) / b

    # Cap Kelly at reasonable values
    return max(0.0, min(kelly, 0.25))  # Never recommend more than 25%


def run_monte_carlo(
    historical_profits: list[float],
    historical_results: list[str],  # "win", "loss", "push"
    n_simulations: int = 10000,
    bets_per_simulation: int = 100,
    stake_per_bet: float = 1.0,
) -> MonteCarloResult:
    """
    Run Monte Carlo simulation using bootstrap resampling.

    Args:
        historical_profits: List of profit/loss for each historical bet
        historical_results: List of "win"/"loss"/"push" for each bet
        n_simulations: Number of simulations to run
        bets_per_simulation: How many bets to simulate (e.g., 100 = one season)
        stake_per_bet: Units risked per bet

    Returns:
        MonteCarloResult with all projections and risk metrics
    """
    if len(historical_profits) < 10:
        return _empty_result(n_simulations, bets_per_simulation)

    # Combine profits and results for resampling
    bet_data = list(zip(historical_profits, historical_results))

    # Run simulations
    simulation_profits = []
    simulation_rois = []
    simulation_win_rates = []
    simulation_max_drawdowns = []
    simulation_max_losing_streaks = []
    ruin_25_count = 0
    ruin_50_count = 0

    for _ in range(n_simulations):
        # Bootstrap resample: randomly pick bets with replacement
        simulated_bets = random.choices(bet_data, k=bets_per_simulation)

        profits = [b[0] for b in simulated_bets]
        results = [b[1] for b in simulated_bets]

        # Calculate metrics for this simulation
        total_profit = sum(profits)
        total_risked = bets_per_simulation * stake_per_bet * 1.1  # -110 odds
        roi = (total_profit / total_risked) * 100 if total_risked > 0 else 0

        wins = results.count("win")
        losses = results.count("loss")
        win_rate = wins / (wins + losses) if (wins + losses) > 0 else 0

        max_dd = calculate_max_drawdown(profits)
        max_losing_streak = _calculate_max_losing_streak(results)

        simulation_profits.append(total_profit)
        simulation_rois.append(roi)
        simulation_win_rates.append(win_rate)
        simulation_max_drawdowns.append(max_dd)
        simulation_max_losing_streaks.append(max_losing_streak)

        # Track ruin scenarios
        # Assume starting bankroll of 100 units
        cumulative = 0
        min_cumulative = 0
        for p in profits:
            cumulative += p
            min_cumulative = min(min_cumulative, cumulative)

        if min_cumulative <= -25:
            ruin_25_count += 1
        if min_cumulative <= -50:
            ruin_50_count += 1

    # Sort for percentile calculations
    simulation_profits.sort()
    simulation_rois.sort()
    simulation_win_rates.sort()
    simulation_max_drawdowns.sort()
    simulation_max_losing_streaks.sort()

    # Calculate percentiles
    def percentile(sorted_list, p):
        idx = int(len(sorted_list) * p / 100)
        idx = max(0, min(idx, len(sorted_list) - 1))
        return sorted_list[idx]

    # Calculate Kelly from historical data
    wins_hist = [p for p, r in bet_data if r == "win"]
    losses_hist = [abs(p) for p, r in bet_data if r == "loss"]

    avg_win = sum(wins_hist) / len(wins_hist) if wins_hist else 0
    avg_loss = sum(losses_hist) / len(losses_hist) if losses_hist else 1.1

    win_count = len(wins_hist)
    loss_count = len(losses_hist)
    historical_win_rate = win_count / (win_count + loss_count) if (win_count + loss_count) > 0 else 0

    kelly = calculate_kelly_criterion(historical_win_rate, avg_win, avg_loss)

    # Expected value per bet
    ev_per_bet = sum(historical_profits) / len(historical_profits) if historical_profits else 0

    return MonteCarloResult(
        n_simulations=n_simulations,
        bets_per_simulation=bets_per_simulation,

        probability_of_profit=round(sum(1 for p in simulation_profits if p > 0) / n_simulations * 100, 1),

        roi_median=round(percentile(simulation_rois, 50), 2),
        roi_5th_percentile=round(percentile(simulation_rois, 5), 2),
        roi_25th_percentile=round(percentile(simulation_rois, 25), 2),
        roi_75th_percentile=round(percentile(simulation_rois, 75), 2),
        roi_95th_percentile=round(percentile(simulation_rois, 95), 2),

        profit_median=round(percentile(simulation_profits, 50), 2),
        profit_5th_percentile=round(percentile(simulation_profits, 5), 2),
        profit_95th_percentile=round(percentile(simulation_profits, 95), 2),

        max_drawdown_median=round(percentile(simulation_max_drawdowns, 50), 2),
        max_drawdown_95th_percentile=round(percentile(simulation_max_drawdowns, 95), 2),

        win_rate_median=round(percentile(simulation_win_rates, 50) * 100, 1),
        win_rate_5th_percentile=round(percentile(simulation_win_rates, 5) * 100, 1),
        win_rate_95th_percentile=round(percentile(simulation_win_rates, 95) * 100, 1),

        kelly_fraction=round(kelly, 4),
        kelly_half=round(kelly / 2, 4),

        risk_of_ruin_25=round(ruin_25_count / n_simulations * 100, 1),
        risk_of_ruin_50=round(ruin_50_count / n_simulations * 100, 1),

        expected_value_per_bet=round(ev_per_bet, 3),

        avg_max_losing_streak=round(sum(simulation_max_losing_streaks) / n_simulations, 1),
        worst_losing_streak_95th=int(percentile(simulation_max_losing_streaks, 95)),
    )


def _calculate_max_losing_streak(results: list[str]) -> int:
    """Calculate maximum consecutive losses."""
    max_streak = 0
    current_streak = 0

    for r in results:
        if r == "loss":
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0

    return max_streak


def _empty_result(n_simulations: int, bets_per_simulation: int) -> MonteCarloResult:
    """Return empty result when insufficient data."""
    return MonteCarloResult(
        n_simulations=n_simulations,
        bets_per_simulation=bets_per_simulation,
        probability_of_profit=0.0,
        roi_median=0.0,
        roi_5th_percentile=0.0,
        roi_25th_percentile=0.0,
        roi_75th_percentile=0.0,
        roi_95th_percentile=0.0,
        profit_median=0.0,
        profit_5th_percentile=0.0,
        profit_95th_percentile=0.0,
        max_drawdown_median=0.0,
        max_drawdown_95th_percentile=0.0,
        win_rate_median=0.0,
        win_rate_5th_percentile=0.0,
        win_rate_95th_percentile=0.0,
        kelly_fraction=0.0,
        kelly_half=0.0,
        risk_of_ruin_25=0.0,
        risk_of_ruin_50=0.0,
        expected_value_per_bet=0.0,
        avg_max_losing_streak=0.0,
        worst_losing_streak_95th=0,
    )
