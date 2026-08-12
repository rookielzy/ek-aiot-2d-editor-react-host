import { expect, it, vi } from "vitest";

import { performProtectedLogout } from "./logout";

it("stops and disposes Agent work before clearing the demo session and calling logout", async () => {
  const calls: string[] = [];
  const stopActiveTurn = vi.fn(async () => {
    calls.push("stop");
  });
  const disposeAgent = vi.fn(() => calls.push("dispose"));
  const clearDemoSession = vi.fn(() => calls.push("clear"));
  const logout = vi.fn(async () => {
    calls.push("logout");
  });
  const navigateToLogin = vi.fn(() => calls.push("navigate"));

  await performProtectedLogout({
    stopActiveTurn,
    disposeAgent,
    clearDemoSession,
    logout,
    navigateToLogin,
  });

  expect(calls).toEqual(["stop", "dispose", "clear", "logout", "navigate"]);
});

it("still disposes, clears, and logs out when stopping the active turn fails", async () => {
  const calls: string[] = [];

  await expect(
    performProtectedLogout({
      stopActiveTurn: async () => {
        calls.push("stop");
        throw new Error("Agent unavailable");
      },
      disposeAgent: () => calls.push("dispose"),
      clearDemoSession: () => calls.push("clear"),
      logout: async () => {
        calls.push("logout");
      },
      navigateToLogin: () => calls.push("navigate"),
    }),
  ).resolves.toBeUndefined();

  expect(calls).toEqual(["stop", "dispose", "clear", "logout", "navigate"]);
});
