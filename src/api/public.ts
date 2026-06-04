import type { PublicMatrixResponse } from "../types/publicMatrix";

export async function fetchPublicMatrix(params?: {
  q?: string;
  disciplines?: string[];
  affiliation_id?: number;
  lat?: number;
  lng?: number;
  radius_mi?: number;
}): Promise<PublicMatrixResponse> {
  const usp = new URLSearchParams();

  if (params?.q) usp.set("q", params.q);

  if (params?.disciplines?.length) {
    for (const d of params.disciplines) usp.append("discipline", d);
  }

  if (params?.lat != null) usp.set("lat", String(params.lat));
  if (params?.lng != null) usp.set("lng", String(params.lng));
  if (params?.radius_mi != null) usp.set("radius_mi", String(params.radius_mi));
  if (params?.affiliation_id != null) usp.set("affiliation_id", String(params.affiliation_id)); 
  
  const url = `/api/public/matrix${usp.toString() ? `?${usp}` : ""}`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Public matrix failed: ${resp.status} ${await resp.text()}`);
  return resp.json();
}
