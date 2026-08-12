import type { EditorDocument } from "@ek-aiot/2d-editor-core";
import { describe, expect, it } from "vitest";

import {
  DEMO_DOCUMENT_SESSION_KEY,
  DemoDocumentSession,
  DemoDocumentSessionConflictError,
  type StoragePort,
} from "./demo-document-session";

const document = (backgroundColor: string): EditorDocument => ({
  schemaVersion: 1,
  canvas: {
    sizeMode: "fit",
    fixedSize: { width: 1600, height: 900 },
    backgroundColor,
    grid: {
      enabled: true,
      size: 24,
      color: "#d7dde5",
      opacity: 1,
      strokeWidth: 1,
    },
  },
  nodes: [],
});

function createMemoryStorage(): StoragePort {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("DemoDocumentSession", () => {
  it("restores the same document reference, document, and revision in one tab", () => {
    const storage = createMemoryStorage();
    const first = DemoDocumentSession.open({
      storage,
      createDocument: () => document("#ffffff"),
      createId: () => "document-ref-1",
    });

    first.persistManualChange(document("#f3f6f8"), 1);

    const restored = DemoDocumentSession.open({
      storage,
      createDocument: () => document("#000000"),
      createId: () => "document-ref-2",
    });

    expect(restored.snapshot()).toMatchObject({
      documentRef: "document-ref-1",
      revision: 1,
      document: { canvas: { backgroundColor: "#f3f6f8" } },
    });
  });

  it("rejects a stale Agent revision without replacing the stored document", async () => {
    const storage = createMemoryStorage();
    const session = DemoDocumentSession.open({
      storage,
      createDocument: () => document("#ffffff"),
      createId: () => "document-ref-1",
    });
    session.persistManualChange(document("#f3f6f8"), 1);

    await expect(
      session.commitAgentDocument({
        documentRef: "document-ref-1",
        toolCallId: "tool-1",
        batchId: "batch-1",
        fencingToken: 1,
        expectedRevision: 0,
        beforeRevision: 0,
        afterRevision: 1,
        document: document("#101820"),
      }),
    ).rejects.toBeInstanceOf(DemoDocumentSessionConflictError);

    expect(session.snapshot()).toMatchObject({
      revision: 1,
      document: { canvas: { backgroundColor: "#f3f6f8" } },
    });
  });

  it("rejects a skipped manual revision without replacing the stored document", () => {
    const storage = createMemoryStorage();
    const session = DemoDocumentSession.open({
      storage,
      createDocument: () => document("#ffffff"),
      createId: () => "document-ref-1",
    });

    expect(() => session.persistManualChange(document("#101820"), 2)).toThrow(
      DemoDocumentSessionConflictError,
    );
    expect(session.snapshot()).toMatchObject({
      revision: 0,
      document: { canvas: { backgroundColor: "#ffffff" } },
    });
  });

  it("returns the first commit for a repeated toolCallId without applying it again", async () => {
    const storage = createMemoryStorage();
    const session = DemoDocumentSession.open({
      storage,
      createDocument: () => document("#ffffff"),
      createId: () => "document-ref-1",
    });

    const first = await session.commitAgentDocument({
      documentRef: "document-ref-1",
      toolCallId: "tool-1",
      batchId: "batch-1",
      fencingToken: 1,
      expectedRevision: 0,
      beforeRevision: 0,
      afterRevision: 1,
      document: document("#101820"),
    });
    const replay = await session.commitAgentDocument({
      documentRef: "document-ref-1",
      toolCallId: "tool-1",
      batchId: "batch-1",
      fencingToken: 1,
      expectedRevision: 0,
      beforeRevision: 0,
      afterRevision: 1,
      document: document("#ff0000"),
    });

    expect(replay).toEqual(first);
    expect(session.snapshot()).toMatchObject({
      revision: 1,
      document: { canvas: { backgroundColor: "#101820" } },
    });
  });

  it("does not mistake an object prototype name for an idempotency receipt", async () => {
    const session = DemoDocumentSession.open({
      storage: createMemoryStorage(),
      createDocument: () => document("#ffffff"),
      createId: () => "document-ref-1",
    });

    await expect(
      session.commitAgentDocument({
        documentRef: "document-ref-1",
        toolCallId: "toString",
        batchId: "batch-1",
        fencingToken: 1,
        expectedRevision: 0,
        beforeRevision: 0,
        afterRevision: 1,
        document: document("#101820"),
      }),
    ).resolves.toMatchObject({ revision: 1 });
  });

  it("removes the whole demo session on clear", () => {
    const storage = createMemoryStorage();
    const session = DemoDocumentSession.open({
      storage,
      createDocument: () => document("#ffffff"),
      createId: () => "document-ref-1",
    });

    session.clear();

    expect(storage.getItem(DEMO_DOCUMENT_SESSION_KEY)).toBeNull();
  });

  it("replaces a malformed stored document with a fresh session", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      DEMO_DOCUMENT_SESSION_KEY,
      JSON.stringify({
        version: 1,
        documentRef: "broken-document",
        document: { schemaVersion: 1 },
        revision: 3,
        lastCommit: null,
        toolCalls: {},
      }),
    );

    const session = DemoDocumentSession.open({
      storage,
      createDocument: () => document("#ffffff"),
      createId: () => "replacement-document",
    });

    expect(session.snapshot()).toMatchObject({
      documentRef: "replacement-document",
      revision: 0,
      document: { canvas: { backgroundColor: "#ffffff" } },
    });
  });

  it("replaces unsafe revisions and malformed tool receipts", () => {
    for (const invalidState of [
      {
        version: 1,
        documentRef: "unsafe-revision",
        document: document("#101820"),
        revision: Number.MAX_SAFE_INTEGER,
        lastCommit: null,
        toolCalls: {},
      },
      {
        version: 1,
        documentRef: "malformed-receipt",
        document: document("#101820"),
        revision: 1,
        lastCommit: null,
        toolCalls: { "tool-1": { commitId: "", revision: 1 } },
      },
    ]) {
      const storage = createMemoryStorage();
      storage.setItem(DEMO_DOCUMENT_SESSION_KEY, JSON.stringify(invalidState));

      expect(
        DemoDocumentSession.open({
          storage,
          createDocument: () => document("#ffffff"),
          createId: () => "replacement-document",
        }).snapshot(),
      ).toMatchObject({ documentRef: "replacement-document", revision: 0 });
    }
  });
});
