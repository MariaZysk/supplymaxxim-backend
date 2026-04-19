import json
import os

from dotenv import load_dotenv

load_dotenv()

try:
    from groq import Groq
except ImportError:  # pragma: no cover
    Groq = None  # type: ignore[misc, assignment]

MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def _client():
    key = os.getenv("GROQ_API_KEY")
    if not key or Groq is None:
        return None
    return Groq(api_key=key)


def generate_explanation(
    supplier_name: str,
    material_name: str,
    replaceability: float,
    evidence_label: str,
    feasibility: float,
    recommendation: str,
    extra_signals: dict | None = None,
) -> dict:
    extra_signals = extra_signals or {}

    prompt = f"""
You are helping explain a procurement recommendation.

Supplier: {supplier_name}
Material: {material_name}
Replaceability: {replaceability}
Supporting Evidence: {evidence_label}
Feasibility: {feasibility}
Recommendation: {recommendation}
Extra Signals: {json.dumps(extra_signals)}

Write:
1. Two short bullet points for "why_this_option"
2. Two short bullet points for "things_to_check"

Rules:
- Keep each bullet short
- Sound business-friendly
- Do not invent facts not present in the input
- If uncertainty exists, mention review or verification
- Return only valid JSON

Return exactly this format:
{{
  "why_this_option": ["...", "..."],
  "things_to_check": ["...", "..."]
}}
"""

    client = _client()
    if client is None:
        return _fallback_explanation()

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You produce concise procurement explanations in JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )

        content = response.choices[0].message.content.strip()
        return json.loads(content)
    except Exception:
        return _fallback_explanation()


def _fallback_explanation() -> dict:
    return {
        "why_this_option": [
            "Supplier appears relevant for the selected material",
            "Internal scoring supports this sourcing option",
        ],
        "things_to_check": [
            "Review supporting evidence before final decision",
            "Verify external compliance or supplier details",
        ],
    }


_CHAT_SYSTEM = """You are the Spheremaxxing procurement co-pilot.

You will receive a DATA CONTEXT block. A "PRIMARY SOURCE" section lists verified supplier–material relationships (the same facts as in-app Procurement Search). Later "SQLite" sections add graph-style scoring and may use different internal ids—prefer the PRIMARY SOURCE for who supplies what.

Rules:
1) Base factual statements about suppliers, materials, counts, and scores ONLY on DATA CONTEXT. Do not invent SKUs, supplier names, or metrics.
2) If DATA CONTEXT includes a "SIMULATED DATABASE" section, those are **demo** substitute candidates (in-app Simulated mode style). For substitute / alternative questions, you may summarize them and say Real data has no substitute list. Answer in plain, conversational sentences focused on the user’s question (e.g. who supplies X → name the supplier(s) directly). Do NOT paste internal dumps, field names, filenames, row counts, raw_material_id, supplier_id, or RM-C SKU codes unless the user explicitly asks for those identifiers.
3) If DATA CONTEXT does not contain enough to answer, ask exactly ONE short clarifying question (e.g. which material name, region, or risk vs cost priority).
4) If the question is only partly covered, give the closest relevant answer from DATA CONTEXT and name what is missing.
5) You may give brief, general procurement guidance that does not depend on secret facts, but label it as general practice—not as data from the database.
6) Keep replies concise (about 2–6 sentences) unless the user explicitly requests a long explanation.
7) Never claim a fixed percentage (e.g. "18%") unless it appears in DATA CONTEXT."""


def generate_procurement_chat_reply(
    user_message: str,
    data_context: str,
    history: list[dict[str, str]] | None = None,
) -> str | None:
    """Returns None when no LLM client is configured or the call fails; caller may use rule-based fallback."""
    client = _client()
    if client is None:
        return None

    history = history or []
    trimmed = (data_context or "")[:9000]
    user_block = f"""DATA CONTEXT:
{trimmed}

USER QUESTION:
{user_message.strip()}"""

    messages: list[dict[str, str]] = [{"role": "system", "content": _CHAT_SYSTEM}]
    for turn in history[-8:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_block})

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.35,
            max_tokens=700,
        )
        text = (response.choices[0].message.content or "").strip()
        return text if text else None
    except Exception:
        return None
