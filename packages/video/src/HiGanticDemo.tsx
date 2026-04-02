import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { CreatorScene } from "./scenes/CreatorScene";
import { MemoryScene } from "./scenes/MemoryScene";
import { WorkspaceScene } from "./scenes/WorkspaceScene";
import { AutomationScene } from "./scenes/AutomationScene";
import { IntegrationsScene } from "./scenes/IntegrationsScene";
import { ThreeDScene } from "./scenes/ThreeDScene";
import { CTAScene } from "./scenes/CTAScene";

const FPS = 60;
const TRANSITION = 20; // frames

export const HiGanticDemo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      <TransitionSeries>
        {/* Scene 1: Hook — 5s */}
        <TransitionSeries.Sequence durationInFrames={5 * FPS}>
          <HookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION })}
        />

        {/* Scene 2: Problem — 8s */}
        <TransitionSeries.Sequence durationInFrames={8 * FPS}>
          <ProblemScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 } })}
        />

        {/* Scene 3: Agent Creator — 12s */}
        <TransitionSeries.Sequence durationInFrames={12 * FPS}>
          <CreatorScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION })}
        />

        {/* Scene 4: Memory — 10s */}
        <TransitionSeries.Sequence durationInFrames={10 * FPS}>
          <MemoryScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION })}
        />

        {/* Scene 5: Workspace Pages — 15s */}
        <TransitionSeries.Sequence durationInFrames={15 * FPS}>
          <WorkspaceScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 } })}
        />

        {/* Scene 6: Automations — 12s */}
        <TransitionSeries.Sequence durationInFrames={12 * FPS}>
          <AutomationScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION })}
        />

        {/* Scene 7: Integrations Grid — 10s */}
        <TransitionSeries.Sequence durationInFrames={10 * FPS}>
          <IntegrationsScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 } })}
        />

        {/* Scene 8: 3D Closer — 10s */}
        <TransitionSeries.Sequence durationInFrames={10 * FPS}>
          <ThreeDScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION })}
        />

        {/* Scene 9: CTA — 8s */}
        <TransitionSeries.Sequence durationInFrames={8 * FPS}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
