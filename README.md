# Spheremaxxing

> AI-powered procurement and supply-chain intelligence platform for smarter sourcing decisions.

Spheremaxxing is an enterprise-grade procurement intelligence console that helps sourcing managers, supply-chain analysts, and operations teams discover suppliers, compare sourcing paths, evaluate raw-material substitutes, and get AI-driven decision support — all on top of their real BOM data, with a clearly tagged simulated intelligence layer for what the data alone can't tell you.

🔗 **Live demo:** https://spheremaxxing.lovable.app

---

## ✨ Features

- **Dashboard** — KPIs for active suppliers, materials tracked, BOMs evaluated, AI recommendations, risk alerts, and cost-optimization opportunities.
- **Procurement Search** — Search across finished products, BOM IDs, raw materials, suppliers, regions, and SKUs with detailed sourcing-path drawer.
- **BOM Explorer** — Hierarchical drill-down: Company → Finished Product → BOM → Raw Material → Supplier.
- **Supplier Intelligence** — Side-by-side comparison of 2–4 suppliers with pricing, lead times, risk, reliability, and region.
- **Substitution Engine** — AI-suggested substitute materials with compatibility, cost-impact, risk-impact, and recommendation confidence.
- **Decision Support** — Conversational procurement co-pilot with best-cost / lowest-risk / best-balanced sourcing recommendations.
- **Analytics** — Boardroom-ready charts for supplier distribution, material dependency, sourcing-risk breakdown, and substitution usage.
- **Three Data Modes** — Real / Simulated Intelligence / Comparison, switchable globally from the top bar.

---

## 🧠 Dual data architecture

The app keeps two data sources strictly separate:

### A. Real Data Layer — `frontend/src/data/mydata.json`
The source of truth for actual procurement relationships (companies, finished products, BOMs, raw materials, suppliers). Transformed into typed entities by `frontend/src/data/realData.ts` and used by Dashboard, Procurement Search, BOM Explorer, and Supplier Intelligence. When a field is missing, the UI shows *"Not available in real dataset"* — never invented values.

### B. Simulated Intelligence Layer — `frontend/src/data/ingredient_metadata.json`
A **blueprint** describing what enrichment fields *can* exist (purity, regulatory status, chemical formula, certifications, lead time, allergen info, etc.). `frontend/src/data/simulatedIntelligence.ts` deterministically generates inferred values (risk score, reliability, estimated cost, substitute candidates…) seeded from real entity IDs, and every value carries a `provenance` tag and `confidence: Low | Medium | High` badge.

> **Rule:** Metadata blueprint rows are never treated as real procurement rows. Simulated outputs are always visibly tagged in the UI.

### Three modes
| Mode | Behavior |
|------|----------|
| **Real Data** | Uses only `mydata.json`. Missing fields display as *Not available in real dataset*. |
| **Simulated Intelligence** | Real entities enriched with blueprint-driven simulated fields, each tagged `Simulated` / `Inferred` / `Estimated` with confidence. |
| **Comparison** | Side-by-side: real coverage vs simulated insight, with both recommendations shown. |

Mode is managed by `DataModeContext` and persisted to `localStorage`.

---

## 🛠 Tech stack

### Frontend (`/frontend`)
- **React 18 + TypeScript + Vite**
- **Tailwind CSS v3** with a custom HSL design system (deep navy / electric blue / teal)
- **shadcn/ui** + Radix primitives
- **Recharts** for analytics
- **React Router v6**, **TanStack Query**
- **Vitest** + Testing Library

### Backend (`/backend`)
- **FastAPI** (Python) — `app/main.py` for procurement chat, `agnes/main.py` for ingredient enrichment
- **Groq** LLM integration with retrieval grounded in `mydata.json`
- **Firecrawl** for regulatory / news scraping
- Optional **Dify** chat integration (configured via `VITE_DIFY_*` env vars)

---

## 📁 Project structure

