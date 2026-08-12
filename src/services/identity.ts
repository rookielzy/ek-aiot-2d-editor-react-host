import type { DemoTokenStore } from "./demo-token";

const AUTHENTICATED_USER_ID_HEADER = "X-Authenticated-User-Id";

export interface LoginCredentials {
  mobile: string;
  password: string;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  avatarUrl?: string;
}

export interface IdentityClient {
  login(credentials: LoginCredentials): Promise<void>;
  getCurrentUser(): Promise<AuthenticatedUser>;
  logout(): Promise<void>;
  loginUrl: string;
}

export interface IdentityClientOptions {
  loginEndpoint: string;
  userInfoUrl: string;
  logoutUrl?: string;
  loginUrl?: string;
  logoutMethod?: "GET" | "POST";
  tokenStore: DemoTokenStore;
  fetch?: typeof globalThis.fetch;
}

export class IdentityUnauthorizedError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "IdentityUnauthorizedError";
  }
}

export class AuthenticatedUserMismatchError extends Error {
  constructor() {
    super("Authenticated user JSON and trusted response header do not match.");
    this.name = "AuthenticatedUserMismatchError";
  }
}

export function createIdentityClient(
  options: IdentityClientOptions,
): IdentityClient {
  const request = options.fetch ?? globalThis.fetch;
  return {
    loginUrl: options.loginUrl ?? "/login",
    async login(credentials) {
      const response = await request(options.loginEndpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        throw new Error(`Login request failed: ${response.status}.`);
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const accessToken = readString(payload.access_token);
      const expiresIn = normalizeExpiresIn(payload.expires_in);
      if (!accessToken || expiresIn === null) {
        throw new Error("Login response is missing a valid access token.");
      }
      options.tokenStore.set(accessToken, expiresIn);
    },
    async getCurrentUser() {
      const token = options.tokenStore.get();
      if (!token) throw new IdentityUnauthorizedError();
      const response = await request(options.userInfoUrl, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        options.tokenStore.clear();
        throw new IdentityUnauthorizedError();
      }
      if (!response.ok)
        throw new Error(`User information request failed: ${response.status}.`);

      const payload = (await response.json()) as Record<string, unknown>;
      const candidate = isRecord(payload.data) ? payload.data : payload;
      const jsonUserId = normalizeUserId(candidate.userId);
      const trustedUserId = normalizeUserId(
        response.headers.get(AUTHENTICATED_USER_ID_HEADER),
      );
      if (!jsonUserId || !trustedUserId || jsonUserId !== trustedUserId) {
        options.tokenStore.clear();
        throw new AuthenticatedUserMismatchError();
      }

      return {
        userId: jsonUserId,
        username:
          readString(candidate.username) ??
          readString(candidate.mobile) ??
          jsonUserId,
        ...(readString(candidate.avatarUrl)
          ? { avatarUrl: readString(candidate.avatarUrl) }
          : {}),
      };
    },
    async logout() {
      const token = options.tokenStore.get();
      try {
        if (!options.logoutUrl || !token) return;
        const response = await request(options.logoutUrl, {
          method: options.logoutMethod ?? "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok && response.status !== 401) {
          throw new Error(`Logout request failed: ${response.status}.`);
        }
      } finally {
        options.tokenStore.clear();
      }
    },
  };
}

function normalizeExpiresIn(value: unknown): number | null {
  const expiresIn =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null;
}

function normalizeUserId(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
