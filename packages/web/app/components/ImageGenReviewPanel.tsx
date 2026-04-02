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
  // Visual dimensions for the ratio preview boxes
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
      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all ${
        selected
          ? "bg-neon-400/10 ring-1 ring-neon-400/30"
          : "hover:bg-zinc-800/60"
      }`}
    >
      <div
        className={`rounded-sm border transition-colors ${
          selected
            ? "border-neon-400/60 bg-neon-400/10"
            : "border-zinc-600 bg-zinc-800/40"
        }`}
        style={{ width: size.w, height: size.h }}
      />
      <span
        className={`text-[10px] font-medium ${
          selected ? "text-neon-400" : "text-zinc-500"
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

  // Fetch the input asset for display (when editing an existing image)
  const inputAsset = useQuery(
    api.assets.get,
    inputAssetId ? { assetId: inputAssetId as Id<"assets"> } : "skip"
  );

  // The selected model's metadata
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

  // Show generating shimmer state
  if (isGenerating) {
    return (
      <div className="mt-2">
        <div className="relative rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/40">
          <div className="relative h-72 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(24,24,27,1) 0%, rgba(39,39,42,0.8) 25%, rgba(24,24,27,1) 50%, rgba(39,39,42,0.6) 75%, rgba(24,24,27,1) 100%)",
                backgroundSize: "400% 400%",
                animation: "shimmer-bg 3s ease-in-out infinite",
              }}
            />
            <div
              className="absolute w-32 h-32 rounded-full opacity-20 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, var(--color-neon-400) 0%, transparent 70%)",
                top: "20%",
                left: "30%",
                animation: "float-orb-1 4s ease-in-out infinite",
              }}
            />
            <div
              className="absolute w-24 h-24 rounded-full opacity-15 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(168,85,247,0.8) 0%, transparent 70%)",
                bottom: "20%",
                right: "25%",
                animation: "float-orb-2 5s ease-in-out infinite",
              }}
            />
            <div
              className="absolute inset-x-0 h-px opacity-20"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--color-neon-400), transparent)",
                animation: "scan-line 2.5s ease-in-out infinite",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
              <div
                className="h-12 w-12 rounded-xl bg-neon-400/10 border border-neon-400/20 flex items-center justify-center"
                style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
              >
                <Sparkles className="h-6 w-6 text-neon-400" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-xs font-medium text-zinc-300">
                  Generating image...
                </p>
                <p className="text-[11px] text-zinc-500 max-w-xs line-clamp-2 leading-relaxed">
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
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/40">
          <ImagePlus className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-semibold text-zinc-300">
            {inputAssetId ? "Edit Image" : "Image Generation"}
          </span>
        </div>

        <div className="p-4 space-y-4">
          {/* Source image preview (when editing) */}
          {inputAssetId && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Source Image
              </label>
              <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/40">
                {inputAsset?.resolvedUrl ? (
                  <img
                    src={inputAsset.resolvedUrl}
                    alt="Source image"
                    className="w-full max-h-40 object-contain"
                  />
                ) : (
                  <div className="h-20 flex items-center justify-center">
                    <div className="h-4 w-4 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
                  </div>
                )}
                {!selectedModelEntry?.supportsImageInput && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 rounded-xl">
                    <p className="text-[11px] text-zinc-400 text-center px-4">
                      Select a model that supports image input to edit this image
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              {inputAssetId ? "Edit Instructions" : "Prompt"}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors resize-none"
              placeholder={inputAssetId ? "Describe how to edit this image..." : "Describe the image to generate..."}
            />
          </div>

          {/* Models */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Model
            </label>
            <div className="space-y-1">
              {IMAGE_GEN_MODELS.map((m) => {
                const isSelected = m.value === selectedModel;
                const isDisabled = configuredImageGenProviders !== undefined &&
                  !configuredImageGenProviders.includes(m.provider);
                const ProviderIcon = getProviderIcon(m.group);
                return (
                  <button
                    key={m.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setSelectedModel(m.value)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                      isDisabled
                        ? "opacity-40 cursor-not-allowed"
                        : isSelected
                          ? "bg-violet-500/8 ring-1 ring-violet-500/20"
                          : "hover:bg-zinc-800/60"
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-violet-500/15" : "bg-zinc-800"
                      }`}
                    >
                      <ProviderIcon
                        className={`h-3.5 w-3.5 ${
                          isSelected ? "text-violet-400" : "text-zinc-500"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[12px] font-medium ${
                            isDisabled ? "text-zinc-600" : isSelected ? "text-zinc-100" : "text-zinc-300"
                          }`}
                        >
                          {m.label}
                        </span>
                        {m.supportsImageInput && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/20 uppercase tracking-wide">
                            img input
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] ${isDisabled ? "text-zinc-700" : "text-zinc-500"}`}>
                        {isDisabled ? "No API key configured" : m.description}
                      </p>
                    </div>
                    {isDisabled && <Lock className="h-3.5 w-3.5 text-zinc-700 shrink-0" />}
                    {isSelected && !isDisabled && (
                      <Check className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Aspect Ratio
            </label>
            <div className="flex gap-1">
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
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="w-full flex items-center justify-center gap-2 text-xs bg-zinc-100 text-zinc-900 px-4 py-2.5 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
