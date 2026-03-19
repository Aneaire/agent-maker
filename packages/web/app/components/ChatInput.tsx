import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  ArrowUp, Square, MessageSquare, ChevronDown, ChevronUp,
  Eye, Brain, ImagePlus, Search, Lock, Check, Sparkles,
} from "lucide-react";

// ── Provider icons ──────────────────────────────────────────────────────

function AnthropicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm1.21 5.175l-2.33 6.003h4.66l-2.33-6.003z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 11.366v3.38h5.32c-.235 1.395-.945 2.575-2.01 3.37l3.25 2.52c1.895-1.745 2.99-4.315 2.99-7.365 0-.71-.065-1.39-.185-2.045H12v.14zm-7.134 2.15a7.003 7.003 0 010-3.032L1.59 8.01A11.965 11.965 0 000 12c0 1.935.465 3.765 1.29 5.385l3.576-2.87zM12 4.83c1.77 0 3.355.61 4.605 1.8l3.455-3.455C17.955 1.185 15.235 0 12 0 7.31 0 3.255 2.69 1.59 6.615l3.575 2.87C6.145 6.665 8.835 4.83 12 4.83zM12 19.17c-3.165 0-5.855-1.835-6.835-4.655l-3.575 2.87C3.255 21.31 7.31 24 12 24c3.06 0 5.64-.995 7.55-2.73l-3.25-2.52c-.93.6-2.1.975-3.435.975l-.865-.555z" />
    </svg>
  );
}

function NanoBananaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-1.5-1.5L11 14l-2.5-2.5L10 10l2 2 4-4 1.5 1.5L12 15l-1 2z" />
    </svg>
  );
}

// ── Model data ──────────────────────────────────────────────────────────

type ModelCapability = "vision" | "thinking";

interface ModelEntry {
  value: string;
  label: string;
  description: string;
  group: "Claude" | "Gemini";
  tier: string;
  capabilities: ModelCapability[];
  type: "chat";
}

interface ImageGenEntry {
  value: string;
  label: string;
  description: string;
  group: "Gemini" | "Nano Banana";
  provider: string;
  type: "image_gen";
}

type AnyModel = ModelEntry | ImageGenEntry;

const CHAT_MODELS: ModelEntry[] = [
  {
    value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6",
    description: "Balanced speed and capability",
    group: "Claude", tier: "$$", capabilities: ["vision", "thinking"], type: "chat",
  },
  {
    value: "claude-opus-4-6", label: "Claude Opus 4.6",
    description: "Most capable Claude model",
    group: "Claude", tier: "$$$", capabilities: ["vision", "thinking"], type: "chat",
  },
  {
    value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",
    description: "Fastest and most affordable",
    group: "Claude", tier: "$", capabilities: ["vision"], type: "chat",
  },
  {
    value: "gemini-3.1-pro", label: "Gemini 3.1 Pro",
    description: "Most capable Gemini model",
    group: "Gemini", tier: "$$$", capabilities: ["vision", "thinking"], type: "chat",
  },
  {
    value: "gemini-3-flash", label: "Gemini 3 Flash",
    description: "Lightning-fast with agentic capability",
    group: "Gemini", tier: "$$", capabilities: ["vision", "thinking"], type: "chat",
  },
  {
    value: "gemini-2.5-flash", label: "Gemini 2.5 Flash",
    description: "Balanced Gemini model",
    group: "Gemini", tier: "$$", capabilities: ["vision", "thinking"], type: "chat",
  },
];

const IMAGE_GEN_MODELS: ImageGenEntry[] = [
  {
    value: "gemini:imagen-4.0-generate-001", label: "Gemini Imagen 4.0",
    description: "High quality image generation",
    group: "Gemini", provider: "gemini", type: "image_gen",
  },
  {
    value: "nano_banana:generate-2", label: "Nano Banana",
    description: "Fast AI image generation",
    group: "Nano Banana", provider: "nano_banana", type: "image_gen",
  },
];

function getModelLabel(value: string) {
  return CHAT_MODELS.find((m) => m.value === value)?.label ?? value;
}

function getImageGenLabel(value: string) {
  return IMAGE_GEN_MODELS.find((m) => m.value === value)?.label ?? "";
}

function getProviderIcon(group: string) {
  if (group === "Claude") return AnthropicIcon;
  if (group === "Gemini") return GoogleIcon;
  if (group === "Nano Banana") return NanoBananaIcon;
  return GoogleIcon;
}

function TierBadge({ tier }: { tier: string }) {
  const color =
    tier === "$$$" ? "text-amber-400" :
    tier === "$$" ? "text-zinc-400" :
    "text-zinc-600";
  return <span className={`text-[10px] font-mono ${color}`}>{tier}</span>;
}

// ── Model Selector (all-in-one with open/close managed internally) ──────

