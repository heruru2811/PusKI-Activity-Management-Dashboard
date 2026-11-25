import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ACTIVITY_STATUSES, ActivityStatus } from "../types/activity";
import { StatusIndicator } from "./StatusIndicator";

interface InlineStatusEditorProps {
  activityId: string;
  activityName: string;
  storedStatus: ActivityStatus;
  effectiveStatus: ActivityStatus;
  canEdit: boolean;
  isAdmin: boolean;
  onChangeStatus: (activityId: string, newStatus: ActivityStatus) => Promise<void>;
}

export function InlineStatusEditor({
  activityId,
  activityName,
  storedStatus,
  effectiveStatus,
  canEdit,
  isAdmin,
  onChangeStatus,
}: InlineStatusEditorProps) {
  const [saving, setSaving] = useState(false);
  const [pendingConfirmStatus, setPendingConfirmStatus] =
    useState<ActivityStatus | null>(null);

  const isTerminalForPegawai =
    !isAdmin &&
    (storedStatus === "Selesai" || storedStatus === "Dibatalkan");

  const allowSelect = canEdit && !isTerminalForPegawai;

  const commitStatus = async (targetStatus: ActivityStatus) => {
    setSaving(true);
    try {
      await onChangeStatus(activityId, targetStatus);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectChange = (nextVal: string) => {
    const nextStatus = nextVal as ActivityStatus;
    if (nextStatus === storedStatus) return;

    if (nextStatus === "Selesai" || nextStatus === "Dibatalkan") {
      setPendingConfirmStatus(nextStatus);
      return;
    }

    void commitStatus(nextStatus);
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <StatusIndicator status={effectiveStatus} compact />

      {allowSelect && (
        <div className="flex items-center gap-1.5">
          <select
            value={storedStatus}
            disabled={saving}
            onChange={(e) => handleSelectChange(e.target.value)}
            aria-label={`Ubah status untuk ${activityName}`}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-[#1D4ED8] focus:border-[#1D4ED8] focus:outline-none disabled:opacity-60"
          >
            {ACTIVITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {saving && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]"
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {pendingConfirmStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-status-title-${activityId}`}
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  pendingConfirmStatus === "Dibatalkan"
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
                aria-hidden="true"
              />
              <div className="space-y-1.5">
                <h3
                  id={`confirm-status-title-${activityId}`}
                  className="text-base font-bold text-[#0B1F3A]"
                >
                  Konfirmasi Ubah Status ke "{pendingConfirmStatus}"
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-normal">
                  Apakah Anda yakin ingin mengubah status kegiatan{" "}
                  <span className="font-semibold text-slate-900">
                    "{activityName}"
                  </span>{" "}
                  menjadi{" "}
                  <span className="font-semibold text-slate-900">
                    {pendingConfirmStatus}
                  </span>
                  ?
                </p>
                {!isAdmin && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 whitespace-normal">
                    Catatan: Setelah berstatus {pendingConfirmStatus}, hanya Admin yang dapat mengubah kembali status kegiatan ini.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setPendingConfirmStatus(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const target = pendingConfirmStatus;
                  setPendingConfirmStatus(null);
                  await commitStatus(target);
                }}
                className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-white ${
                  pendingConfirmStatus === "Dibatalkan"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                Ya, Ubah Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
