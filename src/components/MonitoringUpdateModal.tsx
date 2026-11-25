import { useEffect, useState } from "react";
import { CheckSquare, Plus, Trash2, X } from "lucide-react";
import {
  ACTIVITY_STATUSES,
  Activity,
  ActivityStatus,
  TaskItem,
} from "../types/activity";
import {
  createActivityTask,
  deleteActivityTask,
  subscribeActivityTasks,
  updateActivityTask,
} from "../services/firestoreService";
import { formatTanggalID, getTodayISODate } from "../utils/activityHelpers";
import { StatusIndicator } from "./StatusIndicator";

interface MonitoringUpdateModalProps {
  activity: Activity | null;
  canEdit: boolean;
  onClose: () => void;
  onSave: (
    activityId: string,
    updates: {
      status: ActivityStatus;
      progres: number;
      hasilKegiatan: string;
    }
  ) => void;
}

export function MonitoringUpdateModal({
  activity,
  canEdit,
  onClose,
  onSave,
}: MonitoringUpdateModalProps) {
  const [activeSection, setActiveSection] = useState<"monitoring" | "tasks">(
    "monitoring"
  );

  // Monitoring fields
  const [status, setStatus] = useState<ActivityStatus>("Belum Dimulai");
  const [progres, setProgres] = useState<number>(0);
  const [hasilKegiatan, setHasilKegiatan] = useState<string>("");

  // Sub-collection tasks state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskName, setTaskName] = useState("");
  const [taskPic, setTaskPic] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(getTodayISODate());
  const [taskTargetOutput, setTaskTargetOutput] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);

  useEffect(() => {
    if (!activity) return;
    setActiveSection("monitoring");
    setStatus(activity.status);
    setProgres(activity.progres);
    setHasilKegiatan(activity.hasilKegiatan);
    setTaskPic(activity.pic);
    setTaskDeadline(activity.tanggalPelaksanaan || getTodayISODate());
  }, [activity]);

  useEffect(() => {
    if (!activity) {
      setTasks([]);
      return;
    }
    const unsub = subscribeActivityTasks(activity.id, setTasks);
    return () => unsub();
  }, [activity]);

  if (!activity) return null;

  const handleStatusChange = (nextStatus: ActivityStatus) => {
    setStatus(nextStatus);
    if (nextStatus === "Selesai") {
      setProgres(100);
    } else if (nextStatus === "Belum Dimulai" && progres === 100) {
      setProgres(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clampedProgres = Math.max(0, Math.min(100, Math.round(progres)));
    onSave(activity.id, {
      status,
      progres: clampedProgres,
      hasilKegiatan: hasilKegiatan.trim(),
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim() || !taskPic.trim() || !taskTargetOutput.trim()) return;
    setTaskSaving(true);
    try {
      await createActivityTask(activity.id, {
        namaTugas: taskName.trim(),
        pic: taskPic.trim(),
        deadline: taskDeadline,
        targetOutput: taskTargetOutput.trim(),
        status: "Belum Dimulai",
        progres: 0,
      });
      setTaskName("");
      setTaskTargetOutput("");
    } finally {
      setTaskSaving(false);
    }
  };

  const handleToggleTaskDone = async (task: TaskItem) => {
    const nextStatus: ActivityStatus =
      task.status === "Selesai" ? "Sedang Berjalan" : "Selesai";
    const nextProgres = nextStatus === "Selesai" ? 100 : 50;
    await updateActivityTask(activity.id, task.id, {
      namaTugas: task.namaTugas,
      pic: task.pic,
      deadline: task.deadline,
      targetOutput: task.targetOutput,
      status: nextStatus,
      progres: nextProgres,
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteActivityTask(activity.id, taskId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="monitoring-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="monitoring-modal-title"
              className="text-base sm:text-lg font-bold text-[#0B1F3A]"
            >
              Perbarui Monitoring Kegiatan
            </h2>
            <p className="text-xs text-slate-500">
              {activity.timPelaksana} · PIC: {activity.pic} · Pelaksanaan{" "}
              {formatTanggalID(activity.tanggalPelaksanaan)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup pembaruan monitoring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-Tabs: Monitoring Status vs Sub-koleksi Tasks */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-6 py-2.5">
          <button
            type="button"
            onClick={() => setActiveSection("monitoring")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSection === "monitoring"
                ? "bg-[#0B1F3A] text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Status & Progres
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("tasks")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSection === "tasks"
                ? "bg-[#0B1F3A] text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Tugas Persiapan ({tasks.length})</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <p className="text-xs font-medium text-slate-500">Nama Kegiatan</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {activity.namaKegiatan}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Target Output: {activity.targetOutput}
            </p>
          </div>

          {activeSection === "monitoring" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="monitoring-status"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Status Kegiatan
                  </label>
                  <select
                    id="monitoring-status"
                    disabled={!canEdit}
                    value={status}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as ActivityStatus)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {ACTIVITY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="monitoring-progres"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Persentase Progres (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="monitoring-progres"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={!canEdit}
                      value={progres}
                      onChange={(e) => setProgres(Number(e.target.value))}
                      className="flex-1 accent-[#1D4ED8]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={!canEdit}
                      value={progres}
                      onChange={(e) => setProgres(Number(e.target.value))}
                      aria-label="Angka persentase progres"
                      className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-right text-sm font-mono tabular-nums text-slate-900 disabled:bg-slate-100 focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="monitoring-hasil"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Hasil Kegiatan / Perkembangan Terkini
                </label>
                <textarea
                  id="monitoring-hasil"
                  rows={4}
                  disabled={!canEdit}
                  value={hasilKegiatan}
                  onChange={(e) => setHasilKegiatan(e.target.value)}
                  placeholder="Catat capaian progres, kendala koordinasi, atau ringkasan hasil pelaksanaan..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Tutup
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    className="rounded-lg bg-[#0B1F3A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#13325C]"
                  >
                    Simpan Pembaruan
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {canEdit && (
                <form
                  onSubmit={handleAddTask}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                >
                  <p className="text-xs font-semibold text-[#0B1F3A]">
                    Tambah Tahapan / Tugas Persiapan
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      placeholder="Nama tugas persiapan..."
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      required
                      value={taskPic}
                      onChange={(e) => setTaskPic(e.target.value)}
                      placeholder="PIC tugas"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="date"
                      required
                      value={taskDeadline}
                      onChange={(e) => setTaskDeadline(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                    />
                    <input
                      type="text"
                      required
                      value={taskTargetOutput}
                      onChange={(e) => setTaskTargetOutput(e.target.value)}
                      placeholder="Target output tugas"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={taskSaving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{taskSaving ? "Menyimpan..." : "Tambah Tugas"}</span>
                    </button>
                  </div>
                </form>
              )}

              {tasks.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Belum ada tugas persiapan tercatat pada kegiatan ini.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900">
                          {task.namaTugas}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          PIC: {task.pic} · Deadline:{" "}
                          <span className="font-mono">
                            {formatTanggalID(task.deadline)}
                          </span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Output: {task.targetOutput}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <StatusIndicator status={task.status} compact />
                        <span className="font-mono text-xs text-slate-600 tabular-nums">
                          {task.progres}%
                        </span>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleTaskDone(task)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {task.status === "Selesai"
                                ? "Buka Ulang"
                                : "Tandai Selesai"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="rounded-lg border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                              aria-label="Hapus tugas"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
