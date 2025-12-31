"""
Player Props Schema - Definitions for player prop betting hypotheses.

Supports backtesting player prop strategies like:
- "Bet over 250 passing yards for all QBs"
- "Bet under 50 rushing yards for RBs against top rush defenses"
- "Anytime TD scorer for Patrick Mahomes"
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PropType(str, Enum):
    """Types of player props supported."""
    PASSING_YARDS = "passing_yards"
    RUSHING_YARDS = "rushing_yards"
    RECEIVING_YARDS = "receiving_yards"
    RECEPTIONS = "receptions"
    PASSING_TDS = "passing_tds"
    ANYTIME_TD = "anytime_td"


class PropBetSide(str, Enum):
    """Bet sides for player props."""
    OVER = "over"
    UNDER = "under"
    YES = "yes"  # For anytime TD


class PlayerPosition(str, Enum):
    """Player positions for filtering."""
    QB = "QB"
    RB = "RB"
    WR = "WR"
    TE = "TE"


class PlayerPropStrategy(BaseModel):
    """
    A player prop betting strategy for backtesting.

    Example strategies:
    - Bet over 250 yards for all QBs
    - Bet under 50 rushing yards for RBs
    - Anytime TD for Patrick Mahomes
    """
    name: str = Field(..., description="Strategy name")
    description: str = Field("", description="Strategy description")

    # What prop to bet
    prop_type: PropType = Field(..., description="Type of prop (passing_yards, rushing_yards, etc)")
    bet_side: PropBetSide = Field(..., description="over, under, or yes (for anytime TD)")

    # The line to bet against (for historical backtesting)
    line: float = Field(..., description="The line value (e.g., 249.5 for over/under)")

    # Player filters (all optional - if none set, applies to all players)
    player_id: Optional[str] = Field(None, description="Specific player ID")
    player_name: Optional[str] = Field(None, description="Player name for display")
    position: Optional[PlayerPosition] = Field(None, description="Filter by position")

    # Time range for backtest
    season_start: Optional[int] = Field(None, description="First season to include")
    season_end: Optional[int] = Field(None, description="Last season to include")
    week_start: Optional[int] = Field(1, description="First week to include")
    week_end: Optional[int] = Field(18, description="Last week to include")

    # Staking
    stake_unit: float = Field(1.0, description="Units per bet (flat staking)")
    odds: int = Field(-110, description="Standard odds for the prop (American format)")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Mahomes Over 275 Passing",
                "description": "Bet Patrick Mahomes over 275 passing yards",
                "prop_type": "passing_yards",
                "bet_side": "over",
                "line": 274.5,
                "player_name": "Patrick Mahomes",
                "position": "QB",
                "season_start": 2020,
                "season_end": 2023,
                "stake_unit": 1.0,
                "odds": -110
            }
        }


class PropBacktestRequest(BaseModel):
    """Request body for player prop backtesting."""
    strategy: PlayerPropStrategy


class PlayerSearchResult(BaseModel):
    """A player search result for autocomplete."""
    player_id: str
    name: str
    position: str
    team: str
    last_season: int


class PropBacktestResult(BaseModel):
    """Results from backtesting a player prop strategy."""
    strategy_name: str
    total_bets: int
    wins: int
    losses: int
    pushes: int
    win_rate: float
    profit_units: float
    roi_pct: float
    max_drawdown: float


# Mapping from PropType to database column name
PROP_TYPE_TO_COLUMN = {
    PropType.PASSING_YARDS: "passing_yards",
    PropType.RUSHING_YARDS: "rushing_yards",
    PropType.RECEIVING_YARDS: "receiving_yards",
    PropType.RECEPTIONS: "receptions",
    PropType.PASSING_TDS: "passing_tds",
    PropType.ANYTIME_TD: "total_tds",
}
