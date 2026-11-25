import { useState } from "react";
import { Pencil, Plus, Trash2, Users, X, Shield } from "lucide-react";
import {
  TeamDoc,
  UserProfileDoc,
  UserRole,
} from "../types/activity";
import {
  adminUpdateUserAccess,
  removeTeam,
  upsertTeam,
} from "../services/firestoreService";

interface AdminManagementModalProps {
  open: boolean;
  currentUid: string;
  teams: TeamDoc[];
  users: UserProfileDoc[];
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export function AdminManagementModal({
  open,
  currentUid,
  teams,
  users,
  onClose,
  onNotify,
}: AdminManagementModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"teams" | "users">("teams");

  // Team Form State
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamIdInput, setTeamIdInput] = useState("");
  const [namaTim, setNamaTim] = useState("");
  const [deskripsiTim, setDeskripsiTim] = useState("");
  const [anggotaInput, setAnggotaInput] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamFormVisible, setTeamFormVisible] = useState(false);

  // User Edit State
  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("pegawai");
  const [userTeamId, setUserTeamId] = useState("tim_1");
  const [userJabatan, setUserJabatan] = useState("Pegawai");
  const [userSaving, setUserSaving] = useState(false);

  if (!open) return null;

  const openNewTeamForm = () => {
    setEditingTeamId(null);
    setTeamIdInput("");
    setNamaTim("");
    setDeskripsiTim("");
    setAnggotaInput("");
    setTeamFormVisible(true);
  };

  const openEditTeamForm = (team: TeamDoc) => {
    setEditingTeamId(team.id);
    setTeamIdInput(team.id);
    setNamaTim(team.nama_tim);
    setDeskripsiTim(team.deskripsi);
    setAnggotaInput(team.daftar_anggota.join(", "));
    setTeamFormVisible(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaTim.trim()) return;
    const rawId = editingTeamId ?? (teamIdInput.trim() || namaTim.trim().toLowerCase().replace(/\s+/g, "_"));
    const members = anggotaInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setTeamSaving(true);
    try {
      await upsertTeam(
        rawId,
        {
          nama_tim: namaTim.trim(),
          deskripsi: deskripsiTim.trim(),
          daftar_anggota: members,
        },
        editingTeamId === null
      );
      setTeamFormVisible(false);
      onNotify(
        editingTeamId ? "Data tim berhasil diperbarui." : "Tim baru berhasil ditambahkan."
      );
    } finally {
      setTeamSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    await removeTeam(teamId);
    onNotify("Data tim berhasil dihapus dari Firestore.");
  };

  const startEditUser = (u: UserProfileDoc) => {
    setEditingUserUid(u.uid);
    setUserRole(u.role);
    setUserTeamId(u.team_id);
    setUserJabatan(u.jabatan || "Pegawai");
  };

  const handleSaveUser = async (uid: string) => {
    setUserSaving(true);
    try {
      await adminUpdateUserAccess(uid, {
        role: userRole,
        team_id: userTeamId,
        jabatan: userJabatan,
      });
      setEditingUserUid(null);
      onNotify("Hak akses dan tim pengguna berhasil diperbarui.");
    } finally {
      setUserSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-mgmt-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="admin-mgmt-title"
              className="text-base sm:text-lg font-bold text-[#0B1F3A]"
            >
              Kelola Tim & Pengguna PusKI
            </h2>
            <p className="text-xs text-slate-500">
              Pengaturan terpusat koleksi teams dan users pada Cloud Firestore.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup panel admin"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-3 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setActiveSubTab("teams")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeSubTab === "teams"
                ? "bg-[#0B1F3A] text-white"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Daftar Tim ({teams.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("users")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeSubTab === "users"
                ? "bg-[#0B1F3A] text-white"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Pengguna & Role ({users.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeSubTab === "teams" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Tim aktif digunakan untuk pengelompokan kegiatan dan hak akses pegawai.
                </p>
                <button
                  type="button"
                  onClick={openNewTeamForm}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Tim</span>
                </button>
              </div>

              {teamFormVisible && (
                <form
                  onSubmit={handleSaveTeam}
                  className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ID Tim (misal: tim_4)
                      </label>
                      <input
                        type="text"
                        value={teamIdInput}
                        disabled={Boolean(editingTeamId)}
                        onChange={(e) => setTeamIdInput(e.target.value)}
                        placeholder="tim_4"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Tim *
                      </label>
                      <input
                        type="text"
                        required
                        value={namaTim}
                        onChange={(e) => setNamaTim(e.target.value)}
                        placeholder="Contoh: Tim 4"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Deskripsi Bidang Kerja
                    </label>
                    <input
                      type="text"
                      value={deskripsiTim}
                      onChange={(e) => setDeskripsiTim(e.target.value)}
                      placeholder="Uraian tugas dan fokus tim"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Daftar Anggota (pisahkan dengan koma)
                    </label>
                    <input
                      type="text"
                      value={anggotaInput}
                      onChange={(e) => setAnggotaInput(e.target.value)}
                      placeholder="Rizky Pratama, Nadia Kusuma"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setTeamFormVisible(false)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={teamSaving}
                      className="rounded-lg bg-[#0B1F3A] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#13325C]"
                    >
                      {teamSaving ? "Menyimpan..." : "Simpan Tim"}
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {team.nama_tim}
                        </p>
                        <span className="font-mono text-[11px] text-slate-400">
                          {team.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{team.deskripsi}</p>
                      <p className="text-[11px] text-slate-500">
                        Anggota:{" "}
                        {team.daftar_anggota.length > 0
                          ? team.daftar_anggota.join(", ")
                          : "Belum diisi"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditTeamForm(team)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      {!["tim_1", "tim_2", "tim_3"].includes(team.id) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTeam(team.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === "users" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Atur peran (`admin`, `pimpinan`, `pegawai`) dan penempatan tim pengguna yang telah login.
              </p>

              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                {users.map((u) => {
                  const isEditing = editingUserUid === u.uid;
                  return (
                    <div key={u.uid} className="px-4 py-3.5 space-y-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {u.nama}{" "}
                            {u.uid === currentUid && (
                              <span className="text-[11px] font-mono text-[#1D4ED8]">
                                (Anda)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {u.email} · {u.jabatan || "Pegawai"}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-700">
                            {u.role} · {u.team_id}
                          </span>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => startEditUser(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Ubah Akses</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <select
                            value={userRole}
                            onChange={(e) => setUserRole(e.target.value as UserRole)}
                            aria-label="Role pengguna"
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          >
                            <option value="pegawai">pegawai</option>
                            <option value="pimpinan">pimpinan</option>
                            <option value="admin">admin</option>
                          </select>

                          <select
                            value={userTeamId}
                            onChange={(e) => setUserTeamId(e.target.value)}
                            aria-label="Tim pengguna"
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          >
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nama_tim}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={userJabatan}
                            onChange={(e) => setUserJabatan(e.target.value)}
                            placeholder="Jabatan (misal: Ketua Tim)"
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingUserUid(null)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={userSaving}
                              onClick={() => handleSaveUser(u.uid)}
                              className="rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              {userSaving ? "..." : "Simpan"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
