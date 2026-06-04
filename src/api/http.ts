const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "GET",
    credentials: "include", // keep if you use cookies; harmless otherwise
    headers: {
      "Content-Type": "application/json",
      // If you use Bearer tokens, add Authorization here from storage
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}
