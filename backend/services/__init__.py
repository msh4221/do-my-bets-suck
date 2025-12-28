"""
External API services for real-time data.
"""

from .odds_api import OddsAPIClient, get_upcoming_games, UpcomingGame

__all__ = ["OddsAPIClient", "get_upcoming_games", "UpcomingGame"]
