import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "../store/useAppStore";
import {
   maskSpoilerText,
   renderFormattedMessageText,
} from "../components/chat/FloatingChatBubble";

describe("Global dailyGameFinishedDate store state", () => {
   beforeEach(() => {
      useAppStore.setState({ dailyGameFinishedDate: null });
   });

   it("tracks the finished daily game date and resets on date rollover", () => {
      const today = "2026-11-20";
      const tomorrow = "2026-11-21";

      expect(useAppStore.getState().dailyGameFinishedDate).toBeNull();
      expect(useAppStore.getState().dailyGameFinishedDate === today).toBe(false);

      useAppStore.getState().setDailyGameFinishedDate(today);
      expect(useAppStore.getState().dailyGameFinishedDate).toBe(today);
      expect(useAppStore.getState().dailyGameFinishedDate === today).toBe(true);
      expect(useAppStore.getState().dailyGameFinishedDate === tomorrow).toBe(false);

      useAppStore.getState().setDailyGameFinishedDate(null);
      expect(useAppStore.getState().dailyGameFinishedDate).toBeNull();
   });
});

describe("maskSpoilerText", () => {
   it("masks today's answer and ALL-CAPS guess words in group chats when user has not finished", () => {
      const masked = maskSpoilerText("I got CRANE after trying SLATE", "CRANE", true, false);
      expect(masked).not.toContain("CRANE");
      expect(masked).not.toContain("SLATE");
      expect(masked).toContain("••••• (spoiler)");
   });

   it("does NOT mask answers in group chats when user has finished today's game", () => {
      const text = "I got CRANE after trying SLATE";
      expect(maskSpoilerText(text, "CRANE", true, true)).toBe(text);
   });

   it("does NOT mask answers in DMs regardless of completion state", () => {
      const text = "I got CRANE today";
      expect(maskSpoilerText(text, "CRANE", false, false)).toBe(text);
   });
});

describe("renderFormattedMessageText", () => {
   it("blurs answers in group chats when user has not finished today's game", () => {
      const onBlocked = vi.fn();
      render(
         <div>
            {renderFormattedMessageText(
               "The answer was CRANE",
               "alice",
               false,
               "CRANE",
               true,
               false,
               onBlocked,
            )}
         </div>,
      );

      expect(screen.queryByText(/CRANE/)).not.toBeInTheDocument();
      const spoilerEl = screen.getByText("SPOILER");
      expect(spoilerEl).toBeInTheDocument();
      fireEvent.click(spoilerEl);
      expect(onBlocked).toHaveBeenCalledTimes(1);
   });

   it("renders unblurred answers (and preserves @mentions) in group chats when user has finished today's game", () => {
      render(
         <div>
            {renderFormattedMessageText(
               "Hey @alice the answer was CRANE and SLATE",
               "alice",
               false,
               "CRANE",
               true,
               true,
            )}
         </div>,
      );

      expect(screen.queryByText("SPOILER")).not.toBeInTheDocument();
      expect(screen.getByText("@alice")).toBeInTheDocument();
      expect(screen.getByText(/the answer was CRANE and SLATE/)).toBeInTheDocument();
   });
});
