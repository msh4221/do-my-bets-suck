"""
Abstract base class for data sources.

Implement this interface to add new data providers without touching the backtest engine.
"""

from abc import ABC, abstractmethod
from typing import Optional
import pandas as pd


class DataSource(ABC):
    """Base interface for all betting data sources."""

    @abstractmethod
    def get_games(
        self,
        season_start: Optional[int] = None,
        season_end: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Fetch games within the specified season range.

        Returns DataFrame with standardized columns:
        - game_id: unique identifier
        - game_date: date of game
        - season: year
        - week: week number or playoff round
        - home_team: home team name
        - away_team: away team name
        - home_score: final home score
        - away_score: final away score
        - spread_line: spread (negative = home favored)
        - total_line: over/under line
        - home_favorite: bool, True if home team is favored
        - favorite_covered: bool, True if favorite covered spread
        - total_result: "over", "under", or "push"
        """
        pass

    @abstractmethod
    def get_available_fields(self) -> list[str]:
        """Return list of fields available for filtering."""
        pass

    @abstractmethod
    def get_season_range(self) -> tuple[int, int]:
        """Return (min_season, max_season) available in this source."""
        pass
