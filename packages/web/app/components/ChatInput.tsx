import { useState, useRef } from "react";
import { ArrowUp, Square, MessageSquare, ChevronDown, Sparkles } from "lucide-react";

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6", group: "Claude" },
  { value: "claude-opus-4-6", label: "Opus 4.6", group: "Claude" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5", group: "Claude" },
  { value: "gemini-3.1-pro", label: "Gemini 3.1 Pro", group: "Gemini" },
  { value: "gemini-3-flash", label: "Gemini 3 Flash", group: "Gemini" },
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", group: "Gemini" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", group: "Gemini" },
];

function getModelLabel(value: string) {
  return MODELS.find((m) => m.value === value)?.label ?? value;
}

export function ChatInput({
  onSend,
  onStop,
  isProcessing,
  hasActiveQuestions,
  model,
  onModelChange,
}: {
  onSend: (content: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  hasActiveQuestions?: boolean;
  model?: string;
  onModelChange?: (model: string) => void;
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

  // When questions are active and user hasn't clicked "type own answer"
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
          className={`relative rounded-2xl border bg-zinc-900/80 backdrop-blur-sm transition-all duration-200 ${
            hasContent
              ? "border-zinc-600 shadow-lg shadow-black/20"
              : "border-zinc-800 hover:border-zinc-700"
          }`}
        >
          {/* Textarea */}
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

          {/* Bottom bar: model selector + send */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            {/* Model selector */}
            {model && onModelChange ? (
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => onModelChange(e.target.value)}
                  disabled={isProcessing}
                  className="appearance-none pl-2 pr-6 py-1 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 bg-transparent hover:bg-zinc-800/80 focus:outline-none disabled:opacity-50 transition-all cursor-pointer"
                >
                  <optgroup label="Claude">
                    {MODELS.filter((m) => m.group === "Claude").map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Gemini">
                    {MODELS.filter((m) => m.group === "Gemini").map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-zinc-600 pointer-events-none" />
              </div>
            ) : (
              <div />
            )}

            {/* Send / Stop button */}
            {isProcessing ? (
              <button
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white transition-all"
                title="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!hasContent}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                  hasContent
                    ? "bg-zinc-100 text-zinc-900 hover:bg-white shadow-sm"
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
