"""
Quick smoke test to verify the backtest engine works.

Run: python scripts/smoke_test.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.schemas import StrategyInput, Filter, Operator, Market, BetSide
from backend.data_sources import NFLKaggleSource
from backend.engine import run_backtest


def main():
    project_root = Path(__file__).parent.parent
    db_path = project_root / "data" / "nfl.db"

    print("Loading data source...")
    source = NFLKaggleSource(db_path=db_path)

    min_s, max_s = source.get_season_range()
    print(f"Data available: {min_s} - {max_s}")

    # Test 1: Simple strategy - bet home underdogs ATS
    print("\n--- Test 1: Home Underdogs ATS ---")
    strategy1 = StrategyInput(
        name="Home Underdogs ATS",
        description="Bet on home teams when they are underdogs",
        market=Market.SPREAD,
        bet_side=BetSide.HOME,
        filters=[
            Filter(field="home_favorite", operator=Operator.EQ, value=False)
        ],
        season_start=2010,
        season_end=2017,
    )

    results1 = run_backtest(strategy1, source, include_bet_details=False)
    print(f"Total bets: {results1.total_bets}")
    print(f"Record: {results1.wins}-{results1.losses}-{results1.pushes}")
    print(f"Win rate: {results1.win_rate_pct}%")
    print(f"ROI: {results1.roi_pct}%")
    print(f"Profit: {results1.total_profit_units} units")
    print(f"Max drawdown: {results1.max_drawdown_units} units")

    # Test 2: All favorites ATS
    print("\n--- Test 2: All Favorites ATS ---")
    strategy2 = StrategyInput(
        name="Favorites ATS",
        description="Bet on the favorite against the spread",
        market=Market.SPREAD,
        bet_side=BetSide.FAVORITE,
        season_start=2010,
        season_end=2017,
    )

    results2 = run_backtest(strategy2, source, include_bet_details=False)
    print(f"Total bets: {results2.total_bets}")
    print(f"Record: {results2.wins}-{results2.losses}-{results2.pushes}")
    print(f"Win rate: {results2.win_rate_pct}%")
    print(f"ROI: {results2.roi_pct}%")

    # Test 3: Overs
    print("\n--- Test 3: Bet the Over ---")
    strategy3 = StrategyInput(
        name="Always Over",
        description="Bet the over on every game",
        market=Market.TOTAL,
        bet_side=BetSide.OVER,
        season_start=2010,
        season_end=2017,
    )

    results3 = run_backtest(strategy3, source, include_bet_details=False)
    print(f"Total bets: {results3.total_bets}")
    print(f"Win rate: {results3.win_rate_pct}%")
    print(f"ROI: {results3.roi_pct}%")

    print("\n--- Smoke test passed! ---")
    return 0


if __name__ == "__main__":
    sys.exit(main())
