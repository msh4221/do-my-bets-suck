"""
Player prop bet settlement logic.

Determines win/loss/push for player prop bets.
"""


def settle_over_under_prop(
    actual_stat: float,
    line: float,
    bet_side: str,  # "over" or "under"
    odds: int = -110
) -> tuple[str, float]:
    """
    Settle an over/under player prop bet.

    Args:
        actual_stat: The player's actual stat value
        line: The prop line (e.g., 249.5 for over/under 250)
        bet_side: "over" or "under"
        odds: American odds (default -110)

    Returns:
        (result, profit) where result is "win", "loss", or "push"
        Profit is in units based on the odds
    """
    if actual_stat is None:
        return "no_data", 0.0

    # Calculate profit/loss based on American odds
    if odds > 0:
        win_profit = odds / 100  # e.g., +200 wins 2 units
        loss_profit = -1.0
    else:
        win_profit = 1.0
        loss_profit = odds / 100  # e.g., -110 loses 1.1 units

    if bet_side == "over":
        if actual_stat > line:
            return "win", win_profit
        elif actual_stat < line:
            return "loss", loss_profit
        else:
            return "push", 0.0
    elif bet_side == "under":
        if actual_stat < line:
            return "win", win_profit
        elif actual_stat > line:
            return "loss", loss_profit
        else:
            return "push", 0.0
    else:
        raise ValueError(f"Invalid bet_side for over/under prop: {bet_side}")


def settle_anytime_td_prop(
    total_tds: int,
    bet_side: str,  # "yes" or "no"
    odds: int = -120
) -> tuple[str, float]:
    """
    Settle an anytime TD scorer prop.

    Args:
        total_tds: Total TDs scored by the player (passing + rushing + receiving)
        bet_side: "yes" (scored TD) or "no" (did not score)
        odds: American odds (default -120 for yes)

    Returns:
        (result, profit)
    """
    if total_tds is None:
        return "no_data", 0.0

    # Calculate profit/loss based on American odds
    if odds > 0:
        win_profit = odds / 100
        loss_profit = -1.0
    else:
        win_profit = 1.0
        loss_profit = odds / 100

    scored_td = total_tds > 0

    if bet_side == "yes":
        if scored_td:
            return "win", win_profit
        else:
            return "loss", loss_profit
    elif bet_side == "no":
        if not scored_td:
            return "win", win_profit
        else:
            return "loss", loss_profit
    else:
        raise ValueError(f"Invalid bet_side for anytime TD: {bet_side}")


def settle_prop_bet(
    actual_stat: float,
    line: float,
    bet_side: str,
    prop_type: str,
    odds: int = -110
) -> tuple[str, float]:
    """
    Generic prop settlement function.

    Args:
        actual_stat: The player's actual stat value
        line: The prop line
        bet_side: "over", "under", or "yes"
        prop_type: Type of prop (passing_yards, anytime_td, etc.)
        odds: American odds

    Returns:
        (result, profit)
    """
    if prop_type == "anytime_td":
        return settle_anytime_td_prop(
            total_tds=int(actual_stat) if actual_stat else 0,
            bet_side=bet_side,
            odds=odds
        )
    else:
        return settle_over_under_prop(
            actual_stat=actual_stat,
            line=line,
            bet_side=bet_side,
            odds=odds
        )
