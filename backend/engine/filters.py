"""
Filter evaluation for strategy conditions.

Applies user-defined filters to select which games to bet on.
"""

import pandas as pd
from typing import Callable

from backend.schemas import Filter, Operator


def get_operator_func(op: Operator) -> Callable:
    """Convert operator enum to actual comparison function."""
    ops = {
        Operator.GT: lambda a, b: a > b,
        Operator.GTE: lambda a, b: a >= b,
        Operator.LT: lambda a, b: a < b,
        Operator.LTE: lambda a, b: a <= b,
        Operator.EQ: lambda a, b: a == b,
        Operator.NE: lambda a, b: a != b,
    }
    return ops[op]


def apply_filter(df: pd.DataFrame, filter: Filter) -> pd.Series:
    """
    Apply a single filter and return boolean mask.

    Args:
        df: Games dataframe
        filter: Filter condition to apply

    Returns:
        Boolean series where True = game passes filter
    """
    if filter.field not in df.columns:
        raise ValueError(f"Unknown filter field: {filter.field}")

    column = df[filter.field]
    op_func = get_operator_func(filter.operator)

    return op_func(column, filter.value)


def apply_filters(df: pd.DataFrame, filters: list[Filter]) -> pd.DataFrame:
    """
    Apply all filters and return matching games.

    All filters must pass (AND logic).
    """
    if not filters:
        return df

    mask = pd.Series([True] * len(df), index=df.index)

    for f in filters:
        mask = mask & apply_filter(df, f)

    return df[mask]
