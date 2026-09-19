import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TypingBubble from "../../components/chat/TypingBubble";
import ChatActivityIndicator from "../../components/chat/ChatActivityIndicator";

describe("TypingBubble Component", () => {
   it("renders single user typing message with animation dots", () => {
      render(<TypingBubble name="Alice" type="typing" />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText(/is typing…/i)).toBeInTheDocument();
      expect(screen.getByTestId("chat-activity-indicator")).toBeInTheDocument();
   });

   it("renders multiple users typing message with pluralized 'are typing'", () => {
      render(<TypingBubble name="Alice, Bob" type="typing" />);
      expect(screen.getByText("Alice, Bob")).toBeInTheDocument();
      expect(screen.getByText(/are typing…/i)).toBeInTheDocument();
   });

   it("renders fallback name 'Someone' when name is null or undefined", () => {
      render(<TypingBubble name={null} type="typing" />);
      expect(screen.getByText("Someone")).toBeInTheDocument();
      expect(screen.getByText(/is typing…/i)).toBeInTheDocument();
   });

   it("renders single user voice note recording indicator with mic and text", () => {
      render(<TypingBubble name="Bob" type="recording" />);
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText(/is recording audio…/i)).toBeInTheDocument();
   });

   it("renders multiple users voice note recording with pluralized text", () => {
      render(<TypingBubble name="Bob, Charlie" type="recording" />);
      expect(screen.getByText("Bob, Charlie")).toBeInTheDocument();
      expect(screen.getByText(/are recording audio…/i)).toBeInTheDocument();
   });
});

describe("ChatActivityIndicator Component", () => {
   it("renders nothing when no users are typing or recording", () => {
      const { container } = render(<ChatActivityIndicator typingNames={[]} recordingNames={[]} />);
      expect(container.firstChild).toBeNull();
   });

   it("renders typing indicator when typingNames is provided", () => {
      render(<ChatActivityIndicator typingNames={["Alice"]} recordingNames={[]} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText(/is typing…/i)).toBeInTheDocument();
   });

   it("renders voice recording indicator when recordingNames is provided", () => {
      render(<ChatActivityIndicator typingNames={[]} recordingNames={["Bob"]} />);
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText(/is recording audio…/i)).toBeInTheDocument();
   });

   it("renders both typing and recording indicators when both are active", () => {
      render(<ChatActivityIndicator typingNames={["Alice"]} recordingNames={["Bob"]} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText(/is typing…/i)).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText(/is recording audio…/i)).toBeInTheDocument();
   });
});
