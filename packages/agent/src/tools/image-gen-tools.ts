import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

interface ImageGenConfig {
  provider: "gemini" | "nano_banana";
  geminiApiKey?: string;
  nanoBananaApiKey?: string;
}

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  opts: { width?: number; height?: number; model?: string }
): Promise<{ imageBase64: string; mimeType: string }> {
  const model = opts.model || "imagen-4.0-generate-001";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          ...(opts.width && opts.height
            ? { aspectRatio: getAspectRatio(opts.width, opts.height) }
            : {}),
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Imagen API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error("No image returned from Gemini Imagen API");
  }

  return {
    imageBase64: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType || "image/png",
  };
}

const NANO_BANANA_BASE = "https://api.nanobananaapi.ai/api/v1/nanobanana";
const NANO_BANANA_POLL_INTERVAL = 3000; // 3s
const NANO_BANANA_MAX_POLLS = 60; // 3 min max

// Maps model IDs to their API endpoint paths and supported features
const NANO_BANANA_MODELS: Record<string, {
  endpoint: string;
  supportsResolution: boolean;
  supportsOutputFormat: boolean;
  defaultResolution: string;
}> = {
  "generate": {
    endpoint: "/generate",
    supportsResolution: false,
    supportsOutputFormat: false,
    defaultResolution: "1K",
  },
  "generate-2": {
    endpoint: "/generate-2",
    supportsResolution: true,
    supportsOutputFormat: true,
    defaultResolution: "1K",
  },
  "generate-pro": {
    endpoint: "/generate-pro",
    supportsResolution: true,
    supportsOutputFormat: false,
    defaultResolution: "2K",
  },
};

async function generateWithNanoBanana(
  apiKey: string,
  prompt: string,
  opts: { width?: number; height?: number; model?: string }
): Promise<{ imageBase64: string; mimeType: string }> {
  const modelKey = opts.model || "generate-2";
  const modelConfig = NANO_BANANA_MODELS[modelKey] ?? NANO_BANANA_MODELS["generate-2"];

  // Step 1: Submit generation task
  const aspectRatio = opts.width && opts.height
    ? getAspectRatio(opts.width, opts.height)
    : "1:1";

  // Build request body based on endpoint capabilities
  const body: Record<string, unknown> = { prompt, aspectRatio };
  if (modelConfig.supportsResolution) {
    body.resolution = modelConfig.defaultResolution;
  }
  if (modelConfig.supportsOutputFormat) {
    body.outputFormat = "png";
  }
  // v1 endpoint uses different field names
  if (modelKey === "generate") {
    body.type = "TEXTTOIAMGE";
    body.image_size = aspectRatio;
    delete body.aspectRatio;
  }

  const submitRes = await fetch(`${NANO_BANANA_BASE}${modelConfig.endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Nano Banana API error (${submitRes.status}): ${err}`);
  }

  const submitData = await submitRes.json();
  const taskId = submitData.data?.taskId;
  if (!taskId) {
    throw new Error("No taskId returned from Nano Banana API");
  }

  // Step 2: Poll for completion
  for (let i = 0; i < NANO_BANANA_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, NANO_BANANA_POLL_INTERVAL));

    const pollRes = await fetch(
      `${NANO_BANANA_BASE}/record-info?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status = pollData.data?.successFlag ?? pollData.successFlag;

    if (status === 1) {
      // Success — download the result image
      const imageUrl =
        pollData.data?.response?.resultImageUrl ??
        pollData.response?.resultImageUrl;
      if (!imageUrl) throw new Error("Nano Banana returned success but no image URL");

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`);
      const buf = await imgRes.arrayBuffer();
      return {
        imageBase64: Buffer.from(buf).toString("base64"),
        mimeType: imgRes.headers.get("content-type") || "image/png",
      };
    } else if (status === 2 || status === 3) {
      const errMsg = pollData.data?.errorMessage ?? pollData.errorMessage ?? "Unknown error";
      throw new Error(`Nano Banana generation failed: ${errMsg}`);
    }
    // status 0 = still generating, keep polling
  }

  throw new Error("Nano Banana image generation timed out");
}

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio >= 1.7) return "16:9";
  if (ratio >= 1.4) return "3:2";
  if (ratio >= 1.2) return "4:3";
  if (ratio >= 0.9) return "1:1";
  if (ratio >= 0.7) return "3:4";
  if (ratio >= 0.6) return "2:3";
  return "9:16";
}

