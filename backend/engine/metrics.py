"""
Performance metrics calculation.

Computes ROI, drawdown, streaks, Sharpe ratio, and other statistics.
"""

import math
import pandas as pd
from typing import Optional


def calculate_sharpe_ratio(profits: list[float], risk_free_rate: float = 0.0) -> float:
    """
    Calculate Sharpe ratio for a series of bet returns.

    Higher is better. Measures risk-adjusted returns.
    - > 1.0 is good
    - > 2.0 is very good
    - > 3.0 is excellent

    Args:
        profits: List of profit/loss for each bet
        risk_free_rate: Risk-free rate per bet (usually 0 for betting)

    Returns:
        Sharpe ratio (annualized assuming ~200 bets/year for NFL)
    """
    if len(profits) < 2:
        return 0.0

    mean_return = sum(profits) / len(profits)

    # Calculate standard deviation
    variance = sum((p - mean_return) ** 2 for p in profits) / (len(profits) - 1)
    std_dev = math.sqrt(variance) if variance > 0 else 0.0

    if std_dev == 0:
        return 0.0 if mean_return <= 0 else 10.0  # Cap at 10 for zero variance

    # Sharpe ratio (annualized, assuming ~200 bets per year)
    sharpe = (mean_return - risk_free_rate) / std_dev
    annualized_sharpe = sharpe * math.sqrt(200)

    return round(annualized_sharpe, 3)


def calculate_roi(total_profit: float, total_risked: float) -> float:
    """Calculate return on investment as percentage."""
    if total_risked == 0:
        return 0.0
    return (total_profit / total_risked) * 100


def calculate_win_rate(wins: int, losses: int, pushes: int = 0) -> float:
    """Calculate win rate as percentage (excluding pushes)."""
    total = wins + losses
    if total == 0:
        return 0.0
    return (wins / total) * 100


def calculate_max_drawdown(profits: list[float]) -> float:
    """
    Calculate maximum drawdown in units.

    Returns the largest peak-to-trough decline.
    """
    if not profits:
        return 0.0

    cumulative = 0.0
    peak = 0.0
    max_dd = 0.0

    for profit in profits:
        cumulative += profit
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_dd:
            max_dd = dd

    return max_dd


def calculate_streaks(results: list[str]) -> tuple[int, int]:
    """
    Calculate longest winning and losing streaks.

    Args:
        results: List of "win", "loss", "push"

    Returns:
        (longest_win_streak, longest_lose_streak)
    """
    if not results:
        return 0, 0

    longest_win = 0
    longest_loss = 0
    current_win = 0
    current_loss = 0

    for r in results:
        if r == "win":
            current_win += 1
            current_loss = 0
            longest_win = max(longest_win, current_win)
        elif r == "loss":
            current_loss += 1
            current_win = 0
            longest_loss = max(longest_loss, current_loss)
        else:  # push
            current_win = 0
            current_loss = 0

    return longest_win, longest_loss


def calculate_season_summary(bets_df: pd.DataFrame) -> list[dict]:
    """
    Calculate per-season performance.

    Args:
        bets_df: DataFrame with season, result, profit columns

    Returns:
        List of season summaries
    """
    if bets_df.empty:
        return []

    summaries = []

    for season, group in bets_df.groupby("season"):
        wins = (group["result"] == "win").sum()
        losses = (group["result"] == "loss").sum()
        pushes = (group["result"] == "push").sum()
        profit = group["profit"].sum()
        total_risked = len(group) * 1.1  # Assuming 1.1 unit risk per bet

        summaries.append({
            "season": int(season),
            "bets": len(group),
            "wins": int(wins),
            "losses": int(losses),
            "pushes": int(pushes),
            "roi_pct": round(calculate_roi(profit, total_risked), 2),
            "profit_units": round(profit, 2),
        })

    return sorted(summaries, key=lambda x: x["season"])
