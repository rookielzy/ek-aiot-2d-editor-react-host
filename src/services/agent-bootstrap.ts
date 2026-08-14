import {
  AGENT_PROTOCOL_VERSION,
  type AgentTransport,
} from "@ek-aiot/agent-protocol";

const DEFAULT_CONVERSATION_ID = "conversation-default";
const DEFAULT_CONVERSATION_COMMAND_ID = "conversation-create-default";

interface BootstrapAgentDocumentOptions {
  documentRef: string;
  transport: Pick<AgentTransport, "sendCommand">;
}

export async function bootstrapAgentDocument(
  options: BootstrapAgentDocumentOptions,
): Promise<void> {
  const acceptance = await options.transport.sendCommand({
    protocolVersion: AGENT_PROTOCOL_VERSION,
    commandId: DEFAULT_CONVERSATION_COMMAND_ID,
    commandType: "conversation.create",
    documentRef: options.documentRef,
    conversationId: DEFAULT_CONVERSATION_ID,
    payload: {},
  });

  if (acceptance.status === "rejected") {
    throw new Error(
      acceptance.reason ?? "Agent document bootstrap was rejected.",
    );
  }
}
