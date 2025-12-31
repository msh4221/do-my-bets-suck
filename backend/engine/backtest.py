"""
Main backtest engine.

Executes strategies against historical data deterministically.
"""

import hashlib
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

from backend.schemas import StrategyInput, BacktestResults, BetRecord, SeasonSummary, Market
from backend.data_sources import NFLKaggleSource
from .filters import apply_filters
from .settlement import settle_spread_bet, settle_total_bet, settle_moneyline_bet
from .metrics import (
    calculate_roi,
    calculate_win_rate,
    calculate_max_drawdown,
    calculate_streaks,
    calculate_season_summary,
)


def hash_strategy(strategy: StrategyInput) -> str:
    """Create reproducible hash of strategy for audit trail."""
    strategy_json = strategy.model_dump_json(exclude_none=True)
    return hashlib.sha256(strategy_json.encode()).hexdigest()[:16]


def run_backtest(
    strategy: StrategyInput,
    data_source: NFLKaggleSource,
    include_bet_details: bool = True,
) -> BacktestResults:
    """
    Execute a backtest and return results.

    This is the core deterministic engine - no LLM involvement.

    Args:
        strategy: Validated strategy specification
        data_source: Data provider
        include_bet_details: Whether to include individual bet records

    Returns:
        BacktestResults with all metrics
    """
    # Get games matching season range
    games = data_source.get_games(
        season_start=strategy.season_start,
        season_end=strategy.season_end,
    )

    if games.empty:
        return _empty_results(strategy)

    # Apply filters
    filtered_games = apply_filters(games, strategy.filters)

    # Apply team filters (supports OR logic: team can be home OR away)
    # Teams can be a single abbreviation or a list (for relocated franchises like OAK/LV)
    team_list = strategy.team if isinstance(strategy.team, list) else ([strategy.team] if strategy.team else None)
    opp_list = strategy.opponent if isinstance(strategy.opponent, list) else ([strategy.opponent] if strategy.opponent else None)

    if team_list and opp_list:
        # Both specified: must be a matchup between these two teams (any of their abbreviations)
        matchup_mask = (
            (filtered_games["home_team"].isin(team_list) & filtered_games["away_team"].isin(opp_list)) |
            (filtered_games["away_team"].isin(team_list) & filtered_games["home_team"].isin(opp_list))
        )
        filtered_games = filtered_games[matchup_mask]
    elif team_list:
        # Only team specified: any game involving this team (any of its abbreviations)
        team_mask = filtered_games["home_team"].isin(team_list) | filtered_games["away_team"].isin(team_list)
        filtered_games = filtered_games[team_mask]
    elif opp_list:
        # Only opponent specified: any game involving this opponent (any of its abbreviations)
        opp_mask = filtered_games["home_team"].isin(opp_list) | filtered_games["away_team"].isin(opp_list)
        filtered_games = filtered_games[opp_mask]

    if filtered_games.empty:
        return _empty_results(strategy, warning="No games matched your filters")

    # Select settlement function based on market
    if strategy.market == Market.SPREAD:
        settle_func = settle_spread_bet
    elif strategy.market == Market.TOTAL:
        settle_func = settle_total_bet
    elif strategy.market == Market.MONEYLINE:
        settle_func = settle_moneyline_bet
    else:
        raise ValueError(f"Unknown market: {strategy.market}")

    # Settle all bets
    bet_records = []
    for _, row in filtered_games.iterrows():
        # Pass selected_team for "team" bet side (spread and moneyline only)
        if strategy.bet_side.value == "team" and strategy.market != Market.TOTAL:
            # Find which team abbreviation matches this game (for relocated franchises)
            selected_team = None
            if team_list:
                if row["home_team"] in team_list:
                    selected_team = row["home_team"]
                elif row["away_team"] in team_list:
                    selected_team = row["away_team"]
            result, profit = settle_func(row, strategy.bet_side.value, selected_team=selected_team)
        else:
            result, profit = settle_func(row, strategy.bet_side.value)

        if result == "no_line":
            continue

        profit *= strategy.stake_unit

        # Handle game_date which might be datetime or string from SQLite
        game_date_val = row["game_date"]
        if pd.notna(game_date_val):
            if hasattr(game_date_val, "date"):
                game_date_str = str(game_date_val.date())
            else:
                game_date_str = str(game_date_val)[:10]  # Take YYYY-MM-DD part
        else:
            game_date_str = ""

        bet_records.append({
            "game_date": game_date_str,
            "season": int(row["season"]),
            "week": str(row["week"]),
            "home_team": row["home_team"],
            "away_team": row["away_team"],
            "bet_side": strategy.bet_side.value,
            "line": float(row.get("spread_line", 0) or row.get("total_line", 0) or 0),
            "result": result,
            "profit": round(profit, 2),
        })

    if not bet_records:
        return _empty_results(strategy, warning="No bets could be settled (missing line data)")

    # Convert to DataFrame for analysis
    bets_df = pd.DataFrame(bet_records)

    # Calculate metrics
    wins = (bets_df["result"] == "win").sum()
    losses = (bets_df["result"] == "loss").sum()
    pushes = (bets_df["result"] == "push").sum()
    total_profit = bets_df["profit"].sum()
    total_risked = len(bets_df) * 1.1 * strategy.stake_unit

    max_dd = calculate_max_drawdown(bets_df["profit"].tolist())
    win_streak, loss_streak = calculate_streaks(bets_df["result"].tolist())
    seasons = calculate_season_summary(bets_df)

    # Generate warnings
    warnings = []
    if len(bets_df) < 100:
        warnings.append(f"Small sample size ({len(bets_df)} bets) - results may not be statistically significant")
    if len(bets_df) < 50:
        warnings.append("Very small sample - treat results with high skepticism")

    # Build result
    return BacktestResults(
        strategy_name=strategy.name,
        strategy_hash=hash_strategy(strategy),
        total_bets=len(bets_df),
        wins=int(wins),
        losses=int(losses),
        pushes=int(pushes),
        win_rate_pct=round(calculate_win_rate(wins, losses, pushes), 2),
        roi_pct=round(calculate_roi(total_profit, total_risked), 2),
        total_profit_units=round(total_profit, 2),
        max_drawdown_units=round(max_dd, 2),
        longest_losing_streak=loss_streak,
        longest_winning_streak=win_streak,
        seasons=[SeasonSummary(**s) for s in seasons],
        bets=[BetRecord(**b) for b in bet_records] if include_bet_details else [],
        data_start_date=str(bets_df["game_date"].min()),
        data_end_date=str(bets_df["game_date"].max()),
        run_timestamp=datetime.utcnow().isoformat() + "Z",
        warnings=warnings,
    )


def _empty_results(strategy: StrategyInput, warning: str = "No data available") -> BacktestResults:
    """Return empty results when no bets can be made."""
    return BacktestResults(
        strategy_name=strategy.name,
        strategy_hash=hash_strategy(strategy),
        total_bets=0,
        wins=0,
        losses=0,
        pushes=0,
        win_rate_pct=0.0,
        roi_pct=0.0,
        total_profit_units=0.0,
        max_drawdown_units=0.0,
        longest_losing_streak=0,
        longest_winning_streak=0,
        seasons=[],
        bets=[],
        data_start_date="",
        data_end_date="",
        run_timestamp=datetime.utcnow().isoformat() + "Z",
        warnings=[warning],
    )
