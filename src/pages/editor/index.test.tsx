import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const shellProps = vi.hoisted(() => vi.fn());

vi.mock("@ek-aiot/2d-editor-react", async () => {
  const actual = await vi.importActual<
    typeof import("@ek-aiot/2d-editor-react")
  >("@ek-aiot/2d-editor-react");
  return {
    ...actual,
    ReactEditorShell: (props: unknown) => {
      shellProps(props);
      return <div data-testid="react-editor-shell" />;
    },
  };
});

import EditorPage from ".";

beforeEach(() => {
  sessionStorage.clear();
  shellProps.mockClear();
});

it("mounts the published editor as a full editable Agent workspace", () => {
  render(<EditorPage />);

  expect(screen.getByRole("main")).toHaveClass("editor-page");
  expect(screen.getByLabelText("二维编辑器工作区")).toContainElement(
    screen.getByTestId("react-editor-shell"),
  );
  expect(screen.getByText("Revision 0")).toBeVisible();
  expect(shellProps).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: "edit",
      layout: "full",
      hotkeys: true,
      materialMergeStrategy: "append",
      materials: expect.any(Array),
      agent: expect.objectContaining({
        documentRef: expect.any(String),
        transport: expect.any(Object),
        documentCommitAdapter: expect.any(Object),
      }),
      onDocumentChange: expect.any(Function),
    }),
  );
});
