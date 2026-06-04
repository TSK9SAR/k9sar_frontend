export type CertStatus = "none" | "active" | "expiring" | "expired";

export interface MatrixCell {
  expires?: string;        // ISO date, or undefined if no cert
  status: CertStatus;
}

export interface MatrixTeam {
  team_id: number;
  handler_first: string;
  handler_last: string;
  dog_name: string;
  certifications: Record<string, MatrixCell>; // key = discipline name/code
}

export interface CertificationMatrixDto {
  disciplines: string[];
  teams: MatrixTeam[];
}

