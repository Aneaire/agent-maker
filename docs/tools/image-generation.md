# Image Generation

**Tool set name**: `image_generation`
**Default**: Disabled
**Requires**: At least one provider API key (Gemini or Nano Banana)

Generate images from text prompts using AI. Generated images are stored in the agent's Assets library with prompt metadata for reference.

## Setup

1. Go to your agent's **Settings** page
2. Enable the **Image Generation** tool set
3. Configure:
   - **Provider** — Choose `gemini` or `nano_banana` as the default provider
   - **Gemini API Key** — Required if using Gemini (uses Imagen 4.0)
   - **Nano Banana API Key** — Required if using Nano Banana

You can configure both providers and select per-request, or set a default.

## Tools

| Tool | Description |
|------|-------------|
| `generate_image` | Generate an image from a text prompt and save it to the assets library |
| `list_assets` | List all generated images and files in the agent's asset library |

### generate_image Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Detailed description of the image to generate |
| `name` | string | Yes | Short descriptive name (used as filename) |
| `provider` | string | No | Override the default provider (`gemini` or `nano_banana`) |
| `width` | number | No | Image width in pixels (default: 1024) |
| `height` | number | No | Image height in pixels (default: 1024) |
| `folder_id` | string | No | Asset folder to save the image in |

## Event Bus Integration

The following events are emitted:
- `image.generated` — Image successfully generated and saved to assets

## Example Usage

**User**: "Generate a logo for my coffee shop called Sunrise Brew"

**Agent**: Uses `generate_image` with a detailed prompt describing the logo style, colors, and composition. The image is saved to the assets library.

**User**: "Show me all the images you've generated"

**Agent**: Uses `list_assets` with type `image` to list all generated images with their prompts and creation dates.

## Notes

- Gemini uses Imagen 4.0 and maps width/height to the nearest supported aspect ratio (16:9, 3:2, 4:3, 1:1, 3:4, 2:3, 9:16)
- Nano Banana accepts arbitrary width/height values
- All generated images are uploaded to Convex storage and tracked in the assets table with the original prompt
