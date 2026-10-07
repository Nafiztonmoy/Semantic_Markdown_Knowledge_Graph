import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CommandPaletteModal } from "@/components/CommandPaletteModal";
// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));
// Mock API client
vi.mock("@/lib/api", () => ({
  api: {
    search: vi.fn().mockResolvedValue({
      items: [{
        document_id: "doc-1",
        section_id: "sec-1",
        title: "System Architecture",
        heading_path: "System Architecture > Topology",
        snippet: "NexusDocs runs on Next.js and FastAPI.",
        score: 0.032,
        relevance_explanation: "Keyword match #1"
      }]
    })
  }
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
describe("Frontend Component Tests", () => {
  it("renders CommandPaletteModal when open", () => {
    const handleClose = vi.fn();
    render(<CommandPaletteModal workspaceId="ws-123" isOpen={true} onClose={handleClose} />);
    expect(screen.getByPlaceholderText(/Search documents, sections, or concepts/i)).toBeDefined();
    expect(screen.getByText(/Hybrid \(RRF\)/i)).toBeDefined();
    expect(screen.getByText(/ESC/i)).toBeDefined();
  });
  it("does not render CommandPaletteModal when closed", () => {
    const handleClose = vi.fn();
    const {
      container
    } = render(<CommandPaletteModal workspaceId="ws-123" isOpen={false} onClose={handleClose} />);
    expect(container.firstChild).toBeNull();
  });
  it("allows switching search modes in CommandPaletteModal", () => {
    const handleClose = vi.fn();
    render(<CommandPaletteModal workspaceId="ws-123" isOpen={true} onClose={handleClose} />);
    const keywordBtn = screen.getByText("Keyword");
    fireEvent.click(keywordBtn);
    expect(keywordBtn.getAttribute("aria-pressed")).toBe("true");
  });
});
