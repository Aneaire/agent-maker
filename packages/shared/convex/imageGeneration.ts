"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { decrypt } from "../src/crypto";

// ── Aspect ratio → dimensions mapping ──────────────────────────────────

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1536, height: 864 },
  "9:16": { width: 864, height: 1536 },
  "4:3": { width: 1365, height: 1024 },
  "3:4": { width: 1024, height: 1365 },
  "21:9": { width: 1536, height: 658 },
};

// ── Nano Banana model configs ──────────────────────────────────────────

const NANO_BANANA_BASE = "https://api.nanobananaapi.ai/api/v1/nanobanana";
const NANO_BANANA_POLL_INTERVAL = 3000;
const NANO_BANANA_MAX_POLLS = 60;

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

// ── Provider generation functions ─────────────────────────────────────

// Gemini Flash image models use generateContent API (not Imagen's predict API)
const GEMINI_FLASH_IMAGE_MODELS = new Set([
  "gemini-3.1-flash-image-preview",
]);

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  opts: { aspectRatio: string; model?: string; inputImageBase64?: string; inputImageMimeType?: string }
): Promise<{ imageBase64: string; mimeType: string }> {
  const model = opts.model || "imagen-4.0-generate-001";

  // Gemini Flash image models use generateContent, not Imagen's predict
  if (GEMINI_FLASH_IMAGE_MODELS.has(model)) {
    // Build parts — include input image first if provided (for editing)
    const parts: any[] = [];
    if (opts.inputImageBase64 && opts.inputImageMimeType) {
      parts.push({ inlineData: { mimeType: opts.inputImageMimeType, data: opts.inputImageBase64 } });
    }
    parts.push({ text: prompt });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini Flash Image API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const resParts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = resParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart?.inlineData) {
      throw new Error("No image returned from Gemini Flash Image API");
    }

    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    };
  }

  // Imagen models use the predict API
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: opts.aspectRatio,
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
  opts: { aspectRatio: string; model?: string }
): Promise<{ imageBase64: string; mimeType: string }> {
  const modelKey = opts.model || "generate-2";
  const modelConfig = NANO_BANANA_MODELS[modelKey] ?? NANO_BANANA_MODELS["generate-2"];

  const body: Record<string, unknown> = { prompt, aspectRatio: opts.aspectRatio };
  if (modelConfig.supportsResolution) {
    body.resolution = modelConfig.defaultResolution;
  }
  if (modelConfig.supportsOutputFormat) {
    body.outputFormat = "png";
  }
  if (modelKey === "generate") {
    body.type = "TEXTTOIAMGE";
    body.image_size = opts.aspectRatio;
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
  }

  throw new Error("Nano Banana image generation timed out");
}

/** Resolve the API key for an image-gen provider in this priority order:
 *   1. Credential linked to the image_generation tool set on this agent,
 *      accepted only if it matches the requested provider (Gemini-family
 *      types → gemini provider; Nano Banana type → nano_banana provider).
 *   2. For Gemini only: the owner's user-scoped `google_ai` credential
 *      (same key that powers chat BYOK — avoid forcing users to store it twice).
 *   3. For Gemini only: process.env.GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY.
 * Returns undefined when nothing is configured. */
