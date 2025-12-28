"""
Ingest raw CSV data into SQLite database.

Run this once after downloading the Kaggle dataset:
    python scripts/ingest_data.py
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.data_sources import NFLKaggleSource


def main():
    project_root = Path(__file__).parent.parent
    csv_path = project_root / "data" / "raw" / "nfl_betting_data.csv"
    db_path = project_root / "data" / "nfl.db"

    if not csv_path.exists():
        print(f"Error: CSV not found at {csv_path}")
        return 1

    print(f"Loading data from {csv_path}...")
    source = NFLKaggleSource(csv_path=csv_path)

    # Load and validate
    df = source.get_games()
    min_season, max_season = source.get_season_range()

    print(f"Loaded {len(df)} games from {min_season} to {max_season}")
    print(f"Columns: {list(df.columns)}")

    # Save to SQLite
    print(f"Saving to {db_path}...")
    source.save_to_sqlite(db_path)

    print("Done!")
    print(f"\nSample data:")
    print(df[["game_date", "season", "home_team", "away_team", "spread_line", "home_score", "away_score"]].head(10))

    return 0


if __name__ == "__main__":
    sys.exit(main())
