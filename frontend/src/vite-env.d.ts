/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute base for API (e.g. deployed FastAPI). If unset, `/api/*` uses Vite dev proxy. */
  readonly VITE_API_URL?: string;
  /** Dify app API key (starts with app-). Exposed to the browser — use app keys only. */
  readonly VITE_DIFY_API_KEY?: string;
  /** Dify API base, e.g. https://api.dify.ai/v1 */
  readonly VITE_DIFY_BASE_URL?: string;
  /** If the app’s input form uses another variable name instead of `query`, set it here. */
  readonly VITE_DIFY_INPUT_QUERY_KEY?: string;
  /** Set to "true" to use SSE streaming; otherwise blocking mode (default). */
  readonly VITE_DIFY_STREAMING?: string;
}
