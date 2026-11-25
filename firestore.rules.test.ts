/**
 * Security Rule Verification Suite — Dirty Dozen & RBAC Matrix
 * Target: firestore.rules
 *
 * Covers:
 * - Admin Role Escalation Prevention (self-create 'admin', self-update 'admin', /admins client write)
 * - Role & Team Immutability after role_selected == true
 * - Admin, Pimpinan, and Pegawai access boundaries
 * - Dirty Dozen Adversarial Payloads (12 vectors)
 */

export interface RuleTestVector {
  id: number;
  name: string;
  path: string;
  operation: "get" | "list" | "create" | "update" | "delete";
  actorRole?: "admin" | "pimpinan" | "pegawai" | "anonymous";
  actorTeam?: string;
  emailVerified?: boolean;
  payload?: Record<string, unknown>;
  expected: "ALLOW" | "PERMISSION_DENIED";
}

export const DIRTY_DOZEN_PAYLOADS: RuleTestVector[] = [
  {
    id: 1,
    name: "Self-Privilege Escalation (Create Admin)",
    path: "/users/user_pegawai_1",
    operation: "create",
    actorRole: "pegawai",
    emailVerified: true,
    payload: {
      uid: "user_pegawai_1",
      nama: "Pegawai Uji",
      email: "pegawai@example.com",
      role: "admin",
      team_id: "tim_1",
      role_selected: true,
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 2,
    name: "Self-Privilege Escalation (Update Role/Team after confirmation)",
    path: "/users/user_pegawai_1",
    operation: "update",
    actorRole: "pegawai",
    emailVerified: true,
    payload: {
      role: "pimpinan",
      team_id: "tim_2",
      role_selected: true,
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 3,
    name: "PII Scraping (/users list by non-admin)",
    path: "/users",
    operation: "list",
    actorRole: "pegawai",
    emailVerified: true,
    expected: "PERMISSION_DENIED",
  },
  {
    id: 4,
    name: "Cross-Team Activity Creation",
    path: "/activities/act_cross_1",
    operation: "create",
    actorRole: "pegawai",
    actorTeam: "tim_1",
    emailVerified: true,
    payload: {
      team_id: "tim_2",
      created_by: "user_pegawai_1",
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 5,
    name: "Orphaned Team Reference",
    path: "/activities/act_orphan_1",
    operation: "create",
    actorRole: "admin",
    emailVerified: true,
    payload: {
      team_id: "tim_tidak_terdaftar",
      created_by: "user_admin_1",
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 6,
    name: "Identity Spoofing (created_by != auth.uid)",
    path: "/activities/act_spoof_1",
    operation: "create",
    actorRole: "pegawai",
    actorTeam: "tim_1",
    emailVerified: true,
    payload: {
      team_id: "tim_1",
      created_by: "other_user_uid",
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 7,
    name: "Shadow / Ghost Field Injection",
    path: "/activities/act_shadow_1",
    operation: "create",
    actorRole: "pegawai",
    actorTeam: "tim_1",
    emailVerified: true,
    payload: {
      team_id: "tim_1",
      isApprovedByBoss: true,
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 8,
    name: "Resource Exhaustion (Oversized String)",
    path: "/activities/act_huge_1",
    operation: "create",
    actorRole: "pegawai",
    actorTeam: "tim_1",
    emailVerified: true,
    payload: {
      nama_kegiatan: "A".repeat(1000),
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 9,
    name: "Client Timestamp Tampering",
    path: "/activities/act_time_1",
    operation: "create",
    actorRole: "pegawai",
    actorTeam: "tim_1",
    emailVerified: true,
    payload: {
      created_at: "2020-01-01T00:00:00Z",
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 10,
    name: "Cross-Team Task Tampering",
    path: "/activities/act_tim_2/tasks/task_1",
    operation: "create",
    actorRole: "pegawai",
    actorTeam: "tim_1",
    emailVerified: true,
    expected: "PERMISSION_DENIED",
  },
  {
    id: 11,
    name: "Terminal State Bypass (Pegawai modifying Selesai activity)",
    path: "/activities/act_selesai_1",
    operation: "update",
    actorRole: "pegawai",
    actorTeam: "tim_1",
    emailVerified: true,
    payload: {
      status: "Sedang Berjalan",
    },
    expected: "PERMISSION_DENIED",
  },
  {
    id: 12,
    name: "Unverified Email Spoofing & Unauthorized /admins Write",
    path: "/admins/attacker_uid",
    operation: "create",
    actorRole: "pegawai",
    emailVerified: false,
    payload: {
      uid: "attacker_uid",
      email: "attacker@example.com",
    },
    expected: "PERMISSION_DENIED",
  },
];
