import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Calendar,
  ChevronRight,
} from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUSES,
  ActiveAccessContext,
  Activity,
  ActivityStatus,
  NavigationTab,
  TeamDoc,
} from "../types/activity";
import {
  ReminderItem,
  diffDaysFromToday,
  formatDaysCountdown,
  formatTanggalID,
  getEffectiveStatus,
  getMonthFullLabel,
  getMonthShortLabel,
  parseISODate,
} from "../utils/activityHelpers";
import { StatusIndicator } from "./StatusIndicator";

interface DashboardViewProps {
  activities: Activity[];
  access: ActiveAccessContext;
  teams: TeamDoc[];
  userDisplayName: string;
  reminders: ReminderItem[];
  onNavigate: (tab: NavigationTab) => void;
  onInspectActivity: (activityId: string) => void;
}

const STATUS_CHART_COLORS: Record<ActivityStatus, string> = {
  Selesai: "#059669",
  "Sedang Berjalan": "#1D4ED8",
  "Belum Dimulai": "#64748B",
  Terlambat: "#DC2626",
  Dibatalkan: "#CBD5E1",
};

export function DashboardView({
  activities,
  access,
  teams,
  userDisplayName,
  reminders,
  onNavigate,
  onInspectActivity,
}: DashboardViewProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    for (const act of activities) {
      const d = parseISODate(act.tanggalPelaksanaan);
      if (d) years.add(d.getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [activities, currentYear]);

  // Dashboard Filters: tim, bulan, tahun, kategori, status
  const [filterTeamId, setFilterTeamId] = useState<string>("ALL");
  const [filterMonth, setFilterMonth] = useState<string>("ALL");
  const [filterYear, setFilterYear] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const [chartYear, setChartYear] = useState<number>(currentYear);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<ActivityStatus | null>(
    null
  );

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (filterTeamId !== "ALL" && act.teamId !== filterTeamId) return false;
      if (filterCategory !== "ALL" && act.kategori !== filterCategory)
        return false;
      const eff = getEffectiveStatus(act);
      if (filterStatus !== "ALL" && eff !== filterStatus) return false;

      if (filterMonth !== "ALL" || filterYear !== "ALL") {
        const d = parseISODate(act.tanggalPelaksanaan);
        if (!d) return false;
        if (filterYear !== "ALL" && d.getFullYear() !== Number(filterYear))
          return false;
        if (filterMonth !== "ALL" && d.getMonth() !== Number(filterMonth))
          return false;
      }
      return true;
    });
  }, [
    activities,
    filterTeamId,
    filterMonth,
    filterYear,
    filterCategory,
    filterStatus,
  ]);

  const hasDashboardFilters =
    filterTeamId !== "ALL" ||
    filterMonth !== "ALL" ||
    filterYear !== "ALL" ||
    filterCategory !== "ALL" ||
    filterStatus !== "ALL";

  const effectiveChartYear =
    filterYear !== "ALL" ? Number(filterYear) : chartYear;

  const stats = useMemo(() => {
    const total = filteredActivities.length;
    let bulanIni = 0;
    let selesai = 0;
    let sedangBerjalan = 0;
    let akanDatang = 0;
    let terlambat = 0;

    for (const act of filteredActivities) {
      const effStatus = getEffectiveStatus(act);
      const execDate = parseISODate(act.tanggalPelaksanaan);

      if (
        execDate &&
        execDate.getFullYear() === currentYear &&
        execDate.getMonth() === currentMonth
      ) {
        bulanIni += 1;
      }

      if (effStatus === "Selesai") {
        selesai += 1;
      } else if (effStatus === "Sedang Berjalan") {
        sedangBerjalan += 1;
      } else if (effStatus === "Terlambat") {
        terlambat += 1;
      } else if (effStatus === "Belum Dimulai") {
        const diff = diffDaysFromToday(act.tanggalPelaksanaan);
        if (diff === null || diff >= 0) {
          akanDatang += 1;
        }
      }
    }

    return { total, bulanIni, selesai, sedangBerjalan, akanDatang, terlambat };
  }, [filteredActivities, currentMonth, currentYear]);

  const monthlyData = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, idx) => ({
      monthIndex: idx,
      label: getMonthShortLabel(idx),
      fullLabel: getMonthFullLabel(idx),
      total: 0,
      selesai: 0,
      aktif: 0,
    }));

    for (const act of filteredActivities) {
      const d = parseISODate(act.tanggalPelaksanaan);
      if (!d || d.getFullYear() !== effectiveChartYear) continue;
      const m = d.getMonth();
      counts[m].total += 1;
      const eff = getEffectiveStatus(act);
      if (eff === "Selesai") {
        counts[m].selesai += 1;
      } else if (eff !== "Dibatalkan") {
        counts[m].aktif += 1;
      }
    }

    return counts;
  }, [filteredActivities, effectiveChartYear]);

  const maxMonthlyCount = useMemo(
    () => Math.max(1, ...monthlyData.map((m) => m.total)),
    [monthlyData]
  );

  const statusBreakdown = useMemo(() => {
    const counts: Record<ActivityStatus, number> = {
      Selesai: 0,
      "Sedang Berjalan": 0,
      "Belum Dimulai": 0,
      Terlambat: 0,
      Dibatalkan: 0,
    };

    for (const act of filteredActivities) {
      const eff = getEffectiveStatus(act);
      counts[eff] += 1;
    }

    const total = filteredActivities.length;
    return ACTIVITY_STATUSES.map((status) => ({
      status,
      count: counts[status],
      percentage: total > 0 ? Math.round((counts[status] / total) * 100) : 0,
      exactPercentage: total > 0 ? (counts[status] / total) * 100 : 0,
      color: STATUS_CHART_COLORS[status],
    }));
  }, [filteredActivities]);

  const teamBreakdown = useMemo(() => {
    const teamList = teams.map((team) => {
      const teamActs = filteredActivities.filter((a) => a.teamId === team.id);
      let selesai = 0;
      let berjalan = 0;
      let terlambat = 0;
      let belumDimulai = 0;
      for (const act of teamActs) {
        const eff = getEffectiveStatus(act);
        if (eff === "Selesai") selesai += 1;
        else if (eff === "Sedang Berjalan") berjalan += 1;
        else if (eff === "Terlambat") terlambat += 1;
        else if (eff === "Belum Dimulai") belumDimulai += 1;
      }
      return {
        id: team.id,
        namaTim: team.nama_tim,
        total: teamActs.length,
        selesai,
        berjalan,
        terlambat,
        belumDimulai,
      };
    });

    const maxTeamTotal = Math.max(1, ...teamList.map((t) => t.total));
    const totalCount = filteredActivities.length;

    return teamList.map((t) => ({
      ...t,
      barWidthPct: t.total > 0 ? Math.max(6, (t.total / maxTeamTotal) * 100) : 0,
      sharePct: totalCount > 0 ? Math.round((t.total / totalCount) * 100) : 0,
    }));
  }, [filteredActivities, teams]);

  const upcomingActivities = useMemo(() => {
    return filteredActivities
      .filter((act) => {
        const eff = getEffectiveStatus(act);
        return eff !== "Selesai" && eff !== "Dibatalkan";
      })
      .sort((a, b) => a.tanggalPelaksanaan.localeCompare(b.tanggalPelaksanaan))
      .slice(0, 6);
  }, [filteredActivities]);

  const donutSegments = useMemo(() => {
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    let accumulated = 0;

    return statusBreakdown
      .filter((item) => item.count > 0)
      .map((item) => {
        const length = (item.exactPercentage / 100) * circumference;
        const offset = circumference - accumulated;
        accumulated += length;
        return {
          ...item,
          circumference,
          dashArray: `${length} ${circumference - length}`,
          dashOffset: offset,
        };
      });
  }, [statusBreakdown]);

  const kpiCards = [
    {
      label: "Total Kegiatan",
      value: stats.total,
      sublabel: access.canViewAllTeams ? "Seluruh tim" : access.teamName,
      tone: "text-[#0B1F3A]",
    },
    {
      label: "Kegiatan Bulan Ini",
      value: stats.bulanIni,
      sublabel: `${getMonthFullLabel(currentMonth)} ${currentYear}`,
      tone: "text-[#1D4ED8]",
    },
    {
      label: "Kegiatan Selesai",
      value: stats.selesai,
      sublabel:
        stats.total > 0
          ? `${Math.round((stats.selesai / stats.total) * 100)}% dari total`
          : "0% dari total",
      tone: "text-emerald-700",
    },
    {
      label: "Sedang Berjalan",
      value: stats.sedangBerjalan,
      sublabel: "Dalam eksekusi aktif",
      tone: "text-blue-700",
    },
    {
      label: "Akan Datang",
      value: stats.akanDatang,
      sublabel: "Terjadwal belum dimulai",
      tone: "text-slate-700",
    },
    {
      label: "Terlambat",
      value: stats.terlambat,
      sublabel: "Perlu tindak lanjut",
      tone: stats.terlambat > 0 ? "text-red-700" : "text-slate-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Contextual Welcome */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Pusat Kelembagaan Internasional · Kementerian Komunikasi dan Digital
          </p>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A]">
            Selamat datang, {userDisplayName}
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Ringkasan kinerja dan jadwal kegiatan terkini tim Anda
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate("rencana")}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#13325C] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <span>Kelola Rencana</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Active Reminder Banner */}
      {reminders.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BellRing
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-amber-950">
                {reminders.length} kegiatan memerlukan perhatian pengingat atau melewati jadwal
              </p>
              <p className="text-xs text-amber-800">
                Prioritas terdekat: {reminders[0].activity.namaKegiatan} (
                {reminders[0].title})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onInspectActivity(reminders[0].activity.id)}
            className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100/60 whitespace-nowrap"
          >
            <span>Tinjau Kegiatan</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Dashboard Filters (Tim, Bulan, Tahun, Kategori, Status) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <select
            value={access.canViewAllTeams ? filterTeamId : access.teamId}
            disabled={!access.canViewAllTeams}
            onChange={(e) => setFilterTeamId(e.target.value)}
            aria-label="Filter dashboard tim"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:bg-slate-100 focus:border-[#1D4ED8] focus:outline-none"
          >
            <option value="ALL">Semua Tim</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama_tim}
              </option>
            ))}
          </select>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            aria-label="Filter dashboard bulan"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
          >
            <option value="ALL">Semua Bulan</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={String(i)}>
                {getMonthFullLabel(i)}
              </option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            aria-label="Filter dashboard tahun"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 font-mono focus:border-[#1D4ED8] focus:outline-none"
          >
            <option value="ALL">Semua Tahun</option>
            {availableYears.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter dashboard kategori"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
          >
            <option value="ALL">Semua Kategori</option>
            {ACTIVITY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter dashboard status"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            {ACTIVITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!hasDashboardFilters}
            onClick={() => {
              setFilterTeamId("ALL");
              setFilterMonth("ALL");
              setFilterYear("ALL");
              setFilterCategory("ALL");
              setFilterStatus("ALL");
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* 6 KPI Metric Grid */}
      <section aria-label="Statistik Kegiatan">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {kpiCards.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between"
            >
              <p className="text-xs font-medium text-slate-500">{item.label}</p>
              <p
                className={`mt-2 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums font-mono ${item.tone}`}
              >
                {item.value}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-400 truncate">
                {item.sublabel}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Charts Row */}
      <section
        className="grid grid-cols-1 gap-5 lg:grid-cols-12"
        aria-label="Grafik Kegiatan"
      >
        {/* Monthly Activity Bar Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-[#0B1F3A]">
                Grafik Kegiatan per Bulan
              </h3>
              <p className="text-xs text-slate-500">
                Distribusi jadwal pelaksanaan kegiatan sepanjang tahun{" "}
                {effectiveChartYear}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#1D4ED8]" />
                  <span>Berjalan / Terjadwal</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                  <span>Selesai</span>
                </span>
              </div>
              <select
                value={effectiveChartYear}
                disabled={filterYear !== "ALL"}
                onChange={(e) => setChartYear(Number(e.target.value))}
                aria-label="Pilih tahun grafik"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 font-mono disabled:opacity-60 focus:border-blue-600 focus:outline-none"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative mt-5 flex-1 min-h-[220px] flex flex-col justify-end">
            <div className="relative h-48 flex items-end gap-1.5 sm:gap-2.5 pt-6">
              {monthlyData.map((m) => {
                const totalHeightPct =
                  m.total > 0
                    ? Math.max(10, (m.total / maxMonthlyCount) * 100)
                    : 0;
                const selesaiRatio =
                  m.total > 0 ? (m.selesai / m.total) * 100 : 0;
                const isHovered = hoveredMonth === m.monthIndex;

                return (
                  <div
                    key={m.monthIndex}
                    onMouseEnter={() => setHoveredMonth(m.monthIndex)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    className="group relative flex h-full flex-1 flex-col items-center justify-end"
                  >
                    {isHovered && (
                      <div className="pointer-events-none absolute -top-2 z-20 -translate-y-full whitespace-nowrap rounded-lg border border-slate-200 bg-[#0B1F3A] px-2.5 py-1.5 text-[11px] text-white shadow-md">
                        <p className="font-semibold">
                          {m.fullLabel} {effectiveChartYear}
                        </p>
                        <p className="font-mono tabular-nums text-slate-200">
                          Total: {m.total} · Selesai: {m.selesai}
                        </p>
                      </div>
                    )}

                    <span
                      className={`mb-1 text-[11px] font-mono tabular-nums transition-opacity ${
                        m.total > 0
                          ? "text-slate-700 font-semibold"
                          : "text-slate-300"
                      }`}
                    >
                      {m.total > 0 ? m.total : "0"}
                    </span>

                    <div className="flex w-full max-w-[34px] items-end justify-center h-36 bg-slate-50 rounded-t-md overflow-hidden border border-slate-100">
                      {m.total > 0 && (
                        <div
                          className="w-full flex flex-col-reverse transition-all duration-200"
                          style={{ height: `${totalHeightPct}%` }}
                        >
                          {m.selesai > 0 && (
                            <div
                              className="w-full bg-emerald-600"
                              style={{ height: `${selesaiRatio}%` }}
                            />
                          )}
                          {m.total - m.selesai > 0 && (
                            <div className="w-full bg-[#1D4ED8] flex-1" />
                          )}
                        </div>
                      )}
                    </div>

                    <span
                      className={`mt-2 text-[11px] font-medium ${
                        m.monthIndex === currentMonth &&
                        effectiveChartYear === currentYear
                          ? "text-[#1D4ED8] font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status Percentage Donut & Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 flex flex-col">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-sm sm:text-base font-semibold text-[#0B1F3A]">
              Persentase Status Kegiatan
            </h3>
            <p className="text-xs text-slate-500">
              Proporsi status aktual berdasarkan data tersimpan
            </p>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12 text-center">
              <p className="text-sm text-slate-500">
                Belum ada data kegiatan untuk ditampilkan.
              </p>
            </div>
          ) : (
            <div className="mt-5 flex flex-1 flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6">
              <div className="relative h-40 w-40 shrink-0">
                <svg viewBox="0 0 144 144" className="h-full w-full -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="56"
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="18"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.status}
                      cx="72"
                      cy="72"
                      r="56"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={hoveredStatus === seg.status ? "21" : "18"}
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      className="transition-all duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredStatus(seg.status)}
                      onMouseLeave={() => setHoveredStatus(null)}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-2xl font-bold font-mono tabular-nums text-[#0B1F3A]">
                    {hoveredStatus
                      ? statusBreakdown.find((s) => s.status === hoveredStatus)
                          ?.percentage ?? 0
                      : stats.total}
                    {hoveredStatus ? "%" : ""}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 max-w-[90px] truncate px-1">
                    {hoveredStatus ?? "Total"}
                  </span>
                </div>
              </div>

              <div className="w-full flex-1 space-y-2.5">
                {statusBreakdown.map((item) => (
                  <div
                    key={item.status}
                    onMouseEnter={() => setHoveredStatus(item.status)}
                    onMouseLeave={() => setHoveredStatus(null)}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors ${
                      hoveredStatus === item.status ? "bg-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs tabular-nums">
                      <span className="text-slate-500">{item.count}</span>
                      <span className="w-10 text-right font-semibold text-slate-900">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Team Distribution Chart */}
      <section
        className="rounded-xl border border-slate-200 bg-white p-5"
        aria-label="Grafik Kegiatan berdasarkan Tim"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0B1F3A]">
              Grafik Kegiatan berdasarkan Tim
            </h3>
            <p className="text-xs text-slate-500">
              Distribusi beban kegiatan dan capaian penyelesaian masing-masing tim pelaksana
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
              <span>Selesai</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#1D4ED8]" />
              <span>Berjalan / Terjadwal</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-red-600" />
              <span>Terlambat</span>
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {teamBreakdown.map((team) => {
            const selesaiWidth =
              team.total > 0 ? (team.selesai / team.total) * 100 : 0;
            const terlambatWidth =
              team.total > 0 ? (team.terlambat / team.total) * 100 : 0;
            const aktifCount = team.total - team.selesai - team.terlambat;
            const aktifWidth =
              team.total > 0 ? (aktifCount / team.total) * 100 : 0;

            return (
              <div key={team.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-[#0B1F3A]">
                    {team.namaTim}
                  </span>
                  <div className="flex items-center gap-3 font-mono tabular-nums text-slate-600">
                    <span>
                      {team.total} kegiatan ({team.sharePct}%)
                    </span>
                  </div>
                </div>
                <div className="h-4 w-full rounded-md bg-slate-100 overflow-hidden border border-slate-200/70">
                  {team.total > 0 && (
                    <div
                      className="flex h-full transition-all duration-300"
                      style={{ width: `${team.barWidthPct}%` }}
                    >
                      {team.selesai > 0 && (
                        <div
                          className="h-full bg-emerald-600"
                          style={{ width: `${selesaiWidth}%` }}
                          title={`Selesai: ${team.selesai}`}
                        />
                      )}
                      {aktifCount > 0 && (
                        <div
                          className="h-full bg-[#1D4ED8]"
                          style={{ width: `${aktifWidth}%` }}
                          title={`Berjalan / Terjadwal: ${aktifCount}`}
                        />
                      )}
                      {team.terlambat > 0 && (
                        <div
                          className="h-full bg-red-600"
                          style={{ width: `${terlambatWidth}%` }}
                          title={`Terlambat: ${team.terlambat}`}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Upcoming / Nearest Activities List */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0B1F3A]">
              Daftar Kegiatan Terdekat
            </h3>
            <p className="text-xs text-slate-500">
              Agenda aktif dan mendatang berdasarkan urutan tanggal pelaksanaan
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("monitoring")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap"
          >
            <span>Lihat Semua di Monitoring</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {upcomingActivities.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Tidak ada kegiatan aktif atau mendatang
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Tambahkan rencana kegiatan baru pada menu Rencana Kegiatan.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcomingActivities.map((act) => {
              const effStatus = getEffectiveStatus(act);
              const daysLeft = diffDaysFromToday(act.tanggalPelaksanaan);
              const isUrgent = daysLeft !== null && daysLeft <= 3;

              return (
                <div
                  key={act.id}
                  className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {act.isDemo && (
                        <>
                          <span className="font-mono font-semibold text-[#1D4ED8]">
                            DATA DEMO
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="font-semibold text-slate-700">
                        {act.timPelaksana}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{act.kategori}</span>
                      <span aria-hidden="true">·</span>
                      <span>PIC: {act.pic}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectActivity(act.id)}
                      className="text-left text-sm font-semibold text-slate-900 hover:text-[#1D4ED8] transition-colors line-clamp-1"
                    >
                      {act.namaKegiatan}
                    </button>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      Target Output: {act.targetOutput}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 font-mono tabular-nums">
                        <Calendar
                          className="h-3.5 w-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        <span>{formatTanggalID(act.tanggalPelaksanaan)}</span>
                      </div>
                      <p
                        className={`text-[11px] font-mono tabular-nums ${
                          effStatus === "Terlambat" ||
                          (daysLeft !== null && daysLeft < 0)
                            ? "font-semibold text-red-700"
                            : isUrgent
                            ? "font-semibold text-amber-700"
                            : "text-slate-500"
                        }`}
                      >
                        {daysLeft !== null && daysLeft < 0 && (
                          <AlertTriangle
                            className="mr-1 inline h-3 w-3"
                            aria-hidden="true"
                          />
                        )}
                        {formatDaysCountdown(daysLeft)}
                      </p>
                    </div>

                    <div className="min-w-[130px] flex justify-end">
                      <StatusIndicator status={effStatus} compact />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
