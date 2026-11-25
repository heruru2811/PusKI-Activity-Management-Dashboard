import {
  ActiveAccessContext,
  Activity,
  ActivityStatus,
  UserRole,
} from "../types/activity";

const MONTH_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const MONTH_FULL_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function getTodayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatTanggalID(dateStr: string, fullMonth = false): string {
  const parsed = parseISODate(dateStr);
  if (!parsed) return dateStr || "-";
  const day = parsed.getDate();
  const monthName = fullMonth
    ? MONTH_FULL_ID[parsed.getMonth()]
    : MONTH_SHORT_ID[parsed.getMonth()];
  const year = parsed.getFullYear();
  return `${day} ${monthName} ${year}`;
}

export function getMonthShortLabel(monthIndex: number): string {
  return MONTH_SHORT_ID[monthIndex] ?? "";
}

export function getMonthFullLabel(monthIndex: number): string {
  return MONTH_FULL_ID[monthIndex] ?? "";
}

export function diffDaysFromToday(dateStr: string): number | null {
  const target = parseISODate(dateStr);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getEffectiveStatus(activity: Activity): ActivityStatus {
  if (
    activity.status === "Selesai" ||
    activity.status === "Dibatalkan" ||
    activity.status === "Terlambat"
  ) {
    return activity.status;
  }
  const daysUntilExecution = diffDaysFromToday(activity.tanggalPelaksanaan);
  if (daysUntilExecution !== null && daysUntilExecution < 0) {
    return "Terlambat";
  }
  return activity.status;
}

export interface ReminderItem {
  activity: Activity;
  type: "overdue" | "reminder_due" | "approaching";
  daysUntilExecution: number;
  title: string;
  detail: string;
}

export function getActiveReminders(activities: Activity[]): ReminderItem[] {
  const reminders: ReminderItem[] = [];

  for (const act of activities) {
    const effective = getEffectiveStatus(act);
    if (effective === "Selesai" || effective === "Dibatalkan") continue;

    const daysExec = diffDaysFromToday(act.tanggalPelaksanaan);
    const daysReminder = diffDaysFromToday(act.tanggalPengingat);

    if (effective === "Terlambat" || (daysExec !== null && daysExec < 0)) {
      const lateDays = daysExec !== null ? Math.abs(daysExec) : 0;
      reminders.push({
        activity: act,
        type: "overdue",
        daysUntilExecution: daysExec ?? -1,
        title:
          lateDays > 0
            ? `Terlambat ${lateDays} hari`
            : "Melewati jadwal pelaksanaan",
        detail: `Jadwal pelaksanaan ${formatTanggalID(act.tanggalPelaksanaan)} belum berstatus Selesai.`,
      });
      continue;
    }

    if (daysExec !== null && daysExec >= 0 && daysExec <= 7) {
      reminders.push({
        activity: act,
        type: "approaching",
        daysUntilExecution: daysExec,
        title:
          daysExec === 0
            ? "Pelaksanaan Hari Ini"
            : `Mendekati Pelaksanaan (H-${daysExec})`,
        detail: `Pelaksanaan pada ${formatTanggalID(act.tanggalPelaksanaan)} · PIC: ${act.pic}`,
      });
      continue;
    }

    if (daysReminder !== null && daysReminder <= 0) {
      reminders.push({
        activity: act,
        type: "reminder_due",
        daysUntilExecution: daysExec ?? 999,
        title:
          daysReminder === 0
            ? "Pengingat Jadwal Hari Ini"
            : "Pengingat Jadwal Aktif",
        detail: `Tanggal pengingat ${formatTanggalID(act.tanggalPengingat)} telah tiba · Pelaksanaan ${formatTanggalID(act.tanggalPelaksanaan)}`,
      });
    }
  }

  return reminders.sort((a, b) => {
    const priority = { overdue: 0, approaching: 1, reminder_due: 2 };
    if (priority[a.type] !== priority[b.type]) {
      return priority[a.type] - priority[b.type];
    }
    return a.daysUntilExecution - b.daysUntilExecution;
  });
}

export function getVisibleActivities(
  activities: Activity[],
  access: ActiveAccessContext
): Activity[] {
  if (access.canViewAllTeams) {
    if (access.viewTeamFilter === "ALL") return activities;
    return activities.filter((a) => a.teamId === access.viewTeamFilter);
  }
  return activities.filter((a) => a.teamId === access.teamId);
}

export function canManageActivity(
  activity: Activity,
  access: ActiveAccessContext
): boolean {
  if (activity.createdBy === "demo-system") return true;
  if (access.role === "admin") return true;
  if (access.role === "pimpinan") return false;
  return activity.teamId === access.teamId;
}

export function getRoleDisplayLabel(role: UserRole): string {
  if (role === "admin") return "Admin";
  if (role === "pimpinan") return "Pimpinan";
  return "Pegawai";
}

export function formatDaysCountdown(days: number | null): string {
  if (days === null) return "-";
  if (days < 0) return `Lewat ${Math.abs(days)} hari`;
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok (H-1)";
  return `H-${days}`;
}
