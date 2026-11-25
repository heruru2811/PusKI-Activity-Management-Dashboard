import { ChangeEvent, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Activity, DemoImportResult, TeamDoc } from "../types/activity";
import {
  ExcelParseReport,
  ParsedExcelRow,
  downloadExcelTemplate,
  parseAndValidateExcelFile,
} from "../utils/excelImport";

interface ExcelImportModalProps {
  open: boolean;
  teams: TeamDoc[];
  existingActivities: Activity[];
  onClose: () => void;
  onSaveValidRows: (validRows: ParsedExcelRow[]) => Promise<DemoImportResult>;
}

export function ExcelImportModal({
  open,
  teams,
  existingActivities,
  onClose,
  onSaveValidRows,
}: ExcelImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseReport, setParseReport] = useState<ExcelParseReport | null>(null);
  const [importResult, setImportResult] = useState<DemoImportResult | null>(
    null
  );
  const [fatalError, setFatalError] = useState<string | null>(null);

  if (!open) return null;

  const resetState = () => {
    setParseReport(null);
    setImportResult(null);
    setFatalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (saving || parsing) return;
    resetState();
    onClose();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setFatalError(null);
    setImportResult(null);
    try {
      const report = await parseAndValidateExcelFile(
        file,
        teams,
        existingActivities
      );
      setParseReport(report);
    } catch (err) {
      setParseReport(null);
      setFatalError(
        err instanceof Error
          ? `Gagal membaca file Excel: ${err.message}`
          : "Gagal membaca file Excel. Pastikan file tidak rusak atau terenkripsi."
      );
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!parseReport) return;
    const validRows = parseReport.rows.filter((r) => r.status === "valid");
    if (validRows.length === 0) return;

    setSaving(true);
    setFatalError(null);
    try {
      const result = await onSaveValidRows(validRows);
      setImportResult(result);
    } catch (err) {
      setFatalError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan data ke Cloud Firestore."
      );
    } finally {
      setSaving(false);
    }
  };

  const validRowsCount = parseReport?.validCount ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-import-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0B1F3A] text-white">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="excel-import-title"
                className="text-base sm:text-lg font-bold text-[#0B1F3A]"
              >
                Import Rencana Kegiatan dari Excel
              </h2>
              <p className="text-xs text-slate-500">
                Unggah file .xlsx sesuai template untuk validasi dan penyimpanan ke Cloud Firestore.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving || parsing}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            aria-label="Tutup modal import Excel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Action Toolbar: Download Template + Upload Excel */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A]">
                1. Pilih atau Unggah File Excel (.xlsx)
              </p>
              <p className="text-xs text-slate-500">
                Format tanggal yang didukung:{" "}
                <span className="font-mono">DD/MM/YYYY</span> atau{" "}
                <span className="font-mono">YYYY-MM-DD</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  downloadExcelTemplate(teams).catch((err) => {
                    setFatalError(
                      err instanceof Error
                        ? `Gagal mengunduh template Excel: ${err.message}`
                        : "Gagal mengunduh template Excel."
                    );
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                <span>Download Template Excel</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="sr-only"
                id="excel-file-upload-input"
              />
              <button
                type="button"
                disabled={parsing || saving}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Membaca File...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Upload Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {fatalError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{fatalError}</span>
            </div>
          )}

          {parseReport?.headerError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">
                  File "{parseReport.fileName}" tidak dapat diproses
                </p>
                <p className="mt-0.5 text-xs">{parseReport.headerError}</p>
              </div>
            </div>
          )}

          {/* Post-Import Result Summary */}
          {importResult && (
            <div
              role="status"
              className={`rounded-xl border px-4 py-3.5 text-xs sm:text-sm ${
                importResult.failedCount > 0
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {importResult.failedCount > 0 ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold">
                    Ringkasan Hasil Import ke Cloud Firestore
                  </p>
                  <p className="text-xs leading-relaxed">
                    Berhasil disimpan:{" "}
                    <strong>{importResult.savedCount}</strong> · Dilewati
                    (duplikat):{" "}
                    <strong>
                      {importResult.skippedCount +
                        (parseReport?.duplicateCount ?? 0)}
                    </strong>{" "}
                    · Tidak valid:{" "}
                    <strong>{parseReport?.invalidCount ?? 0}</strong> · Gagal
                    simpan: <strong>{importResult.failedCount}</strong>
                  </p>
                  {importResult.errors.length > 0 && (
                    <p className="text-xs text-red-700">
                      {importResult.errors.slice(0, 2).join(" | ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Preview & Validation Summary */}
          {parseReport && !parseReport.headerError && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A]">
                  Preview Data: <span className="font-normal text-slate-600">{parseReport.fileName}</span>
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">
                    Total Baris:{" "}
                    <strong className="font-mono">{parseReport.rows.length}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                    Valid:{" "}
                    <strong className="font-mono">{parseReport.validCount}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1 font-medium text-red-800">
                    Tidak Valid:{" "}
                    <strong className="font-mono">{parseReport.invalidCount}</strong>
                  </span>
                  {parseReport.duplicateCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-800">
                      Duplikat (Dilewati):{" "}
                      <strong className="font-mono">
                        {parseReport.duplicateCount}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="max-h-[340px] overflow-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="px-3 py-2.5 whitespace-nowrap">Baris</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Validasi</th>
                        <th className="px-3 py-2.5 min-w-[200px]">Nama Kegiatan</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Kategori</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Tim & PIC</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Jadwal (Mulai / Pelaksanaan / Pengingat)</th>
                        <th className="px-3 py-2.5 min-w-[160px]">Target Output</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parseReport.rows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={
                            row.status === "invalid"
                              ? "bg-red-50/40"
                              : row.status === "duplicate"
                              ? "bg-amber-50/40"
                              : ""
                          }
                        >
                          <td className="px-3 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                            #{row.rowNumber}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {row.status === "valid" && (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                Valid
                              </span>
                            )}
                            {row.status === "duplicate" && (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                Duplikat
                              </span>
                            )}
                            {row.status === "invalid" && (
                              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                Tidak Valid
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-slate-900">
                              {row.namaKegiatan || (
                                <span className="italic text-red-600">
                                  (Kosong)
                                </span>
                              )}
                            </p>
                            {row.errors.length > 0 && (
                              <p className="mt-1 text-[11px] text-red-700">
                                {row.errors.join("; ")}
                              </p>
                            )}
                            {row.duplicateReason && (
                              <p className="mt-1 text-[11px] text-amber-800">
                                {row.duplicateReason}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                            {row.kategori ?? (
                              <span className="text-red-700">
                                {row.kategoriRaw || "-"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <p className="font-medium text-slate-800">
                              {row.timPelaksanaRaw || "-"}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              PIC: {row.pic || "-"}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                            <div>
                              M: {row.tanggalMulaiPersiapan || row.tanggalMulaiPersiapanRaw || "-"}
                            </div>
                            <div>
                              P: {row.tanggalPelaksanaan || row.tanggalPelaksanaanRaw || "-"}
                            </div>
                            <div>
                              I: {row.tanggalPengingat || row.tanggalPengingatRaw || "-"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {row.targetOutput || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50/70">
          <p className="text-xs text-slate-500">
            Hanya baris berstatus <strong>Valid</strong> yang akan disimpan ke Cloud Firestore.
          </p>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving || parsing}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {importResult ? "Tutup" : "Batal"}
            </button>

            {!importResult && (
              <button
                type="button"
                disabled={saving || parsing || validRowsCount === 0}
                onClick={handleConfirmSave}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#13325C] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <span>
                    Simpan ke Database ({validRowsCount})
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
