import {
  AGENT_PROTOCOL_VERSION,
  parseAgentCapabilities,
  parseAgentCommandAcceptance,
  parseAgentEventSubscriptionRequest,
  parseAgentStreamItem,
  type AgentCommand,
  type AgentCommandAcceptance,
  type AgentEventSubscriber,
  type AgentEventSubscription,
  type AgentEventSubscriptionRequest,
  type AgentStreamItem,
  type AgentTransport,
} from "@ek-aiot/agent-protocol";

import { createRandomId } from "@/shared/random-id";

export interface AgentLifecycle {
  stopActiveTurn(): Promise<void>;
}

export interface HttpAgentTransport extends AgentTransport {
  lifecycle: AgentLifecycle;
}

interface CreateHttpAgentTransportOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  maxConnectionAgeMs?: number;
  onUnauthorized?: () => void;
  reconnectDelayMs?: number;
}

interface ActiveTurn {
  conversationId: string;
  documentRef: string;
  turnId: string;
}

class FatalAgentTransportError extends Error {}

export function createHttpAgentTransport(
  options: CreateHttpAgentTransportOptions,
): HttpAgentTransport {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const request: typeof globalThis.fetch =
    options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const maxConnectionAgeMs = options.maxConnectionAgeMs ?? 14 * 60 * 1_000;
  const reconnectDelayMs = options.reconnectDelayMs ?? 500;
  let activeTurn: ActiveTurn | null = null;

  const sendCommand = async (
    command: AgentCommand,
  ): Promise<AgentCommandAcceptance> => {
    const response = await request(`${baseUrl}/commands`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    handleUnauthorized(response, options.onUnauthorized);
    if (![200, 202, 409].includes(response.status)) {
      throw new Error(`Agent command failed with HTTP ${response.status}.`);
    }
    const acceptance = parseAgentCommandAcceptance(await response.json());
    if (command.commandType === "turn.start" && acceptance.turnId) {
      activeTurn = {
        documentRef: command.documentRef,
        conversationId: command.conversationId,
        turnId: acceptance.turnId,
      };
    }
    if (command.commandType === "turn.stop") activeTurn = null;
    return acceptance;
  };

  return {
    lifecycle: {
      async stopActiveTurn() {
        if (!activeTurn) return;
        const turn = activeTurn;
        await sendCommand({
          protocolVersion: AGENT_PROTOCOL_VERSION,
          commandId: createRandomId(),
          commandType: "turn.stop",
          documentRef: turn.documentRef,
          conversationId: turn.conversationId,
          payload: { turnId: turn.turnId },
        });
      },
    },
    async negotiateCapabilities() {
      const response = await request(`${baseUrl}/capabilities`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      handleUnauthorized(response, options.onUnauthorized);
      return parseAgentCapabilities(
        await readJson(response, "Agent capability negotiation"),
      );
    },
    sendCommand,
    subscribe(
      subscriptionRequest: AgentEventSubscriptionRequest,
      subscriber: AgentEventSubscriber,
    ): AgentEventSubscription {
      const parsed = parseAgentEventSubscriptionRequest(subscriptionRequest);
      const controller = new AbortController();
      let afterCursor = parsed.afterCursor;

      void runEventLoop({
        baseUrl,
        controller,
        request,
        maxConnectionAgeMs,
        onUnauthorized: options.onUnauthorized,
        reconnectDelayMs,
        documentRef: parsed.documentRef,
        getAfterCursor: () => afterCursor,
        onItem(item) {
          if (item.streamItemType === "event") {
            afterCursor = item.cursor;
            if (
              item.eventType === "turn.completed" ||
              item.eventType === "turn.failed" ||
              item.eventType === "turn.stopped" ||
              item.eventType === "turn.partially_completed" ||
              item.eventType === "turn.reconciliation_required"
            ) {
              activeTurn = null;
            }
          }
          subscriber.onItem(item);
        },
        onCaughtUp: () => subscriber.onCaughtUp(),
        onError: (error) => subscriber.onError(error),
      });

      return { unsubscribe: () => controller.abort() };
    },
  };
}

async function runEventLoop(options: {
  baseUrl: string;
  controller: AbortController;
  request: typeof globalThis.fetch;
  reconnectDelayMs: number;
  maxConnectionAgeMs: number;
  onUnauthorized?: () => void;
  documentRef: string;
  getAfterCursor(): string | undefined;
  onItem(item: AgentStreamItem): void;
  onCaughtUp(): void;
  onError(error: unknown): void;
}): Promise<void> {
  while (!options.controller.signal.aborted) {
    const connectionController = new AbortController();
    const closeConnection = () => connectionController.abort();
    options.controller.signal.addEventListener("abort", closeConnection, {
      once: true,
    });
    const connectionTimer = globalThis.setTimeout(
      closeConnection,
      options.maxConnectionAgeMs,
    );
    try {
      const query = new URLSearchParams({ documentRef: options.documentRef });
      const afterCursor = options.getAfterCursor();
      if (afterCursor) query.set("afterCursor", afterCursor);
      const response = await options.request(
        `${options.baseUrl}/events?${query}`,
        {
          credentials: "include",
          headers: { Accept: "text/event-stream" },
          signal: connectionController.signal,
        },
      );
      handleUnauthorized(response, options.onUnauthorized);
      if (!response.ok || !response.body) {
        const error = new Error(
          `Agent event subscription failed with HTTP ${response.status}.`,
        );
        if (
          response.status < 500 &&
          response.status !== 408 &&
          response.status !== 429
        ) {
          throw new FatalAgentTransportError(error.message);
        }
        throw error;
      }
      if (
        !(response.headers.get("Content-Type") ?? "").includes(
          "text/event-stream",
        )
      ) {
        throw new FatalAgentTransportError(
          "Agent event subscription did not return SSE.",
        );
      }
      await readSse(response.body, options);
    } catch (error) {
      if (options.controller.signal.aborted) return;
      if (error instanceof FatalAgentTransportError) {
        options.onError(error);
        return;
      }
    } finally {
      globalThis.clearTimeout(connectionTimer);
      options.controller.signal.removeEventListener("abort", closeConnection);
    }
    await abortableDelay(options.reconnectDelayMs, options.controller.signal);
  }
}

function handleUnauthorized(
  response: Response,
  onUnauthorized: (() => void) | undefined,
): void {
  if (response.status !== 401 && response.status !== 403) return;
  onUnauthorized?.();
  throw new FatalAgentTransportError(
    `Agent authentication failed with HTTP ${response.status}.`,
  );
}

async function abortableDelay(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = globalThis.setTimeout(done, delayMs);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      globalThis.clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

async function readSse(
  stream: ReadableStream<Uint8Array>,
  options: Pick<
    Parameters<typeof runEventLoop>[0],
    "controller" | "onItem" | "onCaughtUp"
  >,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!options.controller.signal.aborted) {
    const result = await reader.read();
    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    let boundary = buffer.match(/\r?\n\r?\n/);
    while (boundary?.index !== undefined) {
      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      if (readFrameEvent(frame) === "agent-caught-up") options.onCaughtUp();
      else {
        const data = readFrameData(frame);
        if (data) options.onItem(parseAgentStreamItem(JSON.parse(data)));
      }
      boundary = buffer.match(/\r?\n\r?\n/);
    }
  }
}

async function readJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok)
    throw new Error(`${label} failed with HTTP ${response.status}.`);
  return response.json();
}

function readFrameData(frame: string): string | undefined {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  return data || undefined;
}

function readFrameEvent(frame: string): string | undefined {
  return frame
    .split(/\r?\n/)
    .find((line) => line.startsWith("event:"))
    ?.slice(6)
    .trim();
}
