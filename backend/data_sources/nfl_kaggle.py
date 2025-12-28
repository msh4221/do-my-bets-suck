"""
NFL data source from the Kaggle/GitHub betting dataset.

Handles loading from CSV or SQLite and normalizing to standard schema.

Now supports both:
- Legacy Kaggle schema (2000-2017)
- New nflverse schema (1999-2023)
"""

import sqlite3
from pathlib import Path
from typing import Optional
import pandas as pd

from .base import DataSource


class NFLKaggleSource(DataSource):
    """NFL betting data from Kaggle or nflverse datasets."""

    # Map raw columns to our standardized names (Kaggle CSV)
    COLUMN_MAP = {
        "schedule_date": "game_date",
        "schedule_season": "season",
        "schedule_week": "week",
        "team_home": "home_team",
        "team_away": "away_team",
        "score_home": "home_score",
        "score_away": "away_score",
        "spread_favorite": "spread_line_raw",
        "over_under_line": "total_line",
        "home_favorite": "home_favorite",
        "favorite_covered": "favorite_covered",
        "over_under_result": "total_result",
        "weather_temperature": "temperature",
        "weather_wind_mph": "wind_mph",
    }

    # Map nflverse columns to standardized names
    NFLVERSE_MAP = {
        "gameday": "game_date",
        "spread_line": "spread_line",
        "total_line": "total_line",
        "temp": "temperature",
        "wind": "wind_mph",
    }

    def __init__(self, db_path: Optional[Path] = None, csv_path: Optional[Path] = None):
        """
        Initialize with either SQLite database or raw CSV.

        Args:
            db_path: Path to SQLite database (preferred)
            csv_path: Path to raw CSV file
        """
        self.db_path = db_path
        self.csv_path = csv_path
        self._df: Optional[pd.DataFrame] = None
        self._schema_type: Optional[str] = None  # 'kaggle' or 'nflverse'

    def _detect_schema(self, df: pd.DataFrame) -> str:
        """Detect whether this is Kaggle or nflverse schema."""
        # nflverse has 'gameday', 'away_team', 'home_team'
        # Kaggle has 'team_home', 'team_away', 'schedule_date'
        if 'gameday' in df.columns and 'game_type' in df.columns:
            return 'nflverse'
        elif 'schedule_date' in df.columns or 'team_home' in df.columns:
            return 'kaggle'
        elif 'away_team' in df.columns and 'home_team' in df.columns and 'game_date' not in df.columns:
            return 'nflverse'  # Already processed nflverse
        else:
            return 'kaggle'  # Default to Kaggle

    def _load_data(self) -> pd.DataFrame:
        """Load and normalize the dataset."""
        if self._df is not None:
            return self._df

        if self.db_path and self.db_path.exists():
            conn = sqlite3.connect(self.db_path)
            df = pd.read_sql_query("SELECT * FROM games", conn)
            conn.close()

            # Detect schema type
            self._schema_type = self._detect_schema(df)

            if self._schema_type == 'nflverse':
                self._df = self._normalize_nflverse(df)
            else:
                self._df = df  # Assume already normalized Kaggle

        elif self.csv_path and self.csv_path.exists():
            self._df = self._load_from_csv()
            self._schema_type = 'kaggle'
        else:
            raise FileNotFoundError("No valid data source provided")

        return self._df

    def _normalize_nflverse(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize nflverse schema to standard format."""
        # Rename columns
        df = df.rename(columns={
            'gameday': 'game_date',
            'temp': 'temperature',
            'wind': 'wind_mph'
        })

        # Parse dates
        df['game_date'] = pd.to_datetime(df['game_date'], errors='coerce')

        # Calculate derived fields needed for backtesting

        # 1. home_favorite: True if home team is favored (spread_line < 0)
        df['home_favorite'] = df['spread_line'] < 0

        # 2. favorite_covered: Did the favorite beat the spread?
        df['favorite_covered'] = df.apply(
            lambda row: (
                (row['home_score'] - row['away_score'] + row['spread_line'] > 0) if row['home_favorite']
                else (row['away_score'] - row['home_score'] - row['spread_line'] > 0)
            ) if pd.notna(row['spread_line']) and pd.notna(row['home_score']) else None,
            axis=1
        )

        # 3. total_result: "over", "under", or "push"
        df['total_result'] = df.apply(
            lambda row: (
                "over" if row['total'] > row['total_line']
                else "under" if row['total'] < row['total_line']
                else "push"
            ) if pd.notna(row['total_line']) and pd.notna(row['total']) else None,
            axis=1
        )

        # Filter to regular season and playoffs (exclude preseason)
        df = df[df['game_type'].isin(['REG', 'WC', 'DIV', 'CON', 'SB'])].copy()

        # Filter out games without betting data
        df = df.dropna(subset=['spread_line', 'total_line', 'home_score', 'away_score'])

        return df

    def _load_from_csv(self) -> pd.DataFrame:
        """Load from raw CSV and normalize."""
        df = pd.read_csv(self.csv_path)

        # Rename columns to standard names
        df = df.rename(columns={k: v for k, v in self.COLUMN_MAP.items() if k in df.columns})

        # Parse dates
        df["game_date"] = pd.to_datetime(df["game_date"], format="%m/%d/%Y", errors="coerce")

        # Convert spread to standard format (negative = home favored)
        # Raw data has spread_favorite as positive number for favorite's spread
        # We need to convert so negative = home favored
        if "spread_line_raw" in df.columns:
            df["spread_line"] = df.apply(
                lambda row: -abs(row["spread_line_raw"]) if row.get("home_favorite") == 1
                else abs(row["spread_line_raw"]) if pd.notna(row["spread_line_raw"])
                else None,
                axis=1
            )

        # Convert boolean columns
        if "home_favorite" in df.columns:
            df["home_favorite"] = df["home_favorite"].astype(bool)
        if "favorite_covered" in df.columns:
            df["favorite_covered"] = df["favorite_covered"].fillna(0).astype(bool)

        # Create game_id
        df["game_id"] = df.index

        # Filter out rows without betting data
        df = df.dropna(subset=["spread_line", "home_score", "away_score"])

        return df

    def get_games(
        self,
        season_start: Optional[int] = None,
        season_end: Optional[int] = None
    ) -> pd.DataFrame:
        """Get games within season range."""
        df = self._load_data()

        if season_start:
            df = df[df["season"] >= season_start]
        if season_end:
            df = df[df["season"] <= season_end]

        return df.copy()

    def get_available_fields(self) -> list[str]:
        """Return filterable fields."""
        df = self._load_data()
        return list(df.columns)

    def get_season_range(self) -> tuple[int, int]:
        """Return min and max seasons."""
        df = self._load_data()
        return int(df["season"].min()), int(df["season"].max())

    def save_to_sqlite(self, db_path: Path):
        """Save processed data to SQLite for faster future loads."""
        df = self._load_data()
        conn = sqlite3.connect(db_path)
        df.to_sql("games", conn, if_exists="replace", index=False)
        conn.close()
        self.db_path = db_path
