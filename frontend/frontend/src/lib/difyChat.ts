/**
 * Dify advanced-chat (e.g. Agnes) — POST {base}/chat-messages, optional file upload, streaming SSE.
 * Keys are Vite-exposed (VITE_*) and ship in the client bundle; use only for public app keys.
 */

const SESSION_USER_KEY = "spheremaxxing_dify_user_id";

export function isDifyConfigured(): boolean {
  const key = import.meta.env.VITE_DIFY_API_KEY as string | undefined;
  const base = import.meta.env.VITE_DIFY_BASE_URL as string | undefined;
  return Boolean(key?.trim() && base?.trim());
}

/**
 * Streaming is opt-in (`VITE_DIFY_STREAMING=true`) so blocking mode works reliably with all apps.
 * Advanced-chat / Chatflow often emits `text_chunk` events; when streaming is on we parse those too.
 */
export function isDifyStreamingEnabled(): boolean {
  const v = (import.meta.env.VITE_DIFY_STREAMING as string | undefined)?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function difyBaseUrl(): string {
  return String(import.meta.env.VITE_DIFY_BASE_URL ?? "").replace(/\/$/, "");
}

function difyApiKey(): string {
  return String(import.meta.env.VITE_DIFY_API_KEY ?? "").trim();
}

/** Stable per-tab session id for Dify `user` (conversation history scoped per session). */
export function getDifyUserId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_USER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_USER_KEY, id);
    }
    return id;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export type DifyChatResult = {
  answer: string;
  conversationId: string;
};

/** File reference for chat-messages `files` array (after POST /files/upload). */
export type DifyChatFileRef = {
  type: "document";
  transfer_method: "local_file";
  upload_file_id: string;
};

export type PostDifyChatOptions = {
  /** Uploaded file references (use {@link uploadDifyFile} first). */
  files?: DifyChatFileRef[];
  /** When true, reads SSE and calls `onStreamText` with the latest full answer text. */
  stream?: boolean;
  /** Receives cumulative answer text as SSE `message` events arrive (see Dify streaming API). */
  onStreamText?: (fullAnswerSoFar: string) => void;
  signal?: AbortSignal;
};

/**
 * POST multipart to Dify `/files/upload`. Returns `upload_file_id` for chat-messages.
 */
export async function uploadDifyFile(file: File, signal?: AbortSignal): Promise<string> {
  const base = difyBaseUrl();
  const key = difyApiKey();
  if (!base || !key) {
    throw new Error("Dify is not configured (set VITE_DIFY_API_KEY and VITE_DIFY_BASE_URL).");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("user", getDifyUserId());

  const url = `${base}/files/upload`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: form,
    signal,
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(text || `Dify file upload failed (${res.status})`);
  }

  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : text || `Dify file upload error (${res.status})`;
    throw new Error(msg);
  }

  const id = data.id ?? data.upload_file_id ?? (data.data as Record<string, unknown> | undefined)?.id;
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("Dify file upload response did not include a file id.");
  }
  return id.trim();
}

function inputPayload(query: string): { inputs: Record<string, string>; query: string } {
  const q = query.trim();
  /**
   * Chatflow / advanced-chat start nodes almost always read from `inputs`.
   * Default: mirror the user text into `inputs.query` (top-level `query` is also sent).
   * Set `VITE_DIFY_INPUT_QUERY_KEY=` (empty) in `.env` for truly empty `inputs: {}`.
   * Set `VITE_DIFY_INPUT_QUERY_KEY=question` (etc.) if the start variable is not `query`.
   */
  const raw = import.meta.env.VITE_DIFY_INPUT_QUERY_KEY as string | undefined;
  const key = raw === undefined ? "query" : String(raw).trim();
  const inputs = key ? { [key]: q } : {};
  return { inputs, query: q };
}

