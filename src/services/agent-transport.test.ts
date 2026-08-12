import type { AgentEventSubscriber } from "@ek-aiot/agent-protocol";
import { describe, expect, it, vi } from "vitest";

import { createHttpAgentTransport } from "./agent-transport";

const capabilities = {
  protocolVersion: 1,
  toolCatalogVersion: 3,
  capabilities: { rawReasoning: true },
} as const;

describe("HTTP/SSE Agent transport", () => {
  it("uses same-origin credentials for capabilities and commands", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(capabilities))
      .mockResolvedValueOnce(
        Response.json(
          { status: "accepted", commandId: "command-1" },
          { status: 202 },
        ),
      );
    const transport = createHttpAgentTransport({
      baseUrl: "/api/agent",
      fetch,
    });

    await transport.negotiateCapabilities(capabilities);
    await transport.sendCommand({
      protocolVersion: 1,
      commandId: "command-1",
      commandType: "conversation.create",
      documentRef: "document-1",
      conversationId: "conversation-1",
      payload: {},
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/agent/capabilities",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/agent/commands",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });

  it("decodes chunked SSE events and caught-up frames", async () => {
    const event = {
      streamItemType: "event",
      protocolVersion: 1,
      eventId: "event-1",
      cursor: "postgres:1",
      eventType: "user_message.created",
      documentRef: "document-1",
      conversationId: "conversation-1",
      turnId: "turn-1",
      occurredAt: "2026-08-12T00:00:00.000Z",
      causationId: "command-1",
      correlationId: "turn-1",
      payload: { messageId: "message-1", content: "恢复消息" },
    } as const;
    const frame = `event: agent-stream-item\ndata: ${JSON.stringify(
      event,
    )}\n\nevent: agent-caught-up\ndata: {}\n\n`;
    const bytes = new TextEncoder().encode(frame);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 19));
        controller.enqueue(bytes.slice(19));
        controller.close();
      },
    });
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(body, {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const subscriber: AgentEventSubscriber = {
      onItem: vi.fn(),
      onError: vi.fn(),
      onCaughtUp: vi.fn(),
    };
    const transport = createHttpAgentTransport({
      baseUrl: "/api/agent/",
      fetch,
      reconnectDelayMs: 60_000,
    });

    const subscription = transport.subscribe(
      { documentRef: "document-1", afterCursor: "postgres:0" },
      subscriber,
    );
    await vi.waitFor(() =>
      expect(subscriber.onItem).toHaveBeenCalledWith(event),
    );
    expect(subscriber.onCaughtUp).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/agent/events?documentRef=document-1&afterCursor=postgres%3A0",
      expect.objectContaining({
        credentials: "include",
        signal: expect.any(AbortSignal),
      }),
    );
    subscription.unsubscribe();
  });

  it("reconnects SSE before its authentication age expires", async () => {
    const streams: ReadableStream<Uint8Array>[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>((_, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.close());
        },
      });
      streams.push(body);
      return Promise.resolve(
        new Response(body, {
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    });
    const transport = createHttpAgentTransport({
      baseUrl: "/api/agent",
      fetch,
      maxConnectionAgeMs: 10,
      reconnectDelayMs: 0,
    });
    const subscription = transport.subscribe(
      { documentRef: "document-1" },
      { onItem: vi.fn(), onError: vi.fn(), onCaughtUp: vi.fn() },
    );

    await vi.waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(1));

    subscription.unsubscribe();
    expect(streams.length).toBeGreaterThan(1);
  });

  it("reports an expired Agent session and stops reconnecting", async () => {
    const onUnauthorized = vi.fn();
    const onError = vi.fn();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const transport = createHttpAgentTransport({
      baseUrl: "/api/agent",
      fetch,
      onUnauthorized,
      reconnectDelayMs: 0,
    });
    transport.subscribe(
      { documentRef: "document-1" },
      { onItem: vi.fn(), onError, onCaughtUp: vi.fn() },
    );

    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());

    expect(onError).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
