export const CURRENT_DRAFT_KEY = "autoInvoice.currentInvoiceId";
export const PENDING_CREATE_KEY = "autoInvoice.pendingCreateKey";

// Storage can be unavailable (private mode, blocked site data); the app works without it.
export function readStorage(key: string, area: "local" | "session" = "local"): string | null {
  try {
    return (area === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null, area: "local" | "session" = "local"): void {
  try {
    const storage = area === "local" ? localStorage : sessionStorage;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // ignore
  }
}
