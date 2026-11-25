import { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUSES,
  Activity,
  ActivityCategory,
  ActivityFormValues,
  ActivityStatus,
  DemoImportResult,
  NotificationItem,
  TaskFormValues,
  TaskItem,
  TeamDoc,
  UserProfileDoc,
  UserRole,
} from "../types/activity";
import {
  buildActivityFingerprint,
  ParsedExcelRow,
} from "../utils/excelImport";

export const DEFAULT_TEAMS: Array<{
  id: string;
  nama_tim: string;
  deskripsi: string;
  daftar_anggota: string[];
}> = [
  {
    id: "tim_1",
    nama_tim: "Tim 1",
    deskripsi: "Forum dan Organisasi Internasional (ITU, PBB, IGF)",
    daftar_anggota: ["Rizky Pratama", "Nadia Kusuma"],
  },
  {
    id: "tim_2",
    nama_tim: "Tim 2",
    deskripsi: "Kerja Sama Regional dan Kunjungan Delegasi",
    daftar_anggota: ["Budi Santoso", "Andi Wijaya"],
  },
  {
    id: "tim_3",
    nama_tim: "Tim 3",
    deskripsi: "Kerja Sama Bilateral dan Capacity Building",
    daftar_anggota: ["Siti Rahmawati", "Dewi Lestari"],
  },
];

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof (val as { toDate?: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === "string") return val;
  return new Date().toISOString();
}

export function resolveTeamDisplayName(
  teamId: string,
  teams: TeamDoc[]
): string {
  const found = teams.find((t) => t.id === teamId);
  if (found) return found.nama_tim;
  if (teamId === "tim_1") return "Tim 1";
  if (teamId === "tim_2") return "Tim 2";
  if (teamId === "tim_3") return "Tim 3";
  return teamId;
}

export function mapTeamIdFromLegacyName(teamName: string): string {
  const normalized = teamName.trim().toLowerCase();
  if (normalized === "tim 1" || normalized === "tim_1") return "tim_1";
  if (normalized === "tim 2" || normalized === "tim_2") return "tim_2";
  if (normalized === "tim 3" || normalized === "tim_3") return "tim_3";
  return "tim_1";
}

// ============================================================================
// 1. USERS COLLECTION (/users/{uid})
// ============================================================================

export const BOOTSTRAPPED_ADMIN_EMAIL = "heruru2811@gmail.com";

