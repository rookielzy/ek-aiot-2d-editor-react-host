const AUTHENTICATED_USER_ID_HEADER = "X-Authenticated-User-Id";

export interface AuthenticatedUser {
  userId: string;
  username: string;
  avatarUrl?: string;
}

export interface IdentityClient {
  getCurrentUser(): Promise<AuthenticatedUser>;
  logout(): Promise<void>;
  loginUrl: string;
}

export interface IdentityClientOptions {
  userInfoUrl: string;
  logoutUrl?: string;
  loginUrl?: string;
  logoutMethod?: "GET" | "POST";
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
    async getCurrentUser() {
      const response = await request(options.userInfoUrl, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (response.status === 401) throw new IdentityUnauthorizedError();
      if (!response.ok)
        throw new Error(`User information request failed: ${response.status}.`);

      const payload = (await response.json()) as Record<string, unknown>;
      const candidate = isRecord(payload.data) ? payload.data : payload;
      const jsonUserId = normalizeUserId(candidate.userId);
      const trustedUserId = normalizeUserId(
        response.headers.get(AUTHENTICATED_USER_ID_HEADER),
      );
      if (!jsonUserId || !trustedUserId || jsonUserId !== trustedUserId) {
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
      if (!options.logoutUrl) return;
      const response = await request(options.logoutUrl, {
        method: options.logoutMethod ?? "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 401) {
        throw new Error(`Logout request failed: ${response.status}.`);
      }
    },
  };
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
