import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  ActiveAccessContext,
  Activity,
  ActivityCategory,
  ActivityFormValues,
  TeamDoc,
} from "../types/activity";
import { getTodayISODate } from "../utils/activityHelpers";

interface ActivityFormModalProps {
  open: boolean;
  editingActivity: Activity | null;
  prefillValues?: Partial<ActivityFormValues> | null;
  access: ActiveAccessContext;
  teams: TeamDoc[];
  onClose: () => void;
  onSave: (values: ActivityFormValues, existingId?: string) => void;
}

export function ActivityFormModal({
  open,
  editingActivity,
  prefillValues,
  access,
  teams,
  onClose,
  onSave,
}: ActivityFormModalProps) {
  const lockedTeamId: string | null =
    access.role === "pegawai" ? access.teamId : null;

  const [namaKegiatan, setNamaKegiatan] = useState("");
  const [kategori, setKategori] = useState<ActivityCategory>("Rapat Koordinasi");
  const [teamId, setTeamId] = useState<string>(access.teamId || "tim_1");
  const [pic, setPic] = useState("");
  const [tanggalMulaiPersiapan, setTanggalMulaiPersiapan] = useState(
    getTodayISODate()
  );
  const [tanggalPelaksanaan, setTanggalPelaksanaan] = useState(
    getTodayISODate()
  );
  const [tanggalPengingat, setTanggalPengingat] = useState(getTodayISODate());
  const [targetOutput, setTargetOutput] = useState("");
  const [catatan, setCatatan] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setErrorMsg("");

    if (editingActivity) {
      setNamaKegiatan(editingActivity.namaKegiatan);
      setKategori(editingActivity.kategori);
      setTeamId(lockedTeamId ?? editingActivity.teamId);
      setPic(editingActivity.pic);
      setTanggalMulaiPersiapan(editingActivity.tanggalMulaiPersiapan);
      setTanggalPelaksanaan(editingActivity.tanggalPelaksanaan);
      setTanggalPengingat(editingActivity.tanggalPengingat);
      setTargetOutput(editingActivity.targetOutput);
      setCatatan(editingActivity.catatan);
      return;
    }

    const today = getTodayISODate();
    setNamaKegiatan(prefillValues?.namaKegiatan ?? "");
    setKategori(prefillValues?.kategori ?? "Rapat Koordinasi");
    setTeamId(lockedTeamId ?? prefillValues?.teamId ?? access.teamId ?? "tim_1");
    setPic(prefillValues?.pic ?? "");
    setTanggalMulaiPersiapan(prefillValues?.tanggalMulaiPersiapan ?? today);
    setTanggalPelaksanaan(prefillValues?.tanggalPelaksanaan ?? today);
    setTanggalPengingat(prefillValues?.tanggalPengingat ?? today);
    setTargetOutput(prefillValues?.targetOutput ?? "");
    setCatatan(prefillValues?.catatan ?? "");
  }, [open, editingActivity, prefillValues, access.teamId, lockedTeamId]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaKegiatan.trim()) {
      setErrorMsg("Nama kegiatan wajib diisi.");
      return;
    }
    if (!pic.trim()) {
      setErrorMsg("Nama PIC wajib diisi.");
      return;
    }
    if (!tanggalMulaiPersiapan || !tanggalPelaksanaan || !tanggalPengingat) {
      setErrorMsg(
        "Seluruh tanggal persiapan, pelaksanaan, dan pengingat wajib diisi."
      );
      return;
    }
    if (!targetOutput.trim()) {
      setErrorMsg("Target output wajib diisi.");
      return;
    }

    const values: ActivityFormValues = {
      namaKegiatan: namaKegiatan.trim(),
      kategori,
      teamId: lockedTeamId ?? teamId,
      pic: pic.trim(),
      tanggalMulaiPersiapan,
      tanggalPelaksanaan,
      tanggalPengingat,
      targetOutput: targetOutput.trim(),
      catatan: catatan.trim(),
      status: editingActivity ? editingActivity.status : "Belum Dimulai",
      progres: editingActivity ? editingActivity.progres : 0,
      hasilKegiatan: editingActivity ? editingActivity.hasilKegiatan : "",
      isDemo: editingActivity ? editingActivity.isDemo : false,
    };

    onSave(values, editingActivity?.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-form-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="activity-form-title"
              className="text-base sm:text-lg font-bold text-[#0B1F3A]"
            >
              {editingActivity
                ? "Edit Rencana Kegiatan"
                : "Tambah Rencana Kegiatan"}
            </h2>
            <p className="text-xs text-slate-500">
              Lengkapi detail rencana pelaksanaan, PIC, pengingat, dan target output.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup formulir"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
        >
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label
              htmlFor="input-nama-kegiatan"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Nama Kegiatan <span className="text-red-600">*</span>
            </label>
            <input
              id="input-nama-kegiatan"
              type="text"
              value={namaKegiatan}
              onChange={(e) => setNamaKegiatan(e.target.value)}
              placeholder="Contoh: Rapat Koordinasi Persiapan Pencalonan Dewan ITU"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="input-kategori"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Kategori Kegiatan <span className="text-red-600">*</span>
              </label>
              <select
                id="input-kategori"
                value={kategori}
                onChange={(e) =>
                  setKategori(e.target.value as ActivityCategory)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              >
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="input-tim"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Tim Pelaksana <span className="text-red-600">*</span>
              </label>
              <select
                id="input-tim"
                value={teamId}
                disabled={Boolean(lockedTeamId)}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 focus:border-[#1D4ED8] focus:outline-none"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.nama_tim}
                  </option>
                ))}
              </select>
              {lockedTeamId && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Terkunci sesuai tim akun Anda ({access.teamName}).
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="input-pic"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              PIC (Penanggung Jawab) <span className="text-red-600">*</span>
            </label>
            <input
              id="input-pic"
              type="text"
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              placeholder="Nama pegawai penanggung jawab kegiatan"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="input-tgl-persiapan"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Tanggal Mulai Persiapan <span className="text-red-600">*</span>
              </label>
              <input
                id="input-tgl-persiapan"
                type="date"
                value={tanggalMulaiPersiapan}
                onChange={(e) => setTanggalMulaiPersiapan(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="input-tgl-pelaksanaan"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Tanggal Pelaksanaan <span className="text-red-600">*</span>
              </label>
              <input
                id="input-tgl-pelaksanaan"
                type="date"
                value={tanggalPelaksanaan}
                onChange={(e) => setTanggalPelaksanaan(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="input-tgl-pengingat"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Tanggal Pengingat <span className="text-red-600">*</span>
              </label>
              <input
                id="input-tgl-pengingat"
                type="date"
                value={tanggalPengingat}
                onChange={(e) => setTanggalPengingat(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="input-target-output"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Target Output <span className="text-red-600">*</span>
            </label>
            <textarea
              id="input-target-output"
              rows={2}
              value={targetOutput}
              onChange={(e) => setTargetOutput(e.target.value)}
              placeholder="Contoh: Dokumen posisi delegasi RI dan notulensi rapat lintas unit"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="input-catatan"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Catatan / Deskripsi
            </label>
            <textarea
              id="input-catatan"
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Deskripsi kegiatan, mitra terlibat, atau catatan khusus"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0B1F3A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#13325C] focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {editingActivity ? "Simpan Perubahan" : "Simpan Kegiatan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