async function resolveImageGenApiKey(
  ctx: any,
  agentId: any,
  providerKey: string
): Promise<string | undefined> {
  // Different credential types store the key under different field names
  // (geminiApiKey / nanoBananaApiKey / apiKey). Try each known variant.
  const tryDecryptApiKey = (cred: any): string | undefined => {
    if (!cred?.encryptedData || !cred?.iv) return undefined;
    try {
      const data = JSON.parse(decrypt(cred.encryptedData, cred.iv));
      const k =
        data?.apiKey ??
        data?.geminiApiKey ??
        data?.nanoBananaApiKey ??
        data?.key;
      return typeof k === "string" && k.length > 0 ? k : undefined;
    } catch {
      return undefined;
    }
  };

  // A linked credential is only usable when it matches the requested provider —
  // otherwise a Nano Banana key could be handed to the Gemini API (or vice
  // versa), which would fail with a confusing 401 from the wrong service.
  const credTypeMatchesProvider = (credType: string, provider: string) => {
    if (provider === "gemini") {
      return credType === "image_gen_gemini" || credType === "google_ai";
    }
    if (provider === "nano_banana") {
      return credType === "image_gen_nano_banana";
    }
    return false;
  };

  // (1) Linked image-generation credential
  const link: any = await ctx.runQuery(internal.credentials._getLinkByAgentToolset, {
    agentId,
    toolSetName: "image_generation",
  });
  if (link) {
    const cred: any = await ctx.runQuery(internal.credentials._get, {
      credentialId: link.credentialId,
    });
    if (cred && credTypeMatchesProvider(cred.type, providerKey)) {
      const linkedKey = tryDecryptApiKey(cred);
      if (linkedKey) return linkedKey;
    }
  }

  // (2 / 3) Gemini-only fallbacks. Nano Banana has no sensible fallback —
  // it's a standalone API with no other credential type.
  if (providerKey === "gemini") {
    const agent: any = await ctx.runQuery(internal.agents._get, { agentId });
    if (agent?.userId) {
      const userCred: any = await ctx.runQuery(
        internal.credentials._getUserAiProviderCredential,
        { userId: agent.userId, providerType: "google_ai" }
      );
      const userKey = tryDecryptApiKey(userCred);
      if (userKey) return userKey;
    }
    return (
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
      undefined
    );
  }

  return undefined;
}

/** Diagnostic: report which fallback layer supplies the API key for a given
 * agent + provider, without exposing the key itself. Used by seed tests to
 * verify the chain selects correctly after BYOK was added. */
export const debugResolveImageGenKeySource = action({
  args: {
    agentId: v.id("agents"),
    providerKey: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    source: "linked_credential" | "user_google_ai" | "env" | "none";
    keyLength: number | null;
  }> => {
    const tryDecryptApiKey = (cred: any): string | undefined => {
      if (!cred?.encryptedData || !cred?.iv) return undefined;
      try {
        const data = JSON.parse(decrypt(cred.encryptedData, cred.iv));
        const k =
          data?.apiKey ??
          data?.geminiApiKey ??
          data?.nanoBananaApiKey ??
          data?.key;
        return typeof k === "string" && k.length > 0 ? k : undefined;
      } catch {
        return undefined;
      }
    };
    const credTypeMatchesProvider = (credType: string, provider: string) => {
      if (provider === "gemini") {
        return credType === "image_gen_gemini" || credType === "google_ai";
      }
      if (provider === "nano_banana") {
        return credType === "image_gen_nano_banana";
      }
      return false;
    };

    const link: any = await ctx.runQuery(
      internal.credentials._getLinkByAgentToolset,
      { agentId: args.agentId, toolSetName: "image_generation" }
    );
    if (link) {
      const cred: any = await ctx.runQuery(internal.credentials._get, {
        credentialId: link.credentialId,
      });
      if (cred && credTypeMatchesProvider(cred.type, args.providerKey)) {
        const k = tryDecryptApiKey(cred);
        if (k) return { source: "linked_credential", keyLength: k.length };
      }
    }

    if (args.providerKey === "gemini") {
      const agent: any = await ctx.runQuery(internal.agents._get, {
        agentId: args.agentId,
      });
      if (agent?.userId) {
        const userCred: any = await ctx.runQuery(
          internal.credentials._getUserAiProviderCredential,
          { userId: agent.userId, providerType: "google_ai" }
        );
        const k = tryDecryptApiKey(userCred);
        if (k) return { source: "user_google_ai", keyLength: k.length };
      }
      const env =
        process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (env) return { source: "env", keyLength: env.length };
    }

    return { source: "none", keyLength: null };
  },
});

// ── Main generate action (called from the client UI) ──────────────────

