"""
Ingest NFL player stats from nflreadpy (nflverse) into SQLite database.

This adds weekly player statistics for player prop backtesting:
- Passing: yards, TDs, attempts, completions
- Rushing: yards, TDs, attempts
- Receiving: yards, TDs, receptions, targets

Data source: https://github.com/nflverse/nflreadpy
"""

import sqlite3
from pathlib import Path
import nflreadpy as nfl
from tqdm import tqdm


def create_player_stats_schema(db_path: Path):
    """Create the player_stats table schema."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Drop existing table if it exists
    cursor.execute("DROP TABLE IF EXISTS player_stats")

    # Player stats table with weekly performance data
    cursor.execute("""
        CREATE TABLE player_stats (
            -- Primary key
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            -- Player identification
            player_id TEXT NOT NULL,
            player_name TEXT NOT NULL,
            player_display_name TEXT,
            position TEXT,
            position_group TEXT,
            team TEXT,

            -- Game context
            season INTEGER NOT NULL,
            week INTEGER NOT NULL,
            season_type TEXT,
            opponent_team TEXT,

            -- Passing stats
            passing_attempts INTEGER,
            passing_completions INTEGER,
            passing_yards INTEGER,
            passing_tds INTEGER,
            passing_interceptions INTEGER,

            -- Rushing stats
            rushing_attempts INTEGER,
            rushing_yards INTEGER,
            rushing_tds INTEGER,

            -- Receiving stats
            receptions INTEGER,
            targets INTEGER,
            receiving_yards INTEGER,
            receiving_tds INTEGER,

            -- Combined TD (for anytime TD)
            total_tds INTEGER,

            -- Fantasy points (useful for validation)
            fantasy_points REAL,
            fantasy_points_ppr REAL,

            UNIQUE(player_id, season, week)
        )
    """)

    # Create indexes for common queries
    cursor.execute("CREATE INDEX idx_player_stats_player ON player_stats(player_id)")
    cursor.execute("CREATE INDEX idx_player_stats_name ON player_stats(player_name)")
    cursor.execute("CREATE INDEX idx_player_stats_season_week ON player_stats(season, week)")
    cursor.execute("CREATE INDEX idx_player_stats_position ON player_stats(position)")
    cursor.execute("CREATE INDEX idx_player_stats_team ON player_stats(team)")

    conn.commit()
    conn.close()
    print("[OK] Player stats schema created")


def ingest_player_stats(db_path: Path, start_year: int = 1999, end_year: int = 2023):
    """
    Ingest weekly player stats from nflreadpy.

    Args:
        db_path: Path to SQLite database
        start_year: First season to ingest (default: 1999)
        end_year: Last season to ingest (default: 2023)
    """
    conn = sqlite3.connect(db_path)

    print(f"Loading player stats from {start_year} to {end_year}...")
    years = list(range(start_year, end_year + 1))

    # Load weekly player stats
    df = nfl.load_player_stats(years, summary_level="week")

    # Convert polars to dict records for insertion
    records = df.to_dicts()

    print(f"Processing {len(records)} player-week records...")

    # Prepare insert statement
    insert_sql = """
        INSERT OR REPLACE INTO player_stats (
            player_id, player_name, player_display_name, position, position_group, team,
            season, week, season_type, opponent_team,
            passing_attempts, passing_completions, passing_yards, passing_tds, passing_interceptions,
            rushing_attempts, rushing_yards, rushing_tds,
            receptions, targets, receiving_yards, receiving_tds,
            total_tds, fantasy_points, fantasy_points_ppr
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    cursor = conn.cursor()
    inserted = 0
    skipped = 0

    for record in tqdm(records, desc="Inserting player stats"):
        try:
            # Calculate total TDs
            passing_tds = record.get('passing_tds') or 0
            rushing_tds = record.get('rushing_tds') or 0
            receiving_tds = record.get('receiving_tds') or 0
            total_tds = passing_tds + rushing_tds + receiving_tds

            values = (
                record.get('player_id'),
                record.get('player_name'),
                record.get('player_display_name'),
                record.get('position'),
                record.get('position_group'),
                record.get('recent_team'),
                record.get('season'),
                record.get('week'),
                record.get('season_type'),
                record.get('opponent_team'),
                record.get('attempts'),  # passing attempts
                record.get('completions'),
                record.get('passing_yards'),
                passing_tds,
                record.get('interceptions'),
                record.get('carries'),  # rushing attempts
                record.get('rushing_yards'),
                rushing_tds,
                record.get('receptions'),
                record.get('targets'),
                record.get('receiving_yards'),
                receiving_tds,
                total_tds,
                record.get('fantasy_points'),
                record.get('fantasy_points_ppr'),
            )

            cursor.execute(insert_sql, values)
            inserted += 1

        except Exception as e:
            skipped += 1
            if skipped <= 5:  # Only print first 5 errors
                print(f"Error inserting record: {e}")

    conn.commit()
    conn.close()

    print(f"[OK] Inserted {inserted:,} records, skipped {skipped:,}")


def main():
    """Main ingestion workflow for player stats."""
    # Setup paths
    PROJECT_ROOT = Path(__file__).parent.parent
    DB_PATH = PROJECT_ROOT / "data" / "nfl.db"

    if not DB_PATH.exists():
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Please run ingest_nflverse_data.py first to create the games database.")
        return

    print("=" * 60)
    print("NFL Player Stats Ingestion (nflverse)")
    print("=" * 60)

    # Step 1: Create schema
    create_player_stats_schema(DB_PATH)

    # Step 2: Ingest player stats (1999-2023)
    ingest_player_stats(DB_PATH, start_year=1999, end_year=2023)

    # Verify
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM player_stats")
    total_records = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT player_id) FROM player_stats")
    unique_players = cursor.fetchone()[0]

    cursor.execute("SELECT MIN(season), MAX(season) FROM player_stats")
    min_season, max_season = cursor.fetchone()

    cursor.execute("""
        SELECT position, COUNT(*) as cnt
        FROM player_stats
        WHERE position IN ('QB', 'RB', 'WR', 'TE')
        GROUP BY position
        ORDER BY cnt DESC
    """)
    position_counts = cursor.fetchall()

    conn.close()

    print("\n" + "=" * 60)
    print("Ingestion Complete!")
    print("=" * 60)
    print(f"Total player-week records: {total_records:,}")
    print(f"Unique players: {unique_players:,}")
    print(f"Season range: {min_season}-{max_season}")
    print("\nRecords by position:")
    for pos, cnt in position_counts:
        print(f"  {pos}: {cnt:,}")
    print(f"\nDatabase location: {DB_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
