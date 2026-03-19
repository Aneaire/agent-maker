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

async function generateWithNanoBanana(
  apiKey: string,
  prompt: string,
  opts: { width?: number; height?: number; model?: string }
): Promise<{ imageBase64: string; mimeType: string }> {
  // Step 1: Submit generation task
  const aspectRatio = opts.width && opts.height
    ? getAspectRatio(opts.width, opts.height)
    : "1:1";

  const submitRes = await fetch(`${NANO_BANANA_BASE}/generate-2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      aspectRatio,
      resolution: "1K",
      outputFormat: "png",
    }),
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
  imageGenModel?: string
) {
  const tools = [];

  tools.push(
    tool({
      name: "generate_image",
      description:
        "Generate an image from a text prompt using AI. The image is saved to the agent's assets library. Returns the asset ID and URL.",
      schema: z.object({
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
      }),
      execute: async (input) => {
        // Determine provider: explicit input > imageGenModel setting > config default > auto-detect from keys
        let provider = input.provider || config.provider;
        let modelOverride: string | undefined;

        // Use imageGenModel setting if no explicit provider in input
        if (!input.provider && imageGenModel) {
          const [p, m] = imageGenModel.split(":");
          if (p === "gemini" || p === "nano_banana") {
            provider = p;
            modelOverride = m;
          }
        }

        // Resolve API keys: credential system first, then env var fallback
        const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
        const nanoBananaApiKey = config.nanoBananaApiKey;

        // Auto-detect provider from available API keys if still not set
        if (!provider) {
          if (nanoBananaApiKey) provider = "nano_banana";
          else if (geminiApiKey) provider = "gemini";
        }

        let result: { imageBase64: string; mimeType: string };
        let modelUsed: string;

        if (provider === "gemini") {
          if (!geminiApiKey) {
            return { error: "Gemini API key not configured. Set GEMINI_API_KEY or add it in Settings > Image Generation." };
          }
          modelUsed = modelOverride || "imagen-4.0-generate-001";
          result = await generateWithGemini(geminiApiKey, input.prompt, {
            width: input.width,
            height: input.height,
            model: modelUsed,
          });
        } else if (provider === "nano_banana") {
          if (!nanoBananaApiKey) {
            return { error: "Nano Banana API key not configured. Add it in Settings > Image Generation." };
          }
          modelUsed = "nano_banana_generate_2";
          result = await generateWithNanoBanana(
            nanoBananaApiKey,
            input.prompt,
            { width: input.width, height: input.height }
          );
        } else {
          return { error: `Unknown provider: ${provider}` };
        }

        // Upload to Convex storage
        const storageId = await uploadBase64ToConvex(
          convexClient,
          result.imageBase64,
          result.mimeType
        );

        // Create asset record
        const assetId = await convexClient.createAsset(agentId, {
          name: input.name,
          type: "image",
          storageId,
          mimeType: result.mimeType,
          fileSize: Buffer.from(result.imageBase64, "base64").length,
          generatedBy: provider,
          prompt: input.prompt,
          model: modelUsed,
          width: input.width || 1024,
          height: input.height || 1024,
          ...(input.folder_id ? { folderId: input.folder_id } : {}),
        });

        // Emit event
        await convexClient.emitEvent(agentId, "image.generated", "image_gen_tools", {
          assetId,
          name: input.name,
          provider,
          prompt: input.prompt,
        });

        return {
          success: true,
          assetId,
          name: input.name,
          provider,
          message: `Image "${input.name}" generated successfully and saved to assets.`,
        };
      },
    })
  );

  tools.push(
    tool({
      name: "list_assets",
      description: "List all generated images and files in the agent's asset library.",
      schema: z.object({
        type: z
          .enum(["image", "file"])
          .optional()
          .describe("Filter by asset type"),
      }),
      execute: async (input) => {
        const assets = await convexClient.listAssets(agentId);
        const filtered = input.type
          ? (assets as any[]).filter((a: any) => a.type === input.type)
          : assets;

        return {
          count: (filtered as any[]).length,
          assets: (filtered as any[]).map((a: any) => ({
            id: a._id,
            name: a.name,
            type: a.type,
            url: a.resolvedUrl || a.url,
            generatedBy: a.generatedBy,
            prompt: a.prompt,
            createdAt: a.createdAt,
          })),
        };
      },
    })
  );

  return tools;
}
