const env = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

const logoutMethod = env("UMI_APP_LOGOUT_METHOD", "POST").toUpperCase();
if (logoutMethod !== "GET" && logoutMethod !== "POST") {
  throw new Error("UMI_APP_LOGOUT_METHOD must be GET or POST.");
}

export const runtimeConfig = {
  agentBaseUrl: env("UMI_APP_AGENT_BASE_URL", "/api/agent"),
  loginUrl: env("UMI_APP_LOGIN_URL", "/api/auth/login"),
  logoutMethod,
  logoutUrl: env("UMI_APP_LOGOUT_URL", "/api/auth/logout"),
  userInfoUrl: env("UMI_APP_USER_INFO_URL", "/api/auth/userinfo"),
} as const;
