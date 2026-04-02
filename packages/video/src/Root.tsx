import { Composition } from "remotion";
import { HiGanticDemo } from "./HiGanticDemo";

const FPS = 60;
// 90 seconds total
const TOTAL_FRAMES = 90 * FPS;

export const RemotionRoot = () => {
  return (
    <Composition
      id="HiGanticDemo"
      component={HiGanticDemo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
