import {
  InvalidInputError,
  InvalidSpreadsheetError,
  readSheet,
} from "read-excel-file/browser";
import writeXlsxFile, { type Sheet } from "write-excel-file/browser";
import {
  ACTIVITY_CATEGORIES,
  Activity,
  ActivityCategory,
  TeamDoc,
} from "../types/activity";

export const MAX_EXCEL_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_EXCEL_ROWS = 2000;
export const MAX_EXCEL_COLS = 50;

export const EXCEL_TEMPLATE_HEADERS = [
  "Nama Kegiatan",
  "Kategori Kegiatan",
  "Tim Pelaksana",
  "PIC (Penanggung Jawab)",
  "Tanggal Mulai Persiapan",
  "Tanggal Pelaksanaan",
  "Tanggal Pengingat",
  "Target Output",
  "Catatan / Deskripsi",
] as const;

export interface ParsedExcelRow {
  rowNumber: number;
  namaKegiatan: string;
  kategoriRaw: string;
  kategori: ActivityCategory | null;
  timPelaksanaRaw: string;
  teamId: string | null;
  pic: string;
  tanggalMulaiPersiapanRaw: string;
  tanggalMulaiPersiapan: string | null;
  tanggalPelaksanaanRaw: string;
  tanggalPelaksanaan: string | null;
  tanggalPengingatRaw: string;
  tanggalPengingat: string | null;
  targetOutput: string;
  catatan: string;
  status: "valid" | "invalid" | "duplicate";
  errors: string[];
  duplicateReason?: string;
  fingerprint: string;
}

export interface ExcelParseReport {
  fileName: string;
  headerError: string | null;
  rows: ParsedExcelRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}

export function buildActivityFingerprint(
  namaKegiatan: string,
  teamId: string,
  tanggalPelaksanaan: string
): string {
  return [
    namaKegiatan.trim().toLowerCase().replace(/\s+/g, " "),
    teamId.trim().toLowerCase(),
    tanggalPelaksanaan.trim(),
  ].join("|");
}

function normalizeHeaderKey(header: unknown): string {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[()/:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COLUMN_ALIASES: Record<
  | "nama"
  | "kategori"
  | "tim"
  | "pic"
  | "mulai"
  | "pelaksanaan"
  | "pengingat"
  | "output"
  | "catatan",
  string[]
> = {
  nama: ["nama kegiatan", "nama"],
  kategori: ["kategori kegiatan", "kategori"],
  tim: ["tim pelaksana", "tim"],
  pic: ["pic penanggung jawab", "pic", "penanggung jawab"],
  mulai: ["tanggal mulai persiapan", "mulai persiapan", "tgl mulai persiapan"],
  pelaksanaan: ["tanggal pelaksanaan", "tgl pelaksanaan"],
  pengingat: ["tanggal pengingat", "tgl pengingat"],
  output: ["target output", "output"],
  catatan: ["catatan deskripsi", "catatan", "deskripsi"],
};

function findColumnIndex(
  normalizedHeaders: string[],
  aliases: string[]
): number {
  for (const alias of aliases) {
    const idx = normalizedHeaders.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function parseExcelSerialNumber(serial: number): {
  y: number;
  m: number;
  d: number;
} | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 109574) {
    return null;
  }
  const wholeDays = Math.floor(serial);
  // Excel 1900 date system treats 1900 as a leap year (serial 60 = non-existent 1900-02-29)
  const baseEpochUtc =
    wholeDays < 60
      ? Date.UTC(1899, 11, 31)
      : Date.UTC(1899, 11, 30);
  const dt = new Date(baseEpochUtc + wholeDays * 86_400_000);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

export function parseExcelDateValue(raw: unknown): {
  iso: string | null;
  displayRaw: string;
} {
  if (raw === null || raw === undefined || raw === "") {
    return { iso: null, displayRaw: "" };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    // read-excel-file produces UTC midnight Date objects for Excel date cells
    const y = raw.getUTCFullYear();
    const m = raw.getUTCMonth() + 1;
    const d = raw.getUTCDate();
    if (isValidCalendarDate(y, m, d)) {
      const iso = `${y}-${pad2(m)}-${pad2(d)}`;
      return { iso, displayRaw: iso };
    }
    return { iso: null, displayRaw: String(raw) };
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    const decoded = parseExcelSerialNumber(raw);
    if (decoded && isValidCalendarDate(decoded.y, decoded.m, decoded.d)) {
      const iso = `${decoded.y}-${pad2(decoded.m)}-${pad2(decoded.d)}`;
      return { iso, displayRaw: iso };
    }
    return { iso: null, displayRaw: String(raw) };
  }

  const text = String(raw).trim();
  if (!text) {
    return { iso: null, displayRaw: "" };
  }

  // YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return { iso: `${y}-${pad2(m)}-${pad2(d)}`, displayRaw: text };
    }
    return { iso: null, displayRaw: text };
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return { iso: `${y}-${pad2(m)}-${pad2(d)}`, displayRaw: text };
    }
    return { iso: null, displayRaw: text };
  }

  return { iso: null, displayRaw: text };
}

