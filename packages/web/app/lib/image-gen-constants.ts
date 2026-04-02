export interface ImageGenModelEntry {
  value: string;
  label: string;
  description: string;
  group: "Gemini" | "Nano Banana";
  provider: string;
  type: "image_gen";
  /** Whether this model accepts an input image for editing */
  supportsImageInput: boolean;
}

export const IMAGE_GEN_MODELS: ImageGenModelEntry[] = [
  {
    value: "gemini:imagen-4.0-generate-001",
    label: "Gemini Imagen 4.0",
    description: "High quality image generation",
    group: "Gemini",
    provider: "gemini",
    type: "image_gen",
    supportsImageInput: false,
  },
  {
    value: "gemini:gemini-3.1-flash-image-preview",
    label: "Gemini Flash Image",
    description: "Fast generation with conversational edits",
    group: "Gemini",
    provider: "gemini",
    type: "image_gen",
    supportsImageInput: true,
  },
  {
    value: "nano_banana:generate",
    label: "Nano Banana",
    description: "Fastest, $0.02/image",
    group: "Nano Banana",
    provider: "nano_banana",
    type: "image_gen",
    supportsImageInput: false,
  },
  {
    value: "nano_banana:generate-2",
    label: "Nano Banana 2",
    description: "Balanced, up to 4K, $0.04/image",
    group: "Nano Banana",
    provider: "nano_banana",
    type: "image_gen",
    supportsImageInput: false,
  },
  {
    value: "nano_banana:generate-pro",
    label: "Nano Banana Pro",
    description: "Highest quality, 4K native, $0.09/image",
    group: "Nano Banana",
    provider: "nano_banana",
    type: "image_gen",
    supportsImageInput: false,
  },
];

export const ASPECT_RATIOS: Record<
  string,
  { width: number; height: number; label: string }
> = {
  "1:1": { width: 1024, height: 1024, label: "1:1" },
  "16:9": { width: 1536, height: 864, label: "16:9" },
  "9:16": { width: 864, height: 1536, label: "9:16" },
  "4:3": { width: 1365, height: 1024, label: "4:3" },
  "3:4": { width: 1024, height: 1365, label: "3:4" },
  "21:9": { width: 1536, height: 658, label: "21:9" },
};

export function getImageGenLabel(value: string) {
  return IMAGE_GEN_MODELS.find((m) => m.value === value)?.label ?? "";
}
