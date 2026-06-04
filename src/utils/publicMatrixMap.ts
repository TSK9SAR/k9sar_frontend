import type { PublicTeamRow } from "../types/publicMatrix";

export type PublicMatrixCell =
  | { status: "active"; expires_mm_yy: string }
  | { status: "none" };

export function buildPublicCellMap(team: PublicTeamRow): Record<string, PublicMatrixCell> {
  const map: Record<string, PublicMatrixCell> = {};
  for (const c of team.active_certs) {
    map[c.discipline] = { status: "active", expires_mm_yy: c.expires_mm_yy };
  }
  return map;
}
