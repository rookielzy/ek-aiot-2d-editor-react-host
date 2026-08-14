import {
  AGENT_PROTOCOL_VERSION,
  type AgentTransport,
} from "@ek-aiot/agent-protocol";
import { describe, expect, it, vi } from "vitest";

import { bootstrapAgentDocument } from "./agent-bootstrap";

function createTransport(
  acceptance: Awaited<ReturnType<AgentTransport["sendCommand"]>>,
): AgentTransport {
  return {
    negotiateCapabilities: vi.fn(),
    sendCommand: vi.fn().mockResolvedValue(acceptance),
    subscribe: vi.fn(),
  };
}

describe("Agent document bootstrap", () => {
  it("claims a fresh document with the published client's conversation identity", async () => {
    const transport = createTransport({
      status: "accepted",
      commandId: "conversation-create-default",
      conversationId: "conversation-default",
    });

    await bootstrapAgentDocument({ documentRef: "document-1", transport });

    expect(transport.sendCommand).toHaveBeenCalledWith({
      protocolVersion: AGENT_PROTOCOL_VERSION,
      commandId: "conversation-create-default",
      commandType: "conversation.create",
      documentRef: "document-1",
      conversationId: "conversation-default",
      payload: {},
    });
  });

  it("accepts an idempotent duplicate bootstrap", async () => {
    const transport = createTransport({
      status: "duplicate",
      commandId: "conversation-create-default",
      conversationId: "conversation-default",
    });

    await expect(
      bootstrapAgentDocument({ documentRef: "document-1", transport }),
    ).resolves.toBeUndefined();
  });

  it("surfaces a rejected bootstrap", async () => {
    const transport = createTransport({
      status: "rejected",
      commandId: "conversation-create-default",
      reason: "Agent resource is unavailable.",
    });

    await expect(
      bootstrapAgentDocument({ documentRef: "document-1", transport }),
    ).rejects.toThrow("Agent resource is unavailable.");
  });
});
