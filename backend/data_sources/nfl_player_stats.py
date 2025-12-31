"""
NFL player stats data source for player prop backtesting.

Provides access to weekly player statistics for settlement of prop bets.
"""

import sqlite3
from pathlib import Path
from typing import Optional
import pandas as pd


class NFLPlayerStatsSource:
    """Data source for NFL player statistics."""

    def __init__(self, db_path: Optional[Path] = None):
        """
        Initialize with database path.

        Args:
            db_path: Path to SQLite database. Defaults to data/nfl.db
        """
        if db_path is None:
            db_path = Path(__file__).parent.parent.parent / "data" / "nfl.db"
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    def _get_connection(self) -> sqlite3.Connection:
        """Get or create database connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path)
        return self._conn

    def search_players(
        self,
        query: str,
        position: Optional[str] = None,
        limit: int = 20
    ) -> list[dict]:
        """
        Search for players by name for autocomplete.

        Args:
            query: Search string (partial name match)
            position: Filter by position (QB, RB, WR, TE)
            limit: Maximum results to return

        Returns:
            List of matching players with id, name, position, team
        """
        conn = self._get_connection()

        # Search by player name with most recent team
        sql = """
            SELECT
                player_id,
                player_display_name,
                position,
                team,
                MAX(season) as last_season
            FROM player_stats
            WHERE player_display_name LIKE ?
        """
        params = [f"%{query}%"]

        if position:
            sql += " AND position = ?"
            params.append(position.upper())

        sql += """
            GROUP BY player_id, player_display_name, position
            ORDER BY last_season DESC, player_display_name
            LIMIT ?
        """
        params.append(limit)

        cursor = conn.execute(sql, params)
        results = []
        for row in cursor.fetchall():
            results.append({
                "player_id": row[0],
                "name": row[1],
                "position": row[2],
                "team": row[3],
                "last_season": row[4]
            })

        return results

    def get_player_stats(
        self,
        player_id: Optional[str] = None,
        player_name: Optional[str] = None,
        position: Optional[str] = None,
        season_start: Optional[int] = None,
        season_end: Optional[int] = None,
        week_start: Optional[int] = None,
        week_end: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Query player stats with filters.

        Args:
            player_id: Filter by specific player ID
            player_name: Filter by player name (exact match)
            position: Filter by position
            season_start: Minimum season
            season_end: Maximum season
            week_start: Minimum week
            week_end: Maximum week

        Returns:
            DataFrame with player stats
        """
        conn = self._get_connection()

        sql = "SELECT * FROM player_stats WHERE 1=1"
        params = []

        if player_id:
            sql += " AND player_id = ?"
            params.append(player_id)

        if player_name:
            sql += " AND player_display_name = ?"
            params.append(player_name)

        if position:
            sql += " AND position = ?"
            params.append(position.upper())

        if season_start:
            sql += " AND season >= ?"
            params.append(season_start)

        if season_end:
            sql += " AND season <= ?"
            params.append(season_end)

        if week_start:
            sql += " AND week >= ?"
            params.append(week_start)

        if week_end:
            sql += " AND week <= ?"
            params.append(week_end)

        # Only include regular season and postseason
        sql += " AND season_type IN ('REG', 'POST')"

        sql += " ORDER BY season, week"

        return pd.read_sql_query(sql, conn, params=params)

    def get_player_stat_for_game(
        self,
        player_id: str,
        season: int,
        week: int,
        stat_type: str
    ) -> Optional[float]:
        """
        Get a specific stat for a player in a specific game.

        Args:
            player_id: Player's unique ID
            season: Season year
            week: Week number
            stat_type: One of: passing_yards, rushing_yards, receiving_yards,
                       receptions, passing_tds, rushing_tds, receiving_tds, total_tds

        Returns:
            The stat value or None if not found
        """
        valid_stats = [
            'passing_yards', 'rushing_yards', 'receiving_yards',
            'receptions', 'passing_tds', 'rushing_tds', 'receiving_tds',
            'total_tds', 'passing_attempts', 'rushing_attempts', 'targets'
        ]

        if stat_type not in valid_stats:
            raise ValueError(f"Invalid stat_type: {stat_type}. Must be one of {valid_stats}")

        conn = self._get_connection()

        sql = f"""
            SELECT {stat_type}
            FROM player_stats
            WHERE player_id = ? AND season = ? AND week = ?
        """

        cursor = conn.execute(sql, (player_id, season, week))
        row = cursor.fetchone()

        if row is None:
            return None
        return row[0]

    def get_all_player_games_with_stat(
        self,
        stat_type: str,
        position: Optional[str] = None,
        season_start: Optional[int] = None,
        season_end: Optional[int] = None,
        min_stat_value: Optional[float] = None
    ) -> pd.DataFrame:
        """
        Get all player-game records with a specific stat.

        Useful for backtesting strategies like "bet over X yards for all QBs"

        Args:
            stat_type: The stat to filter by (e.g., 'passing_yards')
            position: Filter by position
            season_start: Minimum season
            season_end: Maximum season
            min_stat_value: Only include games where stat >= this value

        Returns:
            DataFrame with player stats
        """
        valid_stats = [
            'passing_yards', 'rushing_yards', 'receiving_yards',
            'receptions', 'passing_tds', 'rushing_tds', 'receiving_tds',
            'total_tds'
        ]

        if stat_type not in valid_stats:
            raise ValueError(f"Invalid stat_type: {stat_type}")

        conn = self._get_connection()

        sql = f"""
            SELECT
                player_id,
                player_display_name as player_name,
                position,
                team,
                season,
                week,
                opponent_team,
                {stat_type} as actual_stat
            FROM player_stats
            WHERE {stat_type} IS NOT NULL
        """
        params = []

        if position:
            sql += " AND position = ?"
            params.append(position.upper())

        if season_start:
            sql += " AND season >= ?"
            params.append(season_start)

        if season_end:
            sql += " AND season <= ?"
            params.append(season_end)

        if min_stat_value is not None:
            sql += f" AND {stat_type} >= ?"
            params.append(min_stat_value)

        # Only include regular season and postseason
        sql += " AND season_type IN ('REG', 'POST')"

        sql += " ORDER BY season, week, player_display_name"

        return pd.read_sql_query(sql, conn, params=params)

    def get_season_range(self) -> tuple[int, int]:
        """Return min and max seasons with player stats."""
        conn = self._get_connection()
        cursor = conn.execute("SELECT MIN(season), MAX(season) FROM player_stats")
        row = cursor.fetchone()
        return (row[0], row[1]) if row else (None, None)

    def get_positions(self) -> list[str]:
        """Return list of available positions."""
        conn = self._get_connection()
        cursor = conn.execute("""
            SELECT DISTINCT position
            FROM player_stats
            WHERE position IS NOT NULL
            ORDER BY position
        """)
        return [row[0] for row in cursor.fetchall()]

    def close(self):
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None
