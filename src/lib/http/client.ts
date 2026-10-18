import type { Issue } from "@/modules/invoices/invoice.types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: Issue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK", "Could not reach the server. Check your connection.");
  }
  if (response.status === 401) redirectToLogin();
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as { error?: { code: string; message: string; issues?: Issue[] } } | null;
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(response.status, error?.code ?? "HTTP_ERROR", error?.message ?? `Request failed (${response.status}).`, error?.issues ?? []);
  }
  return payload as T;
}

function redirectToLogin(): void {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

export async function downloadFile(path: string): Promise<void> {
  const response = await fetch(path, { cache: "no-store" });
  if (response.status === 401) redirectToLogin();
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    throw new ApiError(response.status, payload?.error?.code ?? "HTTP_ERROR", payload?.error?.message ?? "Download failed.");
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "download.pdf";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
