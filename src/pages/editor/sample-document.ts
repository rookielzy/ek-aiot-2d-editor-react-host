import type { EditorDocument } from "@ek-aiot/2d-editor-core";

export function createDemoDocument(): EditorDocument {
  return {
    schemaVersion: 1,
    canvas: {
      sizeMode: "fit",
      fixedSize: { width: 1600, height: 900 },
      backgroundColor: "#f7f9fb",
      grid: {
        enabled: true,
        size: 24,
        color: "#d7dde5",
        opacity: 0.75,
        strokeWidth: 1,
      },
      snapping: { enabled: true },
    },
    nodes: [],
  };
}
