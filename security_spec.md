# Security Specification — PusKI Cloud Firestore

## 1. Data Invariants
1. **User Identity & Role Isolation**: A user document at `/users/{userId}` can only be self-created by the authenticated owner (`request.auth.uid == userId`) with `role in ['pegawai', 'pimpinan']` and `role_selected == true` (NEVER `'admin'`). Role `'admin'` can only be assigned by an already authorized Admin (`isAdmin()`), the verified bootstrapped owner `heruru2811@gmail.com`, or an out-of-band provisioned entry in `/admins/{uid}` (client writes to `/admins` are strictly denied). Once `role_selected == true`, non-admins can NEVER modify their own `role`, `team_id`, `jabatan`, or `role_selected`.
2. **PII Protection**: User documents contain `email`. Read (`get`) is strictly limited to the document owner (`request.auth.uid == userId`) or `admin`. Listing all users is strictly limited to `admin`.
3. **Team-Scoped Activity Ownership**: Every `/activities/{activityId}` document must reference an existing `/teams/{team_id}` (`exists(...)` on create) and bind `created_by == request.auth.uid`. `created_by` is immutable after creation.
4. **Access Boundaries**:
   - `pegawai` (including Ketua Tim) can read, create, update, and delete activities ONLY within their assigned `team_id`.
   - `pimpinan` can read ALL activities across all teams, and cannot mutate activities or admin tables.
   - `admin` can manage all `users`, `teams`, and `activities`.
5. **Sub-Collection Master Gate**:
   - `/activities/{activityId}/tasks/{taskId}` inherits access strictly from its parent `/activities/{activityId}` via `get(...)`.
   - `/users/{userId}/notifications/{notificationId}` is strictly owned by `userId` (`request.auth.uid == userId`).
6. **Temporal & Schema Integrity**: Every write enforces strict allowed keys (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update), string length limits, valid regex IDs, and server-verified `request.time` timestamps (`created_at`, `updated_at`).

## 2. "Dirty Dozen" Adversarial Payloads
1. **Self-Privilege Escalation (Create)**: Pegawai creates `/users/{uid}` with `role: "admin"`. -> `PERMISSION_DENIED`.
2. **Self-Privilege Escalation (Update)**: Pegawai updates own `/users/{uid}` changing `role` to `"pimpinan"` or `team_id` to `"tim_2"`. -> `PERMISSION_DENIED`.
3. **PII Scraping**: Non-admin executes `getDocs(collection(db, "users"))` or reads `/users/{otherUid}`. -> `PERMISSION_DENIED`.
4. **Cross-Team Activity Creation**: Pegawai in `tim_1` creates `/activities/{id}` with `team_id: "tim_2"`. -> `PERMISSION_DENIED`.
5. **Orphaned Team Reference**: User creates `/activities/{id}` with `team_id: "tim_tidak_ada"`. -> `PERMISSION_DENIED`.
6. **Identity Spoofing**: User creates `/activities/{id}` with `created_by: "other_uid"`. -> `PERMISSION_DENIED`.
7. **Shadow / Ghost Field Injection**: User creates or updates `/activities/{id}` with extra field `isApprovedByBoss: true`. -> `PERMISSION_DENIED`.
8. **Resource Exhaustion (1MB String)**: User injects 10,000-char string into `nama_kegiatan` or invalid `activityId` path (`"../../etc"`). -> `PERMISSION_DENIED`.
9. **Client Timestamp Tampering**: User sends backdated `created_at` or `updated_at` instead of `serverTimestamp()`. -> `PERMISSION_DENIED`.
10. **Cross-Team Task Tampering**: Pegawai in `tim_1` attempts to create/update `/activities/{tim2ActivityId}/tasks/{taskId}`. -> `PERMISSION_DENIED`.
11. **Terminal State Bypass**: Non-admin attempts to modify an activity whose status is already `'Dibatalkan'` or `'Selesai'` (unless admin override). -> `PERMISSION_DENIED`.
12. **Unverified Email Spoofing**: User with `email_verified: false` attempts write operations or claims admin email. -> `PERMISSION_DENIED`.