export async function checkIsProvisionedAdmin(
  firebaseUser: User
): Promise<boolean> {
  const email = firebaseUser.email?.trim().toLowerCase() ?? "";
  if (firebaseUser.emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL) {
    return true;
  }
  try {
    const adminSnap = await getDoc(doc(db, "admins", firebaseUser.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

export async function fetchUserProfile(
  firebaseUser: User
): Promise<UserProfileDoc | null> {
  const path = `users/${firebaseUser.uid}`;
  const userRef = doc(db, "users", firebaseUser.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap.exists()) {
    return null;
  }

  const existing = snap.data() as UserProfileDoc;

  if (existing.role_selected === true) {
    const displayName =
      firebaseUser.displayName?.trim() ||
      firebaseUser.email?.split("@")[0] ||
      "Pengguna PusKI";
    const email = firebaseUser.email?.trim() || "";
    const photoUrl = firebaseUser.photoURL?.trim() || "";

    const needsSync =
      existing.nama !== displayName ||
      existing.email !== email ||
      (photoUrl && existing.foto_profil !== photoUrl);

    if (needsSync) {
      const updates: Record<string, unknown> = {
        nama: displayName,
        email,
        updated_at: serverTimestamp(),
      };
      if (photoUrl) {
        updates.foto_profil = photoUrl;
      }
      try {
        await updateDoc(userRef, updates);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      return {
        ...existing,
        nama: displayName,
        email,
        foto_profil: photoUrl || existing.foto_profil,
      };
    }
  }

  return existing;
}

export async function saveUserRoleSelection(
  firebaseUser: User,
  selection: {
    role: UserRole;
    team_id: string;
    jabatan: string;
  }
): Promise<UserProfileDoc> {
  if (
    selection.role !== "pegawai" &&
    selection.role !== "pimpinan" &&
    selection.role !== "admin"
  ) {
    throw new Error("Pilihan role tidak valid.");
  }

  const path = `users/${firebaseUser.uid}`;
  const userRef = doc(db, "users", firebaseUser.uid);

  const displayName =
    firebaseUser.displayName?.trim() ||
    firebaseUser.email?.split("@")[0] ||
    "Pengguna PusKI";
  const email = firebaseUser.email?.trim() || "";
  const photoUrl = firebaseUser.photoURL?.trim() || "";
  const cleanTeamId = selection.team_id.trim() || "tim_1";
  const cleanJabatan =
    selection.jabatan.trim() ||
    (selection.role === "admin"
      ? "Administrator PusKI"
      : selection.role === "pimpinan"
      ? "Kepala Pusat (Pimpinan)"
      : "Pegawai");

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const existingData = snap.exists()
    ? (snap.data() as Partial<UserProfileDoc>)
    : null;

  if (existingData?.role_selected === true) {
    throw new Error(
      "Role akun Anda sudah dikonfirmasi dan tidak dapat diubah sendiri. Hubungi Admin PusKI untuk perubahan akses."
    );
  }

  if (selection.role === "admin") {
    const isAlreadyAdmin = existingData?.role === "admin";
    const isProvisioned = await checkIsProvisionedAdmin(firebaseUser);
    if (!isAlreadyAdmin && !isProvisioned) {
      throw new Error(
        "Role Admin tidak dapat ditetapkan secara mandiri. Penetapan Admin hanya dapat dilakukan melalui otorisasi resmi atau Admin PusKI."
      );
    }
  }

  try {
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: firebaseUser.uid,
        nama: displayName,
        email,
        role: selection.role,
        team_id: cleanTeamId,
        jabatan: cleanJabatan,
        role_selected: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };
      if (photoUrl) {
        payload.foto_profil = photoUrl;
      }
      await setDoc(userRef, payload);
    } else {
      const updates: Record<string, unknown> = {
        nama: displayName,
        email,
        role: selection.role,
        team_id: cleanTeamId,
        jabatan: cleanJabatan,
        role_selected: true,
        updated_at: serverTimestamp(),
      };
      if (photoUrl) {
        updates.foto_profil = photoUrl;
      }
      await updateDoc(userRef, updates);
    }

    return {
      uid: firebaseUser.uid,
      nama: displayName,
      email,
      foto_profil: photoUrl,
      role: selection.role,
      team_id: cleanTeamId,
      jabatan: cleanJabatan,
      role_selected: true,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfileDoc | null) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(snap.data() as UserProfileDoc);
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeAllUsers(
  onData: (users: UserProfileDoc[]) => void
): Unsubscribe {
  const path = "users";
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as UserProfileDoc);
      list.sort((a, b) => a.nama.localeCompare(b.nama));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function adminUpdateUserAccess(
  targetUid: string,
  updates: {
    role: UserRole;
    team_id: string;
    jabatan?: string;
  }
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, "users", targetUid), {
      role: updates.role,
      team_id: updates.team_id,
      jabatan: updates.jabatan?.trim() || "Pegawai",
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// 2. TEAMS COLLECTION (/teams/{teamId})
// ============================================================================

export async function seedDefaultTeamsIfMissing(
  existingTeams: TeamDoc[]
): Promise<void> {
  const existingIds = new Set(existingTeams.map((t) => t.id));
  const missing = DEFAULT_TEAMS.filter((t) => !existingIds.has(t.id));
  if (missing.length === 0) return;

  try {
    const batch = writeBatch(db);
    for (const team of missing) {
      batch.set(doc(db, "teams", team.id), {
        nama_tim: team.nama_tim,
        deskripsi: team.deskripsi,
        daftar_anggota: team.daftar_anggota,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "teams");
  }
}

export function subscribeTeams(onData: (teams: TeamDoc[]) => void): Unsubscribe {
  const path = "teams";
  return onSnapshot(
    collection(db, "teams"),
    (snap) => {
      const list: TeamDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nama_tim: String(data.nama_tim ?? d.id),
          deskripsi: String(data.deskripsi ?? ""),
          daftar_anggota: Array.isArray(data.daftar_anggota)
            ? data.daftar_anggota.map(String)
            : [],
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      });
      list.sort((a, b) => a.nama_tim.localeCompare(b.nama_tim));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function upsertTeam(
  teamId: string,
  values: {
    nama_tim: string;
    deskripsi: string;
    daftar_anggota: string[];
  },
  isNew: boolean
): Promise<void> {
  const safeId = teamId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `teams/${safeId}`;
  try {
    if (isNew) {
      await setDoc(doc(db, "teams", safeId), {
        nama_tim: values.nama_tim.trim(),
        deskripsi: values.deskripsi.trim(),
        daftar_anggota: values.daftar_anggota.slice(0, 50),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, "teams", safeId), {
        nama_tim: values.nama_tim.trim(),
        deskripsi: values.deskripsi.trim(),
        daftar_anggota: values.daftar_anggota.slice(0, 50),
        updated_at: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function removeTeam(teamId: string): Promise<void> {
  const path = `teams/${teamId}`;
  try {
    await deleteDoc(doc(db, "teams", teamId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 3. ACTIVITIES COLLECTION (/activities/{activityId})
// ============================================================================

function normalizeActivityCategory(raw: unknown): ActivityCategory {
  const val = String(raw ?? "").trim();
  if (val === "Kegiatan Lainnya" || val === "Lainnya") return "Lainnya";
  const matched = ACTIVITY_CATEGORIES.find(
    (c) => c.toLowerCase() === val.toLowerCase()
  );
  return matched ?? "Lainnya";
}

function normalizeActivityStatus(raw: unknown): ActivityStatus {
  const val = String(raw ?? "").trim();
  const matched = ACTIVITY_STATUSES.find(
    (s) => s.toLowerCase() === val.toLowerCase()
  );
  return matched ?? "Belum Dimulai";
}

function isIsoDateString(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function mapFirestoreActivity(
  id: string,
  data: Record<string, unknown>,
  teams: TeamDoc[]
): Activity {
  const teamId = String(data.team_id ?? "tim_1");
  return {
    id,
    namaKegiatan: String(data.nama_kegiatan ?? ""),
    kategori: normalizeActivityCategory(
      data.kategori ?? data.kategori_kegiatan
    ),
    teamId,
    timPelaksana: resolveTeamDisplayName(teamId, teams),
    createdBy: String(data.created_by ?? ""),
    pic: String(data.pic ?? ""),
    tanggalMulaiPersiapan: String(data.tanggal_mulai_persiapan ?? ""),
    tanggalPelaksanaan: String(data.tanggal_pelaksanaan ?? ""),
    tanggalPengingat: String(data.tanggal_pengingat ?? ""),
    targetOutput: String(data.target_output ?? ""),
    catatan: String(data.deskripsi ?? data.catatan_deskripsi ?? ""),
    status: normalizeActivityStatus(data.status),
    progres: Number(data.persentase_progres ?? data.progress ?? 0),
    hasilKegiatan: String(data.hasil_kegiatan ?? ""),
    isDemo: Boolean(data.is_demo),
    demoId: typeof data.demo_id === "string" ? data.demo_id : undefined,
    createdAt: timestampToIso(data.created_at),
    updatedAt: timestampToIso(data.updated_at),
  };
}

export function subscribeActivities(
  userProfile: UserProfileDoc,
  teams: TeamDoc[],
  onData: (activities: Activity[]) => void
): Unsubscribe {
  const path = "activities";
  const activitiesRef = collection(db, "activities");

  const q =
    userProfile.role === "admin" || userProfile.role === "pimpinan"
      ? query(activitiesRef)
      : query(activitiesRef, where("team_id", "==", userProfile.team_id));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) =>
        mapFirestoreActivity(d.id, d.data() as Record<string, unknown>, teams)
      );
      items.sort((a, b) =>
        a.tanggalPelaksanaan.localeCompare(b.tanggalPelaksanaan)
      );
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createActivityInFirestore(
  values: ActivityFormValues,
  creatorUid: string
): Promise<string> {
  const path = "activities";
  try {
    const defaultTeam = DEFAULT_TEAMS.find((t) => t.id === values.teamId);
    if (defaultTeam) {
      const teamRef = doc(db, "teams", defaultTeam.id);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        await setDoc(teamRef, {
          nama_tim: defaultTeam.nama_tim,
          deskripsi: defaultTeam.deskripsi,
          daftar_anggota: defaultTeam.daftar_anggota,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }
    }

    const docRef = await addDoc(collection(db, "activities"), {
      nama_kegiatan: values.namaKegiatan.trim(),
      kategori: values.kategori,
      deskripsi: values.catatan.trim(),
      team_id: values.teamId,
      created_by: creatorUid,
      pic: values.pic.trim(),
      tanggal_mulai_persiapan: values.tanggalMulaiPersiapan,
      tanggal_pelaksanaan: values.tanggalPelaksanaan,
      tanggal_pengingat: values.tanggalPengingat,
      target_output: values.targetOutput.trim(),
      hasil_kegiatan: values.hasilKegiatan.trim(),
      status: values.status,
      persentase_progres: Math.max(0, Math.min(100, Math.round(values.progres))),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateActivityPlanInFirestore(
  activityId: string,
  values: ActivityFormValues,
  allowTeamChange: boolean
): Promise<void> {
  const path = `activities/${activityId}`;
  try {
    const payload: Record<string, unknown> = {
      nama_kegiatan: values.namaKegiatan.trim(),
      kategori: values.kategori,
      deskripsi: values.catatan.trim(),
      pic: values.pic.trim(),
      tanggal_mulai_persiapan: values.tanggalMulaiPersiapan,
      tanggal_pelaksanaan: values.tanggalPelaksanaan,
      tanggal_pengingat: values.tanggalPengingat,
      target_output: values.targetOutput.trim(),
      updated_at: serverTimestamp(),
    };
    if (allowTeamChange) {
      payload.team_id = values.teamId;
    }
    await updateDoc(doc(db, "activities", activityId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateActivityMonitoringInFirestore(
  activityId: string,
  updates: {
    status: ActivityStatus;
    progres: number;
    hasilKegiatan: string;
  }
): Promise<void> {
  const path = `activities/${activityId}`;
  try {
    await updateDoc(doc(db, "activities", activityId), {
      status: updates.status,
      persentase_progres: Math.max(0, Math.min(100, Math.round(updates.progres))),
      hasil_kegiatan: updates.hasilKegiatan.trim(),
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateActivityStatusInFirestore(
  activityId: string,
  newStatus: ActivityStatus
): Promise<void> {
  const path = `activities/${activityId}`;
  try {
    const payload: Record<string, unknown> = {
      status: newStatus,
      updated_at: serverTimestamp(),
    };
    if (newStatus === "Selesai") {
      payload.persentase_progres = 100;
    }
    await updateDoc(doc(db, "activities", activityId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteActivityInFirestore(
  activityId: string
): Promise<void> {
  const path = `activities/${activityId}`;
  try {
    await deleteDoc(doc(db, "activities", activityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 4. TASKS SUB-COLLECTION (/activities/{activityId}/tasks/{taskId})
// ============================================================================

export function subscribeActivityTasks(
  activityId: string,
  onData: (tasks: TaskItem[]) => void
): Unsubscribe {
  const path = `activities/${activityId}/tasks`;
  return onSnapshot(
    collection(db, "activities", activityId, "tasks"),
    (snap) => {
      const items: TaskItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          namaTugas: String(data.nama_tugas ?? ""),
          pic: String(data.pic ?? ""),
          deadline: String(data.deadline ?? ""),
          targetOutput: String(data.target_output ?? ""),
          status: String(data.status ?? "Belum Dimulai") as ActivityStatus,
          progres: Number(data.progres ?? 0),
          createdAt: timestampToIso(data.created_at),
          updatedAt: timestampToIso(data.updated_at),
        };
      });
      items.sort((a, b) => a.deadline.localeCompare(b.deadline));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createActivityTask(
  activityId: string,
  values: TaskFormValues
): Promise<string> {
  const path = `activities/${activityId}/tasks`;
  try {
    const ref = await addDoc(collection(db, "activities", activityId, "tasks"), {
      nama_tugas: values.namaTugas.trim(),
      pic: values.pic.trim(),
      deadline: values.deadline,
      target_output: values.targetOutput.trim(),
      status: values.status,
      progres: Math.max(0, Math.min(100, Math.round(values.progres))),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateActivityTask(
  activityId: string,
  taskId: string,
  values: TaskFormValues
): Promise<void> {
  const path = `activities/${activityId}/tasks/${taskId}`;
  try {
    await updateDoc(doc(db, "activities", activityId, "tasks", taskId), {
      nama_tugas: values.namaTugas.trim(),
      pic: values.pic.trim(),
      deadline: values.deadline,
      target_output: values.targetOutput.trim(),
      status: values.status,
      progres: Math.max(0, Math.min(100, Math.round(values.progres))),
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteActivityTask(
  activityId: string,
  taskId: string
): Promise<void> {
  const path = `activities/${activityId}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, "activities", activityId, "tasks", taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 5. NOTIFICATIONS SUB-COLLECTION (/users/{uid}/notifications/{notificationId})
// ============================================================================

export function subscribeUserNotifications(
  uid: string,
  onData: (items: NotificationItem[]) => void
): Unsubscribe {
  const path = `users/${uid}/notifications`;
  return onSnapshot(
    collection(db, "users", uid, "notifications"),
    (snap) => {
      const items: NotificationItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          activityId: String(data.activity_id ?? ""),
          judul: String(data.judul ?? ""),
          pesan: String(data.pesan ?? ""),
          tanggalPengingat: String(data.tanggal_pengingat ?? ""),
          dibaca: Boolean(data.dibaca),
          createdAt: timestampToIso(data.created_at),
          updatedAt: timestampToIso(data.updated_at),
        };
      });
      items.sort((a, b) => {
        if (a.dibaca !== b.dibaca) return a.dibaca ? 1 : -1;
        return b.tanggalPengingat.localeCompare(a.tanggalPengingat);
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function syncActivityReminderNotification(
  uid: string,
  payload: {
    activityId: string;
    judul: string;
    pesan: string;
    tanggalPengingat: string;
  }
): Promise<void> {
  const notifId = `notif_${payload.activityId}`;
  const path = `users/${uid}/notifications/${notifId}`;
  const ref = doc(db, "users", uid, "notifications", notifId);

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        activity_id: payload.activityId,
        judul: payload.judul.slice(0, 200),
        pesan: payload.pesan.slice(0, 500),
        tanggal_pengingat: payload.tanggalPengingat,
        dibaca: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markNotificationRead(
  uid: string,
  notificationId: string
): Promise<void> {
  const path = `users/${uid}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, "users", uid, "notifications", notificationId), {
      dibaca: true,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotificationDoc(
  uid: string,
  notificationId: string
): Promise<void> {
  const path = `users/${uid}/notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "notifications", notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 6. SAFE ONE-TIME MIGRATION FROM LEGACY LOCALSTORAGE (NON-DEMO ONLY)
// ============================================================================

const LEGACY_LOCAL_KEY = "puski_activities_v1";

interface LegacyLocalActivity {
  id?: string;
  namaKegiatan?: string;
  kategori?: ActivityCategory;
  timPelaksana?: string;
  pic?: string;
  tanggalMulaiPersiapan?: string;
  tanggalPelaksanaan?: string;
  tanggalPengingat?: string;
  targetOutput?: string;
  catatan?: string;
  status?: ActivityStatus;
  progres?: number;
  hasilKegiatan?: string;
  isDemo?: boolean;
}

export function getLegacyLocalOfficialActivities(): LegacyLocalActivity[] {
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as LegacyLocalActivity[]).filter(
      (item) => item && item.isDemo !== true && Boolean(item.namaKegiatan)
    );
  } catch {
    return [];
  }
}

export async function migrateLegacyLocalActivitiesToFirestore(
  creatorUid: string,
  userTeamId: string,
  canChooseAnyTeam: boolean
): Promise<number> {
  const legacyItems = getLegacyLocalOfficialActivities();
  if (legacyItems.length === 0) return 0;

  let migratedCount = 0;
  for (const item of legacyItems) {
    const targetTeamId = canChooseAnyTeam
      ? mapTeamIdFromLegacyName(item.timPelaksana ?? "Tim 1")
      : userTeamId;

    await createActivityInFirestore(
      {
        namaKegiatan: item.namaKegiatan ?? "Kegiatan Tanpa Nama",
        kategori: item.kategori ?? "Lainnya",
        teamId: targetTeamId,
        pic: item.pic || "PIC Tim",
        tanggalMulaiPersiapan: item.tanggalMulaiPersiapan || "2026-11-24",
        tanggalPelaksanaan: item.tanggalPelaksanaan || "2026-11-24",
        tanggalPengingat: item.tanggalPengingat || "2026-11-24",
        targetOutput: item.targetOutput || "Target output kegiatan",
        catatan: item.catatan || "",
        status: item.status ?? "Belum Dimulai",
        progres: typeof item.progres === "number" ? item.progres : 0,
        hasilKegiatan: item.hasilKegiatan || "",
      },
      creatorUid
    );
    migratedCount += 1;
  }

  // Only remove legacy key AFTER every Firestore write succeeded
  try {
    localStorage.removeItem(LEGACY_LOCAL_KEY);
  } catch {
    // Ignore storage removal errors
  }

  return migratedCount;
}

// ============================================================================
// 7. ADMIN BATCH IMPORT OF 50 DEMO ACTIVITIES FROM JSON
// ============================================================================

const DEMO_JSON_ASSET_PATH = "/assets/aistudio/puski_50_data_demo_64a1a75c.json";

interface RawDemoActivityJson {
  demo_id?: unknown;
  nama_kegiatan?: unknown;
  kategori_kegiatan?: unknown;
  tim_pelaksana?: unknown;
  pic?: unknown;
  tanggal_mulai_persiapan?: unknown;
  tanggal_pelaksanaan?: unknown;
  tanggal_pengingat?: unknown;
  target_output?: unknown;
  catatan_deskripsi?: unknown;
  status?: unknown;
  progress?: unknown;
  hasil_kegiatan?: unknown;
  is_demo?: unknown;
}

export async function importDemoActivitiesFromJson(
  adminUid: string,
  knownTeams: TeamDoc[]
): Promise<DemoImportResult> {
  const response = await fetch(DEMO_JSON_ASSET_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Gagal membaca file JSON demo (${response.status} ${response.statusText}).`
    );
  }

  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed)) {
    throw new Error("Format file JSON tidak valid: harus berupa array data.");
  }
  if (parsed.length !== 50) {
    throw new Error(
      `Jumlah data pada file JSON harus tepat 50 kegiatan (ditemukan ${parsed.length}).`
    );
  }

  // Ensure default teams (Tim 1, Tim 2, Tim 3) exist in Firestore so team_id references pass security rules
  let liveTeams: TeamDoc[] = [];
  try {
    const teamSnap = await getDocs(collection(db, "teams"));
    liveTeams = teamSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        nama_tim: String(data.nama_tim ?? d.id),
        deskripsi: String(data.deskripsi ?? ""),
        daftar_anggota: Array.isArray(data.daftar_anggota)
          ? data.daftar_anggota.map(String)
          : [],
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "teams");
  }

  if (liveTeams.length < DEFAULT_TEAMS.length) {
    await seedDefaultTeamsIfMissing(liveTeams.length > 0 ? liveTeams : knownTeams);
    try {
      const refreshed = await getDocs(collection(db, "teams"));
      liveTeams = refreshed.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nama_tim: String(data.nama_tim ?? d.id),
          deskripsi: String(data.deskripsi ?? ""),
          daftar_anggota: Array.isArray(data.daftar_anggota)
            ? data.daftar_anggota.map(String)
            : [],
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "teams");
    }
  }

  // Build lookup by normalized team name -> team_id
  const teamIdByName = new Map<string, string>();
  for (const t of liveTeams) {
    teamIdByName.set(t.nama_tim.trim().toLowerCase(), t.id);
    teamIdByName.set(t.id.trim().toLowerCase(), t.id);
  }

  // Fetch existing activities to prevent duplicating demo_id or overwriting official records
  const existingDocsById = new Map<string, Record<string, unknown>>();
  const existingDemoIds = new Set<string>();
  try {
    const existingSnap = await getDocs(collection(db, "activities"));
    for (const d of existingSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      existingDocsById.set(d.id, data);
      if (typeof data.demo_id === "string" && data.demo_id.trim()) {
        existingDemoIds.add(data.demo_id.trim());
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "activities");
  }

  const pendingWrites: Array<{
    docId: string;
    payload: Record<string, unknown>;
  }> = [];
  let skippedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (let idx = 0; idx < parsed.length; idx++) {
    const item = parsed[idx] as RawDemoActivityJson;
    const demoId = String(item?.demo_id ?? "").trim();
    const namaKegiatan = String(item?.nama_kegiatan ?? "").trim();

    if (!demoId || !/^[a-zA-Z0-9_-]{1,64}$/.test(demoId)) {
      failedCount += 1;
      errors.push(`Baris ${idx + 1}: demo_id tidak valid.`);
      continue;
    }

    const existingDoc = existingDocsById.get(demoId);
    if (existingDoc || existingDemoIds.has(demoId)) {
      if (existingDoc && existingDoc.is_demo !== true) {
        failedCount += 1;
        errors.push(
          `${demoId}: ID dokumen sudah dipakai kegiatan resmi sehingga tidak ditimpa.`
        );
      } else {
        skippedCount += 1;
      }
      continue;
    }

    const prepDate = String(item.tanggal_mulai_persiapan ?? "").trim();
    const execDate = String(item.tanggal_pelaksanaan ?? "").trim();
    const reminderDate = String(item.tanggal_pengingat ?? "").trim();
    if (
      !namaKegiatan ||
      !isIsoDateString(prepDate) ||
      !isIsoDateString(execDate) ||
      !isIsoDateString(reminderDate)
    ) {
      failedCount += 1;
      errors.push(`${demoId}: format nama kegiatan atau tanggal tidak valid.`);
      continue;
    }

    const rawTeamName = String(item.tim_pelaksana ?? "Tim 1").trim();
    const matchedTeamId =
      teamIdByName.get(rawTeamName.toLowerCase()) ??
      mapTeamIdFromLegacyName(rawTeamName);

    const rawCategory = String(item.kategori_kegiatan ?? "Lainnya").trim();
    const normalizedCategory = normalizeActivityCategory(rawCategory);
    const normalizedStatus = normalizeActivityStatus(item.status);
    const numericProgress = Math.max(
      0,
      Math.min(100, Math.round(Number(item.progress ?? 0) || 0))
    );
    const notesText = String(item.catatan_deskripsi ?? "").trim().slice(0, 2000);
    const targetOutput =
      String(item.target_output ?? "").trim().slice(0, 500) ||
      "Target output kegiatan";
    const picName = String(item.pic ?? "").trim().slice(0, 150) || "PIC Tim";
    const resultText = String(item.hasil_kegiatan ?? "").trim().slice(0, 1000);

    pendingWrites.push({
      docId: demoId,
      payload: {
        demo_id: demoId,
        nama_kegiatan: namaKegiatan.slice(0, 300),
        kategori_kegiatan: rawCategory.slice(0, 120),
        kategori: normalizedCategory,
        tim_pelaksana: rawTeamName.slice(0, 120),
        team_id: matchedTeamId,
        created_by: adminUid,
        pic: picName,
        tanggal_mulai_persiapan: prepDate,
        tanggal_pelaksanaan: execDate,
        tanggal_pengingat: reminderDate,
        target_output: targetOutput,
        catatan_deskripsi: notesText,
        deskripsi: notesText,
        status: normalizedStatus,
        progress: numericProgress,
        persentase_progres: numericProgress,
        hasil_kegiatan: resultText,
        is_demo: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
    });
  }

  let savedCount = 0;
  const BATCH_CHUNK_SIZE = 450;

  for (let i = 0; i < pendingWrites.length; i += BATCH_CHUNK_SIZE) {
    const chunk = pendingWrites.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const entry of chunk) {
      batch.set(doc(db, "activities", entry.docId), entry.payload);
    }
    try {
      await batch.commit();
      savedCount += chunk.length;
    } catch (error) {
      failedCount += chunk.length;
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Gagal batch write (${chunk.length} data): ${msg}`);
    }
  }

  return {
    totalInFile: parsed.length,
    savedCount,
    skippedCount,
    failedCount,
    errors,
  };
}

// ============================================================================
// 8. ADMIN BATCH IMPORT OF ACTIVITIES FROM EXCEL (.xlsx / .xls)
// ============================================================================

export async function importExcelActivitiesToFirestore(
  adminUid: string,
  validRows: ParsedExcelRow[],
  knownTeams: TeamDoc[]
): Promise<DemoImportResult> {
  if (validRows.length === 0) {
    return {
      totalInFile: 0,
      savedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  // Ensure default teams exist in Firestore before referencing team_id
  let liveTeams: TeamDoc[] = [];
  try {
    const teamSnap = await getDocs(collection(db, "teams"));
    liveTeams = teamSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        nama_tim: String(data.nama_tim ?? d.id),
        deskripsi: String(data.deskripsi ?? ""),
        daftar_anggota: Array.isArray(data.daftar_anggota)
          ? data.daftar_anggota.map(String)
          : [],
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "teams");
  }

  if (liveTeams.length < DEFAULT_TEAMS.length) {
    await seedDefaultTeamsIfMissing(liveTeams.length > 0 ? liveTeams : knownTeams);
  }

  // Re-check live Firestore activities to avoid duplicating existing records
  const liveFingerprints = new Set<string>();
  try {
    const existingSnap = await getDocs(collection(db, "activities"));
    for (const d of existingSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      const fp = buildActivityFingerprint(
        String(data.nama_kegiatan ?? ""),
        String(data.team_id ?? ""),
        String(data.tanggal_pelaksanaan ?? "")
      );
      if (fp) liveFingerprints.add(fp);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "activities");
  }

  const pendingPayloads: Record<string, unknown>[] = [];
  let skippedCount = 0;

  for (const row of validRows) {
    if (
      !row.kategori ||
      !row.teamId ||
      !row.tanggalMulaiPersiapan ||
      !row.tanggalPelaksanaan ||
      !row.tanggalPengingat
    ) {
      continue;
    }

    const fp = buildActivityFingerprint(
      row.namaKegiatan,
      row.teamId,
      row.tanggalPelaksanaan
    );
    if (liveFingerprints.has(fp)) {
      skippedCount += 1;
      continue;
    }
    liveFingerprints.add(fp);

    pendingPayloads.push({
      nama_kegiatan: row.namaKegiatan.slice(0, 300),
      kategori: row.kategori,
      deskripsi: row.catatan.slice(0, 2000),
      team_id: row.teamId,
      created_by: adminUid,
      pic: row.pic.slice(0, 150),
      tanggal_mulai_persiapan: row.tanggalMulaiPersiapan,
      tanggal_pelaksanaan: row.tanggalPelaksanaan,
      tanggal_pengingat: row.tanggalPengingat,
      target_output: row.targetOutput.slice(0, 500),
      hasil_kegiatan: "",
      status: "Belum Dimulai",
      persentase_progres: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }

  let savedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  const BATCH_CHUNK_SIZE = 450;

  for (let i = 0; i < pendingPayloads.length; i += BATCH_CHUNK_SIZE) {
    const chunk = pendingPayloads.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const payload of chunk) {
      const newRef = doc(collection(db, "activities"));
      batch.set(newRef, payload);
    }
    try {
      await batch.commit();
      savedCount += chunk.length;
    } catch (error) {
      failedCount += chunk.length;
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Gagal menyimpan batch (${chunk.length} baris): ${msg}`);
    }
  }

  return {
    totalInFile: validRows.length,
    savedCount,
    skippedCount,
    failedCount,
    errors,
  };
}