function matchCategory(raw: string): ActivityCategory | null {
  const clean = raw.trim().toLowerCase();
  if (!clean) return null;
  if (clean === "kegiatan lainnya" || clean === "lainnya") return "Lainnya";
  const found = ACTIVITY_CATEGORIES.find((c) => c.toLowerCase() === clean);
  return found ?? null;
}

function matchTeamId(raw: string, teams: TeamDoc[]): string | null {
  const clean = raw.trim().toLowerCase();
  if (!clean) return null;
  for (const team of teams) {
    if (
      team.nama_tim.trim().toLowerCase() === clean ||
      team.id.trim().toLowerCase() === clean
    ) {
      return team.id;
    }
  }
  if (clean === "tim 1" || clean === "tim_1") return "tim_1";
  if (clean === "tim 2" || clean === "tim_2") return "tim_2";
  if (clean === "tim 3" || clean === "tim_3") return "tim_3";
  return null;
}

function emptyErrorReport(fileName: string, headerError: string): ExcelParseReport {
  return {
    fileName,
    headerError,
    rows: [],
    validCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
  };
}

const ALLOWED_EXCEL_MIME_TYPES = new Set([
  "",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
]);

function hasZipMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // OOXML (.xlsx) files are ZIP archives starting with PK\x03\x04, PK\x05\x06, or PK\x07\x08
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

export async function validateExcelFileBeforeRead(
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xls") {
    return "Format lama .xls tidak didukung demi keamanan. Simpan ulang file sebagai Excel (.xlsx) atau gunakan tombol Download Template Excel.";
  }
  if (ext !== "xlsx") {
    return "Format file harus berupa Excel (.xlsx). Gunakan tombol Download Template Excel untuk format yang sesuai.";
  }

  if (file.size === 0) {
    return "File Excel kosong (0 byte) dan tidak dapat diproses.";
  }
  if (file.size > MAX_EXCEL_FILE_SIZE_BYTES) {
    return "Ukuran file Excel melebihi batas maksimal 5 MB.";
  }

  const normalizedMime = file.type.trim().toLowerCase();
  if (normalizedMime && !ALLOWED_EXCEL_MIME_TYPES.has(normalizedMime)) {
    return `Tipe file (${file.type}) bukan dokumen Excel (.xlsx) yang valid.`;
  }

  const headerSlice = await file.slice(0, 4).arrayBuffer();
  const headerBytes = new Uint8Array(headerSlice);
  if (!hasZipMagicBytes(headerBytes)) {
    return "Isi file bukan dokumen Excel (.xlsx) yang valid (signature berkas tidak sesuai).";
  }

  return null;
}

