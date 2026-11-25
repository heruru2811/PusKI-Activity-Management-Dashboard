import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Layers,
  ListChecks,
  Loader2,
  PlusCircle,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  AIPlanResponse,
  ActiveAccessContext,
  ActivityCategory,
  ActivityFormValues,
  TeamDoc,
} from "../types/activity";
import { auth } from "../firebase";
import { formatTanggalID } from "../utils/activityHelpers";

interface AIPlannerViewProps {
  access: ActiveAccessContext;
  teams: TeamDoc[];
  onUseAsActivityPlan: (
    draft: Partial<ActivityFormValues>,
    planStages?: AIPlanResponse["preparationStages"]
  ) => void;
}

function getDefaultExecutionDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AIPlannerView({
  access,
  teams,
  onUseAsActivityPlan,
}: AIPlannerViewProps) {
  const [activityName, setActivityName] = useState("");
  const [executionDate, setExecutionDate] = useState(getDefaultExecutionDate);
  const [teamId, setTeamId] = useState<string>(access.teamId || "tim_1");
  const [additionalContext, setAdditionalContext] = useState("");

  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);

  useEffect(() => {
    if (access.role === "pegawai") {
      setTeamId(access.teamId);
    } else if (teams.length > 0 && !teams.some((t) => t.id === teamId)) {
      setTeamId(teams[0].id);
    }
  }, [access.role, access.teamId, teams, teamId]);

  useEffect(() => {
    let cancelled = false;
    async function checkStatus() {
      try {
        const res = await fetch("/api/ai-status");
        const text = await res.text();
        let data: { configured?: boolean } | null = null;
        try {
          data = text ? (JSON.parse(text) as { configured?: boolean }) : null;
        } catch {
          data = null;
        }
        if (!res.ok || !data) {
          if (!cancelled) {
            setAiConfigured(false);
            setConfigNotice(
              "Tidak dapat memeriksa status integrasi AI pada server. Pastikan layanan backend berjalan dan GEMINI_API_KEY telah dikonfigurasi."
            );
          }
          return;
        }
        if (!cancelled) {
          setAiConfigured(Boolean(data.configured));
          if (!data.configured) {
            setConfigNotice(
              "Integrasi Gemini AI belum tersedia. Pastikan GEMINI_API_KEY telah dikonfigurasi melalui panel Settings > Secrets di Google AI Studio."
            );
          }
        }
      } catch {
        if (!cancelled) {
          setAiConfigured(false);
          setConfigNotice(
            "Tidak dapat memeriksa status integrasi AI pada server. Pastikan layanan backend berjalan dan GEMINI_API_KEY telah dikonfigurasi."
          );
        }
      }
    }
    checkStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTeamName =
    teams.find((t) => t.id === teamId)?.nama_tim ?? access.teamName;

  const handleUseExample = () => {
    setActivityName(
      "Penyelenggaraan rapat persiapan pencalonan Indonesia sebagai Dewan ITU."
    );
    setExecutionDate(getDefaultExecutionDate());
    setAdditionalContext(
      "Melibatkan unsur internal Kemkomdigi, Kementerian Luar Negeri, dan perwakilan tetap RI di Jenewa."
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setConfigNotice(null);

    if (!activityName.trim()) {
      setErrorMsg("Silakan masukkan nama kegiatan terlebih dahulu.");
      return;
    }
    if (!executionDate) {
      setErrorMsg("Silakan pilih target tanggal pelaksanaan.");
      return;
    }

    setLoading(true);
    setPlan(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setErrorMsg(
          "Sesi autentikasi tidak ditemukan. Silakan keluar dan masuk kembali."
        );
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/ai-planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          activityName: activityName.trim(),
          executionDate,
          team: selectedTeamName,
          additionalContext: additionalContext.trim(),
        }),
      });

      const rawText = await response.text();
      let data: {
        configured?: boolean;
        error?: string;
        plan?: AIPlanResponse;
      } = {};
      try {
        data = rawText
          ? (JSON.parse(rawText) as {
              configured?: boolean;
              error?: string;
              plan?: AIPlanResponse;
            })
          : {};
      } catch {
        setErrorMsg(
          `Respons server AI tidak valid (HTTP ${response.status}). Silakan coba kembali.`
        );
        return;
      }

      if (!response.ok) {
        if (data.configured === false) {
          setAiConfigured(false);
          setConfigNotice(
            data.error ||
              "Integrasi Gemini AI belum terkonfigurasi pada Google AI Studio (Settings > Secrets)."
          );
        } else {
          setErrorMsg(data.error || "Gagal menyusun rencana kegiatan AI.");
        }
        return;
      }

      if (data.plan) {
        setAiConfigured(true);
        setPlan(data.plan);
      } else {
        setErrorMsg("Respons AI tidak lengkap. Silakan coba kembali.");
      }
    } catch {
      setErrorMsg(
        "Koneksi ke server AI terputus. Periksa jaringan atau status server aplikasi."
      );
    } finally {
      setLoading(false);
    }
  };

  const preparationStages = Array.isArray(plan?.preparationStages)
    ? plan.preparationStages
    : [];
  const coordinationMeetings = Array.isArray(plan?.coordinationMeetings)
    ? plan.coordinationMeetings
    : [];
  const timelineItems = Array.isArray(plan?.timeline) ? plan.timeline : [];
  const supportingRequirements = Array.isArray(plan?.supportingRequirements)
    ? plan.supportingRequirements
    : [];
  const stageOutputs = Array.isArray(plan?.stageOutputs)
    ? plan.stageOutputs
    : [];

  const handleConvertToPlan = () => {
    if (!plan) return;
    const matchedCategory: ActivityCategory = ACTIVITY_CATEGORIES.includes(
      plan.suggestedCategory as ActivityCategory
    )
      ? (plan.suggestedCategory as ActivityCategory)
      : "Rapat Persiapan";

    const stagesSummary = preparationStages
      .map((s) => `${s.phase}: ${s.title}`)
      .join("; ");

    onUseAsActivityPlan(
      {
        namaKegiatan: activityName.trim(),
        kategori: matchedCategory,
        teamId: access.role === "pegawai" ? access.teamId : teamId,
        tanggalMulaiPersiapan: plan.suggestedPrepStartDate || executionDate,
        tanggalPelaksanaan: executionDate,
        tanggalPengingat: plan.suggestedReminderDate || executionDate,
        targetOutput: plan.recommendedTargetOutput || "",
        catatan: `${plan.summary}\nTahapan utama: ${stagesSummary}`,
      },
      preparationStages
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A]">
          AI Activity Planner
        </h2>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
          Susun rekomendasi tahapan persiapan, rapat koordinasi, timeline, kebutuhan pendukung, dan target output berbantuan Gemini AI.
        </p>
      </div>

      {aiConfigured === false && configNotice && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-950">
                Konfigurasi Integrasi AI Diperlukan
              </h3>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                {configNotice}
              </p>
              <p className="text-xs text-amber-800">
                Aplikasi ini tidak menampilkan jawaban AI simulasi apabila layanan Gemini AI belum aktif.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-[#0B1F3A]">
                Parameter Kegiatan
              </h3>
              <button
                type="button"
                onClick={handleUseExample}
                className="text-xs font-semibold text-[#1D4ED8] hover:underline whitespace-nowrap"
              >
                Isi Contoh Dewan ITU
              </button>
            </div>

            <div>
              <label
                htmlFor="ai-nama-kegiatan"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Nama Kegiatan <span className="text-red-600">*</span>
              </label>
              <textarea
                id="ai-nama-kegiatan"
                rows={3}
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder='Contoh: "Penyelenggaraan rapat persiapan pencalonan Indonesia sebagai Dewan ITU."'
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ai-tanggal-pelaksanaan"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Tanggal Pelaksanaan <span className="text-red-600">*</span>
                </label>
                <input
                  id="ai-tanggal-pelaksanaan"
                  type="date"
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="ai-tim"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Tim Pelaksana
                </label>
                <select
                  id="ai-tim"
                  value={teamId}
                  disabled={access.role === "pegawai"}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:border-[#1D4ED8] focus:outline-none"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama_tim}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="ai-konteks"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Catatan Konteks Tambahan (Opsional)
              </label>
              <textarea
                id="ai-konteks"
                rows={2}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Misal: peserta lintas kementerian, format hybrid, atau dokumen mandat yang diperlukan..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#13325C] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Menyusun Rekomendasi AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Buat Rekomendasi Rencana</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          {loading ? (
            <div className="space-y-4 py-4">
              <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
              <div className="h-16 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-28 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-28 w-full animate-pulse rounded bg-slate-100" />
            </div>
          ) : !plan ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#1D4ED8]">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                Siap Menyusun Rencana Kegiatan
              </h3>
              <p className="mt-1.5 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
                Masukkan nama kegiatan dan tanggal pelaksanaan di panel kiri, lalu tekan{" "}
                <span className="font-semibold text-slate-700">
                  Buat Rekomendasi Rencana
                </span>{" "}
                untuk memperoleh rancangan tahapan persiapan, rapat koordinasi, timeline, dan target output.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#1D4ED8]">
                    Rekomendasi AI · {plan.suggestedCategory}
                  </p>
                  <h3 className="text-base sm:text-lg font-bold text-[#0B1F3A]">
                    {activityName}
                  </h3>
                  <p className="text-xs font-mono text-slate-500">
                    Target Pelaksanaan: {formatTanggalID(executionDate)} · Mulai Persiapan:{" "}
                    {formatTanggalID(plan.suggestedPrepStartDate)}
                  </p>
                </div>

                {access.canManageActivities && (
                  <button
                    type="button"
                    onClick={handleConvertToPlan}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
                  >
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Simpan ke Rencana Kegiatan</span>
                  </button>
                )}
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">
                {plan.summary}
              </p>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                  <Layers className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  <h4>1. Tahapan Persiapan</h4>
                </div>
                <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {preparationStages.map((stage, idx) => (
                    <li key={idx} className="px-4 py-3 space-y-1">
                      <p className="text-xs font-bold text-[#1D4ED8]">
                        {stage.phase} · {stage.title}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {stage.description}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                  <Users className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  <h4>2. Rapat Koordinasi yang Diperlukan</h4>
                </div>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {coordinationMeetings.map((meeting, idx) => (
                    <li key={idx} className="px-4 py-3 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {meeting.title}
                        </p>
                        <span className="font-mono text-xs font-semibold text-slate-600">
                          {meeting.timing}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Peserta: {meeting.participants}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700">
                        Agenda: {meeting.agenda}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                  <Calendar className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  <h4>3. Timeline Kegiatan</h4>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                        <th className="px-3.5 py-2.5 whitespace-nowrap">
                          Rentang Waktu
                        </th>
                        <th className="px-3.5 py-2.5">Tonggak Kegiatan</th>
                        <th className="px-3.5 py-2.5 whitespace-nowrap">
                          Penanggung Jawab
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {timelineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3.5 py-2.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                            {item.dateRange}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-900">
                            {item.milestone}
                          </td>
                          <td className="px-3.5 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                            {item.picRole}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                  <Wrench className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  <h4>4. Kebutuhan Pendukung</h4>
                </div>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {supportingRequirements.map((req, idx) => (
                    <li
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 px-4 py-2.5 text-xs sm:text-sm"
                    >
                      <span className="w-32 shrink-0 font-semibold text-slate-800">
                        {req.category}
                      </span>
                      <span className="text-slate-700">{req.item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                  <ListChecks className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  <h4>5. Target Output Setiap Tahapan</h4>
                </div>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {stageOutputs.map((out, idx) => (
                    <li key={idx} className="px-4 py-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{out.stage}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-800">
                        <span className="font-medium">Output:</span> {out.output}
                      </p>
                      <p className="text-xs text-slate-500">
                        <ClipboardList className="mr-1 inline h-3 w-3" />
                        Indikator: {out.indicator}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
