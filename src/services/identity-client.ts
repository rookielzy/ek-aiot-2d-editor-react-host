import { runtimeConfig } from "@/config/runtime";

import { createBrowserDemoTokenStore } from "./demo-token";
import { createIdentityClient } from "./identity";

export const demoTokenStore = createBrowserDemoTokenStore();

export const identityClient = createIdentityClient({
  ...runtimeConfig,
  tokenStore: demoTokenStore,
});
