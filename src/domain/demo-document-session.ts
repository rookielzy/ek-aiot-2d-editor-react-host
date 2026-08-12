import {
  validateEditorDocument,
  type EditorDocument,
} from "@ek-aiot/2d-editor-core";
import type {
  AgentDocumentCommitRequest,
  AgentDocumentCommitResult,
  DocumentCommitAdapter,
} from "@ek-aiot/2d-editor-agent";

export const DEMO_DOCUMENT_SESSION_KEY = "ek-aiot.demo-document-session.v1";
const MAX_RESTORABLE_REVISION = 1_000;

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DemoDocumentSessionSnapshot {
  documentRef: string;
  document: EditorDocument;
  revision: number;
  lastCommit: AgentDocumentCommitResult | null;
  toolCalls: Readonly<Record<string, AgentDocumentCommitResult>>;
}

interface StoredDemoDocumentSession extends DemoDocumentSessionSnapshot {
  version: 1;
}

interface OpenDemoDocumentSessionOptions {
  storage: StoragePort;
  createDocument: () => EditorDocument;
  createId?: () => string;
}

export class DemoDocumentSessionConflictError extends Error {
  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `Stale document revision: expected ${expectedRevision}, actual ${actualRevision}.`,
    );
    this.name = "DemoDocumentSessionConflictError";
  }
}

export class DemoDocumentSession
  implements DocumentCommitAdapter<EditorDocument>
{
  static open(options: OpenDemoDocumentSessionOptions): DemoDocumentSession {
    const stored = readStoredSession(options.storage);
    if (stored) return new DemoDocumentSession(options.storage, stored);

    const state: StoredDemoDocumentSession = {
      version: 1,
      documentRef: (options.createId ?? createRandomId)(),
      document: options.createDocument(),
      revision: 0,
      lastCommit: null,
      toolCalls: {},
    };
    options.storage.setItem(DEMO_DOCUMENT_SESSION_KEY, JSON.stringify(state));
    return new DemoDocumentSession(options.storage, state);
  }

  private constructor(
    private readonly storage: StoragePort,
    private state: StoredDemoDocumentSession,
  ) {}

  snapshot(): DemoDocumentSessionSnapshot {
    return structuredClone(this.state);
  }

  persistManualChange(document: EditorDocument, revision: number): void {
    if (revision !== this.state.revision + 1) {
      throw new DemoDocumentSessionConflictError(revision, this.state.revision);
    }
    this.store({
      ...this.state,
      document: structuredClone(document),
      revision,
    });
  }

  async commitAgentDocument(
    request: AgentDocumentCommitRequest<EditorDocument>,
  ): Promise<AgentDocumentCommitResult> {
    const existing = Object.hasOwn(this.state.toolCalls, request.toolCallId)
      ? this.state.toolCalls[request.toolCallId]
      : undefined;
    if (existing) return structuredClone(existing);

    if (request.documentRef !== this.state.documentRef) {
      throw new Error(
        "Agent documentRef does not match the active demo session.",
      );
    }
    if (
      request.expectedRevision !== this.state.revision ||
      request.beforeRevision !== this.state.revision
    ) {
      throw new DemoDocumentSessionConflictError(
        request.expectedRevision,
        this.state.revision,
      );
    }
    if (request.afterRevision !== request.beforeRevision + 1) {
      throw new Error(
        "Agent commit must advance the document revision exactly once.",
      );
    }

    const result = {
      commitId: createRandomId(),
      revision: request.afterRevision,
    } satisfies AgentDocumentCommitResult;
    this.store({
      ...this.state,
      document: structuredClone(request.document),
      revision: result.revision,
      lastCommit: result,
      toolCalls: { ...this.state.toolCalls, [request.toolCallId]: result },
    });
    return structuredClone(result);
  }

  clear(): void {
    this.storage.removeItem(DEMO_DOCUMENT_SESSION_KEY);
  }

  private store(state: StoredDemoDocumentSession): void {
    this.storage.setItem(DEMO_DOCUMENT_SESSION_KEY, JSON.stringify(state));
    this.state = state;
  }
}

function createRandomId(): string {
  return crypto.randomUUID();
}

function readStoredSession(
  storage: StoragePort,
): StoredDemoDocumentSession | null {
  const raw = storage.getItem(DEMO_DOCUMENT_SESSION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredDemoDocumentSession>;
    const document = validateEditorDocument(value.document);
    const lastCommit = parseCommitResult(value.lastCommit);
    const toolCalls = parseToolCalls(value.toolCalls);
    const revision = value.revision;
    if (
      value.version !== 1 ||
      typeof value.documentRef !== "string" ||
      !value.documentRef ||
      typeof revision !== "number" ||
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      revision > MAX_RESTORABLE_REVISION ||
      !document.ok ||
      lastCommit === undefined ||
      toolCalls === null ||
      (lastCommit !== null && lastCommit.revision > revision) ||
      Object.values(toolCalls).some((receipt) => receipt.revision > revision)
    ) {
      storage.removeItem(DEMO_DOCUMENT_SESSION_KEY);
      return null;
    }
    return {
      version: 1,
      documentRef: value.documentRef,
      document: document.value,
      revision,
      lastCommit,
      toolCalls,
    };
  } catch {
    storage.removeItem(DEMO_DOCUMENT_SESSION_KEY);
    return null;
  }
}

function parseToolCalls(
  value: unknown,
): Record<string, AgentDocumentCommitResult> | null {
  if (!isPlainRecord(value)) return null;
  const entries = Object.entries(value);
  const parsed: Record<string, AgentDocumentCommitResult> = Object.create(
    null,
  ) as Record<string, AgentDocumentCommitResult>;
  for (const [toolCallId, receipt] of entries) {
    const result = parseCommitResult(receipt);
    if (!toolCallId || !result) return null;
    parsed[toolCallId] = result;
  }
  return parsed;
}

function parseCommitResult(
  value: unknown,
): AgentDocumentCommitResult | null | undefined {
  if (value === null) return null;
  if (
    !isPlainRecord(value) ||
    typeof value.commitId !== "string" ||
    !value.commitId ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    value.revision > MAX_RESTORABLE_REVISION
  ) {
    return undefined;
  }
  return { commitId: value.commitId, revision: value.revision };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
