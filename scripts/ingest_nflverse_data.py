"""
Ingest NFL data from nflreadpy (nflverse) into SQLite database.

This script replaces the Kaggle data with more comprehensive nflverse data:
- Seasons: 1999-2024 (vs 2000-2017 in Kaggle)
- Betting lines: spread, total, moneyline with odds
- Weather: temperature, wind
- Stadium: location, surface, roof type

Data source: https://github.com/nflverse/nflreadpy
"""

import sqlite3
from pathlib import Path
import nflreadpy as nfl
from tqdm import tqdm


def create_database_schema(db_path: Path):
    """Create the database schema for nflverse data."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Drop existing tables if they exist
    cursor.execute("DROP TABLE IF EXISTS games")
    cursor.execute("DROP TABLE IF EXISTS stadiums")

    # Games table with comprehensive betting and weather data
    cursor.execute("""
        CREATE TABLE games (
            game_id TEXT PRIMARY KEY,
            season INTEGER NOT NULL,
            game_type TEXT NOT NULL,
            week INTEGER,
            gameday TEXT,
            weekday TEXT,
            gametime TEXT,

            -- Teams
            away_team TEXT NOT NULL,
            away_score INTEGER,
            away_rest INTEGER,
            away_qb_id TEXT,
            away_qb_name TEXT,
            away_coach TEXT,

            home_team TEXT NOT NULL,
            home_score INTEGER,
            home_rest INTEGER,
            home_qb_id TEXT,
            home_qb_name TEXT,
            home_coach TEXT,

            -- Results
            result INTEGER,
            total INTEGER,
            overtime INTEGER,

            -- Betting Lines (Spread)
            spread_line REAL,
            away_spread_odds INTEGER,
            home_spread_odds INTEGER,

            -- Betting Lines (Total)
            total_line REAL,
            under_odds INTEGER,
            over_odds INTEGER,

            -- Betting Lines (Moneyline)
            away_moneyline INTEGER,
            home_moneyline INTEGER,

            -- Stadium & Conditions
            stadium_id TEXT,
            stadium TEXT,
            location TEXT,
            roof TEXT,
            surface TEXT,
            temp REAL,
            wind REAL,

            -- Officials
            referee TEXT,

            -- Division Game Flag
            div_game INTEGER,

            -- External IDs for cross-referencing
            old_game_id TEXT,
            gsis TEXT,
            nfl_detail_id TEXT,
            pfr TEXT,
            pff TEXT,
            espn TEXT,
            ftn TEXT
        )
    """)

    # Create indexes for common queries
    cursor.execute("CREATE INDEX idx_games_season_week ON games(season, week)")
    cursor.execute("CREATE INDEX idx_games_teams ON games(away_team, home_team)")
    cursor.execute("CREATE INDEX idx_games_season ON games(season)")
    cursor.execute("CREATE INDEX idx_games_spread ON games(spread_line)")
    cursor.execute("CREATE INDEX idx_games_total ON games(total_line)")

    # Stadiums lookup table
    cursor.execute("""
        CREATE TABLE stadiums (
            stadium_id TEXT PRIMARY KEY,
            stadium_name TEXT,
            location TEXT,
            roof_type TEXT,
            surface_type TEXT,
            latitude REAL,
            longitude REAL
        )
    """)

    conn.commit()
    conn.close()
    print("[OK] Database schema created")


def ingest_schedules(db_path: Path, start_year: int = 1999, end_year: int = 2024):
    """
    Ingest NFL schedule data from nflreadpy.

    Args:
        db_path: Path to SQLite database
        start_year: First season to ingest (default: 1999)
        end_year: Last season to ingest (default: 2024)
    """
    conn = sqlite3.connect(db_path)

    print(f"Loading NFL schedules from {start_year} to {end_year}...")
    years = list(range(start_year, end_year + 1))

    # Load all schedules at once (nflreadpy is efficient)
    df = nfl.load_schedules(years)

    # Convert polars to dict records for insertion
    records = df.to_dicts()

    print(f"Inserting {len(records)} games into database...")

    # Prepare insert statement with all columns
    columns = [
        'game_id', 'season', 'game_type', 'week', 'gameday', 'weekday', 'gametime',
        'away_team', 'away_score', 'away_rest', 'away_qb_id', 'away_qb_name', 'away_coach',
        'home_team', 'home_score', 'home_rest', 'home_qb_id', 'home_qb_name', 'home_coach',
        'result', 'total', 'overtime',
        'spread_line', 'away_spread_odds', 'home_spread_odds',
        'total_line', 'under_odds', 'over_odds',
        'away_moneyline', 'home_moneyline',
        'stadium_id', 'stadium', 'location', 'roof', 'surface', 'temp', 'wind',
        'referee', 'div_game',
        'old_game_id', 'gsis', 'nfl_detail_id', 'pfr', 'pff', 'espn', 'ftn'
    ]

    placeholders = ', '.join(['?' for _ in columns])
    insert_sql = f"INSERT OR REPLACE INTO games ({', '.join(columns)}) VALUES ({placeholders})"

    # Insert records
    cursor = conn.cursor()
    for record in tqdm(records, desc="Inserting games"):
        values = tuple(record.get(col) for col in columns)
        cursor.execute(insert_sql, values)

    conn.commit()
    conn.close()

    print(f"[OK] Inserted {len(records)} games")


def generate_stadium_coordinates():
    """Generate approximate coordinates for NFL stadiums for weather API."""
    # These are approximate coordinates for active NFL stadiums as of 2024
    # For weather forecasting with weather.gov API
    stadiums = {
        # AFC East
        'Buffalo Bills': {'name': 'Highmark Stadium', 'lat': 42.7738, 'lon': -78.7870},
        'Miami Dolphins': {'name': 'Hard Rock Stadium', 'lat': 25.9580, 'lon': -80.2389},
        'New England Patriots': {'name': 'Gillette Stadium', 'lat': 42.0909, 'lon': -71.2643},
        'New York Jets': {'name': 'MetLife Stadium', 'lat': 40.8128, 'lon': -74.0742},

        # AFC North
        'Baltimore Ravens': {'name': 'M&T Bank Stadium', 'lat': 39.2780, 'lon': -76.6227},
        'Cincinnati Bengals': {'name': 'Paycor Stadium', 'lat': 39.0954, 'lon': -84.5160},
        'Cleveland Browns': {'name': 'Cleveland Browns Stadium', 'lat': 41.5061, 'lon': -81.6995},
        'Pittsburgh Steelers': {'name': 'Acrisure Stadium', 'lat': 40.4468, 'lon': -80.0158},

        # AFC South
        'Houston Texans': {'name': 'NRG Stadium', 'lat': 29.6847, 'lon': -95.4107},
        'Indianapolis Colts': {'name': 'Lucas Oil Stadium', 'lat': 39.7601, 'lon': -86.1639},
        'Jacksonville Jaguars': {'name': 'TIAA Bank Field', 'lat': 30.3240, 'lon': -81.6373},
        'Tennessee Titans': {'name': 'Nissan Stadium', 'lat': 36.1665, 'lon': -86.7713},

        # AFC West
        'Denver Broncos': {'name': 'Empower Field at Mile High', 'lat': 39.7439, 'lon': -105.0201},
        'Kansas City Chiefs': {'name': 'GEHA Field at Arrowhead Stadium', 'lat': 39.0489, 'lon': -94.4839},
        'Las Vegas Raiders': {'name': 'Allegiant Stadium', 'lat': 36.0908, 'lon': -115.1834},
        'Los Angeles Chargers': {'name': 'SoFi Stadium', 'lat': 33.9535, 'lon': -118.3390},

        # NFC East
        'Dallas Cowboys': {'name': 'AT&T Stadium', 'lat': 32.7473, 'lon': -97.0945},
        'New York Giants': {'name': 'MetLife Stadium', 'lat': 40.8128, 'lon': -74.0742},
        'Philadelphia Eagles': {'name': 'Lincoln Financial Field', 'lat': 39.9008, 'lon': -75.1675},
        'Washington Commanders': {'name': 'FedExField', 'lat': 38.9076, 'lon': -76.8645},

        # NFC North
        'Chicago Bears': {'name': 'Soldier Field', 'lat': 41.8623, 'lon': -87.6167},
        'Detroit Lions': {'name': 'Ford Field', 'lat': 42.3400, 'lon': -83.0456},
        'Green Bay Packers': {'name': 'Lambeau Field', 'lat': 42.5063, 'lon': -88.0622},
        'Minnesota Vikings': {'name': 'U.S. Bank Stadium', 'lat': 44.9738, 'lon': -93.2577},

        # NFC South
        'Atlanta Falcons': {'name': 'Mercedes-Benz Stadium', 'lat': 33.7553, 'lon': -84.4006},
        'Carolina Panthers': {'name': 'Bank of America Stadium', 'lat': 35.2258, 'lon': -80.8528},
        'New Orleans Saints': {'name': 'Caesars Superdome', 'lat': 29.9511, 'lon': -90.0812},
        'Tampa Bay Buccaneers': {'name': 'Raymond James Stadium', 'lat': 27.9759, 'lon': -82.5033},

        # NFC West
        'Arizona Cardinals': {'name': 'State Farm Stadium', 'lat': 33.5276, 'lon': -112.2626},
        'Los Angeles Rams': {'name': 'SoFi Stadium', 'lat': 33.9535, 'lon': -118.3390},
        'San Francisco 49ers': {'name': 'Levi\'s Stadium', 'lat': 37.4030, 'lon': -121.9698},
        'Seattle Seahawks': {'name': 'Lumen Field', 'lat': 47.5952, 'lon': -122.3316},
    }

    return stadiums


def insert_stadium_coordinates(db_path: Path):
    """Insert stadium coordinate data for weather API lookups."""
    stadiums = generate_stadium_coordinates()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    for team, info in stadiums.items():
        cursor.execute("""
            INSERT OR REPLACE INTO stadiums (stadium_id, stadium_name, latitude, longitude)
            VALUES (?, ?, ?, ?)
        """, (team, info['name'], info['lat'], info['lon']))

    conn.commit()
    conn.close()

    print(f"[OK] Inserted {len(stadiums)} stadium coordinates")


def main():
    """Main ingestion workflow."""
    # Setup paths
    PROJECT_ROOT = Path(__file__).parent.parent
    DB_PATH = PROJECT_ROOT / "data" / "nfl.db"

    # Ensure data directory exists
    DB_PATH.parent.mkdir(exist_ok=True)

    print("=" * 60)
    print("NFL Data Ingestion (nflverse)")
    print("=" * 60)

    # Step 1: Create schema
    create_database_schema(DB_PATH)

    # Step 2: Insert stadium coordinates
    insert_stadium_coordinates(DB_PATH)

    # Step 3: Ingest schedule data
    # Using 1999-2023 for completed seasons (2024 is ongoing)
    ingest_schedules(DB_PATH, start_year=1999, end_year=2023)

    # Verify
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM games")
    game_count = cursor.fetchone()[0]

    cursor.execute("SELECT MIN(season), MAX(season) FROM games")
    min_season, max_season = cursor.fetchone()

    cursor.execute("SELECT COUNT(*) FROM games WHERE spread_line IS NOT NULL")
    games_with_spread = cursor.fetchone()[0]

    conn.close()

    print("\n" + "=" * 60)
    print("Ingestion Complete!")
    print("=" * 60)
    print(f"Total games: {game_count:,}")
    print(f"Season range: {min_season}-{max_season}")
    print(f"Games with spread lines: {games_with_spread:,} ({games_with_spread/game_count*100:.1f}%)")
    print(f"Database location: {DB_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
