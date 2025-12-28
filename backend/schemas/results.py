"""
Results Schema - Backtest output structure.

These are the immutable results that the LLM can narrate but not modify.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BetRecord(BaseModel):
    """Individual bet placed by the strategy."""
    game_date: str
    season: int
    week: str
    home_team: str
    away_team: str
    bet_side: str
    line: float
    result: str  # "win", "loss", "push"
    profit: float  # In units


class SeasonSummary(BaseModel):
    """Performance breakdown by season."""
    season: int
    bets: int
    wins: int
    losses: int
    pushes: int
    roi_pct: float
    profit_units: float


class BacktestResults(BaseModel):
    """
    Complete backtest output.
    LLM receives this and can only format/explain it, not recalculate.
    """
    strategy_name: str
    strategy_hash: str = Field(..., description="SHA256 of strategy JSON for reproducibility")

    # Core metrics
    total_bets: int
    wins: int
    losses: int
    pushes: int
    win_rate_pct: float
    roi_pct: float
    total_profit_units: float

    # Risk metrics
    max_drawdown_units: float
    longest_losing_streak: int
    longest_winning_streak: int

    # Breakdown
    seasons: list[SeasonSummary]
    bets: list[BetRecord] = Field(default_factory=list)

    # Metadata
    data_start_date: str
    data_end_date: str
    run_timestamp: str

    # Warnings
    warnings: list[str] = Field(
        default_factory=list,
        description="Caveats about the results (small sample, overfitting risk, etc.)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "strategy_name": "Home Underdogs ATS",
                "strategy_hash": "abc123...",
                "total_bets": 342,
                "wins": 185,
                "losses": 150,
                "pushes": 7,
                "win_rate_pct": 55.2,
                "roi_pct": 4.8,
                "total_profit_units": 16.4,
                "max_drawdown_units": -12.5,
                "longest_losing_streak": 7,
                "longest_winning_streak": 9,
                "seasons": [],
                "data_start_date": "2015-09-10",
                "data_end_date": "2023-12-31",
                "run_timestamp": "2024-01-15T10:30:00Z",
                "warnings": ["Sample size < 500 bets - results may not be statistically significant"]
            }
        }


class NarratedResults(BaseModel):
    """Results with LLM-generated explanation."""
    results: BacktestResults
    summary: str = Field(..., description="Plain English summary of performance")
    verdict: str = Field(..., description="Does this strategy appear profitable?")
    caveats: list[str] = Field(..., description="Important limitations to consider")
