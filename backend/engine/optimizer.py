"""
Strategy Optimizer Engine.

Uses grid search with K-fold cross-validation to find optimal betting parameters.
Ranks strategies by Sharpe ratio for risk-adjusted returns.
"""

import itertools
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

from backend.schemas import StrategyInput, Market, BetSide, Filter, Operator, FilterSearchConfig
from backend.data_sources import NFLKaggleSource
from .backtest import run_backtest
from .metrics import calculate_sharpe_ratio, calculate_roi, calculate_win_rate


@dataclass
class OptimizedStrategy:
    """Result of an optimized strategy search."""
    name: str
    market: str
    bet_side: str
    filters_description: str
    total_bets: int
    wins: int
    losses: int
    pushes: int
    win_rate_pct: float
    roi_pct: float
    sharpe_ratio: float
    # K-fold validation metrics
    train_roi_pct: float
    validation_roi_pct: float
    train_sharpe: float
    validation_sharpe: float
    # Raw filters for reconstruction
    filters: list[dict]
    # Bet data for Monte Carlo (profits and results)
    bet_profits: list[float] = field(default_factory=list)
    bet_results: list[str] = field(default_factory=list)


# Smart search ranges by market type
SPREAD_SEARCH_SPACE = {
    'bet_side': ['favorite', 'underdog', 'home', 'away'],
    'spread_ranges': [
        ('All Spreads', None, None),
        ('Big Underdogs (+7 or more)', 7, 14),
        ('Medium Underdogs (+3 to +7)', 3, 7),
        ('Small Underdogs (+0.5 to +3)', 0.5, 3),
        ('Pick/Small Favorites (-3 to 0)', -3, 0),
        ('Medium Favorites (-7 to -3)', -7, -3),
        ('Big Favorites (-14 to -7)', -14, -7),
    ],
    'temperature': [
        ('Any Temp', None, None),
        ('Cold (<40°F)', None, 40),
        ('Moderate (40-70°F)', 40, 70),
        ('Hot (>70°F)', 70, None),
    ],
    'wind': [
        ('Any Wind', None, None),
        ('Calm (<10 mph)', None, 10),
        ('Windy (10+ mph)', 10, None),
        ('Very Windy (15+ mph)', 15, None),
    ],
}

TOTAL_SEARCH_SPACE = {
    'bet_side': ['over', 'under'],
    'total_ranges': [
        ('All Totals', None, None),
        ('Low Totals (<42)', None, 42),
        ('Medium Totals (42-48)', 42, 48),
        ('High Totals (>48)', 48, None),
    ],
    'temperature': SPREAD_SEARCH_SPACE['temperature'],
    'wind': SPREAD_SEARCH_SPACE['wind'],
}

MONEYLINE_SEARCH_SPACE = {
    'bet_side': ['favorite', 'underdog', 'home', 'away'],
    'spread_ranges': [  # Use spread as proxy for ML value
        ('All Games', None, None),
        ('Big Underdogs (+7 or more)', 7, 14),
        ('Medium Underdogs (+3 to +7)', 3, 7),
        ('Small Underdogs/Pick', 0, 3),
        ('Small Favorites (-3 to 0)', -3, 0),
        ('Medium Favorites (-7 to -3)', -7, -3),
        ('Big Favorites (-14 to -7)', -14, -7),
    ],
    'temperature': SPREAD_SEARCH_SPACE['temperature'],
    'wind': SPREAD_SEARCH_SPACE['wind'],
}


