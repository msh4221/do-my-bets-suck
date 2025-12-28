"""
Hypothesis Parser - Converts natural language to Strategy JSON.

Uses Claude to interpret betting hypotheses and produce structured output.
"""

import os
import json
from typing import Optional, Union

from backend.schemas import StrategyInput, ClarifyingQuestion
from .guardrails import sanitize_input, verify_strategy_json, extract_clarifying_questions, GuardrailError

# Available fields for filtering (from our dataset)
AVAILABLE_FIELDS = """
Available fields you can filter on:
- home_favorite: boolean (True if home team is favored)
- spread_line: float (negative = home favored, e.g., -7 means home favored by 7)
- total_line: float (over/under line)
- temperature: float (game temperature in Fahrenheit)
- wind_mph: float (wind speed)
- home_win_pct: float (home team's win percentage going into game)
- away_win_pct: float (away team's win percentage going into game)
- season: int (year, 1967-2017)
- week: string (week number or "Wildcard", "Divisional", etc.)
"""

SYSTEM_PROMPT = f"""You are a betting strategy interpreter. Your job is to convert natural language betting hypotheses into structured JSON that can be backtested.

{AVAILABLE_FIELDS}

Markets available: "spread", "total", "moneyline"
Bet sides:
- For spread/moneyline: "home", "away", "favorite", "underdog"
- For totals: "over", "under"

Operators for filters: ">", ">=", "<", "<=", "==", "!="

If the hypothesis is clear enough to create a complete strategy, respond with ONLY valid JSON matching this schema:
{{
  "name": "Short descriptive name",
  "description": "What this strategy does",
  "league": "NFL",
  "market": "spread" | "total" | "moneyline",
  "bet_side": "home" | "away" | "favorite" | "underdog" | "over" | "under",
  "filters": [
    {{"field": "field_name", "operator": "==", "value": true}}
  ],
  "season_start": 2010,
  "season_end": 2017,
  "stake_unit": 1.0
}}

If you need more information, respond with JSON containing questions:
{{
  "questions": [
    {{"question": "What market?", "field": "market", "options": ["spread", "total", "moneyline"]}}
  ]
}}

Do not include any text outside the JSON. Only output valid JSON."""


async def parse_hypothesis(
    hypothesis: str,
    anthropic_client,
    available_seasons: tuple[int, int] = (1967, 2017),
) -> Union[StrategyInput, list[ClarifyingQuestion]]:
    """
    Convert natural language hypothesis to Strategy JSON.

    Args:
        hypothesis: User's betting hypothesis
        anthropic_client: Anthropic API client
        available_seasons: (min, max) seasons in dataset

    Returns:
        Either a validated StrategyInput or a list of clarifying questions

    Raises:
        GuardrailError: If input/output validation fails
    """
    # Sanitize input
    cleaned = sanitize_input(hypothesis)

    # Build prompt with context
    user_prompt = f"""Convert this betting hypothesis to a strategy JSON.

Hypothesis: "{cleaned}"

Data available from {available_seasons[0]} to {available_seasons[1]}.
If no season range specified, use the full range.

Respond with ONLY valid JSON."""

    # Call Claude
    response = await anthropic_client.messages.create(
        model="claude-3-haiku-20240307",  # Fast and cheap for parsing
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    llm_output = response.content[0].text

    # Check for clarifying questions
    questions = extract_clarifying_questions(llm_output)
    if questions:
        return [ClarifyingQuestion(**q) for q in questions]

    # Verify and parse strategy
    strategy = verify_strategy_json(llm_output)

    # Apply default season range if not specified
    if strategy.season_start is None:
        strategy.season_start = available_seasons[0]
    if strategy.season_end is None:
        strategy.season_end = available_seasons[1]

    return strategy


def parse_hypothesis_sync(
    hypothesis: str,
    anthropic_client,
    available_seasons: tuple[int, int] = (1967, 2017),
) -> Union[StrategyInput, list[ClarifyingQuestion]]:
    """Synchronous version of parse_hypothesis for simpler usage."""
    import asyncio

    # Check if we're already in an event loop
    try:
        loop = asyncio.get_running_loop()
        # We're in an async context, need to use await
        raise RuntimeError("Use parse_hypothesis() in async context")
    except RuntimeError:
        # No event loop, safe to create one
        return asyncio.run(parse_hypothesis(hypothesis, anthropic_client, available_seasons))
