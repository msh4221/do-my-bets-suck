"""
The Odds API client for fetching current NFL betting lines.

API Documentation: https://the-odds-api.com/liveapi/guides/v4/
Free tier: 500 requests/month

Usage:
    client = OddsAPIClient(api_key="your_key")
    games = client.get_nfl_odds()
    props = client.get_player_props_for_event(event_id)
"""

import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
import requests

# Load .env file if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass  # python-dotenv not installed, rely on system env vars


@dataclass
class BookmakerOdds:
    """Odds from a single bookmaker."""
    bookmaker: str
    spread_home: Optional[float] = None
    spread_home_price: Optional[int] = None
    spread_away: Optional[float] = None
    spread_away_price: Optional[int] = None
    total_line: Optional[float] = None
    over_price: Optional[int] = None
    under_price: Optional[int] = None
    home_moneyline: Optional[int] = None
    away_moneyline: Optional[int] = None


@dataclass
class UpcomingGame:
    """An upcoming NFL game with betting lines."""
    game_id: str
    commence_time: datetime
    home_team: str
    away_team: str

    # Consensus lines (average across bookmakers)
    spread_line: Optional[float] = None  # Negative = home favored
    total_line: Optional[float] = None
    home_moneyline: Optional[int] = None
    away_moneyline: Optional[int] = None

    # Individual bookmaker odds
    bookmakers: list[BookmakerOdds] = field(default_factory=list)

    # Derived fields
    home_favorite: bool = False

    def __post_init__(self):
        if self.spread_line is not None:
            self.home_favorite = self.spread_line < 0


@dataclass
class PlayerPropLine:
    """A single player prop betting line."""
    player_name: str
    prop_type: str  # e.g., "player_pass_yds", "player_rush_yds"
    line: float  # e.g., 274.5
    over_price: Optional[int] = None  # American odds for over
    under_price: Optional[int] = None  # American odds for under
    bookmaker: str = ""


@dataclass
class GamePlayerProps:
    """All player props for a single game."""
    event_id: str
    home_team: str
    away_team: str
    commence_time: datetime
    props: list[PlayerPropLine] = field(default_factory=list)


# Simple in-memory cache for player props (15-minute TTL)
_props_cache: dict[str, tuple[float, list]] = {}
CACHE_TTL = 15 * 60  # 15 minutes in seconds


