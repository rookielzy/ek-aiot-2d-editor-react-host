export interface ProtectedLogoutOptions {
  stopActiveTurn(): Promise<unknown>;
  disposeAgent(): void;
  clearDemoSession(): void;
  logout(): Promise<void>;
  navigateToLogin(): void;
}

export async function performProtectedLogout(
  options: ProtectedLogoutOptions,
): Promise<void> {
  try {
    await options.stopActiveTurn();
  } catch {
    // Logout still invalidates the write lease and session when the Agent is unavailable.
  } finally {
    options.disposeAgent();
    options.clearDemoSession();
  }

  try {
    await options.logout();
  } finally {
    options.navigateToLogin();
  }
}
