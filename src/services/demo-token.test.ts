import { beforeEach, expect, it } from "vitest";

import {
  DEMO_ACCESS_TOKEN_COOKIE,
  createBrowserDemoTokenStore,
} from "./demo-token";

beforeEach(() => {
  document.cookie = `${DEMO_ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0`;
});

it("stores and clears the demo access token in a browser cookie", () => {
  const store = createBrowserDemoTokenStore();

  store.set("token-value", 60);
  expect(store.get()).toBe("token-value");

  store.clear();
  expect(store.get()).toBeUndefined();
});