def generate_parameter_combinations(
    market: Market,
    max_combinations: int = 5000,
    filter_config: Optional[FilterSearchConfig] = None,
) -> list[dict]:
    """Generate all parameter combinations for a given market type.

    If filter_config is provided, uses custom ranges and filter selections.
    """
    if market == Market.SPREAD:
        search_space = SPREAD_SEARCH_SPACE.copy()
        line_key = 'spread_ranges'
        line_field = 'spread_line'
    elif market == Market.TOTAL:
        search_space = TOTAL_SEARCH_SPACE.copy()
        line_key = 'total_ranges'
        line_field = 'total_line'
    else:  # MONEYLINE
        search_space = MONEYLINE_SEARCH_SPACE.copy()
        line_key = 'spread_ranges'
        line_field = 'spread_line'

    # Apply user-controlled filter configuration
    if filter_config:
        # If user disabled spread/line filter, only use "All" option
        if not filter_config.include_spread:
            if market == Market.TOTAL:
                search_space['total_ranges'] = [('All Totals', None, None)]
            else:
                search_space['spread_ranges'] = [('All Spreads', None, None)]

        # If user disabled temperature filter
        if not filter_config.include_temperature:
            search_space['temperature'] = [('Any Temp', None, None)]

        # If user disabled wind filter
        if not filter_config.include_wind:
            search_space['wind'] = [('Any Wind', None, None)]

        # Apply custom ranges if provided
        if filter_config.spread_min is not None or filter_config.spread_max is not None:
            custom_min = filter_config.spread_min if filter_config.spread_min is not None else -14
            custom_max = filter_config.spread_max if filter_config.spread_max is not None else 14
            search_space['spread_ranges'] = [
                (f'Custom ({custom_min} to {custom_max})', custom_min, custom_max)
            ]

        if filter_config.total_min is not None or filter_config.total_max is not None:
            custom_min = filter_config.total_min if filter_config.total_min is not None else 30
            custom_max = filter_config.total_max if filter_config.total_max is not None else 65
            search_space['total_ranges'] = [
                (f'Custom ({custom_min} to {custom_max})', custom_min, custom_max)
            ]

        if filter_config.temp_min is not None or filter_config.temp_max is not None:
            custom_min = filter_config.temp_min
            custom_max = filter_config.temp_max
            name = f'Custom Temp ({custom_min or "any"}-{custom_max or "any"}°F)'
            search_space['temperature'] = [(name, custom_min, custom_max)]

        if filter_config.wind_min is not None or filter_config.wind_max is not None:
            custom_min = filter_config.wind_min
            custom_max = filter_config.wind_max
            name = f'Custom Wind ({custom_min or "any"}-{custom_max or "any"} mph)'
            search_space['wind'] = [(name, custom_min, custom_max)]

    combinations = []

    for bet_side in search_space['bet_side']:
        for line_name, line_min, line_max in search_space[line_key]:
            for temp_name, temp_min, temp_max in search_space['temperature']:
                for wind_name, wind_min, wind_max in search_space['wind']:
                    combo = {
                        'bet_side': bet_side,
                        'line_name': line_name,
                        'line_min': line_min,
                        'line_max': line_max,
                        'line_field': line_field,
                        'temp_name': temp_name,
                        'temp_min': temp_min,
                        'temp_max': temp_max,
                        'wind_name': wind_name,
                        'wind_min': wind_min,
                        'wind_max': wind_max,
                    }
                    combinations.append(combo)

                    if len(combinations) >= max_combinations:
                        return combinations

    return combinations


def build_filters_from_params(params: dict) -> list[Filter]:
    """Convert parameter dict to list of Filter objects."""
    filters = []

    # Line filters
    if params['line_min'] is not None:
        filters.append(Filter(
            field=params['line_field'],
            operator=Operator.GTE,
            value=params['line_min']
        ))
    if params['line_max'] is not None:
        filters.append(Filter(
            field=params['line_field'],
            operator=Operator.LTE,
            value=params['line_max']
        ))

    # Temperature filters
    if params['temp_min'] is not None:
        filters.append(Filter(
            field='temperature',
            operator=Operator.GTE,
            value=params['temp_min']
        ))
    if params['temp_max'] is not None:
        filters.append(Filter(
            field='temperature',
            operator=Operator.LTE,
            value=params['temp_max']
        ))

    # Wind filters
    if params['wind_min'] is not None:
        filters.append(Filter(
            field='wind_mph',
            operator=Operator.GTE,
            value=params['wind_min']
        ))
    if params['wind_max'] is not None:
        filters.append(Filter(
            field='wind_mph',
            operator=Operator.LTE,
            value=params['wind_max']
        ))

    return filters


def get_fold_seasons(all_seasons: list[int], n_folds: int = 5) -> list[tuple[list[int], list[int]]]:
    """
    Split seasons into K folds for cross-validation.

    Returns list of (train_seasons, validation_seasons) tuples.
    """
    sorted_seasons = sorted(all_seasons)
    n = len(sorted_seasons)
    fold_size = n // n_folds

    folds = []
    for i in range(n_folds):
        start_idx = i * fold_size
        end_idx = start_idx + fold_size if i < n_folds - 1 else n

        validation_seasons = sorted_seasons[start_idx:end_idx]
        train_seasons = [s for s in sorted_seasons if s not in validation_seasons]

        folds.append((train_seasons, validation_seasons))

    return folds


