export type ActivityCategory =
  | "Sidang dan Forum Internasional"
  | "Rapat Koordinasi"
  | "Rapat Persiapan"
  | "Kerja Sama Bilateral"
  | "Kerja Sama Multilateral"
  | "Kunjungan Delegasi"
  | "Pelatihan dan Capacity Building"
  | "Lainnya";

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  "Sidang dan Forum Internasional",
  "Rapat Koordinasi",
  "Rapat Persiapan",
  "Kerja Sama Bilateral",
  "Kerja Sama Multilateral",
  "Kunjungan Delegasi",
  "Pelatihan dan Capacity Building",
  "Lainnya",
];

export type TeamName = "Tim 1" | "Tim 2" | "Tim 3";

export const TEAM_NAMES: TeamName[] = ["Tim 1", "Tim 2", "Tim 3"];

export type ActivityStatus =
  | "Belum Dimulai"
  | "Sedang Berjalan"
  | "Selesai"
  | "Terlambat"
  | "Dibatalkan";

export const ACTIVITY_STATUSES: ActivityStatus[] = [
  "Belum Dimulai",
  "Sedang Berjalan",
  "Selesai",
  "Terlambat",
  "Dibatalkan",
];

export type NavigationTab =
  | "dashboard"
  | "rencana"
  | "kalender"
  | "monitoring"
  | "ai-planner";

export type UserRole = "admin" | "pimpinan" | "pegawai";

export interface UserProfileDoc {
  uid: string;
  nama: string;
  email: string;
  foto_profil?: string;
  role: UserRole;
  team_id: string;
  jabatan?: string;
  role_selected?: boolean;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface TeamDoc {
  id: string;
  nama_tim: string;
  deskripsi: string;
  daftar_anggota: string[];
  created_at?: unknown;
  updated_at?: unknown;
}

export interface TaskItem {
  id: string;
  namaTugas: string;
  pic: string;
  deadline: string; // YYYY-MM-DD
  targetOutput: string;
  status: ActivityStatus;
  progres: number;
  createdAt?: string;
  updatedAt?: string;
}

export type TaskFormValues = Omit<TaskItem, "id" | "createdAt" | "updatedAt">;

export interface NotificationItem {
  id: string;
  activityId: string;
  judul: string;
  pesan: string;
  tanggalPengingat: string;
  dibaca: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// View-layer role context derived from Firestore user + optional admin view filter
export interface ActiveAccessContext {
  uid: string;
  nama: string;
  email: string;
  role: UserRole;
  teamId: string;
  teamName: string;
  jabatan: string;
  /** For admin/pimpinan UI filtering across teams; 'ALL' sees all teams */
  viewTeamFilter: string;
  canViewAllTeams: boolean;
  canManageActivities: boolean;
  canManageAdmin: boolean;
}

export interface Activity {
  id: string;
  namaKegiatan: string;
  kategori: ActivityCategory;
  teamId: string;
  timPelaksana: string;
  createdBy: string;
  pic: string;
  tanggalMulaiPersiapan: string; // YYYY-MM-DD
  tanggalPelaksanaan: string; // YYYY-MM-DD
  tanggalPengingat: string; // YYYY-MM-DD
  targetOutput: string;
  catatan: string; // Maps to Firestore `deskripsi`
  status: ActivityStatus;
  progres: number; // Maps to Firestore `persentase_progres`
  hasilKegiatan: string;
  isDemo?: boolean;
  demoId?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface DemoImportResult {
  totalInFile: number;
  savedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
}

export type ActivityFormValues = Omit<
  Activity,
  "id" | "createdBy" | "createdAt" | "updatedAt" | "timPelaksana"
> & {
  timPelaksana?: string;
};

export interface AIPlanResponse {
  summary: string;
  suggestedCategory: string;
  suggestedPrepStartDate: string;
  suggestedReminderDate: string;
  recommendedTargetOutput: string;
  preparationStages: Array<{
    phase: string;
    title: string;
    description: string;
  }>;
  coordinationMeetings: Array<{
    title: string;
    participants: string;
    timing: string;
    agenda: string;
  }>;
  timeline: Array<{
    dateRange: string;
    milestone: string;
    picRole: string;
  }>;
  supportingRequirements: Array<{
    category: string;
    item: string;
  }>;
  stageOutputs: Array<{
    stage: string;
    output: string;
    indicator: string;
  }>;
}
