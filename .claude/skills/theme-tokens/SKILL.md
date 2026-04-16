---
name: theme-tokens
description: Enforce HiGantic semantic design token usage. Use this skill whenever writing or reviewing UI code that might use hardcoded colors (zinc, slate, gray, black, white, any Tailwind color literal). Also use it when creating dialogs, modals, cards, prose/markdown blocks, or any component that needs to adapt to light/dark mode. Trigger on: "match the theme", "use theme tokens", "fix hardcoded colors", "adapt to theme", "make it theme-aware", "dark mode", "light mode support".
---

# HiGantic Theme Token System

HiGantic uses a semantic CSS token system built with `light-dark()`. Every color value is theme-aware — do **not** use raw Tailwind color literals (`zinc-*`, `slate-*`, `gray-*`, `black`, `white`, etc.). Always use the semantic tokens below.

## Token Reference

### Surface (backgrounds)

| Token | Use case |
|---|---|
| `bg-surface` | Page/screen background |
| `bg-surface-raised` | Cards, panels, modals, dropdowns |
| `bg-surface-sunken` | Recessed areas, input backgrounds, code blocks |
| `bg-surface-inverse` | Contrasting overlays (e.g. backdrop: `bg-surface-inverse/50`) |

### Borders

| Token | Use case |
|---|---|
| `border-rule` | Default border between elements |
| `border-rule-strong` | Emphasized borders, active/focused inputs |

### Text

| Token | Use case |
|---|---|
| `text-ink` | Primary body text |
| `text-ink-muted` | Secondary / supporting text |
| `text-ink-faint` | Placeholder, disabled, metadata |
| `text-ink-inverse` | Text on dark/contrasting backgrounds (e.g. on `bg-ink`) |

### Accent & Interactive

| Token | Use case |
|---|---|
| `text-accent` | Links, active states, highlights |
| `bg-accent-soft` | Subtle accent tint (e.g. hover states) |
| `bg-ink` | Solid button backgrounds (e.g. primary CTA) |
| `text-ink-inverse` | Text on `bg-ink` buttons |

## Common Patterns

### Modal / Dialog
```tsx
{/* Backdrop */}
<div className="fixed inset-0 bg-surface-inverse/50 z-50 flex items-center justify-center">
  {/* Panel */}
  <div className="bg-surface-raised border border-rule w-full max-w-2xl ...">
    {/* Header */}
    <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
      <h2 className="text-base font-semibold text-ink">Title</h2>
      <button className="text-ink-faint hover:text-ink">×</button>
    </div>
    {/* Body */}
    <div className="px-6 py-5 text-ink">...</div>
    {/* Footer */}
    <div className="px-6 py-4 border-t border-rule flex justify-end gap-3">
      <button className="text-sm text-ink-muted hover:text-ink">Cancel</button>
      <button className="text-sm bg-ink text-ink-inverse px-4 py-2">Save</button>
    </div>
  </div>
</div>
```

### Input / Textarea
```tsx
<textarea className="w-full bg-surface-sunken border border-rule text-ink placeholder:text-ink-faint focus:border-rule-strong focus:outline-none px-3 py-2 text-sm" />
```

### Card
```tsx
<div className="bg-surface-raised border border-rule p-4">
  <p className="text-sm text-ink">Primary content</p>
  <p className="text-xs text-ink-muted">Supporting detail</p>
</div>
```

### Primary Button
```tsx
<button className="bg-ink text-ink-inverse hover:bg-ink-muted px-4 py-2 text-sm font-medium transition-colors">
  Action
</button>
```

### Ghost Button
```tsx
<button className="text-ink-muted hover:text-ink transition-colors text-sm">
  Cancel
</button>
```

## Prose / Markdown Rendering

When rendering markdown with `react-markdown` and `@tailwindcss/typography`:

**Do NOT use `prose-invert`** — it hardcodes white text and breaks light mode.

Instead, use `prose` alone and override each element with semantic tokens:

```tsx
<div className="prose prose-sm max-w-none
  prose-headings:text-ink prose-headings:font-semibold
  prose-p:text-ink prose-p:leading-relaxed
  prose-strong:text-ink prose-strong:font-semibold
  prose-code:text-ink prose-code:bg-surface-sunken prose-code:px-1
  prose-pre:bg-surface-sunken prose-pre:border prose-pre:border-rule
  prose-li:text-ink prose-li:marker:text-ink-faint
  prose-blockquote:text-ink-muted prose-blockquote:border-l-rule
  prose-a:text-accent prose-a:no-underline hover:prose-a:underline">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
</div>
```

## What to Replace

| Hardcoded (wrong) | Semantic token (correct) |
|---|---|
| `bg-zinc-900`, `bg-zinc-950` | `bg-surface` |
| `bg-zinc-800`, `bg-zinc-900/50` | `bg-surface-raised` or `bg-surface-sunken` |
| `bg-black/70`, `bg-gray-900/80` | `bg-surface-inverse/50` |
| `border-zinc-700`, `border-zinc-800` | `border-rule` |
| `border-zinc-600` | `border-rule-strong` |
| `text-white`, `text-zinc-100` | `text-ink` |
| `text-zinc-400`, `text-zinc-500` | `text-ink-muted` |
| `text-zinc-600`, `text-zinc-700` | `text-ink-faint` |
| `text-zinc-900` (on light bg) | `text-ink-inverse` |
| `prose prose-invert` | `prose` + per-element semantic overrides |

## Key Rule

If a component uses any raw color like `zinc-*`, `slate-*`, `gray-*`, `neutral-*`, `stone-*`, `black`, or `white` — replace it with the appropriate semantic token. The entire design system is built on these tokens so that a single CSS variable change (in `styles.css`) updates every component at once.
