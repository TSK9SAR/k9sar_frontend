export type PublicActiveCert = {
  discipline: string;
  expires_mm_yy: string; // "MM/YY"
};

export type PublicTeamRow = {
  team_id: number;
  handler_full_name: string;
  dog_name: string;
  email: string;
  phone?: string | null;
  distance_mi?: number | null;
  active_certs: PublicActiveCert[];
};

export type PublicMatrixResponse = {
  disciplines: string[];
  teams: PublicTeamRow[];
};
