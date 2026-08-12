export const DEMO_ACCESS_TOKEN_COOKIE = "ek_aiot_demo_access_token";

export interface DemoTokenStore {
  get(): string | undefined;
  set(token: string, expiresInSeconds: number): void;
  clear(): void;
}

export function createBrowserDemoTokenStore(): DemoTokenStore {
  return {
    get() {
      const prefix = `${DEMO_ACCESS_TOKEN_COOKIE}=`;
      return document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix))
        ?.slice(prefix.length);
    },
    set(token, expiresInSeconds) {
      if (!/^[A-Za-z0-9._~-]+$/.test(token)) {
        throw new Error(
          "The demo access token contains unsupported characters.",
        );
      }
      document.cookie = serializeTokenCookie(token, {
        maxAge: Math.max(0, Math.floor(expiresInSeconds)),
      });
    },
    clear() {
      document.cookie = serializeTokenCookie("", { maxAge: 0 });
    },
  };
}

function serializeTokenCookie(
  token: string,
  options: { maxAge: number },
): string {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `${DEMO_ACCESS_TOKEN_COOKIE}=${token}; Path=/; Max-Age=${options.maxAge}; SameSite=Lax${secure}`;
}