export function validateParsedMatrix(
  matrix: unknown[][],
  fileName: string,
  teams: TeamDoc[],
  existingActivities: Activity[]
): ExcelParseReport {
  if (matrix.length === 0) {
    return emptyErrorReport(
      fileName,
      "Worksheet Excel kosong. Isi baris header sesuai Template Excel terlebih dahulu."
    );
  }

  if (matrix.length > MAX_EXCEL_ROWS) {
    return emptyErrorReport(
      fileName,
      `Jumlah baris (${matrix.length}) melebihi batas maksimal ${MAX_EXCEL_ROWS} baris per unggahan.`
    );
  }

  if (matrix.some((r) => Array.isArray(r) && r.length > MAX_EXCEL_COLS)) {
    return emptyErrorReport(
      fileName,
      `Jumlah kolom melebihi batas maksimal ${MAX_EXCEL_COLS} kolom.`
    );
  }

  const rawHeaders = Array.isArray(matrix[0]) ? matrix[0] : [];
  const normalizedHeaders = rawHeaders.map(normalizeHeaderKey);

  const colMap = {
    nama: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.nama),
    kategori: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.kategori),
    tim: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.tim),
    pic: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.pic),
    mulai: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.mulai),
    pelaksanaan: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.pelaksanaan),
    pengingat: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.pengingat),
    output: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.output),
    catatan: findColumnIndex(normalizedHeaders, COLUMN_ALIASES.catatan),
  };

  const missingHeaders: string[] = [];
  if (colMap.nama === -1) missingHeaders.push("Nama Kegiatan");
  if (colMap.kategori === -1) missingHeaders.push("Kategori Kegiatan");
  if (colMap.tim === -1) missingHeaders.push("Tim Pelaksana");
  if (colMap.pic === -1) missingHeaders.push("PIC (Penanggung Jawab)");
  if (colMap.mulai === -1) missingHeaders.push("Tanggal Mulai Persiapan");
  if (colMap.pelaksanaan === -1) missingHeaders.push("Tanggal Pelaksanaan");
  if (colMap.pengingat === -1) missingHeaders.push("Tanggal Pengingat");
  if (colMap.output === -1) missingHeaders.push("Target Output");
  if (colMap.catatan === -1) missingHeaders.push("Catatan / Deskripsi");

  if (missingHeaders.length > 0) {
    return emptyErrorReport(
      fileName,
      `Kolom Excel tidak sesuai template. Kolom belum ditemukan: ${missingHeaders.join(", ")}.`
    );
  }

  const existingFingerprints = new Set<string>(
    existingActivities.map((a) =>
      buildActivityFingerprint(a.namaKegiatan, a.teamId, a.tanggalPelaksanaan)
    )
  );
  const seenInFile = new Set<string>();

  const rows: ParsedExcelRow[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let i = 1; i < matrix.length; i++) {
    const rawRow = Array.isArray(matrix[i]) ? matrix[i] : [];
    const nonEmpty = rawRow.some((cell) => String(cell ?? "").trim() !== "");
    if (!nonEmpty) continue;

    const rowNumber = i + 1;
    const namaKegiatan = String(rawRow[colMap.nama] ?? "").trim();
    const kategoriRaw = String(rawRow[colMap.kategori] ?? "").trim();
    const timPelaksanaRaw = String(rawRow[colMap.tim] ?? "").trim();
    const pic = String(rawRow[colMap.pic] ?? "").trim();
    const mulaiParsed = parseExcelDateValue(rawRow[colMap.mulai]);
    const pelaksanaanParsed = parseExcelDateValue(rawRow[colMap.pelaksanaan]);
    const pengingatParsed = parseExcelDateValue(rawRow[colMap.pengingat]);
    const targetOutput = String(rawRow[colMap.output] ?? "").trim();
    const catatan = String(rawRow[colMap.catatan] ?? "").trim();

    const errors: string[] = [];

    if (!namaKegiatan) {
      errors.push("Nama Kegiatan wajib diisi");
    } else if (namaKegiatan.length > 300) {
      errors.push("Nama Kegiatan maksimal 300 karakter");
    }

    const kategori = matchCategory(kategoriRaw);
    if (!kategori) {
      errors.push(`Kategori "${kategoriRaw || "(kosong)"}" tidak valid`);
    }

    const teamId = matchTeamId(timPelaksanaRaw, teams);
    if (!teamId) {
      errors.push(
        `Tim Pelaksana "${timPelaksanaRaw || "(kosong)"}" tidak dikenali`
      );
    }

    if (!pic) {
      errors.push("PIC wajib diisi");
    } else if (pic.length > 150) {
      errors.push("PIC maksimal 150 karakter");
    }

    if (!mulaiParsed.iso) {
      errors.push(
        `Tanggal Mulai Persiapan "${mulaiParsed.displayRaw || "(kosong)"}" harus format DD/MM/YYYY atau YYYY-MM-DD`
      );
    }

    if (!pelaksanaanParsed.iso) {
      errors.push(
        `Tanggal Pelaksanaan "${pelaksanaanParsed.displayRaw || "(kosong)"}" harus format DD/MM/YYYY atau YYYY-MM-DD`
      );
    }

    if (!pengingatParsed.iso) {
      errors.push(
        `Tanggal Pengingat "${pengingatParsed.displayRaw || "(kosong)"}" harus format DD/MM/YYYY atau YYYY-MM-DD`
      );
    }

    if (!targetOutput) {
      errors.push("Target Output wajib diisi");
    } else if (targetOutput.length > 500) {
      errors.push("Target Output maksimal 500 karakter");
    }

    if (catatan.length > 2000) {
      errors.push("Catatan / Deskripsi maksimal 2000 karakter");
    }

    const fingerprint =
      namaKegiatan && teamId && pelaksanaanParsed.iso
        ? buildActivityFingerprint(namaKegiatan, teamId, pelaksanaanParsed.iso)
        : "";

    let status: ParsedExcelRow["status"] = "valid";
    let duplicateReason: string | undefined;

    if (errors.length > 0) {
      status = "invalid";
      invalidCount += 1;
    } else if (fingerprint && existingFingerprints.has(fingerprint)) {
      status = "duplicate";
      duplicateReason =
        "Sudah tersimpan di database (dilewati agar tidak duplikat)";
      duplicateCount += 1;
    } else if (fingerprint && seenInFile.has(fingerprint)) {
      status = "duplicate";
      duplicateReason = "Duplikat baris lain pada file Excel ini";
      duplicateCount += 1;
    } else {
      if (fingerprint) seenInFile.add(fingerprint);
      validCount += 1;
    }

    rows.push({
      rowNumber,
      namaKegiatan,
      kategoriRaw,
      kategori,
      timPelaksanaRaw,
      teamId,
      pic,
      tanggalMulaiPersiapanRaw: mulaiParsed.displayRaw,
      tanggalMulaiPersiapan: mulaiParsed.iso,
      tanggalPelaksanaanRaw: pelaksanaanParsed.displayRaw,
      tanggalPelaksanaan: pelaksanaanParsed.iso,
      tanggalPengingatRaw: pengingatParsed.displayRaw,
      tanggalPengingat: pengingatParsed.iso,
      targetOutput,
      catatan,
      status,
      errors,
      duplicateReason,
      fingerprint,
    });
  }

  if (rows.length === 0) {
    return emptyErrorReport(
      fileName,
      "Tidak ada baris data kegiatan di bawah baris header pada file Excel."
    );
  }

  return {
    fileName,
    headerError: null,
    rows,
    validCount,
    invalidCount,
    duplicateCount,
  };
}

