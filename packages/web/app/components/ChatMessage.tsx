import { useState } from "react";
import {
  Bot,
  User,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Check,
  Wrench,
  Copy,
  CheckCheck,
  ArrowRight,
  CircleDot,
  Send,
  Search,
  Settings,
  Database,
  Globe,
  FileText,
  Zap,
  Eye,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

// ── Copy button (hover-reveal) ──────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-700/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all opacity-0 group-hover:opacity-100"
    >
      {copied ? (
        <CheckCheck className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ── Tool icon resolver ──────────────────────────────────────────────────

function getToolIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("search") || lower.includes("find") || lower.includes("query"))
    return Search;
  if (lower.includes("config") || lower.includes("setting") || lower.includes("update") || lower.includes("edit"))
    return Settings;
  if (lower.includes("database") || lower.includes("db") || lower.includes("sql"))
    return Database;
  if (lower.includes("web") || lower.includes("fetch") || lower.includes("http") || lower.includes("api"))
    return Globe;
  if (lower.includes("read") || lower.includes("file") || lower.includes("document"))
    return FileText;
  if (lower.includes("preview") || lower.includes("view") || lower.includes("get"))
    return Eye;
  if (lower.includes("create") || lower.includes("generate") || lower.includes("run"))
    return Zap;
  return Wrench;
}

// ── Format tool name for display ────────────────────────────────────────

function formatToolName(name: string): string {
  // Strip MCP prefixes like "mcp__creator-tools__"
  const stripped = name.replace(/^mcp__[^_]+__/, "");
  return stripped;
}

// ── Summarize tool input into a short readable string ───────────────────

function summarizeInput(name: string, input: any): string {
  try {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    if (!parsed || typeof parsed !== "object") return "";

    // Pick the most meaningful field to show
    const keys = Object.keys(parsed);
    if (keys.length === 0) return "";

    // Common patterns
    if (parsed.query) return String(parsed.query);
    if (parsed.name) return String(parsed.name);
    if (parsed.description) return String(parsed.description).substring(0, 60);
    if (parsed.path) return String(parsed.path);
    if (parsed.url) return String(parsed.url);
    if (parsed.id) return `id: ${parsed.id}`;
    if (parsed.agentId) return `agent: ${parsed.agentId}`;

    // For small objects, show key=value pairs
    const pairs = keys
      .slice(0, 3)
      .map((k) => {
        const v = parsed[k];
        const val = typeof v === "string" ? v : JSON.stringify(v);
        return `${k}: ${val.length > 30 ? val.substring(0, 30) + "..." : val}`;
      });
    return pairs.join(", ");
  } catch {
    return "";
  }
}

// ── Single tool call row (inside the grouped panel) ─────────────────────

function ToolCallRow({
  tc,
  isStreaming,
  isLast,
}: {
  tc: { id: string; name: string; input: any; output?: string };
  isStreaming: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasOutput = tc.output !== undefined;
  const isRunning = !hasOutput && isStreaming;
  const Icon = getToolIcon(tc.name);
  const displayName = formatToolName(tc.name);
  const inputSummary = summarizeInput(tc.name, tc.input);

  let inputDisplay = "";
  try {
    const parsed =
      typeof tc.input === "string" ? JSON.parse(tc.input) : tc.input;
    inputDisplay = JSON.stringify(parsed, null, 2);
  } catch {
    inputDisplay = String(tc.input ?? "");
  }

  return (
    <div className={!isLast && !expanded ? "border-b border-zinc-800/40" : ""}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-800/30 transition-colors text-left"
      >
        {/* Status + icon */}
        <div className="shrink-0 relative">
          {isRunning ? (
            <div className="h-6 w-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
            </div>
          ) : hasOutput ? (
            <div className="h-6 w-6 rounded-lg bg-neon-400/10 flex items-center justify-center">
              <Icon className="h-3.5 w-3.5 text-neon-400" />
            </div>
          ) : (
            <div className="h-6 w-6 rounded-lg bg-zinc-800/60 flex items-center justify-center">
              <Icon className="h-3.5 w-3.5 text-zinc-500" />
            </div>
          )}
        </div>

        {/* Name + summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              tool_call
            </span>
            <span className="text-[10px] text-zinc-700">
              /
            </span>
            <span className="font-mono text-xs font-medium text-zinc-300 truncate">
              {displayName}
            </span>
          </div>
          {inputSummary && (
            <p className="text-[11px] text-zinc-500 truncate mt-0.5 leading-tight">
              {inputSummary}
            </p>
          )}
        </div>

        {/* Status badge */}
        {isRunning && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-amber-400/80 bg-amber-500/10 rounded-full px-2 py-0.5">
            <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
            Running
          </span>
        )}
        {hasOutput && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-neon-400/80 bg-neon-400/10 rounded-full px-2 py-0.5">
            <Check className="h-2.5 w-2.5" />
            Done
          </span>
        )}

        <div className="shrink-0 text-zinc-600">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mx-3.5 mb-2.5 rounded-lg border border-zinc-800/60 bg-zinc-950/40 overflow-hidden">
          {inputDisplay && inputDisplay !== "{}" && (
            <div className="px-3 py-2 border-b border-zinc-800/40">
              <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                Input
              </div>
              <div className="group relative">
                <pre className="text-xs text-zinc-400 font-mono bg-zinc-950/50 rounded-md p-2 overflow-x-auto max-h-40 overflow-y-auto">
                  {inputDisplay}
                </pre>
                <CopyButton text={inputDisplay} />
              </div>
            </div>
          )}

          {hasOutput && tc.output && (
            <div className="px-3 py-2">
              <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                Output
              </div>
              <div className="group relative">
                <pre className="text-xs text-zinc-400 font-mono bg-zinc-950/50 rounded-md p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                  {tc.output}
                </pre>
                <CopyButton text={tc.output} />
              </div>
            </div>
          )}

          {isRunning && (
            <div className="px-3 py-2 flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Executing...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Grouped tool calls panel ────────────────────────────────────────────

function ToolCallsPanel({
  toolCalls,
  isStreaming,
}: {
  toolCalls: { id: string; name: string; input: any; output?: string }[];
  isStreaming: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = toolCalls.filter((tc) => tc.output !== undefined).length;
  const totalCount = toolCalls.length;
  const anyRunning = toolCalls.some((tc) => tc.output === undefined) && isStreaming;
  const allDone = completedCount === totalCount && !isStreaming;

  return (
    <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-900/50 backdrop-blur-sm">
      {/* Panel header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-800/30 transition-colors text-left border-b border-zinc-800/40"
      >
        <div className="shrink-0">
          {anyRunning ? (
            <div className="h-5 w-5 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
            </div>
          ) : (
            <div className="h-5 w-5 rounded-md bg-zinc-800/60 flex items-center justify-center">
              <Wrench className="h-3 w-3 text-zinc-400" />
            </div>
          )}
        </div>

        <span className="text-xs font-medium text-zinc-300 flex-1">
          {anyRunning ? "Using tools..." : "Used tools"}
        </span>

        <span className="text-[10px] text-zinc-500 tabular-nums">
          {allDone ? (
            <span className="inline-flex items-center gap-1 text-neon-400/70">
              <Check className="h-2.5 w-2.5" />
              {totalCount} completed
            </span>
          ) : (
            `${completedCount}/${totalCount}`
          )}
        </span>

        <div className="shrink-0 text-zinc-600">
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </div>
      </button>

      {/* Tool call rows */}
      {!collapsed && (
        <div>
          {toolCalls.map((tc, i) => (
            <ToolCallRow
              key={tc.id}
              tc={tc}
              isStreaming={isStreaming}
              isLast={i === toolCalls.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Interactive question cards ──────────────────────────────────────────

type Question = { id: string; question: string; options: string[] };

function QuestionCards({
  questions,
  onSubmit,
}: {
  questions: Question[];
  onSubmit: (answers: string) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = questions.every((q) => selections[q.id]);

  function handleSelect(questionId: string, option: string) {
    if (submitted) return;
    setSelections((prev) => ({
      ...prev,
      [questionId]: prev[questionId] === option ? "" : option,
    }));
  }

  function handleSubmit() {
    if (!allAnswered || submitted) return;
    setSubmitted(true);

    // Build a natural-language answer string
    const answerLines = questions.map((q) => {
      const answer = selections[q.id];
      return `${q.question} → ${answer}`;
    });
    onSubmit(answerLines.join("\n"));
  }

  return (
    <div className="space-y-3">
      {questions.map((q, qi) => {
        const selected = selections[q.id];
        return (
          <div
            key={q.id}
            className="border border-zinc-800 rounded-xl bg-zinc-900/40 overflow-hidden"
          >
            {/* Question header */}
            <div className="px-3.5 py-2.5 flex items-start gap-2.5">
              <div className="shrink-0 mt-0.5">
                <div
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    selected
                      ? "bg-neon-400/20 text-neon-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {submitted && selected ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    qi + 1
                  )}
                </div>
              </div>
              <p className="text-sm text-zinc-200 leading-snug flex-1">
                {q.question}
              </p>
            </div>

            {/* Options */}
            <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
              {q.options.map((option) => {
                const isSelected = selected === option;
                return (
                  <button
                    key={option}
                    onClick={() => handleSelect(q.id, option)}
                    disabled={submitted}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all duration-150 ${
                      submitted
                        ? isSelected
                          ? "bg-neon-400/15 border border-neon-400/30 text-neon-300"
                          : "bg-zinc-900/40 border border-zinc-800/50 text-zinc-600"
                        : isSelected
                          ? "bg-neon-400/15 border border-neon-400/40 text-neon-300 shadow-sm shadow-neon-400/10"
                          : "bg-zinc-800/40 border border-zinc-700/60 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-100"
                    }`}
                  >
                    <CircleDot
                      className={`h-3 w-3 shrink-0 ${
                        isSelected ? "text-neon-400" : "text-zinc-600"
                      }`}
                    />
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all duration-150 ${
            allAnswered
              ? "bg-neon-400 text-zinc-950 hover:bg-neon-300 glow-neon-sm"
              : "bg-zinc-800/50 text-zinc-500 cursor-not-allowed"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          {allAnswered
            ? "Send answers"
            : `Select ${questions.length - Object.values(selections).filter(Boolean).length} more`}
        </button>
      )}
    </div>
  );
}

// ── Main ChatMessage component ──────────────────────────────────────────

export function ChatMessage({
  message,
  showSuggestions,
  onSendSuggestion,
}: {
  message: Doc<"messages">;
  showSuggestions?: boolean;
  onSendSuggestion?: (content: string) => void;
}) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "processing";
  const isError = message.status === "error";
  const isPending = message.status === "pending";

  // ── User message ──────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm bg-zinc-800 text-zinc-100">
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-700 mt-0.5">
          <User className="h-4 w-4 text-zinc-300" />
        </div>
      </div>
    );
  }

  // ── Assistant message ─────────────────────────────────────────────────
  const hiddenTools = new Set(["suggest_replies", "ask_questions", "mcp__creator-tools__suggest_replies", "mcp__creator-tools__ask_questions"]);
  const visibleToolCalls = message.toolCalls?.filter(
    (tc) => !hiddenTools.has(tc.name)
  );
  const hasToolCalls = visibleToolCalls && visibleToolCalls.length > 0;

  const hasSuggestions =
    showSuggestions &&
    message.suggestions &&
    message.suggestions.length > 0;

  const hasQuestions =
    showSuggestions &&
    message.questions &&
    message.questions.length > 0;

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neon-400/10 mt-0.5">
        <Bot className="h-4 w-4 text-neon-400" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Tool calls — grouped in a single panel */}
        {hasToolCalls && (
          <ToolCallsPanel
            toolCalls={visibleToolCalls!}
            isStreaming={isStreaming}
          />
        )}

        {/* Pending state */}
        {isPending && !message.content ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Thinking...</span>
          </div>
        ) : message.content ? (
          /* Markdown content */
          <div
            className={`text-sm leading-relaxed prose prose-invert prose-zinc max-w-none
              prose-p:my-1.5 prose-headings:my-3 prose-li:my-0.5
              prose-pre:bg-zinc-950/60 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-xl
              prose-code:text-neon-400 prose-code:font-medium
              prose-code:before:content-none prose-code:after:content-none
              prose-a:text-neon-400 prose-a:no-underline hover:prose-a:underline
              prose-table:border-collapse
              prose-th:border prose-th:border-zinc-700 prose-th:px-3 prose-th:py-1.5 prose-th:bg-zinc-800/60
              prose-td:border prose-td:border-zinc-800 prose-td:px-3 prose-td:py-1.5
              prose-strong:text-zinc-100 prose-strong:font-semibold
              prose-blockquote:border-neon-400/30 prose-blockquote:text-zinc-400
              ${isError ? "text-red-200" : "text-zinc-200"}`}
          >
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-neon-400 ml-0.5 animate-pulse rounded-sm align-middle" />
            )}
          </div>
        ) : null}

        {/* Error message */}
        {isError && message.error && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {message.error}
          </div>
        )}

        {/* Interactive questions */}
        {hasQuestions && (
          <QuestionCards
            questions={message.questions as Question[]}
            onSubmit={(answers) => onSendSuggestion?.(answers)}
          />
        )}

        {/* Suggested replies */}
        {hasSuggestions && !hasQuestions && (
          <div className="flex flex-wrap gap-2 pt-1">
            {message.suggestions!.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSendSuggestion?.(suggestion)}
                className="group inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-3.5 py-2 text-xs text-zinc-300 hover:border-neon-400/30 hover:bg-neon-400/5 hover:text-zinc-100 transition-all duration-150"
              >
                <ArrowRight className="h-3 w-3 text-zinc-600 group-hover:text-neon-400 transition-colors shrink-0" />
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
