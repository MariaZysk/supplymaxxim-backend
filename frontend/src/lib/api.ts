// API placeholder layer — swap mock returns with real fetch calls when backend is ready.
import { procurementData, allSuppliers, allRawMaterials, dashboardMetrics } from "@/data/mockData";
import {
  isDifyConfigured,
  isDifyStreamingEnabled,
  postDifyChatMessage,
  uploadDifyFile,
} from "@/lib/difyChat";

export async function fetchProcurementRecords(query?: string) {
  // TODO: replace with `await fetch('/api/procurement?q=...')`
  await new Promise((r) => setTimeout(r, 120));
  if (!query) return procurementData;
  const q = query.toLowerCase();
  return procurementData.filter((r) =>
    [
      r.finished_product_name,
      r.finished_product_sku,
      r.bom_id,
      r.raw_material_name,
      r.raw_material_sku,
      r.supplier_name,
      r.supplier_id,
      r.region,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

export async function fetchSuppliers() {
  await new Promise((r) => setTimeout(r, 80));
  return allSuppliers;
}

export async function fetchRawMaterials() {
  await new Promise((r) => setTimeout(r, 80));
  return allRawMaterials;
}

export async function fetchDashboardMetrics() {
  await new Promise((r) => setTimeout(r, 60));
  return dashboardMetrics;
}

export type ProcurementChatTurn = { role: "user" | "assistant"; content: string };

/** Optional absolute API origin for production / tunneling (omit in dev → same-origin + Vite proxy). */
function apiOrigin(): string | null {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  if (base && base.trim()) return base.replace(/\/$/, "");
  return null;
}

function chatEndpoint(): string {
  const o = apiOrigin();
  if (o) return `${o}/api/chat`;
  return "/api/chat";
}

/** GET `/api/health` — used to show Live vs demo chat mode. */
export async function getProcurementApiLive(): Promise<boolean> {
  const o = apiOrigin();
  const url = o ? `${o}/api/health` : "/api/health";
  try {
    const r = await fetch(url, { method: "GET" });
    return r.ok;
  } catch {
    return false;
  }
}

const MYDATA_FALLBACK_MS = 2200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProcurementChatOptions = {
  /** Dify conversation id from the previous response; omit or empty for a new thread. */
  conversationId?: string;
  /** Called when Dify returns a new conversation_id (persist for follow-ups). */
  onConversationId?: (conversationId: string) => void;
  /** CoA / spec sheets — uploaded to Dify before chat when using advanced-chat. */
  attachments?: File[];
  /**
   * When using Dify + streaming, receives the latest full assistant text as tokens arrive.
   * Final return value is still the complete answer string.
   */
  onStreamText?: (fullAnswerSoFar: string) => void;
  signal?: AbortSignal;
};

/** Calls Dify when `VITE_DIFY_*` is set; otherwise FastAPI `/api/chat` (proxied to :8000 in dev); falls back to mydata.json if unreachable. */
export async function postProcurementChat(
  message: string,
  history: ProcurementChatTurn[],
  options?: ProcurementChatOptions,
): Promise<string> {
  if (isDifyConfigured()) {
    const fileRefs = [];
    for (const file of options?.attachments ?? []) {
      const id = await uploadDifyFile(file, options?.signal);
      fileRefs.push({
        type: "document" as const,
        transfer_method: "local_file" as const,
        upload_file_id: id,
      });
    }

    const stream = isDifyStreamingEnabled();
    const { answer, conversationId } = await postDifyChatMessage(
      message,
      options?.conversationId ?? "",
      {
        files: fileRefs.length ? fileRefs : undefined,
        stream,
        onStreamText: options?.onStreamText,
        signal: options?.signal,
      },
    );
    options?.onConversationId?.(conversationId);
    return answer;
  }

  const { localProcurementChatFallback } = await import("@/lib/chatFallback");

  let res: Response;
  try {
    res = await fetch(chatEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.slice(-12),
      }),
    });
  } catch {
    await delay(MYDATA_FALLBACK_MS);
    return localProcurementChatFallback(message, history);
  }

  if (res.ok) {
    const data = (await res.json()) as { reply: string };
    return data.reply;
  }

  // 502/503 from Vite proxy = nothing listening on 8000; hosted preview = no Python
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    await delay(MYDATA_FALLBACK_MS);
    return localProcurementChatFallback(message, history);
  }

  const text = await res.text();
  throw new Error(text || `Chat request failed (${res.status})`);
}
