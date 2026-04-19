# data/

Static and generated data assets for the Agnes supply chain backend.

| File | Description |
|------|-------------|
| `dify_ready_data.json` | Full procurement dataset formatted for Dify knowledge base ingestion — finished products, BOMs, suppliers, raw materials |
| `fp_constraints.json` | Finished-product constraints and metadata used by the context API (`/api/context`) |
| `sorted_list.csv` | Sorted raw material / supplier list used for quick lookups and enrichment seeding |
| `db.sqlite` | SQLite database — procurement records + scrape caches (news, PubChem, FDA, enrichment). Loaded by `main.py` at startup via `DB_PATH` env var |
| `db.xlsx` | Source Excel workbook the SQLite database was generated from — kept for reference and re-seeding |

## Usage

`main.py` reads `DB_PATH` (default `db.sqlite`) at startup. Point it at `data/db.sqlite`:

```bash
DB_PATH=data/db.sqlite uvicorn main:app --reload
```

`dify_ready_data.json` and `fp_constraints.json` are loaded at import time by `main.py` — paths are relative to the working directory, so run `uvicorn` from the repo root or set `DATA_DIR` if you add that env var.