function ModelDropdown({
  model,
  onModelChange,
  imageGenModel,
  onImageGenModelChange,
  configuredImageGenProviders,
  disabled,
  enabledModels,
}: {
  model: string;
  onModelChange: (model: string) => void;
  imageGenModel?: string;
  onImageGenModelChange?: (model: string) => void;
  configuredImageGenProviders?: string[];
  disabled?: boolean;
  enabledModels?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "Claude" | "Gemini" | "image_gen">("all");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setFilter("all");
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    };
    // Use setTimeout so the opening click doesn't immediately close
    const id = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", handler);
    };
  }, [open, close]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  const visibleChatModels = useMemo(() => {
    if (!enabledModels) return CHAT_MODELS;
    return CHAT_MODELS.filter((m) => enabledModels.includes(m.value));
  }, [enabledModels]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const results: AnyModel[] = [];

    if (filter === "all" || filter === "Claude" || filter === "Gemini") {
      for (const m of visibleChatModels) {
        if (filter !== "all" && m.group !== filter) continue;
        if (q && !m.label.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q)) continue;
        results.push(m);
      }
    }

    if ((filter === "all" || filter === "image_gen") && onImageGenModelChange) {
      for (const m of IMAGE_GEN_MODELS) {
        if (q && !m.label.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q)) continue;
        results.push(m);
      }
    }

    return results;
  }, [search, filter, onImageGenModelChange, visibleChatModels]);

  // Group into two sections: Agent Brain (chat models) and Image Generation
  const sections = useMemo(() => {
    const brainModels: { group: string; models: AnyModel[] }[] = [];
    const imageGenModels: AnyModel[] = [];
    const brainGroups = new Map<string, AnyModel[]>();

    for (const m of filtered) {
      if (m.type === "image_gen") {
        imageGenModels.push(m);
      } else {
        if (!brainGroups.has(m.group)) brainGroups.set(m.group, []);
        brainGroups.get(m.group)!.push(m);
      }
    }

    for (const [group, models] of brainGroups) {
      brainModels.push({ group, models });
    }

    return { brainModels, imageGenModels };
  }, [filtered]);

  const filterTabs: { key: typeof filter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "all", label: "All", icon: Sparkles },
  ];
  if (onImageGenModelChange) {
    filterTabs.push({ key: "image_gen", label: "Image", icon: ImagePlus });
  }
  filterTabs.push(
    { key: "Claude", label: "Claude", icon: AnthropicIcon },
    { key: "Gemini", label: "Gemini", icon: GoogleIcon },
  );

  const imageGenLabel = imageGenModel ? getImageGenLabel(imageGenModel) : "";

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 disabled:opacity-50 transition-all cursor-pointer"
      >
        {getModelLabel(model)}
        {imageGenLabel && (
          <>
            <span className="text-zinc-700">/</span>
            <ImagePlus className="h-2.5 w-2.5 text-violet-400/60" />
            <span className="text-violet-400/60 text-[10px]">{imageGenLabel}</span>
          </>
        )}
        {open ? (
          <ChevronUp className="h-2.5 w-2.5 text-zinc-600" />
        ) : (
          <ChevronDown className="h-2.5 w-2.5 text-zinc-600" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[370px] h-[420px] flex rounded-2xl border border-zinc-800 bg-zinc-950 backdrop-blur-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
          {/* Sidebar */}
          <div className="flex flex-col items-center gap-1 py-3 px-1.5 border-r border-zinc-800/60 bg-zinc-950/80">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = filter === tab.key;
              const isImageTab = tab.key === "image_gen";
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`relative flex items-center justify-center h-9 w-9 rounded-xl transition-all ${
                    isActive
                      ? isImageTab
                        ? "bg-violet-500/15 text-violet-400"
                        : "bg-neon-400/10 text-neon-400"
                      : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60"
                  }`}
                  title={tab.label}
                >
                  {isActive && (
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full ${
                      isImageTab ? "bg-violet-400" : "bg-neon-400"
                    }`} />
                  )}
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  autoFocus
                  className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Model list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {/* ── Agent Brain section ── */}
              {sections.brainModels.length > 0 && (
                <div>
                  <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur px-2 pt-1 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Brain className="h-3 w-3 text-neon-400" />
                      <span className="text-[9px] font-semibold text-neon-400/80 uppercase tracking-wider">Agent Brain</span>
                    </div>
                  </div>
                  {sections.brainModels.map(({ group, models }) => (
                    <div key={group}>
                      <div className="px-2 py-1 text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">
                        {group}
                      </div>
                      {models.map((m) => {
                        const isSelected = m.value === model;
                        const ProviderIcon = getProviderIcon(m.group);
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => onModelChange(m.value)}
                            className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all mb-0.5 ${
                              isSelected
                                ? "bg-neon-400/8 ring-1 ring-neon-400/20"
                                : "hover:bg-zinc-900/80"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-neon-400/10" : "bg-zinc-900"
                            }`}>
                              <ProviderIcon className={`h-4 w-4 ${isSelected ? "text-neon-400" : "text-zinc-500"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[13px] font-medium leading-tight ${
                                  isSelected ? "text-zinc-100" : "text-zinc-300"
                                }`}>{m.label}</span>
                                <TierBadge tier={(m as ModelEntry).tier} />
                              </div>
                              <p className="text-[11px] mt-0.5 leading-tight text-zinc-500">{m.description}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {(m as ModelEntry).capabilities.includes("vision") && (
                                <Eye className={`h-3.5 w-3.5 ${isSelected ? "text-blue-400" : "text-zinc-700"}`} />
                              )}
                              {(m as ModelEntry).capabilities.includes("thinking") && (
                                <Brain className={`h-3.5 w-3.5 ${isSelected ? "text-pink-400" : "text-zinc-700"}`} />
                              )}
                              {isSelected && <Check className="h-3.5 w-3.5 text-neon-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Divider ── */}
              {sections.brainModels.length > 0 && sections.imageGenModels.length > 0 && (
                <div className="mx-2 my-2 border-t border-zinc-800/60" />
              )}

              {/* ── Image Generation section ── */}
              {sections.imageGenModels.length > 0 && (
                <div>
                  <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur px-2 pt-1 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ImagePlus className="h-3 w-3 text-violet-400" />
                      <span className="text-[9px] font-semibold text-violet-400/80 uppercase tracking-wider">Image Generation</span>
                    </div>
                  </div>
                  {sections.imageGenModels.map((m) => {
                    const isSelected = m.value === imageGenModel;
                    const isDisabled = !configuredImageGenProviders?.includes((m as ImageGenEntry).provider);
                    const ProviderIcon = getProviderIcon(m.group);
                    return (
                      <button
                        key={m.value}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (!isDisabled && onImageGenModelChange) onImageGenModelChange(m.value);
                        }}
                        className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all mb-0.5 ${
                          isDisabled
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                              ? "bg-violet-500/8 ring-1 ring-violet-500/20"
                              : "hover:bg-zinc-900/80"
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-violet-500/15" : "bg-zinc-900"
                        }`}>
                          <ProviderIcon className={`h-4 w-4 ${isSelected ? "text-violet-400" : "text-zinc-500"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[13px] font-medium leading-tight ${
                              isDisabled ? "text-zinc-600" : isSelected ? "text-zinc-100" : "text-zinc-300"
                            }`}>{m.label}</span>
                          </div>
                          <p className={`text-[11px] mt-0.5 leading-tight ${
                            isDisabled ? "text-zinc-700" : "text-zinc-500"
                          }`}>
                            {isDisabled ? "No API key configured" : m.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isDisabled && <Lock className="h-3.5 w-3.5 text-zinc-700" />}
                          {isSelected && <Check className="h-3.5 w-3.5 text-violet-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {filtered.length === 0 && (
                <div className="text-center py-6 text-xs text-zinc-600">
                  No models found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ChatInput ───────────────────────────────────────────────────────────

export function ChatInput({
  onSend,
  onStop,
  isProcessing,
  hasActiveQuestions,
  model,
  onModelChange,
  imageGenModel,
  onImageGenModelChange,
  configuredImageGenProviders,
  enabledModels,
}: {
  onSend: (content: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  hasActiveQuestions?: boolean;
  model?: string;
  onModelChange?: (model: string) => void;
  imageGenModel?: string;
  onImageGenModelChange?: (model: string) => void;
  configuredImageGenProviders?: string[];
  enabledModels?: string[];
}) {
  const [value, setValue] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;
    onSend(trimmed);
    setValue("");
    setShowManualInput(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  if (hasActiveQuestions && !showManualInput) {
    return (
      <div className="p-4 pb-5">
        <div className="max-w-3xl mx-auto flex justify-center">
          <button
            onClick={() => {
              setShowManualInput(true);
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 px-4 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-600 bg-zinc-900/50 hover:bg-zinc-900 transition-all"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Type your own answer
          </button>
        </div>
      </div>
    );
  }

  const hasContent = value.trim().length > 0;

  return (
    <div className="p-4 pb-5">
      <div className="max-w-3xl mx-auto">
        <div
          className={`relative rounded-2xl border bg-zinc-900/80 backdrop-blur-sm transition-all duration-300 shadow-inner shadow-black/10 ${
            hasContent
              ? "border-neon-400/30 shadow-lg shadow-neon-400/5"
              : "border-zinc-800 hover:border-zinc-700"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={isProcessing}
            rows={1}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
          />

          <div className="flex items-center justify-between px-3 pb-2.5">
            {model && onModelChange ? (
              <ModelDropdown
                model={model}
                onModelChange={onModelChange}
                imageGenModel={imageGenModel}
                onImageGenModelChange={onImageGenModelChange}
                configuredImageGenProviders={configuredImageGenProviders}
                disabled={isProcessing}
                enabledModels={enabledModels}
              />
            ) : (
              <div />
            )}

            {isProcessing ? (
              <button
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-400 text-zinc-950 hover:bg-neon-300 transition-all"
                title="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!hasContent}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 send-bounce ${
                  hasContent
                    ? "bg-neon-400 text-zinc-950 hover:bg-neon-300 glow-neon-sm"
                    : "bg-zinc-800 text-zinc-600 cursor-default"
                }`}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-700 mt-2.5 select-none">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
