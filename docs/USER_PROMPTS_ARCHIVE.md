# User prompt archive (SphereMaxxing AI Console)

This file records requests from the project conversation so they stay traceable on branch `experimentChatbot`.

---

1. **Branch `experimentCategory` + repo layout**  
   *“Create a new branch: experimentCategory … Separate this project in two categories: frontend (UI) and backend (heavy programming stuff) without breaking the website and the functionality.”*

2. **Commit & push `experimentCategory`**  
   *“Commit and push it in the experimentCategory branch.”*

3. **Spherecast backend in `backend/`**  
   *“This is the backend side. Implement it in the backend section.”*  
   (Referenced external folders: `spherecast-backend - Copy/backend` and `…/data` — FastAPI, scoring, LLM explanations, SQLite data.)

4. **Chatbot behavior (Decision Support)**  
   *Improve co-pilot so it answers open-ended questions; inspect chat flow, prompts, retrieval/fallback; keep dataset lookup; clarify vs canned line; Cursor rules for reuse.*

5. **Procurement chat 502 / dev workflow**  
   *Errors reaching chat API (502); expectation of Vite proxy to Python on 8000; `npm run dev:all`; client fallback when API unavailable.*

6. **`chatFallback` / demo matching**  
   *Better matching for suggested questions (single-source, price-style intents); reduce useless “no match” answers.*

7. **Offline / API status UX**  
   *Explain “offline demo” line; API live vs demo mode banner; reduce repeated footers in every message.*

8. **Ground chat in `mydata.json`**  
   *Avoid inconsistent supplier names (e.g. mock vs Search/BOM); answers tied to `realData` / `mydata.json`; optional delay before offline reply; backend reads same JSON for PRIMARY context.*

9. **Branch `experimentChatbot` + this archive**  
   *“Revert the previous request” (interpreted here as: proceed with branch/archive task, not dropping uncommitted work); add branch `experimentChatbot`; save prior prompts; commit and push all current changes to `experimentChatbot`.*

---

*Generated for maintenance and onboarding. Edit if you need stricter verbatim logs.*
