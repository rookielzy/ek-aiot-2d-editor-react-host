import { expect, it, vi } from "vitest";

import { createRestoredEditorController } from "./revision-controller";
import { createDemoDocument } from "@/pages/editor/sample-document";

it("continues snapshots and document-change events from the restored revision", () => {
  const controller = createRestoredEditorController({
    initialDocument: createDemoDocument(),
    persistedRevision: 7,
  });
  const listener = vi.fn();
  controller.subscribeDocumentChanges(listener);

  expect(controller.getSnapshot()).toMatchObject({
    documentRevision: 7,
    document: { canvas: { backgroundColor: "#f7f9fb" } },
  });
  expect(controller.actions.undo()).toMatchObject({ status: "no-op" });
  expect(controller.actions.redo()).toMatchObject({ status: "no-op" });

  controller.actions.setCanvasBackgroundColor("#101820");

  expect(controller.getSnapshot().documentRevision).toBe(8);
  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "command", revision: 8 }),
  );
});
