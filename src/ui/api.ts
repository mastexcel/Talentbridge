/** Client HTTP des composants : JSON, erreurs normalisées { code, message, issues }. */
export class ApiError extends Error {
  constructor(public code: string, message: string, public issues: { path: string; message: string }[] = [], public details?: Record<string, unknown>) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body instanceof FormData ? undefined : { "content-type": "application/json" },
    body: init.body instanceof FormData ? init.body : init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { code: string; message: string; issues?: { path: string; message: string }[]; details?: Record<string, unknown> } }).error;
    throw new ApiError(e?.code ?? "INTERNAL", e?.message ?? "Une erreur est survenue.", e?.issues ?? [], e?.details);
  }
  return data as T;
}
