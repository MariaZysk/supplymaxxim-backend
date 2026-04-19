"""
Agnes — supply chain news module
Scrapes Google News via Firecrawl, extracts disruption signals with regex.
Zero LLM in this module. Risk classification is delegated to risk_classifier LLM node in Dify.
Cache-backed in db.sqlite with short TTL (1 hour — news is time-sensitive).
"""

import json
import os
import re
import sqlite3
import urllib.parse
from datetime import datetime, timezone

CACHE_MAX_AGE_H = int(os.getenv("NEWS_CACHE_AGE_H", "1"))

_CREATE_SQL = """
CREATE TABLE IF NOT EXISTS news_cache (
    slug           TEXT PRIMARY KEY,
    query_term     TEXT,
    signals        TEXT NOT NULL DEFAULT '[]',
    headlines      TEXT NOT NULL DEFAULT '[]',
    signal_count   INTEGER NOT NULL DEFAULT 0,
    scraped_at     TEXT NOT NULL
)
"""

# Disruption signal patterns — what we look for in headlines
_SIGNALS = {
    "shortage":        re.compile(r'\b(shortage|short supply|supply crunch|out of stock|depletion)\b', re.IGNORECASE),
    "recall":          re.compile(r'\b(recall|recalled|withdrawal|withdrawn|safety alert)\b', re.IGNORECASE),
    "ban":             re.compile(r'\b(ban|banned|prohibited|restriction|blocked|suspended)\b', re.IGNORECASE),
    "strike":          re.compile(r'\b(strike|walkout|labor dispute|work stoppage|shutdown)\b', re.IGNORECASE),
    "tariff":          re.compile(r'\b(tariff|import duty|trade war|sanction|embargo|levy)\b', re.IGNORECASE),
    "export_control":  re.compile(r'\b(export control|export ban|export restriction|export limit)\b', re.IGNORECASE),
    "price_spike":     re.compile(r'\b(price spike|price surge|cost surge|inflation|soaring price)\b', re.IGNORECASE),
    "disruption":      re.compile(r'\b(disruption|disrupted|delay|delayed|bottleneck|congestion)\b', re.IGNORECASE),
    "geopolitical":    re.compile(r'\b(geopolitical|political tension|conflict|war|invasion|sanctions)\b', re.IGNORECASE),
    "natural_disaster": re.compile(r'\b(earthquake|flood|hurricane|typhoon|drought|wildfire|crop failure)\b', re.IGNORECASE),
    "regulatory_change": re.compile(r'\b(new regulation|regulatory change|compliance deadline|rule change|FDA warning)\b', re.IGNORECASE),
}

# Headline extraction — look for news-style lines
_HEADLINE_RE = re.compile(r'^.{20,200}$', re.MULTILINE)


def create_cache_table(conn: sqlite3.Connection) -> None:
    conn.execute(_CREATE_SQL)
    conn.commit()


def _get_cached(conn: sqlite3.Connection, slug: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM news_cache WHERE slug = ?", (slug,)
    ).fetchone()
    if not row:
        return None
    d = dict(row)
    for f in ("signals", "headlines"):
        try:
            d[f] = json.loads(d[f] or "[]")
        except Exception:
            d[f] = []
    try:
        age_h = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(d["scraped_at"].replace("Z", "+00:00"))
        ).total_seconds() / 3600
        if age_h > CACHE_MAX_AGE_H:
            return None
    except Exception:
        pass
    d["from_cache"] = True
    return d


def _set_cache(conn: sqlite3.Connection, slug: str, query_term: str, data: dict) -> None:
    conn.execute(
        """
        INSERT INTO news_cache
            (slug, query_term, signals, headlines, signal_count, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
            query_term   = excluded.query_term,
            signals      = excluded.signals,
            headlines    = excluded.headlines,
            signal_count = excluded.signal_count,
            scraped_at   = excluded.scraped_at
        """,
        (
            slug,
            query_term,
            json.dumps(data.get("signals") or []),
            json.dumps(data.get("headlines") or []),
            data.get("signal_count", 0),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()


def _scrape_news(query_term: str) -> str | None:
    """Scrapes Google News via Firecrawl. Returns raw markdown or None."""
    api_key = os.getenv("FIRECRAWL_API_KEY", "")
    if not api_key:
        return None
    try:
        from firecrawl import FirecrawlApp
    except ImportError:
        return None

    q = urllib.parse.quote_plus(query_term + " supply chain")
    url = f"https://news.google.com/search?q={q}&hl=en"

    fc = FirecrawlApp(api_key=api_key)
    try:
        result = fc.scrape_url(url, params={
            "formats": ["markdown"],
            "onlyMainContent": True,
            "waitFor": 1500,
        })
        content = result.get("markdown", "")
        return content if len(content.strip()) >= 100 else None
    except Exception:
        return None


def _extract_signals(markdown: str, query_term: str) -> dict:
    """
    Pure regex extraction of disruption signals from news markdown.
    No LLM. Returns structured signals for risk_classifier to interpret.
    """
    text = markdown[:5000]

    # Extract headline-like lines (20-200 chars, likely news titles)
    lines = _HEADLINE_RE.findall(text)
    # Filter lines that mention query terms (loose match)
    query_words = set(query_term.lower().split())
    relevant = [
        l.strip() for l in lines
        if any(w in l.lower() for w in query_words)
        or any(pat.search(l) for pat in _SIGNALS.values())
    ]
    headlines = relevant[:15]

    # Check which signal categories appear in the full text
    triggered = []
    for signal_name, pattern in _SIGNALS.items():
        matches = pattern.findall(text)
        if matches:
            triggered.append({
                "type":    signal_name,
                "matches": list(dict.fromkeys(m if isinstance(m, str) else m[0] for m in matches[:5])),
            })

    return {
        "signals":      triggered,
        "headlines":    headlines,
        "signal_count": len(triggered),
        "query_term":   query_term,
    }


def get_news(conn: sqlite3.Connection, slug: str, query_term: str) -> dict:
    """
    Cache-first news + signal extraction. Never raises.
    Returns structured disruption signals for the risk_classifier LLM node.
    """
    cached = _get_cached(conn, slug)
    if cached:
        return cached

    markdown = _scrape_news(query_term)
    if markdown:
        data = _extract_signals(markdown, query_term)
    else:
        data = {
            "signals":      [],
            "headlines":    [],
            "signal_count": 0,
            "query_term":   query_term,
            "note":         "news scrape unavailable — check FIRECRAWL_API_KEY",
        }

    data["slug"] = slug
    _set_cache(conn, slug, query_term, data)
    data["from_cache"] = False
    return data
