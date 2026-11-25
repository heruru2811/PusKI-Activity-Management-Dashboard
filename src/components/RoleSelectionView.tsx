import { FormEvent, useState } from "react";
import { User } from "firebase/auth";
import {
  AlertCircle,
  Check,
  Loader2,
  LogOut,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";
import { TeamDoc, UserProfileDoc, UserRole } from "../types/activity";

interface RoleSelectionViewProps {
  user: User;
  existingProfile: UserProfileDoc | null;
  isProvisionedAdmin?: boolean;
  teams: TeamDoc[];
  onSaveRole: (selection: {
    role: UserRole;
    team_id: string;
    jabatan: string;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
}

interface RoleOptionItem {
  value: UserRole;
  title: string;
  defaultJabatan: string;
  description: string;
  icon: typeof Users;
}

const ROLE_OPTIONS: RoleOptionItem[] = [
  {
    value: "pegawai",
    title: "Pegawai / Tim Pelaksana",
    defaultJabatan: "Pegawai",
    description:
      "Membuat, memperbarui, dan memantau rencana kegiatan milik tim Anda.",
    icon: Users,
  },
  {
    value: "pimpinan",
    title: "Pimpinan PusKI",
    defaultJabatan: "Kepala Pusat (Pimpinan)",
    description:
      "Memantau seluruh kegiatan, statistik, dan progres dari semua tim PusKI.",
    icon: UserCheck,
  },
];

const PROVISIONED_ADMIN_OPTION: RoleOptionItem = {
  value: "admin",
  title: "Admin (Terotorisasi)",
  defaultJabatan: "Administrator PusKI",
  description:
    "Hak akses Admin telah ditetapkan melalui provisioning sistem. Konfirmasi untuk masuk ke dashboard.",
  icon: Shield,
};

export function RoleSelectionView({
  user,
  existingProfile,
  isProvisionedAdmin = false,
  teams,
  onSaveRole,
  onLogout,
}: RoleSelectionViewProps) {
  const canConfirmAdmin = Boolean(
    isProvisionedAdmin || existingProfile?.role === "admin"
  );
  const availableOptions = canConfirmAdmin
    ? [...ROLE_OPTIONS, PROVISIONED_ADMIN_OPTION]
    : ROLE_OPTIONS;

  const initialRole: UserRole | null =
    existingProfile?.role === "admin" && !canConfirmAdmin
      ? null
      : existingProfile?.role ?? (isProvisionedAdmin ? "admin" : null);

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(
    initialRole
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    existingProfile?.team_id || teams[0]?.id || "tim_1"
  );
  const [jabatan, setJabatan] = useState<string>(
    existingProfile?.jabatan ||
      (isProvisionedAdmin ? PROVISIONED_ADMIN_OPTION.defaultJabatan : "")
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayName =
    existingProfile?.nama ||
    user.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "Pengguna PusKI";
  const email = existingProfile?.email || user.email || "";

  const handleSelectRole = (role: UserRole) => {
    if (role === "admin" && !canConfirmAdmin) {
      setErrorMsg(
        "Role Admin tidak dapat dipilih sendiri. Penetapan Admin hanya melalui otorisasi resmi."
      );
      return;
    }
    setSelectedRole(role);
    setErrorMsg(null);
    const meta = availableOptions.find((opt) => opt.value === role);
    if (meta) {
      setJabatan((prev) => {
        const isDefaultPrev =
          !prev.trim() ||
          availableOptions.some((opt) => opt.defaultJabatan === prev.trim());
        return isDefaultPrev ? meta.defaultJabatan : prev;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setErrorMsg("Silakan pilih peran (role) Anda terlebih dahulu.");
      return;
    }
    if (selectedRole === "admin" && !canConfirmAdmin) {
      setErrorMsg(
        "Role Admin tidak dapat ditetapkan secara mandiri. Silakan pilih Pegawai atau Pimpinan."
      );
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const effectiveTeamId =
        selectedRole === "pegawai"
          ? selectedTeamId || teams[0]?.id || "tim_1"
          : existingProfile?.team_id || teams[0]?.id || "tim_1";

      const fallbackJabatan =
        availableOptions.find((opt) => opt.value === selectedRole)
          ?.defaultJabatan || "Pegawai";

      await onSaveRole({
        role: selectedRole,
        team_id: effectiveTeamId,
        jabatan: jabatan.trim() || fallbackJabatan,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : "Gagal menyimpan pilihan role ke database. Silakan coba kembali."
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-8 sm:px-6">
      {/* Top Institutional Wordmark */}
      <div className="mx-auto w-full max-w-xl flex items-center justify-center gap-3 pt-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0B1F3A] text-white font-bold text-sm tracking-tight">
          PK
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-[#0B1F3A]">
            PusKI Activity Management Dashboard
          </p>
          <p className="text-xs text-slate-500">
            Kementerian Komunikasi dan Digital
          </p>
        </div>
      </div>

      {/* Centered Role Selection Card */}
      <main className="mx-auto w-full max-w-xl my-auto py-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6"
        >
          <div className="space-y-2 text-center">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A]">
              Tentukan Role Akun Anda
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {existingProfile
                ? "Akun Anda belum mengonfirmasi peran akses. Pilih atau konfirmasi role Anda sebelum masuk ke dashboard."
                : "Pilih peran (role) akses Anda untuk pertama kali sebelum masuk ke dashboard PusKI."}
            </p>
          </div>

          {/* Signed-in Account Info */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0B1F3A]">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">{email}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              disabled={submitting}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ganti Akun</span>
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800 leading-relaxed"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Role Cards */}
          <fieldset className="space-y-2.5">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Pilih Role
            </legend>
            <div className="grid gap-3">
              {availableOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedRole === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? "border-[#1D4ED8] bg-blue-50/60"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => handleSelectRole(option.value)}
                      className="sr-only"
                    />
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-[#1D4ED8] text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#0B1F3A]">
                          {option.title}
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-[#1D4ED8] bg-[#1D4ED8] text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        {option.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            {!canConfirmAdmin && (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Hak akses Admin hanya ditetapkan oleh administrator berwenang dan tidak dapat dipilih sendiri saat pendaftaran.
              </p>
            )}
          </fieldset>

          {/* Team selector for Pegawai + Jabatan */}
          {selectedRole && (
            <div className="grid gap-4 sm:grid-cols-2">
              {selectedRole === "pegawai" && (
                <div>
                  <label
                    htmlFor="role-team-select"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Tim Pelaksana
                  </label>
                  <select
                    id="role-team-select"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.nama_tim}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={selectedRole === "pegawai" ? "" : "sm:col-span-2"}>
                <label
                  htmlFor="role-jabatan-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Jabatan (Opsional)
                </label>
                <input
                  id="role-jabatan-input"
                  type="text"
                  maxLength={120}
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  placeholder="Contoh: Ketua Tim 1 / Pegawai / Kepala Pusat"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedRole}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#132E54] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan Role...</span>
              </>
            ) : (
              <span>Simpan Role &amp; Masuk Dashboard</span>
            )}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400">
        Pusat Kelembagaan Internasional · Kementerian Komunikasi dan Digital RI
      </footer>
    </div>
  );
}
