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

async function generateWithNanoBanana(
  apiKey: string,
  prompt: string,
  opts: { width?: number; height?: number; model?: string }
): Promise<{ imageBase64: string; mimeType: string }> {
  const res = await fetch("https://api.nanobanana.com/v1/images/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      width: opts.width || 1024,
      height: opts.height || 1024,
      model: opts.model || "default",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Nano Banana API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const image = data.images?.[0] || data.image;
  if (!image) {
    throw new Error("No image returned from Nano Banana API");
  }

  // Nano Banana may return base64 or URL
  if (image.base64) {
    return { imageBase64: image.base64, mimeType: "image/png" };
  } else if (image.url) {
    // Download and convert to base64
    const imgRes = await fetch(image.url);
    const buf = await imgRes.arrayBuffer();
    return {
      imageBase64: Buffer.from(buf).toString("base64"),
      mimeType: imgRes.headers.get("content-type") || "image/png",
    };
  }

  throw new Error("Unexpected Nano Banana response format");
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
  config: ImageGenConfig
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
        const provider = input.provider || config.provider;

        let result: { imageBase64: string; mimeType: string };
        let modelUsed: string;

        if (provider === "gemini") {
          if (!config.geminiApiKey) {
            return { error: "Gemini API key not configured. Ask the user to add it in Settings > Image Generation." };
          }
          modelUsed = "imagen-4.0-generate-001";
          result = await generateWithGemini(config.geminiApiKey, input.prompt, {
            width: input.width,
            height: input.height,
          });
        } else if (provider === "nano_banana") {
          if (!config.nanoBananaApiKey) {
            return { error: "Nano Banana API key not configured. Ask the user to add it in Settings > Image Generation." };
          }
          modelUsed = "nano_banana";
          result = await generateWithNanoBanana(
            config.nanoBananaApiKey,
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
