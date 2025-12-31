"""
Strategy JSON Schema - Single source of truth for betting hypotheses.

A Strategy defines what bets to make and under what conditions.
"""

from enum import Enum
from typing import Optional, Union
from pydantic import BaseModel, Field


class League(str, Enum):
    NFL = "NFL"


class Market(str, Enum):
    SPREAD = "spread"
    TOTAL = "total"
    MONEYLINE = "moneyline"


class BetSide(str, Enum):
    HOME = "home"
    AWAY = "away"
    FAVORITE = "favorite"
    UNDERDOG = "underdog"
    OVER = "over"
    UNDER = "under"
    TEAM = "team"  # Bet on the selected team regardless of home/away


class Operator(str, Enum):
    GT = ">"
    GTE = ">="
    LT = "<"
    LTE = "<="
    EQ = "=="
    NE = "!="


class Filter(BaseModel):
    """A single condition to filter games."""
    field: str = Field(..., description="Column name from dataset")
    operator: Operator
    value: float | str | bool


class StrategyInput(BaseModel):
    """
    The structured representation of a betting hypothesis.
    LLM converts natural language -> this schema.
    """
    name: str = Field(..., description="Human-readable strategy name")
    description: str = Field(..., description="What this strategy does")

    league: League = League.NFL
    market: Market = Field(..., description="spread, total, or moneyline")
    bet_side: BetSide = Field(..., description="Which side to bet")

    filters: list[Filter] = Field(
        default_factory=list,
        description="Conditions that must all be true to place a bet"
    )

    # Team filters (supports OR logic: team can be home OR away)
    # Accepts single abbreviation or list of abbreviations (for relocated franchises)
    team: Optional[Union[str, list[str]]] = Field(None, description="Team abbreviation(s) to bet on")
    opponent: Optional[Union[str, list[str]]] = Field(None, description="Opponent abbreviation(s) to filter for")

    # Time range for backtest
    season_start: Optional[int] = Field(None, description="First season to include")
    season_end: Optional[int] = Field(None, description="Last season to include")

    # Staking
    stake_unit: float = Field(1.0, description="Units per bet (flat staking)")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Home Underdogs ATS",
                "description": "Bet on home teams when they are underdogs against the spread",
                "league": "NFL",
                "market": "spread",
                "bet_side": "home",
                "filters": [
                    {"field": "home_favorite", "operator": "==", "value": False}
                ],
                "season_start": 2015,
                "season_end": 2023,
                "stake_unit": 1.0
            }
        }


class ClarifyingQuestion(BaseModel):
    """When LLM needs more info to build a complete strategy."""
    question: str
    field: str = Field(..., description="Which strategy field this clarifies")
    options: Optional[list[str]] = None
