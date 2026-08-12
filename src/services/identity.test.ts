import { describe, expect, it, vi } from "vitest";

import {
  AuthenticatedUserMismatchError,
  IdentityUnauthorizedError,
  createIdentityClient,
} from "./identity";

function createTokenStore(initial?: string) {
  let token = initial;
  return {
    clear: vi.fn(() => {
      token = undefined;
    }),
    get: vi.fn(() => token),
    set: vi.fn((next: string) => {
      token = next;
    }),
  };
}

describe("identity client", () => {
  it("maps a 401 user-info response to the protected-login flow", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const tokenStore = createTokenStore("access-token");
    const client = createIdentityClient({
      loginEndpoint: "/auth/login",
      userInfoUrl: "/auth/userinfo",
      tokenStore,
      fetch,
    });

    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(
      IdentityUnauthorizedError,
    );
    expect(tokenStore.clear).toHaveBeenCalledOnce();
  });

  it("accepts a stable userId only when JSON and trusted response header match", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ userId: 42, username: "Ada" }), {
        headers: {
          "Content-Type": "application/json",
          "X-Authenticated-User-Id": "42",
        },
      }),
    );
    const tokenStore = createTokenStore("access-token");
    const client = createIdentityClient({
      loginEndpoint: "/auth/login",
      userInfoUrl: "/auth/userinfo",
      tokenStore,
      fetch,
    });

    await expect(client.getCurrentUser()).resolves.toEqual({
      userId: "42",
      username: "Ada",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/auth/userinfo",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("rejects mismatched JSON and trusted response-header identities", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ userId: 42, username: "Ada" }), {
        headers: { "X-Authenticated-User-Id": "99" },
      }),
    );
    const tokenStore = createTokenStore("access-token");
    const client = createIdentityClient({
      loginEndpoint: "/auth/login",
      userInfoUrl: "/auth/userinfo",
      tokenStore,
      fetch,
    });

    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(
      AuthenticatedUserMismatchError,
    );
    expect(tokenStore.clear).toHaveBeenCalledOnce();
  });

  it("uses the configured logout endpoint method", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const tokenStore = createTokenStore("access-token");
    const client = createIdentityClient({
      loginEndpoint: "/auth/login",
      userInfoUrl: "/auth/userinfo",
      logoutUrl: "/auth/logout",
      logoutMethod: "GET",
      tokenStore,
      fetch,
    });

    await client.logout();

    expect(fetch).toHaveBeenCalledWith(
      "/auth/logout",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
    expect(tokenStore.clear).toHaveBeenCalledOnce();
  });

  it("clears the demo token even when the logout endpoint fails", async () => {
    const tokenStore = createTokenStore("access-token");
    const client = createIdentityClient({
      loginEndpoint: "/auth/login",
      userInfoUrl: "/auth/userinfo",
      logoutUrl: "/auth/logout",
      logoutMethod: "GET",
      tokenStore,
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    });

    await expect(client.logout()).rejects.toThrow(
      "Logout request failed: 500.",
    );
    expect(tokenStore.clear).toHaveBeenCalledOnce();
  });

  it("logs in with JSON credentials and stores the access token", async () => {
    const tokenStore = createTokenStore();
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        access_token: "access-token",
        token_type: "bearer",
        refresh_token: "refresh-token",
        expires_in: 604799,
        scope: "server",
      }),
    );
    const client = createIdentityClient({
      loginEndpoint: "/auth/login",
      userInfoUrl: "/auth/userinfo",
      tokenStore,
      fetch,
    });

    await client.login({ mobile: "13800138001", password: "secret" });

    const [, request] = fetch.mock.calls[0] as [string, RequestInit];
    expect(request.method).toBe("POST");
    expect(request.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(request.body as string)).toEqual({
      mobile: "13800138001",
      password: "secret",
    });
    expect(tokenStore.set).toHaveBeenCalledWith("access-token", 604799);
  });

  it("requires a demo token before requesting protected identity data", async () => {
    const fetch = vi.fn();
    const client = createIdentityClient({
      loginEndpoint: "/auth/login",
      userInfoUrl: "/auth/userinfo",
      tokenStore: createTokenStore(),
      fetch,
    });

    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(
      IdentityUnauthorizedError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