class OddsAPIClient:
    """Client for The Odds API."""

    BASE_URL = "https://api.the-odds-api.com/v4"
    NFL_SPORT = "americanfootball_nfl"

    # Map Odds API team names to standard abbreviations
    TEAM_MAP = {
        "Arizona Cardinals": "ARI",
        "Atlanta Falcons": "ATL",
        "Baltimore Ravens": "BAL",
        "Buffalo Bills": "BUF",
        "Carolina Panthers": "CAR",
        "Chicago Bears": "CHI",
        "Cincinnati Bengals": "CIN",
        "Cleveland Browns": "CLE",
        "Dallas Cowboys": "DAL",
        "Denver Broncos": "DEN",
        "Detroit Lions": "DET",
        "Green Bay Packers": "GB",
        "Houston Texans": "HOU",
        "Indianapolis Colts": "IND",
        "Jacksonville Jaguars": "JAX",
        "Kansas City Chiefs": "KC",
        "Las Vegas Raiders": "LV",
        "Los Angeles Chargers": "LAC",
        "Los Angeles Rams": "LA",
        "Miami Dolphins": "MIA",
        "Minnesota Vikings": "MIN",
        "New England Patriots": "NE",
        "New Orleans Saints": "NO",
        "New York Giants": "NYG",
        "New York Jets": "NYJ",
        "Philadelphia Eagles": "PHI",
        "Pittsburgh Steelers": "PIT",
        "San Francisco 49ers": "SF",
        "Seattle Seahawks": "SEA",
        "Tampa Bay Buccaneers": "TB",
        "Tennessee Titans": "TEN",
        "Washington Commanders": "WAS",
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize with API key.

        Args:
            api_key: The Odds API key. If not provided, reads from ODDS_API_KEY env var.
        """
        self.api_key = api_key or os.environ.get("ODDS_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key required. Set ODDS_API_KEY environment variable or pass api_key parameter."
            )
        self._requests_remaining: Optional[int] = None
        self._requests_used: Optional[int] = None

    @property
    def requests_remaining(self) -> Optional[int]:
        """Number of API requests remaining this month."""
        return self._requests_remaining

    @property
    def requests_used(self) -> Optional[int]:
        """Number of API requests used this month."""
        return self._requests_used

    def _normalize_team(self, team_name: str) -> str:
        """Convert full team name to abbreviation."""
        return self.TEAM_MAP.get(team_name, team_name)

    def get_nfl_odds(
        self,
        markets: list[str] = ["spreads", "totals", "h2h"],
        regions: str = "us",
        odds_format: str = "american",
    ) -> list[UpcomingGame]:
        """
        Fetch current NFL odds from The Odds API.

        Args:
            markets: List of markets to fetch. Options: spreads, totals, h2h (moneyline)
            regions: Bookmaker region. Options: us, uk, eu, au
            odds_format: Odds format. Options: american, decimal

        Returns:
            List of UpcomingGame objects with betting lines
        """
        url = f"{self.BASE_URL}/sports/{self.NFL_SPORT}/odds"

        params = {
            "apiKey": self.api_key,
            "regions": regions,
            "markets": ",".join(markets),
            "oddsFormat": odds_format,
        }

        response = requests.get(url, params=params, timeout=30)

        # Track API usage from response headers
        self._requests_remaining = int(response.headers.get("x-requests-remaining", 0))
        self._requests_used = int(response.headers.get("x-requests-used", 0))

        if response.status_code == 401:
            raise ValueError("Invalid API key")
        elif response.status_code == 422:
            raise ValueError("Invalid request parameters")
        elif response.status_code == 429:
            raise ValueError("API rate limit exceeded")
        elif response.status_code != 200:
            raise ValueError(f"API error: {response.status_code} - {response.text}")

        data = response.json()
        return self._parse_games(data)

    def _parse_games(self, data: list[dict]) -> list[UpcomingGame]:
        """Parse API response into UpcomingGame objects."""
        games = []

        for game_data in data:
            game = self._parse_single_game(game_data)
            if game:
                games.append(game)

        # Sort by commence time
        games.sort(key=lambda g: g.commence_time)

        return games

    def _parse_single_game(self, data: dict) -> Optional[UpcomingGame]:
        """Parse a single game from API response."""
        try:
            # Parse commence time
            commence_time = datetime.fromisoformat(data["commence_time"].replace("Z", "+00:00"))

            # Normalize team names
            home_team = self._normalize_team(data["home_team"])
            away_team = self._normalize_team(data["away_team"])

            # Parse bookmaker odds
            bookmakers = []
            all_spreads_home = []
            all_totals = []
            all_home_ml = []
            all_away_ml = []

            for bm_data in data.get("bookmakers", []):
                bm_odds = self._parse_bookmaker(bm_data, data["home_team"], data["away_team"])
                if bm_odds:
                    bookmakers.append(bm_odds)

                    # Collect for consensus calculation
                    if bm_odds.spread_home is not None:
                        all_spreads_home.append(bm_odds.spread_home)
                    if bm_odds.total_line is not None:
                        all_totals.append(bm_odds.total_line)
                    if bm_odds.home_moneyline is not None:
                        all_home_ml.append(bm_odds.home_moneyline)
                    if bm_odds.away_moneyline is not None:
                        all_away_ml.append(bm_odds.away_moneyline)

            # Calculate consensus (average) lines
            spread_line = round(sum(all_spreads_home) / len(all_spreads_home), 1) if all_spreads_home else None
            total_line = round(sum(all_totals) / len(all_totals), 1) if all_totals else None
            home_moneyline = round(sum(all_home_ml) / len(all_home_ml)) if all_home_ml else None
            away_moneyline = round(sum(all_away_ml) / len(all_away_ml)) if all_away_ml else None

            return UpcomingGame(
                game_id=data["id"],
                commence_time=commence_time,
                home_team=home_team,
                away_team=away_team,
                spread_line=spread_line,
                total_line=total_line,
                home_moneyline=home_moneyline,
                away_moneyline=away_moneyline,
                bookmakers=bookmakers,
            )

        except (KeyError, ValueError) as e:
            print(f"Error parsing game: {e}")
            return None

    def _parse_bookmaker(self, data: dict, home_team: str, away_team: str) -> Optional[BookmakerOdds]:
        """Parse a single bookmaker's odds."""
        try:
            odds = BookmakerOdds(bookmaker=data["key"])

            for market in data.get("markets", []):
                market_key = market["key"]
                outcomes = {o["name"]: o for o in market.get("outcomes", [])}

                if market_key == "spreads":
                    if home_team in outcomes:
                        odds.spread_home = outcomes[home_team].get("point")
                        odds.spread_home_price = outcomes[home_team].get("price")
                    if away_team in outcomes:
                        odds.spread_away = outcomes[away_team].get("point")
                        odds.spread_away_price = outcomes[away_team].get("price")

                elif market_key == "totals":
                    if "Over" in outcomes:
                        odds.total_line = outcomes["Over"].get("point")
                        odds.over_price = outcomes["Over"].get("price")
                    if "Under" in outcomes:
                        odds.under_price = outcomes["Under"].get("price")

                elif market_key == "h2h":
                    if home_team in outcomes:
                        odds.home_moneyline = outcomes[home_team].get("price")
                    if away_team in outcomes:
                        odds.away_moneyline = outcomes[away_team].get("price")

            return odds

        except (KeyError, ValueError):
            return None

    def get_api_usage(self) -> dict:
        """Get current API usage stats."""
        return {
            "requests_remaining": self._requests_remaining,
            "requests_used": self._requests_used,
        }

    def get_nfl_events(self) -> list[dict]:
        """
        Get list of upcoming NFL events (games) with their IDs.

        Returns:
            List of event dicts with id, home_team, away_team, commence_time
        """
        url = f"{self.BASE_URL}/sports/{self.NFL_SPORT}/events"

        params = {
            "apiKey": self.api_key,
        }

        response = requests.get(url, params=params, timeout=30)

        # Track API usage from response headers
        self._requests_remaining = int(response.headers.get("x-requests-remaining", 0))
        self._requests_used = int(response.headers.get("x-requests-used", 0))

        if response.status_code != 200:
            raise ValueError(f"API error: {response.status_code} - {response.text}")

        events = []
        for event in response.json():
            events.append({
                "event_id": event["id"],
                "home_team": self._normalize_team(event["home_team"]),
                "away_team": self._normalize_team(event["away_team"]),
                "commence_time": event["commence_time"],
            })

        return events

    def get_player_props_for_event(
        self,
        event_id: str,
        markets: list[str] = None,
        use_cache: bool = True
    ) -> GamePlayerProps:
        """
        Fetch player props for a specific event.

        Args:
            event_id: The event/game ID from get_nfl_events()
            markets: List of prop markets. Defaults to common props.
                Options: player_pass_yds, player_rush_yds, player_reception_yds,
                        player_receptions, player_pass_tds, player_anytime_td
            use_cache: Whether to use cached data if available

        Returns:
            GamePlayerProps with all player prop lines
        """
        global _props_cache

        # Check cache first
        cache_key = f"{event_id}:{','.join(markets or [])}"
        if use_cache and cache_key in _props_cache:
            cached_time, cached_data = _props_cache[cache_key]
            if time.time() - cached_time < CACHE_TTL:
                return cached_data

        # Default markets
        if markets is None:
            markets = [
                "player_pass_yds",
                "player_rush_yds",
                "player_reception_yds",
                "player_receptions",
                "player_pass_tds",
                "player_anytime_td",
            ]

        url = f"{self.BASE_URL}/sports/{self.NFL_SPORT}/events/{event_id}/odds"

        params = {
            "apiKey": self.api_key,
            "regions": "us",
            "markets": ",".join(markets),
            "oddsFormat": "american",
        }

        response = requests.get(url, params=params, timeout=30)

        # Track API usage
        self._requests_remaining = int(response.headers.get("x-requests-remaining", 0))
        self._requests_used = int(response.headers.get("x-requests-used", 0))

        if response.status_code == 404:
            # Event not found or no props available
            return GamePlayerProps(
                event_id=event_id,
                home_team="",
                away_team="",
                commence_time=datetime.now(),
                props=[]
            )
        elif response.status_code != 200:
            raise ValueError(f"API error: {response.status_code} - {response.text}")

        data = response.json()
        result = self._parse_player_props(event_id, data)

        # Cache the result
        _props_cache[cache_key] = (time.time(), result)

        return result

    def _parse_player_props(self, event_id: str, data: dict) -> GamePlayerProps:
        """Parse player props from API response."""
        home_team = self._normalize_team(data.get("home_team", ""))
        away_team = self._normalize_team(data.get("away_team", ""))

        commence_time = datetime.now()
        if data.get("commence_time"):
            commence_time = datetime.fromisoformat(
                data["commence_time"].replace("Z", "+00:00")
            )

        props = []

        for bookmaker in data.get("bookmakers", []):
            bookmaker_key = bookmaker.get("key", "")

            for market in bookmaker.get("markets", []):
                market_key = market.get("key", "")

                # Group outcomes by player (description field)
                player_outcomes = {}
                for outcome in market.get("outcomes", []):
                    player = outcome.get("description", "")
                    if not player:
                        continue

                    if player not in player_outcomes:
                        player_outcomes[player] = {}

                    name = outcome.get("name", "")
                    player_outcomes[player][name] = {
                        "price": outcome.get("price"),
                        "point": outcome.get("point"),
                    }

                # Create prop lines from grouped outcomes
                for player, outcomes in player_outcomes.items():
                    over_data = outcomes.get("Over", {})
                    under_data = outcomes.get("Under", {})
                    yes_data = outcomes.get("Yes", {})

                    # For anytime TD, use Yes outcome
                    if market_key == "player_anytime_td" and yes_data:
                        props.append(PlayerPropLine(
                            player_name=player,
                            prop_type=market_key,
                            line=0.5,  # Anytime TD is essentially over 0.5 TDs
                            over_price=yes_data.get("price"),
                            under_price=None,
                            bookmaker=bookmaker_key,
                        ))
                    # For over/under props
                    elif over_data.get("point") is not None:
                        props.append(PlayerPropLine(
                            player_name=player,
                            prop_type=market_key,
                            line=over_data.get("point"),
                            over_price=over_data.get("price"),
                            under_price=under_data.get("price"),
                            bookmaker=bookmaker_key,
                        ))

        return GamePlayerProps(
            event_id=event_id,
            home_team=home_team,
            away_team=away_team,
            commence_time=commence_time,
            props=props,
        )

    def get_all_player_props(
        self,
        markets: list[str] = None
    ) -> list[GamePlayerProps]:
        """
        Fetch player props for all upcoming NFL games.

        Warning: This makes multiple API calls (1 per game).
        Use sparingly due to 500/month limit.

        Args:
            markets: List of prop markets to fetch

        Returns:
            List of GamePlayerProps for all upcoming games
        """
        events = self.get_nfl_events()
        all_props = []

        for event in events:
            try:
                props = self.get_player_props_for_event(
                    event["event_id"],
                    markets=markets
                )
                if props.props:  # Only include if there are props
                    all_props.append(props)
            except Exception as e:
                print(f"Error fetching props for {event['event_id']}: {e}")
                continue

        return all_props


def get_upcoming_games(api_key: Optional[str] = None) -> list[UpcomingGame]:
    """
    Convenience function to fetch upcoming NFL games with odds.

    Args:
        api_key: Optional API key. Uses ODDS_API_KEY env var if not provided.

    Returns:
        List of upcoming games with betting lines
    """
    client = OddsAPIClient(api_key=api_key)
    return client.get_nfl_odds()
