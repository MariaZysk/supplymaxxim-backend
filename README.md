# Agnes — AI Supply Chain Manager

> AI-powered procurement intelligence for CPG companies. Built at TUM.ai Makeathon 2026.

Agnes is a full-stack supply chain co-pilot that helps sourcing managers discover supplier risks, evaluate raw-material substitutes, and get real-time disruption signals — grounded in real BOM data and powered by a Dify agentic workflow + FastAPI backend + React frontend.

🔗 **Live demo:** https://spheremaxxing.lovable.app

---

## Architecture Overview

```
User (browser)
    │
    ▼
React Frontend  ──────────────────────────────────────────────────────┐
(spheremaxxing-ai-console)                                            │
    │  VITE_DIFY_* configured?                                        │
    │  YES → Dify advanced-chat API                                   │
    │  NO  → FastAPI /api/chat (Vite proxy → :8000)                   │
    │        falls back to local chatFallback.ts                      │
    ▼                                                                  │
Dify Workflow (agnes_merged.yml)                                       │
    │                                                                  │
    ├─ test_intent_llm       → extracts intent + search_key           │
    ├─ test_intent_extractor → regex JSON parse (robust)              │
    │                                                                  │
    ├─ context_query   → GET /api/context?ingredient=...              │
    ├─ pubchem_query   → GET /api/pubchem?name=...                    │
    ├─ regulatory_query → GET /api/regulatory?name=...                │
    ├─ news_query      → GET /api/news?q=...                          │
    ├─ doc_parser      → vision LLM reads sys.files (CoA / spec PDF)  │
    │                                                                  │
    ├─ news_formatter  → Python code node, cleans raw JSON → text     │
    ├─ risk_classifier → LLM: overall risk + confidence level         │
    ├─ agnes_response  → LLM: full structured procurement analysis     │
    ├─ scenario_simulator → LLM: what-if cost/risk modeling           │
    └─ answer          → final markdown response to user              │
    │                                                                  │
    ▼                                                                  │
FastAPI Backend (main.py, port 8000)   ◄──────────────────────────────┘
    │
    ├── /api/health         → liveness check
    ├── /api/context        → BOM, supplier list, procurement records from db.sqlite
    ├── /api/news           → Firecrawl → Google News → regex signal extraction (cache 1h)
    ├── /api/pubchem        → PubChem REST → chemical properties (cache 7d)
    ├── /api/regulatory     → FDA + EU scrape (cache 72h)
    └── /api/enrichment     → combined enrichment summary (cache 24h)
```

---

## Repo Structure

```
supplymaxxim-backend/
├── main.py               # FastAPI server — all 5 /api/* endpoints
├── scrape_news.py        # Firecrawl → Google News → disruption signal extraction
├── scrape_pubchem.py     # PubChem REST — chemical/safety properties
├── scrape_regulatory.py  # FDA + EU regulatory scraping
├── scrape_enrich.py      # Combined enrichment pipeline
├── enrich.py             # Enrichment helpers
├── parse_spec.py         # PDF / spec sheet parser (CoA ingestion)
├── requirements.txt
├── .env.example
│
├── data/                 # Versioned data assets
│   ├── db.sqlite         # Live SQLite DB — procurement records + all scrape caches
│   ├── db.xlsx           # Source Excel workbook (for reference / re-seeding)
│   ├── dify_ready_data.json   # Full dataset formatted for Dify knowledge base
│   ├── fp_constraints.json    # Finished-product constraints for /api/context
│   ├── sorted_list.csv        # Raw material / supplier lookup list
│   └── README.md
│
├── workflow/
│   └── agnes_merged.yml  # Final Dify workflow — import this into your Dify workspace
│
└── frontend/             # Fetched from missharismitha/spheremaxxing-ai-console (main)
    ├── frontend/         # React 18 + TypeScript + Vite UI
    └── backend/          # Team backend stub (agnes/, app/)
```

---

## Dify Workflow — agnes_merged.yml

The merged workflow (`workflow/agnes_merged.yml`) is the single source of truth for the Agnes agent. Import it into your Dify workspace:

1. Dify → **Studio** → **Import DSL** → select `agnes_merged.yml`
2. Set your API endpoint in the frontend: `VITE_DIFY_API_KEY` + `VITE_DIFY_BASE_URL`
3. The workflow auto-routes by intent — no manual node switching needed

### Node pipeline

| Node | Type | Role |
|------|------|------|
| `start` | Start | Accepts `supplier_doc` (optional file) via `sys.files` |
| `test_intent_llm` | LLM | Extracts `intent` + `search_key` as JSON from user query |
| `test_intent_extractor` | Code | Regex-parses LLM JSON → reliable variable extraction |
| `context_query` | HTTP | `GET /api/context?ingredient={search_key}` |
| `pubchem_query` | HTTP | `GET /api/pubchem?name={search_key}` |
| `regulatory_query` | HTTP | `GET /api/regulatory?name={search_key}` |
| `news_query` | HTTP | `GET /api/news?q={search_key}` |
| `doc_parser` | LLM (vision) | Reads `sys.files` — CoA / spec sheet analysis |
| `news_formatter` | Code | Strips JSON noise → clean disruption signals text |
| `risk_classifier` | LLM | Overall risk level + confidence |
| `agnes_response` | LLM | Full procurement analysis (7 data sections) |
| `scenario_simulator` | LLM | What-if cost/risk scenario modeling |
| `answer` | Answer | Final markdown to user |

---

## Backend Setup

```bash
# 1. Clone
git clone https://github.com/MariaZysk/supplymaxxim-backend.git
cd supplymaxxim-backend

# 2. Install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Configure
cp .env.example .env
# Fill in: FIRECRAWL_API_KEY, DB_PATH=data/db.sqlite

# 4. Run
DB_PATH=data/db.sqlite uvicorn main:app --reload --port 8000
```

---

## Frontend Setup

```bash
cd frontend/frontend
cp .env.example .env        # or create .env
# Set VITE_DIFY_API_KEY and VITE_DIFY_BASE_URL for Dify mode
# Or leave unset to use FastAPI fallback (needs backend running on :8000)

npm install
npm run dev                 # starts on :8080
```

Add Vite proxy to `vite.config.ts` for local FastAPI fallback:
```ts
server: {
  proxy: {
    '/api': 'http://127.0.0.1:8000'
  }
}
```

---

## Data Architecture

Agnes keeps two data layers strictly separate:

**Real Data** — `data/db.sqlite` + `data/dify_ready_data.json`
Actual procurement relationships: companies, finished products, BOMs, raw materials, suppliers. Served by `/api/context`. Missing fields display as *"Not available in real dataset"* — never invented.

**Simulated Intelligence** — Frontend `ingredient_metadata.json`
Blueprint-driven enrichment fields (purity, regulatory status, lead time, substitutes). Every simulated value carries a `provenance` tag and `confidence: Low | Medium | High` badge. Never mixed with real rows.

---

## Key Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_DIFY_API_KEY` | frontend `.env` | Dify app API key |
| `VITE_DIFY_BASE_URL` | frontend `.env` | Dify API base (e.g. `https://api.dify.ai/v1`) |
| `VITE_API_URL` | frontend `.env` | Override FastAPI origin (optional, for tunneling) |
| `DB_PATH` | backend `.env` | Path to SQLite DB (default: `db.sqlite`) |
| `FIRECRAWL_API_KEY` | backend `.env` | Firecrawl key for news + regulatory scraping |
| `NEWS_CACHE_AGE_H` | backend `.env` | News cache TTL in hours (default: 1) |

---

Built by Maria Zyskowska · TUM.ai Makeathon 2026
