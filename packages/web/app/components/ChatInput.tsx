import { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowUp, Square, MessageSquare, Sparkles,
  Paperclip, X, FileText, Image as ImageIcon, Loader2,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { ModelDropdown, CHAT_MODELS } from "~/components/ModelDropdown";

// ── Types ──────────────────────────────────────────────────────────────

export interface ChatAttachment {
  storageId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

interface PendingAttachment extends ChatAttachment {
  previewUrl?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/markdown", "text/csv", "application/json",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Image Picker Button ─────────────────────────────────────────────────

function ImagePickerButton({
  agentId,
  onSelect,
  disabled,
}: {
  agentId: string;
  onSelect: (attachment: PendingAttachment) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const images = useQuery(api.assets.list, { agentId: agentId as any });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const id = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", handler);
    };
  }, [open]);

  const imageAssets = (images ?? [])
    .filter((a: any) => a.type === "image" && a.resolvedUrl)
    .sort((a: any, b: any) => b.createdAt - a.createdAt);

  if (!imageAssets.length && images !== undefined) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title="Reference a generated image"
        className="flex items-center justify-center h-7 w-7 text-ink-faint hover:text-ink disabled:opacity-40 transition-colors"
      >
        <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-surface-raised border border-rule shadow-xl shadow-surface-inverse/10 z-50 overflow-hidden rise">
          <div className="px-3 py-2 border-b border-rule">
            <p className="eyebrow">Generated images</p>
          </div>
          <div className="p-2 max-h-56 overflow-y-auto">
            {images === undefined ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-ink-faint" strokeWidth={1.5} />
              </div>
            ) : imageAssets.length === 0 ? (
              <p className="text-sm text-ink-faint text-center py-4">
                No images generated yet
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {imageAssets.map((asset: any) => (
                  <button
                    key={asset._id}
                    type="button"
                    onClick={() => {
                      onSelect({
                        storageId: asset.storageId,
                        fileName: asset.name,
                        contentType: asset.mimeType || "image/png",
                        fileSize: asset.fileSize || 0,
                        previewUrl: asset.resolvedUrl,
                      });
                      setOpen(false);
                    }}
                    className="relative aspect-square overflow-hidden hover:outline hover:outline-1 hover:outline-accent transition-all group"
                  >
                    <img
                      src={asset.resolvedUrl}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-surface-inverse/0 group-hover:bg-surface-inverse/20 transition-colors" />
                  </button>
                ))}
              </div>
            )}
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
  enabledModels,
  agentId,
  lockModelDuringProcessing = true,
}: {
  onSend: (content: string, attachments?: ChatAttachment[]) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  hasActiveQuestions?: boolean;
  model?: string;
  onModelChange?: (model: string) => void;
  enabledModels?: string[];
  agentId?: string;
  /** When false, the model picker stays clickable even while a response is streaming. Defaults to true. */
  lockModelDuringProcessing?: boolean;
}) {
  const [value, setValue] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const aiProviders = useQuery(api.credentials.listAiProviders);
  const credentialFilteredModels = useMemo(() => {
    if (!aiProviders || aiProviders.length === 0) return undefined;
    const GROUP_TO_CRED: Record<string, string> = {
      Claude: "anthropic",
      Gemini: "google_ai",
      OpenAI: "openai",
    };
    return CHAT_MODELS
      .filter((m) => {
        const credType = GROUP_TO_CRED[m.group];
        return credType ? aiProviders.includes(credType) : true;
      })
      .map((m) => m.value);
  }, [aiProviders]);

  const effectiveEnabledModels = useMemo(() => {
    if (!credentialFilteredModels && !enabledModels) return undefined;
    const base = enabledModels ?? CHAT_MODELS.map((m) => m.value);
    if (!credentialFilteredModels) return base;
    return base.filter((v) => credentialFilteredModels.includes(v));
  }, [enabledModels, credentialFilteredModels]);

  const hasNoCredentials = aiProviders !== undefined && aiProviders.length === 0;

  async function uploadFile(file: File): Promise<PendingAttachment | null> {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      console.warn(`Unsupported file type: ${file.type}`);
      return null;
    }
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`File too large: ${formatFileSize(file.size)} (max ${formatFileSize(MAX_FILE_SIZE)})`);
      return null;
    }

    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await result.json();

    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;

    return {
      storageId,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      previewUrl,
    };
  }

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      const results = await Promise.all(
        Array.from(files).slice(0, 5).map(uploadFile)
      );
      const uploaded = results.filter(Boolean) as PendingAttachment[];
      if (uploaded.length > 0) {
        setAttachments((prev) => [...prev, ...uploaded]);
      }
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit() {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || isProcessing) return;

    const finalAttachments = attachments.length > 0
      ? attachments.map(({ storageId, fileName, contentType, fileSize }) => ({
          storageId,
          fileName,
          contentType,
          fileSize,
        }))
      : undefined;

    onSend(trimmed || "(attached files)", finalAttachments);
    setValue("");
    setAttachments([]);
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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  if (hasActiveQuestions && !showManualInput) {
    return (
      <div className="border-t border-rule px-6 py-4">
        <div className="max-w-3xl mx-auto flex justify-center">
          <button
            onClick={() => {
              setShowManualInput(true);
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
            className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
            Type your own answer
          </button>
        </div>
      </div>
    );
  }

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  return (
    <div className="border-t border-rule px-6 py-4">
      <div className="max-w-3xl mx-auto">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative bg-surface-raised border transition-colors ${
            dragOver
              ? "border-accent bg-accent-soft/30"
              : hasContent
                ? "border-rule-strong"
                : "border-rule hover:border-rule-strong"
          }`}
        >
          {dragOver && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="inline-flex items-center gap-2 text-accent text-sm font-medium">
                <Paperclip className="h-4 w-4" strokeWidth={1.5} />
                Drop files here
              </div>
            </div>
          )}

          {/* Attachment preview strip */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 px-4 pt-3 pb-1 overflow-x-auto">
              {attachments.map((att, i) => (
                <div key={i} className="relative shrink-0 group/att">
                  {att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.fileName}
                      className="h-16 w-16 object-cover border border-rule"
                    />
                  ) : (
                    <div className="h-16 w-20 border border-rule bg-surface-sunken flex flex-col items-center justify-center gap-1 px-1">
                      <FileText className="h-4 w-4 text-ink-faint" strokeWidth={1.5} />
                      <span className="text-2xs text-ink-faint truncate w-full text-center">
                        {att.fileName}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-surface-raised border border-rule flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity hover:border-danger"
                  >
                    <X className="h-3 w-3 text-ink-muted" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
              {uploading && (
                <div className="h-16 w-16 border border-rule bg-surface-sunken flex items-center justify-center shrink-0">
                  <Loader2 className="h-4 w-4 text-ink-faint animate-spin" strokeWidth={1.5} />
                </div>
              )}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message"
            disabled={isProcessing}
            rows={1}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
          />

          <div className="flex items-center justify-between px-3 pb-2.5 border-t border-rule pt-2">
            <div className="flex items-center gap-1">
              {model && onModelChange ? (
                <ModelDropdown
                  model={model}
                  onModelChange={onModelChange}
                  disabled={lockModelDuringProcessing ? isProcessing : false}
                  enabledModels={effectiveEnabledModels}
                  credentialsBannerUrl={hasNoCredentials ? "/credentials" : undefined}
                />
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || uploading}
                className="flex items-center justify-center h-7 w-7 text-ink-faint hover:text-ink disabled:opacity-40 transition-colors"
                title="Attach files"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleFileInputChange}
                className="hidden"
              />

              {agentId && (
                <ImagePickerButton
                  agentId={agentId}
                  disabled={isProcessing}
                  onSelect={(att) => setAttachments((prev) => [...prev, att])}
                />
              )}
            </div>

            {isProcessing ? (
              <button
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center bg-ink text-ink-inverse hover:bg-ink-muted rounded-sm transition-colors"
                title="Stop generating"
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!hasContent}
                className={`flex h-8 w-8 items-center justify-center rounded-sm transition-colors send-bounce ${
                  hasContent
                    ? "bg-ink text-ink-inverse hover:bg-ink-muted"
                    : "bg-surface-sunken text-ink-faint cursor-default"
                }`}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-2xs text-ink-faint mt-2.5 select-none">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
