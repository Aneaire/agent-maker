import { useState } from "react";
import { Sparkles, Check, Lock, ImagePlus } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import {
  IMAGE_GEN_MODELS,
  ASPECT_RATIOS,
  type ImageGenModelEntry,
} from "~/lib/image-gen-constants";

// ── Aspect ratio visual button ─────────────────────────────────────────

function AspectRatioButton({
  ratio,
  selected,
  onClick,
}: {
  ratio: string;
  selected: boolean;
  onClick: () => void;
}) {
  const previewSizes: Record<string, { w: number; h: number }> = {
    "1:1": { w: 18, h: 18 },
    "16:9": { w: 24, h: 14 },
    "9:16": { w: 14, h: 24 },
    "4:3": { w: 22, h: 16 },
    "3:4": { w: 16, h: 22 },
    "21:9": { w: 28, h: 12 },
  };

  const size = previewSizes[ratio] ?? { w: 18, h: 18 };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-3 py-2 transition-all ${
        selected ? "bg-surface-sunken" : "hover:bg-surface-sunken/60"
      }`}
    >
      <div
        className={`border transition-colors ${
          selected ? "border-rule-strong bg-surface-sunken" : "border-rule bg-surface"
        }`}
        style={{ width: size.w, height: size.h }}
      />
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
          selected ? "text-ink" : "text-ink-faint"
        }`}
      >
        {ratio}
      </span>
    </button>
  );
}

// ── Provider icon helpers ──────────────────────────────────────────────

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

function getProviderIcon(group: string) {
  if (group === "Gemini") return GoogleIcon;
  if (group === "Nano Banana") return NanoBananaIcon;
  return GoogleIcon;
}

// ── Main component ────────────────────────────────────────────────────

export function ImageGenReviewPanel({
  messageId,
  toolCallId,
  agentId,
  initialPrompt,
  initialName,
  initialModel,
  inputAssetId,
  configuredImageGenProviders,
}: {
  messageId: Id<"messages">;
  toolCallId: string;
  agentId: Id<"agents">;
  initialPrompt: string;
  initialName: string;
  initialModel?: string;
  inputAssetId?: string;
  configuredImageGenProviders?: string[];
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedModel, setSelectedModel] = useState(
    initialModel || "gemini:imagen-4.0-generate-001"
  );
  const [selectedRatio, setSelectedRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImage = useAction(api.imageGeneration.generate);

  const inputAsset = useQuery(
    api.assets.get,
    inputAssetId ? { assetId: inputAssetId as Id<"assets"> } : "skip"
  );

  const selectedModelEntry = IMAGE_GEN_MODELS.find((m) => m.value === selectedModel);

  async function handleGenerate() {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      await generateImage({
        agentId,
        messageId,
        toolCallId,
        prompt: prompt.trim(),
        name: initialName,
        model: selectedModel,
        aspectRatio: selectedRatio,
        ...(inputAssetId && selectedModelEntry?.supportsImageInput
          ? { inputAssetId: inputAssetId as Id<"assets"> }
          : {}),
      });
    } catch (err: any) {
      setError(err.message || "Image generation failed");
      setIsGenerating(false);
    }
  }

  // Generating shimmer state
  if (isGenerating) {
    return (
      <div className="mt-2">
        <div className="relative border border-rule overflow-hidden bg-surface-sunken">
          <div className="relative h-72 overflow-hidden">
            <div className="absolute inset-0 animate-pulse bg-surface-sunken" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
              <div className="h-10 w-10 border border-rule flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-ink-faint" strokeWidth={1.5} />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-xs text-ink-muted">Generating image…</p>
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

  return (
    <div className="mt-2">
      <div className="border border-rule bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-rule">
          <ImagePlus className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
          <p className="eyebrow">
            {inputAssetId ? "Edit Image" : "Image Generation"}
          </p>
        </div>

        <div className="p-4 space-y-5">
          {/* Source image preview (when editing) */}
          {inputAssetId && (
            <div className="space-y-2">
              <p className="eyebrow">Source Image</p>
              <div className="relative border border-rule overflow-hidden bg-surface-sunken">
                {inputAsset?.resolvedUrl ? (
                  <img
                    src={inputAsset.resolvedUrl}
                    alt="Source image"
                    className="w-full max-h-40 object-contain"
                  />
                ) : (
                  <div className="h-20 flex items-center justify-center">
                    <div className="h-4 w-4 rounded-full border-2 border-rule-strong border-t-transparent animate-spin" />
                  </div>
                )}
                {!selectedModelEntry?.supportsImageInput && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
                    <p className="text-[11px] text-ink-muted text-center px-4">
                      Select a model that supports image input to edit this image
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt */}
          <div className="space-y-2">
            <p className="eyebrow">{inputAssetId ? "Edit Instructions" : "Prompt"}</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors resize-none"
              placeholder={inputAssetId ? "Describe how to edit this image…" : "Describe the image to generate…"}
            />
          </div>

          {/* Models */}
          <div className="space-y-2">
            <p className="eyebrow">Model</p>
            <ol className="divide-y divide-rule border-y border-rule">
              {IMAGE_GEN_MODELS.map((m) => {
                const isSelected = m.value === selectedModel;
                const isDisabled = configuredImageGenProviders !== undefined &&
                  !configuredImageGenProviders.includes(m.provider);
                const ProviderIcon = getProviderIcon(m.group);
                return (
                  <li key={m.value}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && setSelectedModel(m.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                        isDisabled
                          ? "opacity-40 cursor-not-allowed"
                          : isSelected
                            ? "bg-surface-sunken"
                            : "hover:bg-surface-sunken/60"
                      }`}
                    >
                      <div
                        className={`h-7 w-7 border flex items-center justify-center shrink-0 ${
                          isSelected ? "border-rule-strong" : "border-rule"
                        }`}
                      >
                        <ProviderIcon
                          className={`h-3.5 w-3.5 ${
                            isSelected ? "text-ink-muted" : "text-ink-faint"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs ${
                              isDisabled ? "text-ink-faint" : isSelected ? "text-ink" : "text-ink-muted"
                            }`}
                          >
                            {m.label}
                          </span>
                          {m.supportsImageInput && (
                            <span className="eyebrow text-accent">
                              img input
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] ${isDisabled ? "text-ink-faint" : "text-ink-faint"}`}>
                          {isDisabled ? "No API key configured" : m.description}
                        </p>
                      </div>
                      {isDisabled && <Lock className="h-3.5 w-3.5 text-ink-faint shrink-0" strokeWidth={1.5} />}
                      {isSelected && !isDisabled && (
                        <Check className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={2} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-2">
            <p className="eyebrow">Aspect Ratio</p>
            <div className="flex gap-1 border border-rule">
              {Object.keys(ASPECT_RATIOS).map((ratio) => (
                <AspectRatioButton
                  key={ratio}
                  ratio={ratio}
                  selected={selectedRatio === ratio}
                  onClick={() => setSelectedRatio(ratio)}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-danger border border-danger/30 bg-danger/5 px-3 py-2">
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="w-full flex items-center justify-center gap-2 text-xs bg-ink text-surface px-4 py-2.5 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
