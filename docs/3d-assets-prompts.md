# 3D Asset Generation Prompts for HiGantic Homepage

## Concept: "The Neural Nexus"

A floating, interconnected 3D scene where a central AI core (hexagonal, matching the HiGantic logo) orbits with tool nodes, data streams, and agent avatars. The aesthetic is **dark matte surfaces + neon emerald (#34d399) edge-lit wireframes + subtle volumetric light**. Think Blender Cycles/Eevee with a studio-dark HDRI.

### Integration Plan
The 3D scene sits in the **Hero section** as an interactive Three.js canvas behind/beside the headline. On scroll, sections trigger different camera angles or reveal new parts of the scene. The scene reacts to mouse movement with subtle parallax.

### Color Palette (match to CSS theme)
- **Primary glow**: `#34d399` (neon-400 emerald)
- **Secondary glow**: `#10b981` (neon-500 deeper emerald)
- **Surface dark**: `#09090b` (zinc-950)
- **Surface mid**: `#18181b` (zinc-900)
- **Wireframe/edge**: `#34d399` at 30-50% opacity
- **Accent purple**: `#a78bfa` (for memory/brain elements)
- **Accent blue**: `#60a5fa` (for data/search elements)
- **Accent amber**: `#fbbf24` (for automation/schedule elements)

---

## Asset 1: Central Core — "The Nexus"

**Purpose**: Hero background centerpiece. Represents the HiGantic platform engine.

**Prompt:**
```
A floating 3D hexagonal core structure inspired by a futuristic AI processor. The shape is a chamfered hexagonal prism with internal layered geometry visible through semi-transparent matte dark panels. Edges and internal wireframe structures emit a soft emerald green glow (#34d399). The core slowly rotates. Internal micro-circuits and node connections are visible through the glass-like panels. Tiny particles of light orbit the core in elliptical paths. Dark matte gunmetal surface with subsurface scattering where the green light hits. Studio-dark environment with no visible background — just the object floating in pure black (#09090b). Rendered in a modern 3D style, clean topology, no noise. Format: GLB/GLTF optimized for web. Camera angle: 3/4 view, slightly above.
```

**Specifications:**
- Format: `.glb` (compressed GLTF)
- Polycount target: < 15K triangles
- Textures: Baked emissive map for green glow, roughness map for matte panels
- Size: Fits in a ~400x400px area on screen
- Animation-ready: Separate meshes for core, inner rings, and particle orbit paths

---

## Asset 2: Orbiting Tool Nodes — "Satellites"

**Purpose**: 6-8 small objects that orbit the central core. Each represents a tool category (Memory, Search, Pages, Email, Automation, API). They float into view as the user scrolls into the features section.

**Prompt (generate each individually):**

### 2A — Memory Node (Brain)
```
A small 3D stylized brain shape, geometric and low-poly with clean topology. Dark matte charcoal surface (#18181b) with glowing purple (#a78bfa) wireframe edges and synaptic connection lines on the surface. Subtle pulse glow animation on the neural pathways. No background, floating in void. Size: thumbnail-scale, approximately 80x80px on screen. Clean, minimal, icon-like. Format: GLB optimized for web.
```

### 2B — Search Node (Globe)
```
A small 3D wireframe globe/sphere with latitude and longitude lines. Dark matte surface with emerald green (#34d399) glowing grid lines. A single scanning ring orbits around the equator emitting soft light. Particles trail behind the ring. Minimal, geometric, icon-scale. No background, void. Format: GLB for web.
```

### 2C — Pages Node (Stacked Documents)
```
Three small 3D rectangles stacked with slight offset rotation, like floating document pages. Dark matte surface with soft blue (#60a5fa) glowing edges. Tiny grid lines on the face of each page suggesting data/text. Minimal depth, clean geometry. Icon-scale, no background. Format: GLB for web.
```

### 2D — Email Node (Envelope)
```
A small 3D geometric envelope shape, modern and angular (not rounded/cartoon). Dark matte surface with rose/pink (#f472b6) glowing fold lines and edges. A subtle particle trail exits the opening as if a message is being sent. Icon-scale, floating in void. Format: GLB for web.
```

### 2E — Automation Node (Gear + Clock)
```
A small 3D compound shape: a gear/cog interlocked with a clock face. Both dark matte charcoal. The gear teeth have amber (#fbbf24) glowing edges. The clock hands glow softly. Suggests mechanical automation. Minimal, geometric, icon-scale. No background. Format: GLB for web.
```

### 2F — API Node (Brackets)
```
A small 3D representation of code brackets "{ }" or angle brackets "< />" as a floating 3D text/shape. Dark matte surface with cyan (#22d3ee) glowing edges and a soft data-stream particle effect flowing between the brackets. Icon-scale, void background. Format: GLB for web.
```

**Specifications (all nodes):**
- Format: `.glb`
- Polycount: < 3K triangles each
- Consistent scale relative to each other
- Each needs a baked emissive texture for the glow color
- Orbit animation will be handled in Three.js (just need the static mesh)

---

## Asset 3: Data Stream Particles — "The Flow"

**Purpose**: Animated particle trails that flow between the central core and the orbiting nodes. Represents data/information flowing through the platform.

**Prompt:**
```
A curved, flowing ribbon of light particles in 3D space, like a data stream or fiber optic light trail. The particles are tiny emerald green (#34d399) dots that flow along a curved bezier path, with varying opacity and size. Some particles are brighter, creating a bokeh-like depth effect. The trail has a subtle glow halo. Dark void background. The path curves gracefully in 3D space like an orbital trajectory. Clean, minimal, no surface — just the particle stream itself.
```

**Note:** This will likely be done programmatically in Three.js using a `BufferGeometry` + custom `ShaderMaterial` rather than a pre-made asset. The prompt is for visual reference if generating a concept render.

---

## Asset 4: Agent Avatar — "The Entity"

**Purpose**: Represents an AI agent. Appears in the "How it works" section as the agent being created/activated. Also used in the BottomCTA.

**Prompt:**
```
A 3D humanoid/robot head silhouette — abstract and geometric, NOT realistic or cartoon. Think minimal polygonal mask or faceted helmet shape. Dark matte obsidian surface (#09090b) with emerald green (#34d399) glowing "eyes" (two horizontal slits or hexagonal shapes). A faint hexagonal grid pattern subtly visible on the forehead area, referencing the HiGantic logo. The jaw area fades into particles/voxels that dissolve downward, suggesting the agent is materializing from data. Floating in pure dark void. Dramatic front-lit with a single emerald light source from below. Clean, premium, futuristic. Format: GLB for web.
```

**Specifications:**
- Format: `.glb`
- Polycount: < 8K triangles
- Separate meshes: head (solid), dissolve particles (instanced boxes or loose geometry)
- Emissive map for eyes and grid pattern
- Scale: Medium — hero-size for CTA section (~300px tall on screen)

---

## Asset 5: Floating Workspace — "The Desk"

**Purpose**: Represents the agent workspace concept. Shows in the "What HiGantic does" section. An abstract, floating 3D workspace with holographic screens.

**Prompt:**
```
A floating 3D workspace platform — a thin hexagonal base plate (dark matte, almost invisible) with 3 holographic screen panels rising from it at different angles. The screens are thin, semi-transparent glass panels with faint UI wireframes visible (grids, lists, charts — very abstract). Each screen has a different accent glow on its edges: emerald green, soft blue, amber. Tiny floating data particles drift between the screens. The whole assembly floats with a subtle hover animation. Dark void background with a faint reflection/shadow below the platform. Isometric camera angle. Clean, futuristic, premium. Format: GLB for web.
```

**Specifications:**
- Format: `.glb`
- Polycount: < 10K triangles
- Glass panels should use alpha/transparency
- 3 separate screen meshes (for individual animation in Three.js)
- Base platform mesh
- Particle positions can be baked or generated procedurally

---

## Asset 6: Background Environment — "Grid Horizon"

**Purpose**: Subtle infinite-floor grid that replaces the current CSS grid pattern. Extends into the distance with perspective, giving depth to the hero.

**Prompt:**
```
A 3D infinite perspective grid floor extending to the horizon. The grid lines are very thin, dark emerald (#34d399 at 8% opacity) on a pure black surface. The grid squares are large (suggesting scale). A subtle fog/mist fades the grid into darkness at the horizon line. A single faint emerald glow at the vanishing point. The perspective creates dramatic depth. Camera is positioned slightly above, looking toward the horizon. Minimal, clean, cyberpunk-influenced but restrained. No other objects.
```

**Note:** This will be implemented as a Three.js `GridHelper` or custom shader rather than a pre-made asset. The prompt is for visual reference.

---

## Three.js Integration Concept

### Scene Layout:
```
[Nav]
[Hero Section]
  ├── Three.js Canvas (position: absolute, behind content)
  │   ├── Grid Horizon (floor, always visible, subtle)
  │   ├── Central Core (hexagonal, slowly rotating)
  │   ├── Orbiting Nodes (6 satellites, orbit around core)
  │   ├── Data Streams (particle lines connecting nodes to core)
  │   └── Fog/Environment (dark, emerald-tinted)
  └── HTML Content (z-index above canvas)
      ├── Badge
      ├── Headline
      ├── CTA buttons
      └── Mock workspace (scrolls over canvas)

[Scroll triggers]
  ├── 0% → Core rotates, satellites orbit normally
  ├── 20% → Camera pulls back, workspace asset fades in
  ├── 50% → Agent avatar materializes (features section)
  └── 80% → Core pulses brightly (CTA section)
```

### Performance Targets:
- 60fps on mid-range devices
- < 2MB total for all GLB assets (compressed)
- Use `THREE.LOD` for mobile (swap to lower-poly versions)
- `devicePixelRatio` capped at 2
- Lazy-load the Three.js scene after above-the-fold content renders
- Fallback: CSS-only version for devices without WebGL

### Libraries:
- `@react-three/fiber` — React Three.js renderer
- `@react-three/drei` — Helpers (OrbitControls, Float, Stars, etc.)
- `@react-three/postprocessing` — Bloom, vignette effects
- `leva` — Dev-only parameter tweaking (remove in production)

---

## Generation Tools Recommendation:

| Tool | Best For | Notes |
|------|----------|-------|
| **Meshy.ai** | All assets | Text-to-3D, outputs GLB directly, good topology |
| **Tripo3D** | Core + Avatar | Higher detail, good for hero pieces |
| **Spline** | Interactive prototyping | Can export to Three.js directly |
| **Blender + AI addon** | Custom refinement | Best quality, most control |
| **Poly.pizza** | Base shapes to modify | Free low-poly starters |

### Recommended workflow:
1. Generate base meshes with **Meshy.ai** or **Tripo3D** using prompts above
2. Import into **Blender** for cleanup (decimate, UV unwrap, bake emissive maps)
3. Export as `.glb` with Draco compression
4. Integrate into Three.js scene with `@react-three/fiber`

---

## Full Implementation Concept — Step-by-Step Reference

This section captures the complete vision so any future conversation can pick it up and implement it from scratch.

### 1. The Big Idea

The HiGantic homepage hero replaces static CSS glows/orbs with an **interactive 3D scene** rendered via Three.js. The scene tells the story of the product: a central AI core processes data, tool nodes orbit around it, particle streams connect them, and an agent materializes — all reactive to scroll position and mouse movement.

The user **doesn't interact directly** with the 3D scene (no orbit controls). Instead:
- Mouse movement creates **subtle parallax** (camera shifts slightly toward cursor)
- Scroll position drives **camera transitions** and **object visibility** across page sections
- The scene runs in a `position: fixed` or `position: absolute` canvas **behind** the HTML content

### 2. Scene Architecture

```
THREE.Scene
├── Environment
│   ├── GridHorizon (infinite floor grid, fades to fog)
│   ├── AmbientLight (very dim, zinc-tinted)
│   └── Fog (exponential, #09090b, near: 10, far: 50)
│
├── CentralCore ("The Nexus")
│   ├── OuterShell (hexagonal prism, matte dark, rotating Y-axis at 0.1 rad/s)
│   ├── InnerRings (3 concentric hex rings, counter-rotating, emissive green edges)
│   └── CoreGlow (PointLight #34d399, intensity pulses between 0.5–1.0)
│
├── ToolNodes (6 satellites, orbit via sin/cos on update loop)
│   ├── BrainNode (position: orbit radius 3, speed 0.3, elevation +0.5)
│   ├── GlobeNode (orbit radius 3.5, speed -0.25, elevation -0.3)
│   ├── PagesNode (orbit radius 2.8, speed 0.35, elevation +0.8)
│   ├── EmailNode (orbit radius 3.2, speed -0.2, elevation -0.6)
│   ├── AutomationNode (orbit radius 3.8, speed 0.15, elevation +0.2)
│   └── APINode (orbit radius 2.5, speed -0.4, elevation -0.1)
│
├── DataStreams (particle systems)
│   ├── 6x CubicBezierCurve3 paths (core → each node)
│   ├── Each path: 80–120 particles flowing along the curve
│   ├── Particle material: PointsMaterial, size 0.02, emissive #34d399
│   └── Flow speed: staggered, each particle at different curve position (t)
│
├── AgentAvatar ("The Entity") — initially hidden, appears at scroll 50%
│   ├── HeadMesh (geometric mask, matte dark)
│   ├── Eyes (emissive plane, #34d399)
│   └── DissolveParticles (instanced boxes, float downward, fade out)
│
└── PostProcessing
    ├── Bloom (intensity: 0.4, threshold: 0.8, radius: 0.6)
    ├── Vignette (opacity: 0.3)
    └── ChromaticAberration (very subtle, offset: 0.001)
```

### 3. Scroll-Driven Timeline

The page is divided into scroll "zones" based on `window.scrollY / document.scrollHeight`:

| Scroll % | Camera Position | What Happens | Active Section |
|-----------|----------------|--------------|----------------|
| 0–15% | Close to core, slight angle | Core rotates, nodes orbit, streams flow. Hero text overlays. | Hero |
| 15–25% | Slowly pulls back + up | Marquee scrolls across. 3D scene scales down slightly. | Marquee |
| 25–45% | Pans right, reveals workspace | Floating Workspace asset fades in beside core. Feature blocks overlay. | What It Does |
| 45–65% | Returns center, zooms to agent | Agent Avatar materializes with dissolve-in animation. Timeline steps overlay. | How It Works |
| 65–80% | Pulls back wide, all visible | All nodes visible, streams intensify. Tool grid overlays. | Capabilities |
| 80–90% | Static, slightly elevated | Scene dims to 40% opacity. Pricing cards overlay. | Pricing |
| 90–100% | Zoom into core, glow intensifies | Core emissive pulses to max. CTA overlays. | Bottom CTA |

### 4. Mouse Parallax

```typescript
// In the useFrame() loop:
const mouseX = (cursor.x - 0.5) * 2; // -1 to 1
const mouseY = (cursor.y - 0.5) * 2;

camera.position.x = lerp(camera.position.x, baseX + mouseX * 0.3, 0.05);
camera.position.y = lerp(camera.position.y, baseY + mouseY * 0.15, 0.05);
camera.lookAt(corePosition);
```

### 5. File Structure

```
packages/web/
├── app/
│   ├── components/
│   │   └── three/
│   │       ├── HeroScene.tsx          ← Main R3F Canvas wrapper
│   │       ├── CentralCore.tsx        ← Hexagonal core mesh + animation
│   │       ├── ToolNode.tsx           ← Reusable orbiting node component
│   │       ├── DataStream.tsx         ← Particle flow along bezier curve
│   │       ├── AgentAvatar.tsx        ← Materializing agent head
│   │       ├── GridHorizon.tsx        ← Infinite perspective floor
│   │       ├── PostEffects.tsx        ← Bloom, vignette setup
│   │       └── useScrollProgress.ts   ← Hook: maps scroll position to 0–1
│   └── routes/
│       └── home.tsx                   ← Imports <HeroScene /> in LandingPage
├── public/
│   └── models/
│       ├── core.glb                   ← Central hexagonal core
│       ├── brain-node.glb
│       ├── globe-node.glb
│       ├── pages-node.glb
│       ├── email-node.glb
│       ├── automation-node.glb
│       ├── api-node.glb
│       ├── agent-avatar.glb
│       └── workspace.glb
```

### 6. React Component Sketch

```tsx
// HeroScene.tsx — the main Three.js wrapper
import { Canvas } from "@react-three/fiber";
import { Suspense, lazy } from "react";

const Scene = lazy(() => import("./SceneContents"));

export function HeroScene() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        camera={{ position: [0, 2, 8], fov: 45 }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}

// SceneContents.tsx
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { CentralCore } from "./CentralCore";
import { ToolNode } from "./ToolNode";
import { DataStream } from "./DataStream";
import { AgentAvatar } from "./AgentAvatar";
import { GridHorizon } from "./GridHorizon";
import { PostEffects } from "./PostEffects";
import { useScrollProgress } from "./useScrollProgress";

export default function SceneContents() {
  const scroll = useScrollProgress();     // 0 to 1
  const mouse = useRef({ x: 0, y: 0 });

  useFrame(({ camera }) => {
    // Parallax
    const targetX = mouse.current.x * 0.3;
    const targetY = 2 + mouse.current.y * 0.15;
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;

    // Scroll-driven camera distance
    const baseDist = 8 + scroll * 4;
    camera.position.z += (baseDist - camera.position.z) * 0.05;
  });

  return (
    <>
      <fog attach="fog" args={["#09090b", 10, 50]} />
      <ambientLight intensity={0.05} color="#a1a1aa" />

      <GridHorizon />
      <CentralCore scroll={scroll} />

      {/* 6 orbiting tool nodes */}
      <ToolNode model="/models/brain-node.glb" orbitRadius={3} speed={0.3} elevation={0.5} color="#a78bfa" />
      <ToolNode model="/models/globe-node.glb" orbitRadius={3.5} speed={-0.25} elevation={-0.3} color="#34d399" />
      <ToolNode model="/models/pages-node.glb" orbitRadius={2.8} speed={0.35} elevation={0.8} color="#60a5fa" />
      <ToolNode model="/models/email-node.glb" orbitRadius={3.2} speed={-0.2} elevation={-0.6} color="#f472b6" />
      <ToolNode model="/models/automation-node.glb" orbitRadius={3.8} speed={0.15} elevation={0.2} color="#fbbf24" />
      <ToolNode model="/models/api-node.glb" orbitRadius={2.5} speed={-0.4} elevation={-0.1} color="#22d3ee" />

      {/* Particle streams (core to each node) — generated procedurally */}
      <DataStream count={6} />

      {/* Agent avatar — fades in at 50% scroll */}
      <AgentAvatar visible={scroll > 0.45} />

      <PostEffects />
    </>
  );
}
```

### 7. Scroll Progress Hook

```typescript
// useScrollProgress.ts
import { useState, useEffect } from "react";

export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? window.scrollY / scrollable : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return progress;
}
```

### 8. Performance Checklist

- [ ] Cap `dpr` at `[1, 2]` (no retina 3x)
- [ ] Use `THREE.LOD` — swap to box placeholders on mobile
- [ ] Draco-compress all `.glb` files (`gltf-pipeline -d`)
- [ ] Lazy-load `<Canvas>` with `React.lazy` + `Suspense`
- [ ] Detect WebGL support — fall back to current CSS-only version
- [ ] Use `drei`'s `<AdaptiveDpr />` to auto-downscale under load
- [ ] Total asset budget: < 2MB compressed
- [ ] Test on: Chrome, Firefox, Safari, iOS Safari, Android Chrome
- [ ] Add `will-change: transform` on the canvas container
- [ ] Pause animation when tab is not visible (`document.hidden`)

### 9. Dependencies to Install

```bash
bun add three @react-three/fiber @react-three/drei @react-three/postprocessing
bun add -d @types/three
```

### 10. Fallback Strategy

If WebGL is not available or the device is low-end:

```tsx
function HeroScene() {
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) setWebgl(false);
    } catch {
      setWebgl(false);
    }
  }, []);

  if (!webgl) return null; // Falls back to existing CSS glows/orbs

  return <Canvas>...</Canvas>;
}
```

### 11. Future Enhancements (Phase 2)

- **Interactive tool selection**: Clicking a node on the landing page highlights that feature section
- **Agent creation preview**: The 3D agent avatar animates during the sign-up flow
- **Personalized scene**: After sign-in, the 3D core shows the user's actual agent count as orbiting nodes
- **Loading screen**: Use the core animation as a loading indicator while the app hydrates
- **Dark/light mode**: Invert the scene for hypothetical light mode (surface: white, glow: darker emerald)