export async function parseAndValidateExcelFile(
  file: File,
  teams: TeamDoc[],
  existingActivities: Activity[]
): Promise<ExcelParseReport> {
  const preValidationError = await validateExcelFileBeforeRead(file);
  if (preValidationError) {
    return emptyErrorReport(file.name, preValidationError);
  }

  let matrix: unknown[][];
  try {
    matrix = await readSheet(file);
  } catch (error) {
    if (
      error instanceof InvalidInputError ||
      error instanceof InvalidSpreadsheetError
    ) {
      return emptyErrorReport(
        file.name,
        "Struktur file Excel (.xlsx) tidak valid atau rusak. Gunakan Template Excel yang disediakan."
      );
    }
    return emptyErrorReport(
      file.name,
      error instanceof Error
        ? `File Excel tidak dapat dibaca: ${error.message}`
        : "File Excel tidak dapat dibaca."
    );
  }

  return validateParsedMatrix(matrix, file.name, teams, existingActivities);
}

export function buildExcelTemplateSheets(
  teams: TeamDoc[]
): Sheet<File | Blob | ArrayBuffer>[] {
  const templateSheet: Sheet<File | Blob | ArrayBuffer> = {
    sheet: "Rencana Kegiatan",
    columns: [
      { width: 36 },
      { width: 28 },
      { width: 16 },
      { width: 22 },
      { width: 24 },
      { width: 22 },
      { width: 20 },
      { width: 32 },
      { width: 36 },
    ],
    data: [
      EXCEL_TEMPLATE_HEADERS.map((header) => ({
        value: header,
        type: String,
        fontWeight: "bold",
      })),
    ],
  };

  const guideRows: Array<[string, string]> = [
    ["Nama Kegiatan", "Wajib diisi (maksimal 300 karakter)"],
    [
      "Kategori Kegiatan",
      `Pilih salah satu: ${ACTIVITY_CATEGORIES.join(", ")}`,
    ],
    [
      "Tim Pelaksana",
      `Pilih salah satu: ${teams.map((t) => t.nama_tim).join(", ")}`,
    ],
    ["PIC (Penanggung Jawab)", "Wajib diisi nama penanggung jawab"],
    ["Tanggal Mulai Persiapan", "Format DD/MM/YYYY atau YYYY-MM-DD"],
    ["Tanggal Pelaksanaan", "Format DD/MM/YYYY atau YYYY-MM-DD"],
    ["Tanggal Pengingat", "Format DD/MM/YYYY atau YYYY-MM-DD"],
    ["Target Output", "Wajib diisi target hasil kegiatan"],
    ["Catatan / Deskripsi", "Opsional, keterangan tambahan kegiatan"],
  ];

  const guideSheet: Sheet<File | Blob | ArrayBuffer> = {
    sheet: "Panduan Pengisian",
    columns: [{ width: 28 }, { width: 80 }],
    data: [
      [
        { value: "Kolom", type: String, fontWeight: "bold" },
        { value: "Ketentuan Pengisian", type: String, fontWeight: "bold" },
      ],
      ...guideRows.map(([col, rule]) => [
        { value: col, type: String },
        { value: rule, type: String },
      ]),
    ],
  };

  return [templateSheet, guideSheet];
}

export async function downloadExcelTemplate(teams: TeamDoc[]): Promise<void> {
  const sheets = buildExcelTemplateSheets(teams);
  await writeXlsxFile(sheets).toFile("Template_Rencana_Kegiatan_PusKI.xlsx");
}
