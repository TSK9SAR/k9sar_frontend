export type DashboardPermissions = {
  can_manage_members: boolean;
  can_manage_teams: boolean;
  can_manage_disciplines: boolean;
  can_manage_standards: boolean;
  can_hard_delete: boolean;
};

export type DashboardKpis = {
  teams: number;
  handlers: number;
  dogs: number;
  certs_expiring_30: number;
  certs_expiring_90: number;
};

export type ExpiringCertRow = {
  certification_id: number;
  team_id: number;
  handler_name: string;
  dog_name: string;
  standard_name: string;
  expires_at: string | null; // ISO string from API
  days_left: number | null;
};

export type RecentActivityRow = {
  type: string;
  when: string; // ISO
  summary: string;
};

export type DashboardSummary = {
  permissions: DashboardPermissions;
  kpis: DashboardKpis;
  queues: {
    expiring_certs: ExpiringCertRow[];
    recent_activity: RecentActivityRow[];
  };
  trends: {
    issued_by_week: { bucket: string; count: number }[];
  };
};