def evaluate_strategy_kfold(
    params: dict,
    market: Market,
    data_source: NFLKaggleSource,
    season_start: int,
    season_end: int,
    n_folds: int = 5,
    min_bets: int = 50,
) -> Optional[OptimizedStrategy]:
    """
    Evaluate a strategy using K-fold cross-validation.

    Returns None if strategy doesn't meet minimum bet threshold.
    """
    # Get all seasons in range
    all_seasons = list(range(season_start, season_end + 1))

    if len(all_seasons) < n_folds:
        n_folds = max(2, len(all_seasons))

    folds = get_fold_seasons(all_seasons, n_folds)

    # Build filters
    filters = build_filters_from_params(params)
    bet_side = BetSide(params['bet_side'])

    # Collect results across folds
    all_train_profits = []
    all_validation_profits = []
    all_bets = []

    for train_seasons, validation_seasons in folds:
        # Train fold
        train_strategy = StrategyInput(
            name="Optimizer Train",
            description="",
            market=market,
            bet_side=bet_side,
            filters=filters,
            season_start=min(train_seasons),
            season_end=max(train_seasons),
        )
        train_results = run_backtest(train_strategy, data_source, include_bet_details=True)

        # Validation fold
        val_strategy = StrategyInput(
            name="Optimizer Validation",
            description="",
            market=market,
            bet_side=bet_side,
            filters=filters,
            season_start=min(validation_seasons),
            season_end=max(validation_seasons),
        )
        val_results = run_backtest(val_strategy, data_source, include_bet_details=True)

        # Collect profits
        if train_results.bets:
            all_train_profits.extend([b.profit for b in train_results.bets])
        if val_results.bets:
            all_validation_profits.extend([b.profit for b in val_results.bets])
            all_bets.extend(val_results.bets)

    # Check minimum bets across all validation folds
    total_validation_bets = len(all_validation_profits)
    if total_validation_bets < min_bets:
        return None

    # Calculate metrics
    train_sharpe = calculate_sharpe_ratio(all_train_profits) if all_train_profits else 0.0
    validation_sharpe = calculate_sharpe_ratio(all_validation_profits)

    train_profit = sum(all_train_profits)
    train_risked = len(all_train_profits) * 1.1
    train_roi = calculate_roi(train_profit, train_risked) if all_train_profits else 0.0

    val_profit = sum(all_validation_profits)
    val_risked = len(all_validation_profits) * 1.1
    val_roi = calculate_roi(val_profit, val_risked)

    # Full backtest for overall stats
    full_strategy = StrategyInput(
        name="Optimizer Full",
        description="",
        market=market,
        bet_side=bet_side,
        filters=filters,
        season_start=season_start,
        season_end=season_end,
    )
    full_results = run_backtest(full_strategy, data_source, include_bet_details=True)

    if full_results.total_bets < min_bets:
        return None

    # Build description
    desc_parts = [params['bet_side'].title(), params['line_name']]
    if params['temp_name'] != 'Any Temp':
        desc_parts.append(params['temp_name'])
    if params['wind_name'] != 'Any Wind':
        desc_parts.append(params['wind_name'])

    # Collect bet data for Monte Carlo
    bet_profits = [b.profit for b in full_results.bets]
    bet_results = [b.result for b in full_results.bets]

    return OptimizedStrategy(
        name=f"{market.value.title()} - {' | '.join(desc_parts)}",
        market=market.value,
        bet_side=params['bet_side'],
        filters_description=' | '.join(desc_parts),
        total_bets=full_results.total_bets,
        wins=full_results.wins,
        losses=full_results.losses,
        pushes=full_results.pushes,
        win_rate_pct=full_results.win_rate_pct,
        roi_pct=full_results.roi_pct,
        sharpe_ratio=calculate_sharpe_ratio(bet_profits),
        train_roi_pct=round(train_roi, 2),
        validation_roi_pct=round(val_roi, 2),
        train_sharpe=train_sharpe,
        validation_sharpe=validation_sharpe,
        filters=[f.model_dump() for f in filters],
        bet_profits=bet_profits,
        bet_results=bet_results,
    )


def run_optimizer(
    market: Market,
    data_source: NFLKaggleSource,
    season_start: int = 2000,
    season_end: int = 2017,
    n_folds: int = 5,
    min_bets: int = 50,
    max_combinations: int = 5000,
    top_n: int = 10,
    filter_config: Optional[FilterSearchConfig] = None,
) -> list[OptimizedStrategy]:
    """
    Run the full optimization process.

    1. Generate parameter combinations
    2. Evaluate each with K-fold cross-validation
    3. Rank by Sharpe ratio
    4. Return top N strategies
    """
    combinations = generate_parameter_combinations(market, max_combinations, filter_config)

    results = []
    tested = 0

    for params in combinations:
        tested += 1
        result = evaluate_strategy_kfold(
            params=params,
            market=market,
            data_source=data_source,
            season_start=season_start,
            season_end=season_end,
            n_folds=n_folds,
            min_bets=min_bets,
        )
        if result is not None:
            results.append(result)

    # Sort by validation Sharpe ratio (most important for future performance)
    results.sort(key=lambda x: x.validation_sharpe, reverse=True)

    return results[:top_n], tested, len(combinations)