export const generate = action({
  args: {
    agentId: v.id("agents"),
    messageId: v.id("messages"),
    toolCallId: v.string(),
    prompt: v.string(),
    name: v.string(),
    model: v.string(), // e.g. "gemini:imagen-4.0-generate-001" or "nano_banana:generate-2"
    aspectRatio: v.string(), // e.g. "1:1", "16:9"
    folderId: v.optional(v.string()),
    inputAssetId: v.optional(v.id("assets")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; assetId: string }> => {
    const [providerKey, modelId] = args.model.split(":");
    const dims = ASPECT_RATIO_DIMENSIONS[args.aspectRatio] ?? ASPECT_RATIO_DIMENSIONS["1:1"];

    // Resolve API key from credentials or env
    const apiKey = await resolveImageGenApiKey(ctx, args.agentId, providerKey);
    if (!apiKey) {
      if (providerKey === "gemini") {
        throw new Error(
          "No Gemini API key available. Add a Google AI or Gemini Imagen credential in Settings → Credentials, or link one to the Image Generation tool set."
        );
      }
      if (providerKey === "nano_banana") {
        throw new Error(
          "No Nano Banana API key available. Add a Nano Banana credential in Settings → Credentials and link it to the Image Generation tool set."
        );
      }
      throw new Error(`Unknown provider: ${providerKey}`);
    }

    // Fetch input image if provided (for editing workflows)
    let inputImageBase64: string | undefined;
    let inputImageMimeType: string | undefined;
    if (args.inputAssetId) {
      const inputAsset: any = await ctx.runQuery(internal.imageGenerationHelpers._getAsset, {
        assetId: args.inputAssetId,
      });
      if (inputAsset?.storageId) {
        const imageUrl = await ctx.storage.getUrl(inputAsset.storageId);
        if (imageUrl) {
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const buf = await imgRes.arrayBuffer();
            inputImageBase64 = Buffer.from(buf).toString("base64");
            inputImageMimeType = inputAsset.mimeType || imgRes.headers.get("content-type") || "image/png";
          }
        }
      }
    }

    // Generate image
    let result: { imageBase64: string; mimeType: string };

    if (providerKey === "gemini") {
      result = await generateWithGemini(apiKey, args.prompt, {
        aspectRatio: args.aspectRatio,
        model: modelId,
        inputImageBase64,
        inputImageMimeType,
      });
    } else {
      result = await generateWithNanoBanana(apiKey, args.prompt, {
        aspectRatio: args.aspectRatio,
        model: modelId,
      });
    }

    // Upload to Convex storage
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const buffer = Buffer.from(result.imageBase64, "base64");
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": result.mimeType },
      body: buffer,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.status}`);
    }

    const { storageId } = await uploadRes.json();

    // Create asset record
    const modelUsed = providerKey === "gemini"
      ? (modelId || "imagen-4.0-generate-001")
      : `nano_banana_${(modelId || "generate-2").replace(/-/g, "_")}`;

    const assetId = (await ctx.runMutation(internal.imageGenerationHelpers._createAsset, {
      agentId: args.agentId,
      name: args.name,
      storageId,
      mimeType: result.mimeType,
      fileSize: buffer.length,
      generatedBy: providerKey as "gemini" | "nano_banana",
      prompt: args.prompt,
      model: modelUsed,
      width: dims.width,
      height: dims.height,
      ...(args.folderId ? { folderId: args.folderId } : {}),
    })) as string;

    // Update the message's tool call output
    const output = JSON.stringify({
      success: true,
      assetId,
      name: args.name,
      provider: providerKey,
      prompt: args.prompt,
    });

    await ctx.runMutation(internal.imageGenerationHelpers._updateToolCallOutput, {
      messageId: args.messageId,
      toolCallId: args.toolCallId,
      output,
    });

    // Emit event
    await ctx.runMutation(internal.agentEvents.emitInternal, {
      agentId: args.agentId,
      event: "image.generated",
      source: "image_generation_ui",
      payload: {
        assetId,
        name: args.name,
        provider: providerKey,
        prompt: args.prompt,
      },
    });

    return { success: true, assetId };
  },
});
