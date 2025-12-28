"""
Results Narrator - Generates human-readable explanations of backtest results.

The narrator receives immutable results and can only format/explain them.
"""

from backend.schemas import BacktestResults, NarratedResults
from .guardrails import verify_narration, GuardrailError


NARRATOR_SYSTEM_PROMPT = """You are a sports betting analyst explaining backtest results to a user.

Your job is to:
1. Summarize the performance in plain English
2. Give a clear verdict on whether the strategy appears profitable
3. List important caveats and limitations

Rules:
- Use ONLY the numbers provided in the results - do not calculate or invent new numbers
- Be honest about limitations (sample size, historical data, etc.)
- Do not give financial advice
- If ROI is positive, acknowledge it but note it doesn't guarantee future results
- If ROI is negative, be direct about the strategy losing money

Respond in this JSON format:
{
  "summary": "2-3 sentence plain English summary",
  "verdict": "PROFITABLE" | "UNPROFITABLE" | "INCONCLUSIVE",
  "caveats": ["caveat 1", "caveat 2", ...]
}"""


async def narrate_results(
    results: BacktestResults,
    anthropic_client,
) -> NarratedResults:
    """
    Generate human-readable explanation of backtest results.

    Args:
        results: Backtest results to explain
        anthropic_client: Anthropic API client

    Returns:
        NarratedResults with explanation
    """
    # Format results for LLM
    results_summary = f"""
Strategy: {results.strategy_name}

Performance:
- Total bets: {results.total_bets}
- Record: {results.wins} wins, {results.losses} losses, {results.pushes} pushes
- Win rate: {results.win_rate_pct}%
- ROI: {results.roi_pct}%
- Total profit/loss: {results.total_profit_units} units

Risk metrics:
- Max drawdown: {results.max_drawdown_units} units
- Longest losing streak: {results.longest_losing_streak}
- Longest winning streak: {results.longest_winning_streak}

Data range: {results.data_start_date} to {results.data_end_date}

Existing warnings: {results.warnings}
"""

    response = await anthropic_client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=512,
        system=NARRATOR_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Explain these results:\n{results_summary}"}],
    )

    llm_output = response.content[0].text

    # Parse response
    import json
    import re

    json_match = re.search(r'\{[\s\S]*\}', llm_output)
    if json_match:
        try:
            data = json.loads(json_match.group())
            summary = data.get("summary", "Results processed.")
            verdict = data.get("verdict", "INCONCLUSIVE")
            caveats = data.get("caveats", [])
        except json.JSONDecodeError:
            summary = llm_output
            verdict = "PROFITABLE" if results.roi_pct > 0 else "UNPROFITABLE"
            caveats = results.warnings
    else:
        summary = llm_output
        verdict = "PROFITABLE" if results.roi_pct > 0 else "UNPROFITABLE"
        caveats = results.warnings

    # Verify narration doesn't fabricate
    verified_summary = verify_narration(summary, results)

    return NarratedResults(
        results=results,
        summary=verified_summary,
        verdict=verdict,
        caveats=caveats + results.warnings,
    )


def generate_simple_summary(results: BacktestResults) -> str:
    """
    Generate a simple summary without LLM (fallback).

    Used when LLM is unavailable or for quick previews.
    """
    if results.total_bets == 0:
        return "No bets matched your criteria."

    roi_desc = "profitable" if results.roi_pct > 0 else "unprofitable"

    return (
        f"Over {results.total_bets} bets from {results.data_start_date} to {results.data_end_date}, "
        f"this strategy was {roi_desc} with {results.roi_pct}% ROI. "
        f"Win rate: {results.win_rate_pct}% ({results.wins}-{results.losses}-{results.pushes})."
    )