async function uploadBase64ToConvex(
  convexClient: AgentConvexClient,
  base64: string,
  mimeType: string
): Promise<string> {
  const uploadUrl = await convexClient.getAssetUploadUrl();
  const buffer = Buffer.from(base64, "base64");

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: buffer,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }

  const { storageId } = await res.json();
  return storageId;
}

export function createImageGenTools(
  convexClient: AgentConvexClient,
  agentId: string,
  config: ImageGenConfig,
  imageGenModel?: string,
  onProgress?: (toolName: string, progress: string) => void
) {
  const reportProgress = (msg: string) => onProgress?.("generate_image", msg);
  const generateImage = tool(
    "generate_image",
    "Generate an image from a text prompt using AI. The image is saved to the agent's assets library. Returns the asset ID and URL.",
    {
      prompt: z
        .string()
        .describe("Detailed description of the image to generate. Be specific about style, composition, colors, lighting, and subject matter."),
      name: z
        .string()
        .describe("A short descriptive name for the image (used as filename)"),
      provider: z
        .enum(["gemini", "nano_banana"])
        .optional()
        .describe("Which provider to use. Defaults based on config."),
      width: z.number().optional().describe("Image width in pixels (default: 1024)"),
      height: z.number().optional().describe("Image height in pixels (default: 1024)"),
      folder_id: z
        .string()
        .optional()
        .describe("Optional folder ID to save the image in"),
      input_asset_id: z
        .string()
        .optional()
        .describe("Asset ID of an existing image to use as input for editing. Only supported by models with image input capability (e.g. Gemini Flash Image)."),
    },
    async (input) => {
      // Determine provider + model from settings for the pending_approval response
      let provider: string | undefined;
      let modelOverride: string | undefined;

      if (imageGenModel) {
        const [p, m] = imageGenModel.split(":");
        if (p === "gemini" || p === "nano_banana") {
          provider = p;
          modelOverride = m;
        }
      }

      if (!provider) {
        provider = input.provider || config.provider;
      }

      // Auto-detect from available keys
      if (!provider) {
        if (config.nanoBananaApiKey) provider = "nano_banana";
        else if (config.geminiApiKey || process.env.GEMINI_API_KEY) provider = "gemini";
        else provider = "gemini";
      }

      const modelValue = provider === "gemini"
        ? `gemini:${modelOverride || "imagen-4.0-generate-001"}`
        : `nano_banana:${modelOverride || "generate-2"}`;

      // Return pending_approval — the UI will show a review panel for the user
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          status: "pending_approval",
          prompt: input.prompt,
          name: input.name,
          model: modelValue,
          width: input.width || 1024,
          height: input.height || 1024,
          folder_id: input.folder_id,
          input_asset_id: input.input_asset_id,
        }) }],
      };
    }
  );

  const listAssets = tool(
    "list_assets",
    "List all generated images and files in the agent's asset library.",
    {
      type: z
        .enum(["image", "file"])
        .optional()
        .describe("Filter by asset type"),
    },
    async (input) => {
      const assets = await convexClient.listAssets(agentId);
      const filtered = input.type
        ? (assets as any[]).filter((a: any) => a.type === input.type)
        : assets;

      const assetList = (filtered as any[]).map((a: any) =>
        `- ${a.name} (${a.type}) ${a.generatedBy ? `[${a.generatedBy}]` : ""}`
      ).join("\n");

      return {
        content: [{ type: "text" as const, text: `Assets (${(filtered as any[]).length}):\n${assetList || "No assets found."}` }],
      };
    }
  );

  const tools = [generateImage, listAssets];

  return tools;
}
