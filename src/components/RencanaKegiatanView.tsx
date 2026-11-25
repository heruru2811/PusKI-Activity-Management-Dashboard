import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
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
import { downloadExcelTemplate } from "../utils/excelImport";
import { InlineStatusEditor } from "./InlineStatusEditor";

interface RencanaKegiatanViewProps {
  activities: Activity[];
  access: ActiveAccessContext;
  teams: TeamDoc[];
  onOpenExcelImport: () => void;
  onStatusChange: (activityId: string, newStatus: ActivityStatus) => Promise<void>;
  onAddClick: () => void;
  onEditClick: (activity: Activity) => void;
  onDeleteConfirm: (activityId: string) => void;
}

export function RencanaKegiatanView({
  activities,
  access,
  teams,
  onOpenExcelImport,
  onStatusChange,
  onAddClick,
  onEditClick,
  onDeleteConfirm,
}: RencanaKegiatanViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);

  const canCreateActivity = access.canManageActivities;

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities
      .filter((act) => {
        if (categoryFilter !== "ALL" && act.kategori !== categoryFilter) {
          return false;
        }
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
            act.kategori,
            act.catatan,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.tanggalPelaksanaan.localeCompare(b.tanggalPelaksanaan));
  }, [activities, searchQuery, categoryFilter, teamFilter, statusFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("ALL");
    setTeamFilter("ALL");
    setStatusFilter("ALL");
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    categoryFilter !== "ALL" ||
    teamFilter !== "ALL" ||
    statusFilter !== "ALL";

  return (
    <div className="space-y-5">
      {/* Header & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A]">
            Rencana Kegiatan PusKI
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Catat agenda kerja, jadwal persiapan, pengingat, PIC, dan target output tim.
          </p>
        </div>

        {canCreateActivity && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {access.canManageAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void downloadExcelTemplate(teams);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0B1F3A] transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <Download className="h-4 w-4 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
                  <span>Download Template Excel</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenExcelImport}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0B1F3A] transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
                  <span>Import Excel</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onAddClick}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Tambah Kegiatan</span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama kegiatan, PIC, atau target output..."
              aria-label="Cari kegiatan"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter kategori"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="ALL">Semua Kategori</option>
              {ACTIVITY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={access.canViewAllTeams ? teamFilter : access.teamId}
              disabled={!access.canViewAllTeams}
              onChange={(e) => setTeamFilter(e.target.value)}
              aria-label="Filter tim pelaksana"
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

          <div className="lg:col-span-3 flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Menampilkan{" "}
            <strong className="font-mono tabular-nums text-slate-800">
              {filteredActivities.length}
            </strong>{" "}
            dari{" "}
            <strong className="font-mono tabular-nums text-slate-800">
              {activities.length}
            </strong>{" "}
            kegiatan
          </span>
        </div>
      </div>

      {/* Table / Responsive List */}
      {filteredActivities.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-slate-800">
            Tidak ada kegiatan yang sesuai
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {hasActiveFilters
              ? "Coba ubah kata kunci pencarian atau atur ulang filter yang aktif."
              : "Mulai dengan menambahkan rencana kegiatan pertama Anda ke Cloud Firestore."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Atur Ulang Filter
              </button>
            ) : (
              canCreateActivity && (
                <button
                  type="button"
                  onClick={onAddClick}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Kegiatan</span>
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                    <th className="px-4 py-3">Kegiatan & Kategori</th>
                    <th className="px-4 py-3 whitespace-nowrap">Tim / PIC</th>
                    <th className="px-4 py-3 whitespace-nowrap">Jadwal</th>
                    <th className="px-4 py-3">Target Output</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredActivities.map((act) => {
                    const effStatus = getEffectiveStatus(act);
                    const editable = canManageActivity(act, access);

                    return (
                      <tr
                        key={act.id}
                        className="align-top transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            {act.isDemo && (
                              <>
                                <span className="font-mono font-semibold text-[#1D4ED8]">
                                  DATA DEMO
                                </span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span>{act.kategori}</span>
                          </div>
                          <p className="mt-0.5 font-semibold text-slate-900">
                            {act.namaKegiatan}
                          </p>
                          {act.catatan && (
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                              {act.catatan}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="font-semibold text-slate-800">
                            {act.timPelaksana}
                          </p>
                          <p className="text-xs text-slate-500">PIC: {act.pic}</p>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono tabular-nums text-slate-700 space-y-1">
                          <div>
                            <span className="text-slate-400">Persiapan: </span>
                            <span>{formatTanggalID(act.tanggalMulaiPersiapan)}</span>
                          </div>
                          <div className="font-semibold text-slate-900">
                            <span className="font-normal text-slate-400">
                              Pelaksanaan:{" "}
                            </span>
                            <span>{formatTanggalID(act.tanggalPelaksanaan)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Pengingat: </span>
                            <span>{formatTanggalID(act.tanggalPengingat)}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 max-w-xs text-xs text-slate-700 leading-relaxed">
                          {act.targetOutput}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <InlineStatusEditor
                            activityId={act.id}
                            activityName={act.namaKegiatan}
                            storedStatus={act.status}
                            effectiveStatus={effStatus}
                            canEdit={editable}
                            isAdmin={access.role === "admin"}
                            onChangeStatus={onStatusChange}
                          />
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={!editable}
                              onClick={() => onEditClick(act)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              title="Edit kegiatan"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={!editable}
                              onClick={() => setPendingDelete(act)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                              title="Hapus kegiatan"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredActivities.map((act) => {
              const effStatus = getEffectiveStatus(act);
              const editable = canManageActivity(act, access);

              return (
                <div
                  key={act.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        {act.isDemo && (
                          <>
                            <span className="font-mono font-semibold text-[#1D4ED8]">
                              DATA DEMO
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{act.timPelaksana}</span>
                        <span aria-hidden="true">·</span>
                        <span>{act.kategori}</span>
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

                  <div className="space-y-1 text-xs text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">PIC:</span>{" "}
                      {act.pic}
                    </p>
                    <p className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        Pelaksanaan: {formatTanggalID(act.tanggalPelaksanaan)}
                      </span>
                    </p>
                    <p className="font-mono tabular-nums text-slate-500">
                      Persiapan: {formatTanggalID(act.tanggalMulaiPersiapan)} · Pengingat:{" "}
                      {formatTanggalID(act.tanggalPengingat)}
                    </p>
                    <p className="pt-1 text-slate-700">
                      <span className="font-medium text-slate-800">
                        Target Output:
                      </span>{" "}
                      {act.targetOutput}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => onEditClick(act)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => setPendingDelete(act)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <h3
                  id="delete-confirm-title"
                  className="text-base font-bold text-slate-900"
                >
                  Hapus Rencana Kegiatan?
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Kegiatan{" "}
                  <span className="font-semibold text-slate-900">
                    "{pendingDelete.namaKegiatan}"
                  </span>{" "}
                  akan dihapus secara permanen.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteConfirm(pendingDelete.id);
                  setPendingDelete(null);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Ya, Hapus Kegiatan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
