import { useState, useEffect } from "react";
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
  Download,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import type { Doc, Id } from "@agent-maker/shared/convex/_generated/dataModel";
import { ImageGenReviewPanel } from "./ImageGenReviewPanel";

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
      className="absolute top-2 right-2 p-1.5 bg-surface border border-rule text-ink-faint hover:text-ink transition-all opacity-0 group-hover:opacity-100"
    >
      {copied ? (
        <CheckCheck className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ── Image generation preview (shimmer placeholder while generating) ─────

function ImageGenerationPreview({
  prompt,
  progress,
}: {
  prompt: string;
  progress?: string;
}) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-2">
      <div className="relative border border-rule overflow-hidden bg-surface-sunken">
        <div className="relative h-72 overflow-hidden">
          {/* Monochrome shimmer */}
          <div className="absolute inset-0 animate-pulse bg-surface-sunken" />

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
            <div className="h-10 w-10 border border-rule flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-ink-faint" strokeWidth={1.5} />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-xs text-ink-muted">
                {progress || "Generating image"}{dots}
              </p>
              <p className="text-[11px] text-ink-faint max-w-xs line-clamp-2 leading-relaxed">
                &ldquo;{prompt}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Extract prompt from a generate_image tool input */
function parseImageGenInput(tc: { name: string; input: any }): { prompt: string; name?: string } | null {
  const toolName = tc.name.replace(/^mcp__[^_]+__/, "");
  if (toolName !== "generate_image") return null;
  try {
    const parsed = typeof tc.input === "string" ? JSON.parse(tc.input) : tc.input;
    if (parsed?.prompt) return { prompt: parsed.prompt, name: parsed.name };
  } catch {}
  return null;
}

// ── Inline asset image (for generate_image tool results) ────────────────

function InlineAssetImage({ assetId, name }: { assetId: string; name?: string }) {
  const asset = useQuery(api.assets.get, { assetId: assetId as Id<"assets"> });
  const [expanded, setExpanded] = useState(false);

  if (asset === undefined) {
    return (
      <div className="mt-2 flex items-center gap-2 border border-rule bg-surface p-4">
        <Loader2 className="h-4 w-4 animate-spin text-ink-faint" strokeWidth={1.5} />
        <span className="text-xs text-ink-faint">Loading image…</span>
      </div>
    );
  }

  if (!asset || !asset.resolvedUrl) {
    return (
      <div className="mt-2 flex items-center gap-2 border border-rule bg-surface p-3">
        <ImageIcon className="h-4 w-4 text-ink-faint" strokeWidth={1.5} />
        <span className="text-xs text-ink-faint">Image not available</span>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div
        className="relative group border border-rule overflow-hidden cursor-pointer bg-surface"
        onClick={() => setExpanded(!expanded)}
      >
        <img
          src={asset.resolvedUrl}
          alt={name || "Generated image"}
          className={`w-full object-contain transition-all ${
            expanded ? "max-h-[600px]" : "max-h-72"
          }`}
        />
        {/* Overlay with name + actions */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink truncate">
              {name || asset.name}
            </span>
            <a
              href={asset.resolvedUrl}
              download={name || asset.name}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 bg-surface border border-rule text-ink-muted hover:text-ink transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
      {asset.generatedBy && (
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <span className="text-[10px] text-ink-faint">
            Generated by {asset.generatedBy === "gemini" ? "Gemini Imagen" : "Nano Banana"}
          </span>
        </div>
      )}
    </div>
  );
}

/** Extract assetId from a generate_image tool output */
function parseImageAsset(tc: { name: string; output?: string }): { assetId: string; name?: string } | null {
  if (!tc.output) return null;
  const toolName = tc.name.replace(/^mcp__[^_]+__/, "");
  if (toolName !== "generate_image") return null;

  try {
    const parsed = JSON.parse(tc.output);
    if (parsed.success && parsed.assetId) {
      return { assetId: parsed.assetId, name: parsed.name };
    }
  } catch {}

  const match = tc.output.match(/\(ID:\s*([^)]+)\)/);
  if (match) {
    const nameMatch = tc.output.match(/Image "([^"]+)"/);
    return { assetId: match[1].trim(), name: nameMatch?.[1] };
  }

  return null;
}

/** Extract pending_approval data from a generate_image tool output */
function parsePendingApproval(tc: { name: string; output?: string }): {
  prompt: string;
  name: string;
  model?: string;
  inputAssetId?: string;
} | null {
  if (!tc.output) return null;
  const toolName = tc.name.replace(/^mcp__[^_]+__/, "");
  if (toolName !== "generate_image") return null;

  try {
    const parsed = JSON.parse(tc.output);
    if (parsed.status === "pending_approval" && parsed.prompt) {
      return {
        prompt: parsed.prompt,
        name: parsed.name || "Generated Image",
        model: parsed.model,
        inputAssetId: parsed.input_asset_id,
      };
    }
  } catch {}

  return null;
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
  return name.replace(/^mcp__[^_]+__/, "");
}

// ── Summarize tool input into a short readable string ───────────────────

function summarizeInput(name: string, input: any): string {
  try {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    if (!parsed || typeof parsed !== "object") return "";

    const keys = Object.keys(parsed);
    if (keys.length === 0) return "";

    if (parsed.query) return String(parsed.query);
    if (parsed.name) return String(parsed.name);
    if (parsed.description) return String(parsed.description).substring(0, 60);
    if (parsed.path) return String(parsed.path);
    if (parsed.url) return String(parsed.url);
    if (parsed.id) return `id: ${parsed.id}`;
    if (parsed.agentId) return `agent: ${parsed.agentId}`;

    const pairs = keys
      .slice(0, 3)
      .map((k) => {
        const v = parsed[k];
        const val = typeof v === "string" ? v : JSON.stringify(v);
        return `${k}: ${val.length > 30 ? val.substring(0, 30) + "…" : val}`;
      });
    return pairs.join(", ");
  } catch {
    return "";
  }
}

// ── Code block with language header ─────────────────────────────────────

function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") || "";
  const code = String(children).replace(/\n$/, "");

  return (
    <div className="group relative border border-rule bg-surface overflow-hidden my-3">
      {lang && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-surface-sunken border-b border-rule">
          <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-[0.12em]">
            {lang}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1 text-[10px] text-ink-faint hover:text-ink transition-colors"
          >
            {copied ? (
              <>
                <CheckCheck className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm">
        <code className={className}>{children}</code>
      </pre>
      {!lang && <CopyButton text={code} />}
    </div>
  );
}

// ── Single tool call row (inside the grouped panel) ─────────────────────

function ToolCallRow({
  tc,
  isStreaming,
  isLast,
}: {
  tc: { id: string; name: string; input: any; output?: string; progress?: string };
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
    <div className={!isLast && !expanded ? "border-b border-rule" : ""}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-surface-sunken transition-colors text-left"
      >
        {/* Status + icon */}
        <div className="shrink-0">
          {isRunning ? (
            <div className="h-6 w-6 border border-rule flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 text-warn animate-spin" strokeWidth={1.5} />
            </div>
          ) : hasOutput ? (
            <div className="h-6 w-6 border border-rule bg-surface-sunken flex items-center justify-center">
              <Icon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="h-6 w-6 border border-rule flex items-center justify-center">
              <Icon className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Name + summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-muted truncate">
              {displayName}
            </span>
          </div>
          {inputSummary && (
            <p className="text-[11px] text-ink-faint truncate mt-0.5 leading-tight">
              {inputSummary}
            </p>
          )}
        </div>

        {/* Status badge */}
        {isRunning && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-warn max-w-[200px]">
            <span className="h-1 w-1 rounded-full bg-warn status-pulse shrink-0" />
            <span className="truncate">{tc.progress || "Running"}</span>
          </span>
        )}
        {hasOutput && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
            <Check className="h-2.5 w-2.5" strokeWidth={2} />
            Done
          </span>
        )}

        <div className="shrink-0 text-ink-faint">
          {expanded ? (
            <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mx-3.5 mb-2.5 border border-rule bg-surface overflow-hidden">
          {inputDisplay && inputDisplay !== "{}" && (
            <div className="px-3 py-2 border-b border-rule">
              <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-[0.12em] mb-1">
                Input
              </div>
              <div className="group relative">
                <pre className="text-xs text-ink-muted font-mono bg-surface-sunken p-2 overflow-x-auto max-h-40 overflow-y-auto">
                  {inputDisplay}
                </pre>
                <CopyButton text={inputDisplay} />
              </div>
            </div>
          )}

          {hasOutput && tc.output && (
            <div className="px-3 py-2">
              <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-[0.12em] mb-1">
                Output
              </div>
              <div className="group relative">
                <pre className="text-xs text-ink-muted font-mono bg-surface-sunken p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                  {tc.output}
                </pre>
                <CopyButton text={tc.output} />
              </div>
            </div>
          )}

          {isRunning && (
            <div className="px-3 py-2 flex items-center gap-2 text-xs text-ink-faint">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              {tc.progress || "Executing…"}
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
  toolCalls: { id: string; name: string; input: any; output?: string; progress?: string }[];
  isStreaming: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = toolCalls.filter((tc) => tc.output !== undefined).length;
  const totalCount = toolCalls.length;
  const anyRunning = toolCalls.some((tc) => tc.output === undefined) && isStreaming;
  const allDone = completedCount === totalCount && !isStreaming;

  return (
    <div className="border border-rule overflow-hidden">
      {/* Panel header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-surface-sunken transition-colors text-left border-b border-rule"
      >
        <div className="shrink-0">
          {anyRunning ? (
            <div className="h-5 w-5 border border-rule flex items-center justify-center">
              <Loader2 className="h-3 w-3 text-warn animate-spin" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="h-5 w-5 border border-rule bg-surface-sunken flex items-center justify-center">
              <Wrench className="h-3 w-3 text-ink-faint" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <span className="text-xs text-ink-muted flex-1">
          {anyRunning ? "Using tools…" : "Used tools"}
        </span>

        <span className="text-[10px] text-ink-faint tabular-nums font-mono">
          {allDone ? (
            <span className="inline-flex items-center gap-1 text-accent font-semibold uppercase tracking-[0.1em]">
              <Check className="h-2.5 w-2.5" strokeWidth={2} />
              {totalCount} completed
            </span>
          ) : (
            `${completedCount}/${totalCount}`
          )}
        </span>

        <div className="shrink-0 text-ink-faint">
          {collapsed ? (
            <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          ) : (
            <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
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
            className="border border-rule bg-surface overflow-hidden"
          >
            {/* Question header */}
            <div className="px-3.5 py-2.5 flex items-start gap-2.5 border-b border-rule">
              <div className="shrink-0 mt-0.5">
                <div
                  className={`h-5 w-5 flex items-center justify-center text-[10px] font-semibold border ${
                    selected
                      ? "border-accent text-accent"
                      : "border-rule text-ink-faint"
                  }`}
                >
                  {submitted && selected ? (
                    <Check className="h-3 w-3" strokeWidth={2} />
                  ) : (
                    qi + 1
                  )}
                </div>
              </div>
              <p className="text-sm text-ink leading-snug flex-1">
                {q.question}
              </p>
            </div>

            {/* Options */}
            <div className="px-3.5 py-3 flex flex-wrap gap-1.5">
              {q.options.map((option) => {
                const isSelected = selected === option;
                return (
                  <button
                    key={option}
                    onClick={() => handleSelect(q.id, option)}
                    disabled={submitted}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all duration-150 border ${
                      submitted
                        ? isSelected
                          ? "border-accent text-accent bg-surface-sunken"
                          : "border-rule text-ink-faint"
                        : isSelected
                          ? "border-accent text-ink bg-surface-sunken"
                          : "border-rule text-ink-muted hover:border-rule-strong hover:text-ink"
                    }`}
                  >
                    <CircleDot
                      className={`h-3 w-3 shrink-0 ${
                        isSelected ? "text-accent" : "text-ink-faint"
                      }`}
                      strokeWidth={1.5}
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
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all duration-150 ${
            allAnswered
              ? "bg-ink text-surface hover:opacity-90"
              : "bg-surface-sunken text-ink-faint border border-rule cursor-not-allowed"
          }`}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          {allAnswered
            ? "Send answers"
            : `Select ${questions.length - Object.values(selections).filter(Boolean).length} more`}
        </button>
      )}
    </div>
  );
}

// ── Attachment preview for user messages ────────────────────────────────

function AttachmentPreview({
  attachment,
}: {
  attachment: { storageId: string; fileName: string; contentType: string; fileSize: number };
}) {
  const url = useQuery(api.storage.getUrl, {
    storageId: attachment.storageId as any,
  });
  const isImage = attachment.contentType.startsWith("image/");

  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={attachment.fileName}
          className="max-h-48 max-w-64 border border-rule object-cover hover:border-rule-strong transition-colors"
        />
      </a>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="flex items-center gap-2.5 border border-rule bg-surface-sunken px-3 py-2">
      <FileText className="h-4 w-4 text-ink-faint shrink-0" strokeWidth={1.5} />
      <div className="min-w-0">
        <p className="text-xs text-ink truncate">{attachment.fileName}</p>
        <p className="text-[10px] text-ink-faint">{formatSize(attachment.fileSize)}</p>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-ink-faint hover:text-ink transition-colors"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
        </a>
      )}
    </div>
  );
}

// ── Main ChatMessage component ──────────────────────────────────────────

export function ChatMessage({
  message,
  showSuggestions,
  onSendSuggestion,
  agentId,
  configuredImageGenProviders,
}: {
  message: Doc<"messages">;
  showSuggestions?: boolean;
  onSendSuggestion?: (content: string) => void;
  agentId?: Id<"agents">;
  configuredImageGenProviders?: string[];
}) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "processing";
  const isError = message.status === "error";
  const isPending = message.status === "pending";

  // ── User message ──────────────────────────────────────────────────────
  if (isUser) {
    const userAttachments = (message as any).attachments as
      | Array<{ storageId: string; fileName: string; contentType: string; fileSize: number }>
      | undefined;

    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[75%] space-y-2">
          {/* Attachment previews */}
          {userAttachments && userAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end">
              {userAttachments.map((att, i) => (
                <AttachmentPreview key={i} attachment={att} />
              ))}
            </div>
          )}
          {/* Text content */}
          {message.content && message.content !== "(attached files)" && (
            <div className="px-4 py-2.5 text-sm bg-surface-sunken border border-rule text-ink">
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
            </div>
          )}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-rule bg-surface-sunken mt-0.5">
          <User className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-rule bg-surface mt-0.5">
        <Bot className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Tool calls — grouped in a single panel */}
        {hasToolCalls && (
          <ToolCallsPanel
            toolCalls={visibleToolCalls!}
            isStreaming={isStreaming}
          />
        )}

        {/* Inline generated images */}
        {visibleToolCalls?.map((tc) => {
          const img = parseImageAsset(tc);
          if (img) {
            return <InlineAssetImage key={tc.id} assetId={img.assetId} name={img.name} />;
          }
          const pending = parsePendingApproval(tc);
          if (pending && agentId) {
            return (
              <ImageGenReviewPanel
                key={tc.id}
                messageId={message._id}
                toolCallId={tc.id}
                agentId={agentId}
                initialPrompt={pending.prompt}
                initialName={pending.name}
                initialModel={pending.model}
                inputAssetId={pending.inputAssetId}
                configuredImageGenProviders={configuredImageGenProviders}
              />
            );
          }
          if (!tc.output && isStreaming) {
            const genInput = parseImageGenInput(tc);
            if (genInput) {
              return (
                <ImageGenerationPreview
                  key={tc.id}
                  prompt={genInput.prompt}
                  progress={tc.progress}
                />
              );
            }
          }
          return null;
        })}

        {/* Pending state */}
        {isPending && !message.content ? (
          <div className="flex items-center gap-2 text-ink-faint text-sm py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            <span>Thinking…</span>
          </div>
        ) : message.content ? (
          /* Markdown content */
          <div
            className={`text-sm leading-relaxed prose prose-invert prose-zinc max-w-none
              prose-p:my-1.5 prose-headings:my-3 prose-li:my-0.5
              prose-pre:bg-transparent prose-pre:border-0 prose-pre:p-0 prose-pre:my-0
              prose-code:text-accent prose-code:font-medium
              prose-code:before:content-none prose-code:after:content-none
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-table:border-collapse
              prose-th:border prose-th:border-rule-strong prose-th:px-3 prose-th:py-1.5 prose-th:bg-surface-sunken
              prose-td:border prose-td:border-rule prose-td:px-3 prose-td:py-1.5
              prose-strong:text-ink prose-strong:font-semibold
              prose-blockquote:border-rule prose-blockquote:text-ink-muted
              ${isError ? "text-danger" : "text-ink"}`}
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) {
                    return (
                      <CodeBlock className={className}>{children}</CodeBlock>
                    );
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
                pre({ children }) {
                  return <>{children}</>;
                },
              }}
            >
              {message.content}
            </Markdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 align-middle status-pulse" />
            )}
          </div>
        ) : null}

        {/* Error message */}
        {isError && message.error && (
          <div className="flex items-center gap-1.5 text-xs text-danger border border-danger/30 bg-danger/5 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
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
                className="group inline-flex items-center gap-1.5 border border-rule px-3.5 py-2 text-xs text-ink-muted hover:border-rule-strong hover:text-ink transition-all duration-150"
              >
                <ArrowRight className="h-3 w-3 text-ink-faint group-hover:text-accent transition-colors shrink-0" strokeWidth={1.5} />
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
