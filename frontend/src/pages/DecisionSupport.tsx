import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { aiInsights, procurementData } from "@/data/mockData";
import { getProcurementApiLive, postProcurementChat } from "@/lib/api";
import { isDifyConfigured, isDifyStreamingEnabled } from "@/lib/difyChat";
import {
  Sparkles,
  TrendingDown,
  ShieldCheck,
  Scale,
  AlertTriangle,
  ArrowRight,
  Send,
  Brain,
  Paperclip,
} from "lucide-react";

const DecisionSupport = () => {
  const recs = useMemo(() => {
    const sorted = [...procurementData];
    return {
      lowestCost: [...sorted].sort((a, b) => a.estimated_cost - b.estimated_cost)[0],
      lowestRisk: [...sorted].sort((a, b) => a.risk_score - b.risk_score)[0],
      bestBalanced: [...sorted].sort(
        (a, b) =>
          (a.risk_score * 0.4 + (1 - a.reliability_score) * 0.3 + a.estimated_cost / 250 * 0.3) -
          (b.risk_score * 0.4 + (1 - b.reliability_score) * 0.3 + b.estimated_cost / 250 * 0.3),
      )[0],
    };
  }, []);

  const [messages, setMessages] = useState([
    {
      role: "assistant" as const,
      text: "Hi Avery — I analyzed 387 BOMs across your portfolio. Three sourcing paths are flagged for your review today. Where would you like to start?",
    },
    {
      role: "user" as const,
      text: "Where can I cut cost without raising risk?",
    },
    {
      role: "assistant" as const,
      text: "I found 4 BOMs where switching to a secondary supplier reduces cost by 6–11% with neutral or improved risk. The strongest opportunity: BOM-8842 (Whey Protein Isolate) — moving 30% volume to Midwest Protein Partners saves ~$1.2K/month and improves availability score by +6 pts.",
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [apiLive, setApiLive] = useState<boolean | null>(null);
  /** Dify advanced-chat thread id (returned from POST /chat-messages). */
  const [difyConversationId, setDifyConversationId] = useState("");
  /** CoA / spec attachments for Dify (uploaded via /files/upload). */
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void getProcurementApiLive().then((ok) => {
        if (!cancelled) setApiLive(ok);
      });
    };
    run();
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatLoading) return;

      const history = messages.map((m) => ({ role: m.role, content: m.text }));
      const useDifyStream = isDifyConfigured() && isDifyStreamingEnabled();
      const filesToSend = [...attachments];
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setMessages((prev) => {
        const next = [...prev, { role: "user" as const, text: trimmed }];
        if (useDifyStream) next.push({ role: "assistant" as const, text: "" });
        return next;
      });
      setInput("");
      setChatLoading(true);

      try {
        const reply = await postProcurementChat(trimmed, history, {
          conversationId: difyConversationId,
          onConversationId: setDifyConversationId,
          attachments: filesToSend.length ? filesToSend : undefined,
          onStreamText: useDifyStream
            ? (t) => {
                setMessages((prev) => {
                  if (prev.length === 0) return prev;
                  const last = prev[prev.length - 1];
                  if (last.role !== "assistant") return prev;
                  return [...prev.slice(0, -1), { role: "assistant" as const, text: t }];
                });
              }
            : undefined,
        });
        if (useDifyStream) {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            if (last.role === "assistant")
              return [...prev.slice(0, -1), { role: "assistant" as const, text: reply }];
            return [...prev, { role: "assistant" as const, text: reply }];
          });
        } else {
          setMessages((prev) => [...prev, { role: "assistant" as const, text: reply }]);
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const errText = isDifyConfigured()
          ? `Dify chat error: ${err}`
          : `The chat API returned an error (not a connection issue). From the repo root run \`npm run dev:all\` so Vite and FastAPI start together, then retry. Details: ${err}`;
        setMessages((prev) => {
          let base = prev;
          if (useDifyStream && base.length > 0 && base[base.length - 1].role === "assistant") {
            base = base.slice(0, -1);
          }
          return [...base, { role: "assistant" as const, text: errText }];
        });
      } finally {
        setChatLoading(false);
      }
    },
    [attachments, chatLoading, difyConversationId, messages],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Decision Support"
        title="AI Procurement Co-pilot"
        subtitle="Risk-aware recommendations and conversational intelligence to support sourcing decisions."
      />

      {/* Recommendation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RecCard
          icon={TrendingDown}
          accent="success"
          label="Lowest-cost option"
          title={recs.lowestCost.supplier_name}
          subtitle={recs.lowestCost.raw_material_name}
          metric={`$${recs.lowestCost.estimated_cost.toFixed(2)} / unit`}
          note={`Saves est. ${(((procurementData[0].estimated_cost - recs.lowestCost.estimated_cost) / procurementData[0].estimated_cost) * 100).toFixed(0)}% vs current baseline`}
        />
        <RecCard
          icon={ShieldCheck}
          accent="primary"
          label="Lowest-risk option"
          title={recs.lowestRisk.supplier_name}
          subtitle={recs.lowestRisk.raw_material_name}
          metric={`${(recs.lowestRisk.risk_score * 100).toFixed(0)} risk index`}
          note={`Reliability ${(recs.lowestRisk.reliability_score * 100).toFixed(0)}% · ${recs.lowestRisk.region}`}
        />
        <RecCard
          icon={Scale}
          accent="accent"
          label="Best balanced choice"
          title={recs.bestBalanced.supplier_name}
          subtitle={recs.bestBalanced.raw_material_name}
          metric={`$${recs.bestBalanced.estimated_cost.toFixed(2)} · ${recs.bestBalanced.lead_time_days}d`}
          note="Optimized cost, risk, and continuity"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Flagged + Next actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-warning/30 bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-warning/15 border border-warning/30 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" style={{ color: "hsl(var(--warning))" }} />
              </div>
              <h3 className="font-display font-semibold">Flagged Concerns</h3>
            </div>
            <ul className="space-y-3">
              {[
                "Single-source dependency on RM-880 (Electronic-Grade Silicon)",
                "Lead-time variance for SUP-555 increased 22% in last quarter",
                "Geopolitical exposure to APAC sourcing rose to 24% of portfolio",
              ].map((t, i) => (
                <li key={i} className="text-sm flex gap-2"><span className="status-dot bg-warning mt-2 shrink-0" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display font-semibold">Suggested Next Actions</h3>
            </div>
            <ul className="space-y-3">
              {[
                "Qualify secondary supplier for RM-880 by end of Q3",
                "Initiate substitution trial: Lithium Hydroxide for RM-721",
                "Renegotiate SUP-555 contract with risk-adjusted SLA",
              ].map((t, i) => (
                <li key={i} className="text-sm flex items-start gap-2 group cursor-pointer hover:text-primary transition-colors">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Conversational AI panel */}
        <div className="xl:col-span-2 rounded-xl border border-border/60 bg-card shadow-card flex flex-col h-[640px]">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <div className="font-display font-semibold">Spheremaxxing Co-pilot</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  {isDifyConfigured() && (
                    <>
                      <span className="status-dot bg-success" /> Chat · Dify (advanced-chat)
                      {apiLive === true && (
                        <span className="text-muted-foreground/80"> · Local procurement API online</span>
                      )}
                    </>
                  )}
                  {!isDifyConfigured() && apiLive === null && (
                    <>
                      <span className="status-dot bg-muted-foreground/80" /> Checking API…
                    </>
                  )}
                  {!isDifyConfigured() && apiLive === true && (
                    <>
                      <span className="status-dot bg-success" /> Live · Full database (SQLite) + chat API
                    </>
                  )}
                  {!isDifyConfigured() && apiLive === false && (
                    <>
                      <span className="status-dot bg-amber-500" /> Demo mode · Sample data only (API not on port 8000)
                    </>
                  )}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">v2.4</Badge>
          </div>

          {apiLive === false && !isDifyConfigured() && (
            <div className="px-5 py-2.5 border-b border-border/50 text-[11px] leading-snug bg-amber-500/10 text-foreground/90">
              The full SQLite database is available when FastAPI is running. From the repository root run{" "}
              <code className="font-mono text-[10px] bg-secondary/80 px-1 rounded">npm run dev:all</code>{" "}
              so Vite and the backend start together (API on{" "}
              <code className="font-mono text-[10px] bg-secondary/80 px-1 rounded">127.0.0.1:8000</code>). Deployed
              previews often have no Python server — use local dev or set{" "}
              <code className="font-mono text-[10px] bg-secondary/80 px-1 rounded">VITE_API_URL</code> to your API URL.
            </div>
          )}
          {isDifyConfigured() && apiLive === false && (
            <div className="px-5 py-2.5 border-b border-border/50 text-[11px] leading-snug bg-secondary/40 text-foreground/85">
              Chat uses Dify (<code className="font-mono text-[10px]">VITE_DIFY_*</code>). Local FastAPI is offline —
              procurement SQLite features stay in demo until you run{" "}
              <code className="font-mono text-[10px] bg-secondary/80 px-1 rounded">npm run dev:all</code>.
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary/60 border border-border/60 rounded-bl-sm"
                }`}>
                  {m.text ||
                    (m.role === "assistant" ? (chatLoading ? "…" : "") : "")}
                </div>
              </div>
            ))}
            {chatLoading &&
              !(isDifyConfigured() && isDifyStreamingEnabled() && messages[messages.length - 1]?.role === "assistant") && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm text-muted-foreground bg-secondary/40 border border-border/60 rounded-bl-sm animate-pulse">
                  Thinking…
                </div>
              </div>
            )}

            <div className="pt-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Live Insights</div>
              <div className="space-y-2">
                {aiInsights.slice(0, 3).map((i) => (
                  <div key={i.id} className="text-xs px-3 py-2 rounded-lg bg-secondary/30 border border-border/40 leading-relaxed">
                    {i.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border/60">
            <div className="flex gap-2 mb-2 flex-wrap">
              {["Best supplier for Soy Lecithin?", "Substitutes for Calcium Carbonate"].map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={chatLoading}
                  onClick={() => void submit(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,text/plain"
              disabled={chatLoading || !isDifyConfigured()}
              onChange={(e) => {
                const list = e.target.files;
                if (!list?.length) return;
                setAttachments((prev) => [...prev, ...Array.from(list)]);
              }}
            />
            {isDifyConfigured() && attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachments.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-secondary/60 border border-border/50 max-w-[200px] truncate"
                    title={f.name}
                  >
                    {f.name}
                    <button
                      type="button"
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      disabled={chatLoading}
                      aria-label={`Remove ${f.name}`}
                      onClick={() =>
                        setAttachments((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              {isDifyConfigured() && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 shrink-0 border-border/60"
                  disabled={chatLoading}
                  title="Attach CoA or spec (Dify)"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit(input);
                  }
                }}
                placeholder="Ask about cost, risk, suppliers, substitutions…"
                disabled={chatLoading}
                className="flex-1 h-11 rounded-lg bg-secondary/40 border border-border/60 px-4 text-sm focus:outline-none focus:border-primary/50 disabled:opacity-60"
              />
              <Button
                type="button"
                disabled={chatLoading}
                onClick={() => void submit(input)}
                className="h-11 bg-gradient-primary text-primary-foreground"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type RecCardProps = {
  icon: LucideIcon;
  accent: "success" | "primary" | "accent";
  label: string;
  title: string;
  subtitle: string;
  metric: string;
  note: string;
};

function RecCard({ icon: Icon, accent, label, title, subtitle, metric, note }: RecCardProps) {
  const accentMap: Record<string, string> = {
    success: "from-success/15 border-success/30",
    primary: "from-primary/15 border-primary/30",
    accent: "from-accent/15 border-accent/30",
  };
  const iconColor = accent === "success" ? "hsl(var(--success))" : accent === "accent" ? "hsl(var(--accent))" : "hsl(var(--primary))";
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${accentMap[accent]} via-card to-card p-5 shadow-card`}>
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-lg border flex items-center justify-center" style={{ background: `${iconColor}15`, borderColor: `${iconColor}40` }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: iconColor }}>{label}</span>
      </div>
      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{subtitle}</div>
        <div className="font-display text-lg font-semibold mt-0.5">{title}</div>
        <div className="font-mono text-sm mt-2">{metric}</div>
        <div className="text-xs text-muted-foreground mt-2">{note}</div>
      </div>
    </div>
  );
}

export default DecisionSupport;