function parseSseDataLine(line: string): Record<string, unknown> | null {
  const prefix = "data:";
  const t = line.trimStart();
  if (!t.startsWith(prefix)) return null;
  const json = t.slice(prefix.length).trim();
  if (!json || json === "[DONE]") return null;
  if (json === "ping") return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Apply one Dify SSE chunk; mutates logical full answer and notifies callback. */
function applyStreamChunk(
  evt: Record<string, unknown>,
  fullAnswer: string,
  onStreamText?: (full: string) => void,
): string {
  const event = evt.event;

  if (event === "error") {
    const msg =
      typeof evt.message === "string"
        ? evt.message
        : typeof evt.code === "string"
          ? evt.code
          : "Dify streaming error";
    throw new Error(msg);
  }

  let next = fullAnswer;

  if (event === "message" || event === "agent_message") {
    if (typeof evt.answer === "string") {
      next = evt.answer;
      onStreamText?.(next);
    } else if (typeof evt.delta === "string") {
      next += evt.delta;
      onStreamText?.(next);
    }
    return next;
  }

  /** Chatflow / workflow LLM nodes (Dify StreamEvent.TEXT_CHUNK) */
  if (event === "text_chunk") {
    const data = evt.data as Record<string, unknown> | undefined;
    const chunk = data && typeof data.text === "string" ? data.text : "";
    if (chunk) {
      next += chunk;
      onStreamText?.(next);
    }
    return next;
  }

  if (event === "text_replace") {
    const data = evt.data as Record<string, unknown> | undefined;
    if (data && typeof data.text === "string") {
      next = data.text;
      onStreamText?.(next);
    }
    return next;
  }

  if (event === "message_replace" && typeof evt.answer === "string") {
    next = evt.answer;
    onStreamText?.(next);
    return next;
  }

  return next;
}

function consumeSseLine(
  line: string,
  fullAnswer: string,
  conversationId: string,
  onStreamText?: (full: string) => void,
): { answer: string; conversationId: string } {
  const evt = parseSseDataLine(line);
  if (!evt) return { answer: fullAnswer, conversationId };

  let cid = conversationId;
  if (typeof evt.conversation_id === "string" && evt.conversation_id) {
    cid = evt.conversation_id;
  }

  const nextAnswer = applyStreamChunk(evt, fullAnswer, onStreamText);
  return { answer: nextAnswer, conversationId: cid };
}

async function readChatStreaming(
  res: Response,
  initialConversationId: string,
  onStreamText?: (full: string) => void,
): Promise<DifyChatResult> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Streaming response had no body.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullAnswer = "";
  let conversationId = initialConversationId;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);

      const out = consumeSseLine(line, fullAnswer, conversationId, onStreamText);
      fullAnswer = out.answer;
      conversationId = out.conversationId;
    }
  }

  if (buffer.trim()) {
    for (const raw of buffer.split("\n")) {
      const out = consumeSseLine(raw.replace(/\r$/, ""), fullAnswer, conversationId, onStreamText);
      fullAnswer = out.answer;
      conversationId = out.conversationId;
    }
  }

  return { answer: fullAnswer, conversationId: conversationId || initialConversationId };
}

/**
 * Sends one user message. Pass the previous `conversation_id` (if any) to keep context.
 */
export async function postDifyChatMessage(
  query: string,
  conversationId: string,
  options?: PostDifyChatOptions,
): Promise<DifyChatResult> {
  const base = difyBaseUrl();
  const key = difyApiKey();
  if (!base || !key) {
    throw new Error("Dify is not configured (set VITE_DIFY_API_KEY and VITE_DIFY_BASE_URL).");
  }

  const { inputs, query: q } = inputPayload(query);
  if (!q) {
    throw new Error("Message is empty.");
  }

  const stream = Boolean(options?.stream);
  const url = `${base}/chat-messages`;
  const user = getDifyUserId();
  const files = options?.files ?? [];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs,
      query: q,
      response_mode: stream ? "streaming" : "blocking",
      conversation_id: conversationId || "",
      user,
      files,
    }),
    signal: options?.signal,
  });

  if (stream) {
    if (!res.ok) {
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        /* ignore */
      }
      const msg =
        typeof data.message === "string"
          ? data.message
          : text || `Dify streaming request failed (${res.status})`;
      throw new Error(msg);
    }
    const streamed = await readChatStreaming(res, conversationId, options?.onStreamText);
    if (!streamed.answer.trim()) {
      throw new Error(
        "Dify streaming finished with an empty answer. Check workflow reply nodes and inputs " +
          "(default: inputs.query). Enable text_chunk handling is implemented — try blocking mode " +
          "(omit VITE_DIFY_STREAMING) or set VITE_DIFY_INPUT_QUERY_KEY to your start variable.",
      );
    }
    return streamed;
  }

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(text || `Dify request failed (${res.status})`);
  }

  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : typeof data.code === "string"
          ? `${data.code}: ${String(data.message ?? text)}`
          : text || `Dify error (${res.status})`;
    throw new Error(msg);
  }

  const answer = data.answer;
  if (typeof answer !== "string") {
    throw new Error("Dify response did not include a string answer.");
  }

  if (!answer.trim()) {
    throw new Error(
      "Dify returned an empty answer. Check that your Chatflow start variable matches inputs " +
        "(default: we send inputs.query). Set VITE_DIFY_INPUT_QUERY_KEY to your variable name, " +
        'or VITE_DIFY_INPUT_QUERY_KEY= (empty) if the app must use inputs: {} only.',
    );
  }

  const cid = data.conversation_id;
  const nextId = typeof cid === "string" ? cid : conversationId;

  return { answer, conversationId: nextId };
}
