import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  ACTIVITY_STATUSES,
  ActiveAccessContext,
  Activity,
  ActivityStatus,
  TeamDoc,
} from "../types/activity";
import {
  canManageActivity,
  formatTanggalID,
  getEffectiveStatus,
} from "../utils/activityHelpers";
import { InlineStatusEditor } from "./InlineStatusEditor";

interface MonitoringKegiatanViewProps {
  activities: Activity[];
  access: ActiveAccessContext;
  teams: TeamDoc[];
  highlightedActivityId: string | null;
  onClearHighlight: () => void;
  onUpdateClick: (activity: Activity) => void;
  onStatusChange: (activityId: string, newStatus: ActivityStatus) => Promise<void>;
}

export function MonitoringKegiatanView({
  activities,
  access,
  teams,
  highlightedActivityId,
  onClearHighlight,
  onUpdateClick,
  onStatusChange,
}: MonitoringKegiatanViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities
      .filter((act) => {
        if (teamFilter !== "ALL" && act.teamId !== teamFilter) {
          return false;
        }
        if (statusFilter !== "ALL") {
          const eff = getEffectiveStatus(act);
          if (eff !== statusFilter) return false;
        }
        if (q) {
          const haystack = [
            act.namaKegiatan,
            act.pic,
            act.targetOutput,
            act.hasilKegiatan,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.tanggalPelaksanaan.localeCompare(b.tanggalPelaksanaan));
  }, [activities, searchQuery, statusFilter, teamFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A]">
            Monitoring Pelaksanaan & Capaian
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Pantau progres, tugas persiapan, hasil kegiatan, dan perbarui status secara real-time.
          </p>
        </div>

        {highlightedActivityId && (
          <button
            type="button"
            onClick={onClearHighlight}
            className="self-start text-xs font-semibold text-[#1D4ED8] hover:underline"
          >
            Hapus sorotan pengingat
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kegiatan, PIC, target output, atau hasil..."
              aria-label="Cari di monitoring"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={access.canViewAllTeams ? teamFilter : access.teamId}
              disabled={!access.canViewAllTeams}
              onChange={(e) => setTeamFilter(e.target.value)}
              aria-label="Filter tim monitoring"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100 disabled:text-slate-500 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="ALL">Semua Tim</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nama_tim}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status monitoring"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredActivities.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">
            Tidak ada data monitoring yang cocok
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sesuaikan filter atau tambahkan kegiatan terlebih dahulu di menu Rencana Kegiatan.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                    <th className="px-4 py-3">Nama Kegiatan</th>
                    <th className="px-4 py-3 whitespace-nowrap">Tim</th>
                    <th className="px-4 py-3 whitespace-nowrap">PIC</th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      Tanggal Pelaksanaan
                    </th>
                    <th className="px-4 py-3">Target Output</th>
                    <th className="px-4 py-3">Hasil Kegiatan</th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      Status & Progres
                    </th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredActivities.map((act) => {
                    const effStatus = getEffectiveStatus(act);
                    const editable = canManageActivity(act, access);
                    const isHighlighted = highlightedActivityId === act.id;

                    return (
                      <tr
                        key={act.id}
                        className={`align-top transition-colors ${
                          isHighlighted
                            ? "bg-blue-50/70"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        <td className="px-4 py-3.5 max-w-[240px]">
                          {act.isDemo && (
                            <p className="text-[10px] font-mono font-semibold text-[#1D4ED8] mb-0.5">
                              DATA DEMO
                            </p>
                          )}
                          <p className="font-semibold text-slate-900">
                            {act.namaKegiatan}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {act.kategori}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-800">
                          {act.timPelaksana}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-700">
                          {act.pic}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono tabular-nums text-slate-800">
                          {formatTanggalID(act.tanggalPelaksanaan)}
                        </td>

                        <td className="px-4 py-3.5 max-w-[200px] text-xs text-slate-600 leading-relaxed">
                          {act.targetOutput}
                        </td>

                        <td className="px-4 py-3.5 max-w-[220px] text-xs text-slate-700 leading-relaxed">
                          {act.hasilKegiatan ? (
                            act.hasilKegiatan
                          ) : (
                            <span className="text-slate-400 italic">
                              Belum ada catatan hasil
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap min-w-[180px]">
                          <InlineStatusEditor
                            activityId={act.id}
                            activityName={act.namaKegiatan}
                            storedStatus={act.status}
                            effectiveStatus={effStatus}
                            canEdit={editable}
                            isAdmin={access.role === "admin"}
                            onChangeStatus={onStatusChange}
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full transition-all duration-200 ${
                                  effStatus === "Selesai"
                                    ? "bg-emerald-600"
                                    : effStatus === "Terlambat"
                                    ? "bg-red-600"
                                    : effStatus === "Dibatalkan"
                                    ? "bg-slate-400"
                                    : "bg-[#1D4ED8]"
                                }`}
                                style={{ width: `${act.progres}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-[11px] font-mono tabular-nums font-semibold text-slate-700">
                              {act.progres}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onUpdateClick(act)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                          >
                            <SlidersHorizontal
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            <span>{editable ? "Perbarui" : "Detail"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredActivities.map((act) => {
              const effStatus = getEffectiveStatus(act);
              const editable = canManageActivity(act, access);
              const isHighlighted = highlightedActivityId === act.id;

              return (
                <div
                  key={act.id}
                  className={`rounded-xl border p-4 space-y-3 ${
                    isHighlighted
                      ? "border-blue-300 bg-blue-50/50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
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
                        <span>PIC: {act.pic}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {act.namaKegiatan}
                      </h3>
                    </div>
                    <InlineStatusEditor
                      activityId={act.id}
                      activityName={act.namaKegiatan}
                      storedStatus={act.status}
                      effectiveStatus={effStatus}
                      canEdit={editable}
                      isAdmin={access.role === "admin"}
                      onChangeStatus={onStatusChange}
                    />
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <p className="font-mono tabular-nums text-slate-800">
                      Pelaksanaan: {formatTanggalID(act.tanggalPelaksanaan)}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">
                        Target Output:
                      </span>{" "}
                      {act.targetOutput}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">
                        Hasil Kegiatan:
                      </span>{" "}
                      {act.hasilKegiatan || (
                        <span className="italic text-slate-400">
                          Belum ada catatan hasil
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-[#1D4ED8]"
                          style={{ width: `${act.progres}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                        {act.progres}%
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onUpdateClick(act)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#13325C] shrink-0"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>{editable ? "Perbarui" : "Detail"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
