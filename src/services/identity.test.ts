import { describe, expect, it, vi } from "vitest";

import {
  AuthenticatedUserMismatchError,
  IdentityUnauthorizedError,
  createIdentityClient,
} from "./identity";

describe("identity client", () => {
  it("maps a 401 user-info response to the protected-login flow", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const client = createIdentityClient({
      userInfoUrl: "/auth/userinfo",
      fetch,
    });

    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(
      IdentityUnauthorizedError,
    );
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
    const client = createIdentityClient({
      userInfoUrl: "/auth/userinfo",
      fetch,
    });

    await expect(client.getCurrentUser()).resolves.toEqual({
      userId: "42",
      username: "Ada",
    });
  });

  it("rejects mismatched JSON and trusted response-header identities", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ userId: 42, username: "Ada" }), {
        headers: { "X-Authenticated-User-Id": "99" },
      }),
    );
    const client = createIdentityClient({
      userInfoUrl: "/auth/userinfo",
      fetch,
    });

    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(
      AuthenticatedUserMismatchError,
    );
  });

  it("uses the configured logout endpoint method", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = createIdentityClient({
      userInfoUrl: "/auth/userinfo",
      logoutUrl: "/auth/logout",
      logoutMethod: "GET",
      fetch,
    });

    await client.logout();

    expect(fetch).toHaveBeenCalledWith(
      "/auth/logout",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });
});
