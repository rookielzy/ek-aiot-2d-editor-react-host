import type {
  DocumentChangeEvent,
  EditorDocument,
} from "@ek-aiot/2d-editor-core";
import { expect, it, vi } from "vitest";

import { createDemoSessionBridge } from "./demo-session-bridge";

const document = {
  schemaVersion: 2,
  canvas: {},
  nodes: [],
  topologicalConnections: [],
} as unknown as EditorDocument;

it("lets an Agent commit consume its synchronous document-change event before manual persistence", async () => {
  const persistManualChange = vi.fn();
  const commitAgentDocument = vi
    .fn()
    .mockResolvedValue({ commitId: "commit-1", revision: 1 });
  const bridge = createDemoSessionBridge({
    persistManualChange,
    commitAgentDocument,
  });

  bridge.onDocumentChange({
    kind: "command",
    operation: "execute",
    commandType: "nodes.move",
    revision: 1,
    document,
  } as DocumentChangeEvent);
  const result = await bridge.commitAgentDocument({
    documentRef: "document-1",
    toolCallId: "tool-1",
    batchId: "batch-1",
    fencingToken: 1,
    expectedRevision: 0,
    beforeRevision: 0,
    afterRevision: 1,
    document,
  });
  await Promise.resolve();

  expect(result).toEqual({ commitId: "commit-1", revision: 1 });
  expect(persistManualChange).not.toHaveBeenCalled();
});

it("persists an ordinary editor change after the Agent commit opportunity passes", async () => {
  const persistManualChange = vi.fn();
  const bridge = createDemoSessionBridge({
    persistManualChange,
    commitAgentDocument: vi.fn(),
  });

  bridge.onDocumentChange({
    kind: "command",
    operation: "undo",
    commandType: "nodes.move",
    revision: 3,
    document,
  } as DocumentChangeEvent);
  await Promise.resolve();

  expect(persistManualChange).toHaveBeenCalledWith(document, 3);
});