```
spheremaxxing/
├── frontend/                   # React + Vite UI
│   ├── src/
│   │   ├── pages/              # Dashboard, ProcurementSearch, BomExplorer, SupplierIntelligence,
│   │   │                       # SubstitutionEngine, DecisionSupport, Analytics, Settings, Login
│   │   ├── components/         # AppSidebar, TopBar, MetricCard, DataModeSwitcher, SimulatedBadge, ui/*
│   │   ├── contexts/           # DataModeContext (real | simulated | comparison)
│   │   ├── data/
│   │   │   ├── mydata.json                  # REAL procurement rows
│   │   │   ├── ingredient_metadata.json     # Enrichment blueprint (NOT real rows)
│   │   │   ├── realData.ts                  # Transforms mydata.json → entities
│   │   │   ├── simulatedIntelligence.ts     # Generates tagged simulated fields
│   │   │   └── mockData.ts                  # Legacy mocks (being phased out)
│   │   ├── lib/                # api.ts, difyChat.ts, chatFallback.ts, chatFromMydata.ts
│   │   └── layouts/            # AppLayout.tsx
│   ├── tailwind.config.ts
│   └── package.json
├── backend/
│   ├── app/                    # FastAPI procurement chat (main.py, llm.py, scoring.py, …)
│   ├── agnes/                  # Ingredient enrichment service (parse_spec, scrape_*, enrich)
│   ├── data/dify_ready_data.json
│   └── requirements.txt
└── docs/
    └── USER_PROMPTS_ARCHIVE.md
```

---

## 🚀 Getting started

### Prerequisites
- **Node.js 18+** and **bun** (or npm)
- **Python 3.10+** (only if running the backend)

### 1. Frontend
```bash
cd frontend
bun install        # or: npm install
bun run dev        # → http://localhost:5173
```

Other scripts:
```bash
bun run build      # production build
bun run test       # vitest
bun run lint
```

### 2. Backend (optional — UI works standalone with the dataset)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add GROQ_API_KEY, FIRECRAWL_API_KEY, etc.
uvicorn app.main:app --reload --port 8000
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`. If the backend is unreachable, the chat UI gracefully falls back to a local `mydata.json`-grounded responder.

### 3. Environment variables

**`frontend/.env`** (copy from `frontend/.env.example`):
```bash
# Optional: production API origin (omit in dev)
VITE_API_URL=

# Optional: Dify chat integration
VITE_DIFY_API_URL=
VITE_DIFY_API_KEY=
VITE_DIFY_STREAMING=true
```

**`backend/.env`** (copy from `backend/.env.example`):
```bash
GROQ_API_KEY=...
FIRECRAWL_API_KEY=...
```

---

## 🎨 Design system

- **Palette:** dark enterprise — deep navy background, electric blue primary, subtle teal accents, silver text. All colors are HSL semantic tokens defined in `frontend/src/index.css` and `frontend/tailwind.config.ts`.
- **Components:** rounded cards, light glassmorphism, smooth hover states, `.metric-card` utility class.
- **Rule:** components consume semantic tokens (`bg-background`, `text-primary`, …) — never hardcoded colors.

---

## 🔌 Backend-readiness

The frontend is structured for easy backend swap-in:
- `frontend/src/lib/api.ts` is the single API abstraction — replace mock returns with `fetch` calls.
- Real entities in `realData.ts` mirror a normalized relational schema (companies, products, BOMs, materials, suppliers, supplier_relationships) — drop-in for Postgres / Lovable Cloud.
- The simulated layer is deterministic per entity ID, so it can be precomputed server-side or kept client-side without divergence.

---

## 🧭 Roadmap

- [ ] Migrate Substitution Engine & Decision Support off legacy `mockData.ts`
- [ ] Real-aggregate Analytics computed from the full 2,860-row dataset
- [ ] Interactive supplier-network graph (react-flow / d3-force) on BOM Explorer
- [ ] Postgres-backed dataset via Lovable Cloud
- [ ] CSV / Excel BOM import on Procurement Search
- [ ] World-map supplier view colored by risk score

---

## 📝 License

MIT — built for hackathon demonstration. Datasets included are illustrative.

---

## 🙌 Acknowledgements

Built with [Lovable](https://lovable.dev). UI primitives by [shadcn/ui](https://ui.shadcn.com) and [Radix](https://www.radix-ui.com). Charts by [Recharts](https://recharts.org).
