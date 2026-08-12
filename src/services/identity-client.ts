import { runtimeConfig } from "@/config/runtime";

import { createIdentityClient } from "./identity";

export const identityClient = createIdentityClient(runtimeConfig);
