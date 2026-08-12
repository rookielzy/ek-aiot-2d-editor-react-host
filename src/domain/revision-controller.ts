import type { EditorDocument } from "@ek-aiot/2d-editor-core";
import {
  createEditorController,
  type CreateEditorControllerOptions,
  type EditorController,
} from "@ek-aiot/2d-editor-react";

export function createRestoredEditorController(
  options: CreateEditorControllerOptions & { persistedRevision: number },
): EditorController {
  const persistedDocument = options.initialDocument;
  const [seedA, seedB] = persistedDocument
    ? createRevisionSeedDocuments(persistedDocument)
    : [undefined, undefined];
  const controller = createEditorController({
    ...options,
    initialDocument:
      options.persistedRevision > 0 && persistedDocument
        ? seedA
        : persistedDocument,
  });

  if (persistedDocument && options.persistedRevision > 0) {
    for (
      let revision = 1;
      revision <= options.persistedRevision;
      revision += 1
    ) {
      const finalRevision = revision === options.persistedRevision;
      const result = controller.resetDocument(
        finalRevision
          ? persistedDocument
          : revision % 2 === 1
            ? (seedB as EditorDocument)
            : (seedA as EditorDocument),
        { lifecycleType: "replace", reason: "restore persisted revision" },
      );
      if (result.status !== "applied" || !result.documentChanged) {
        throw new Error("Could not restore the persisted document revision.");
      }
    }
  }

  return controller;
}

function createRevisionSeedDocuments(
  document: EditorDocument,
): [EditorDocument, EditorDocument] {
  const candidates = ["#000000", "#010101", "#020202"];
  const [first, second] = candidates.filter(
    (color) =>
      color.toLowerCase() !== document.canvas.backgroundColor.toLowerCase(),
  );
  return [
    withBackground(document, first as string),
    withBackground(document, second as string),
  ];
}

function withBackground(
  document: EditorDocument,
  backgroundColor: string,
): EditorDocument {
  const clone = structuredClone(document);
  clone.canvas.backgroundColor = backgroundColor;
  return clone;
}
