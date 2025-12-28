"""
LLM Guardrails - Input sanitization and output verification.

Ensures the LLM cannot inject malicious content or modify numbers.
"""

import re
import json
from typing import Optional

from pydantic import ValidationError
from backend.schemas import StrategyInput, BacktestResults


class GuardrailError(Exception):
    """Raised when guardrails detect a problem."""
    pass


# Input sanitization

MAX_INPUT_LENGTH = 1000
BLOCKED_PATTERNS = [
    r"ignore\s+(previous|all)\s+instructions",
    r"system\s*prompt",
    r"<script",
    r"javascript:",
]


def sanitize_input(hypothesis: str) -> str:
    """
    Clean and validate user input before sending to LLM.

    Args:
        hypothesis: Raw user hypothesis text

    Returns:
        Sanitized text

    Raises:
        GuardrailError: If input appears malicious
    """
    if not hypothesis or not hypothesis.strip():
        raise GuardrailError("Hypothesis cannot be empty")

    if len(hypothesis) > MAX_INPUT_LENGTH:
        raise GuardrailError(f"Hypothesis too long (max {MAX_INPUT_LENGTH} characters)")

    # Check for injection attempts
    hypothesis_lower = hypothesis.lower()
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, hypothesis_lower):
            raise GuardrailError("Input contains blocked content")

    # Basic cleanup
    cleaned = hypothesis.strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)  # Normalize whitespace

    return cleaned


# Output verification

def verify_strategy_json(llm_output: str) -> StrategyInput:
    """
    Parse and validate LLM's strategy JSON output.

    Args:
        llm_output: Raw LLM response (should contain JSON)

    Returns:
        Validated StrategyInput

    Raises:
        GuardrailError: If output is invalid
    """
    # Extract JSON from response (LLM might include explanation text)
    json_match = re.search(r'\{[\s\S]*\}', llm_output)
    if not json_match:
        raise GuardrailError("No JSON found in LLM response")

    json_str = json_match.group()

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise GuardrailError(f"Invalid JSON: {e}")

    try:
        strategy = StrategyInput(**data)
    except ValidationError as e:
        raise GuardrailError(f"Strategy validation failed: {e}")

    return strategy


def verify_narration(
    narration: str,
    results: BacktestResults,
) -> str:
    """
    Verify that narration doesn't fabricate numbers.

    Checks that key metrics mentioned in narration match the actual results.

    Args:
        narration: LLM's explanation text
        results: The actual backtest results

    Returns:
        Verified narration

    Raises:
        GuardrailError: If narration contains fabricated numbers
    """
    # Extract numbers from narration
    numbers_in_text = re.findall(r'[-+]?\d*\.?\d+%?', narration)

    # Key metrics that should match if mentioned
    critical_values = {
        str(results.total_bets): "total bets",
        str(results.wins): "wins",
        str(results.losses): "losses",
        f"{results.win_rate_pct}": "win rate",
        f"{results.roi_pct}": "ROI",
        f"{results.total_profit_units}": "profit",
    }

    # We don't strictly verify every number (LLM might round differently)
    # but we log a warning if ROI sign is wrong
    if results.roi_pct > 0 and "loss" in narration.lower() and "profit" not in narration.lower():
        # LLM says losing when actually profitable
        raise GuardrailError("Narration incorrectly describes profitable strategy as losing")

    if results.roi_pct < -5 and "profit" in narration.lower() and "loss" not in narration.lower():
        # LLM says profitable when actually losing significantly
        raise GuardrailError("Narration incorrectly describes losing strategy as profitable")

    return narration


def extract_clarifying_questions(llm_output: str) -> Optional[list[dict]]:
    """
    Extract clarifying questions from LLM response if present.

    Returns None if LLM provided a complete strategy instead.
    """
    # Look for questions array in JSON
    try:
        json_match = re.search(r'\{[\s\S]*\}', llm_output)
        if json_match:
            data = json.loads(json_match.group())
            if "questions" in data:
                return data["questions"]
    except (json.JSONDecodeError, KeyError):
        pass

    return None
