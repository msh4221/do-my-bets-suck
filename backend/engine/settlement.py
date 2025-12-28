"""
Bet settlement logic.

Determines win/loss/push for each bet type.
"""

import pandas as pd


def settle_spread_bet(
    row: pd.Series,
    bet_side: str,  # "home", "away", "favorite", "underdog", "team"
    selected_team: str = None,  # Required when bet_side is "team"
) -> tuple[str, float]:
    """
    Settle a spread bet.

    Args:
        row: Game data with home_score, away_score, spread_line, home_favorite
        bet_side: Which side was bet
        selected_team: Team name when bet_side is "team"

    Returns:
        (result, profit) where result is "win", "loss", or "push"
        Profit assumes -110 odds (risk 1.1 to win 1.0)
    """
    home_score = row["home_score"]
    away_score = row["away_score"]
    spread_line = row["spread_line"]  # Negative = home favored
    home_favorite = row.get("home_favorite", spread_line < 0)

    # Calculate margin with spread applied to home team
    # If spread is -7, home needs to win by more than 7
    home_margin = (home_score - away_score) + spread_line

    # Determine which team we bet on
    if bet_side == "home":
        bet_on_home = True
    elif bet_side == "away":
        bet_on_home = False
    elif bet_side == "favorite":
        bet_on_home = home_favorite
    elif bet_side == "underdog":
        bet_on_home = not home_favorite
    elif bet_side == "team":
        if not selected_team:
            raise ValueError("selected_team required when bet_side is 'team'")
        bet_on_home = row["home_team"] == selected_team
    else:
        raise ValueError(f"Invalid bet_side: {bet_side}")

    # If we bet home, home_margin > 0 means we win
    # If we bet away, home_margin < 0 means we win
    if bet_on_home:
        if home_margin > 0:
            return "win", 1.0  # Win 1 unit
        elif home_margin < 0:
            return "loss", -1.1  # Lose 1.1 units (standard -110)
        else:
            return "push", 0.0
    else:
        if home_margin < 0:
            return "win", 1.0
        elif home_margin > 0:
            return "loss", -1.1
        else:
            return "push", 0.0


def settle_total_bet(
    row: pd.Series,
    bet_side: str,  # "over" or "under"
) -> tuple[str, float]:
    """
    Settle an over/under bet.

    Args:
        row: Game data with home_score, away_score, total_line
        bet_side: "over" or "under"

    Returns:
        (result, profit)
    """
    total_points = row["home_score"] + row["away_score"]
    total_line = row["total_line"]

    if pd.isna(total_line):
        return "no_line", 0.0

    if bet_side == "over":
        if total_points > total_line:
            return "win", 1.0
        elif total_points < total_line:
            return "loss", -1.1
        else:
            return "push", 0.0
    elif bet_side == "under":
        if total_points < total_line:
            return "win", 1.0
        elif total_points > total_line:
            return "loss", -1.1
        else:
            return "push", 0.0
    else:
        raise ValueError(f"Invalid bet_side for total: {bet_side}")


def settle_moneyline_bet(
    row: pd.Series,
    bet_side: str,  # "home", "away", "favorite", "underdog", "team"
    selected_team: str = None,  # Required when bet_side is "team"
) -> tuple[str, float]:
    """
    Settle a moneyline bet.

    Note: This is simplified - real ML bets have variable odds.
    For MVP, we assume -110 on both sides.
    """
    home_score = row["home_score"]
    away_score = row["away_score"]
    home_favorite = row.get("home_favorite", False)

    if bet_side == "home":
        bet_on_home = True
    elif bet_side == "away":
        bet_on_home = False
    elif bet_side == "favorite":
        bet_on_home = home_favorite
    elif bet_side == "underdog":
        bet_on_home = not home_favorite
    elif bet_side == "team":
        if not selected_team:
            raise ValueError("selected_team required when bet_side is 'team'")
        bet_on_home = row["home_team"] == selected_team
    else:
        raise ValueError(f"Invalid bet_side: {bet_side}")

    if home_score == away_score:
        return "push", 0.0

    home_won = home_score > away_score

    if bet_on_home == home_won:
        return "win", 1.0
    else:
        return "loss", -1.1
