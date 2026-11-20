import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WordEffectOverlay } from "../components/chat/WordEffectOverlay";

describe("WordEffectOverlay", () => {
   beforeEach(() => {
      vi.useFakeTimers();
   });

   afterEach(() => {
      vi.useRealTimers();
   });

   it("spawns multiple floating particles for each burst and calls onBurstComplete after animation", () => {
      const onComplete = vi.fn();
      render(
         <WordEffectOverlay
            bursts={[{ id: "burst-1", emoji: "🔥" }]}
            onBurstComplete={onComplete}
         />,
      );

      expect(screen.getAllByTestId("word-effect-burst")).toHaveLength(1);
      const particles = screen.getAllByTestId("word-effect-particle");
      expect(particles.length).toBeGreaterThanOrEqual(8);

      expect(onComplete).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      expect(onComplete).toHaveBeenCalledWith("burst-1");
   });

   it("renders nothing when bursts array is empty", () => {
      render(<WordEffectOverlay bursts={[]} onBurstComplete={vi.fn()} />);
      expect(screen.queryByTestId("word-effect-burst")).not.toBeInTheDocument();
   });
});
