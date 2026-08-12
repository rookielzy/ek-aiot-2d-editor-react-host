import type {
  DocumentChangeEvent,
  EditorDocument,
} from "@ek-aiot/2d-editor-core";
import type {
  AgentDocumentCommitRequest,
  AgentDocumentCommitResult,
  DocumentCommitAdapter,
} from "@ek-aiot/2d-editor-agent";

interface DemoSessionBridgeOptions
  extends DocumentCommitAdapter<EditorDocument> {
  persistManualChange(document: EditorDocument, revision: number): void;
}

export interface DemoSessionBridge
  extends DocumentCommitAdapter<EditorDocument> {
  onDocumentChange(event: DocumentChangeEvent): void;
}

export function createDemoSessionBridge(
  options: DemoSessionBridgeOptions,
): DemoSessionBridge {
  const pendingRevisions = new Set<number>();
  return {
    onDocumentChange(event) {
      pendingRevisions.add(event.revision);
      queueMicrotask(() => {
        if (!pendingRevisions.delete(event.revision)) return;
        options.persistManualChange(
          structuredClone(event.document) as EditorDocument,
          event.revision,
        );
      });
    },
    async commitAgentDocument(
      request: AgentDocumentCommitRequest<EditorDocument>,
    ): Promise<AgentDocumentCommitResult> {
      pendingRevisions.delete(request.afterRevision);
      return options.commitAgentDocument(request);
    },
  };
}
