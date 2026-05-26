# Refactor Sistem Role & RBAC — Bertahap, Backward-Compatible

Tujuan: ubah sistem role saat ini menjadi RBAC modular (role + asn_type + system_position + permission granular) tanpa merusak fitur, route, session, atau user existing. Dijalankan dalam **5 fase**, tiap fase aman di-deploy sendiri.

---

## Kondisi Saat Ini (ringkas)

- Enum `app_role`: `warga`, `admin_opd`, `super_admin`, `admin_desa`, `asn` (dipakai di `user_roles`, helper `has_role`, RLS di seluruh tabel)
- `profiles` punya: `opd_id`, `desa`, `nip`, `jabatan` (text bebas)
- Helper: `has_role`, `get_user_opd`, `get_user_desa`, `is_pimpinan`, `can_access_paket`
- Auth context client: `useAuth()` expose `isAdmin/isSuperAdmin/isAdminDesa/isAdminOpd/isAsn/isStaff`
- Audit: tabel `audit_log` sudah ada (append-only, RLS super_admin/admin_desa)

## Prinsip Migrasi

1. **Enum lama tidak dihapus**, hanya ditambah (`admin_pemda`)
2. **Tabel `user_roles` tetap** = sumber kebenaran role utama
3. Field baru ditambahkan, default = NULL/aman, tidak memutus query existing
4. Helper baru di-introduce side-by-side dengan helper lama
5. RLS lama tidak diubah di fase awal; ditambah, lalu fase akhir di-refactor jadi pola `has_permission()`
6. UI lama tetap pakai `useAuth().isAdmin` dst (alias tetap hidup); UI baru pakai `useCan('permission')`

---

## Fase 1 — Foundation (DB + types, zero behavior change)

**Migrasi SQL:**

- `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin_pemda'`
- Enum baru `asn_type`: `pns | pppk_penuh_waktu | pppk_paruh_waktu | honorer`
- Enum baru `system_position`: `kepala_opd | sekretaris | kepala_bidang | kepala_sekolah | operator | verifikator | staff | guru | tenaga_teknis | lainnya`
- `ALTER TABLE profiles ADD COLUMN asn_type asn_type`, `system_position system_position`, `unit_kerja_id uuid` (semua nullable)
- Tabel baru (semua dengan GRANT + RLS):
  - `permissions(code text PK, label text, kategori text, description text)`
  - `role_permissions(role app_role, permission_code text)` — default permission per role
  - `user_permissions(user_id, permission_code, granted boolean, granted_by, expires_at)` — override per-user (grant/deny)
  - `unit_kerja(id, opd_id, nama, parent_id)` — opsional, untuk hierarki sub-unit
  - `rbac_audit(id, user_id, target_user_id, aksi, before, after, created_at)` — audit khusus RBAC (append-only)
- Helper SQL baru (SECURITY DEFINER, search_path=public):
  - `has_permission(_uid uuid, _code text) returns boolean` — gabung `role_permissions` + override `user_permissions`
  - `get_effective_permissions(_uid uuid) returns setof text`
  - `get_user_asn_type(_uid)`, `get_user_position(_uid)`
- Seed `permissions` + `role_permissions` sesuai daftar (can_create_form, can_approve_submission, dll). Mapping default:
  - `super_admin` → semua
  - `admin_pemda` → manage_opd, view_audit_logs, export_data, approve cross-OPD
  - `admin_opd` → manage form/submission/document dalam OPD-nya
  - `admin_desa` → manage warga sedesa, verifikasi
  - `asn` → create/edit submission sendiri, share document, request document
  - `warga` → view publik + create permohonan sendiri
- Trigger audit pada `user_roles`, `user_permissions`, `profiles.system_position/asn_type` → tulis ke `rbac_audit`

**Code:** belum ada perubahan UI. Hanya regenerasi `types.ts` otomatis.

**Hasil Fase 1:** Sistem lama jalan 100% sama. Tabel & helper baru siap dipakai.

---

## Fase 2 — Authorization Layer (TypeScript)

Folder baru (tanpa memindah file lama):

```
src/features/rbac/
  constants.ts        // ROLES, PERMISSIONS, ASN_TYPES, POSITIONS (single source of truth)
  types.ts            // AppRole, Permission, AsnType, SystemPosition
  permissions.functions.ts   // server fn: getEffectivePermissions(userId)
  guards.ts           // canAccessDocument(ctx, doc), canManageForm, canVerifySubmission, ownership helpers
  hooks.ts            // useCan(permission), usePermissions(), useAsnType()
```

- `useAuth()` di-extend: tambah `permissions: Set<Permission>`, `asnType`, `systemPosition`, helper `can(p)`. Field lama (`isAdmin` dst) tetap sebagai alias yang dihitung dari role — **tidak ada breaking change**.
- Permission di-load sekali setelah login via server fn `getEffectivePermissions` (cached di context, di-invalidate saat `onAuthStateChange`).
- Server fn baru: `requirePermission(code)` middleware factory; pakai bersama `requireSupabaseAuth`.

**Hasil Fase 2:** Komponen baru bisa pakai `useCan('can_approve_submission')`. Komponen lama tidak berubah.

---

## Fase 3 — Adopsi Bertahap di Fitur Kunci

Refactor **tanpa mengubah route URL atau API publik**:

1. **Berbagi data** (`src/lib/share.functions.ts`, `berbagi.*`) — gantikan cek role inline dengan `has_permission('can_share_document')` + ownership check yang sudah ada. `can_access_paket` tetap dipakai.
2. **Approval workflow** (`share_paket.approval_required`) — gunakan `can_approve_submission` (cek di server fn + tombol UI via `useCan`).
3. **Form targeting** (`dataset_template.target_role/target_scope`) — tambah opsi targeting by `asn_type` dan `system_position`; logika lama (`target_role='asn'`) tetap valid.
4. **Audit sensitif** — `can_view_audit_logs` (super_admin + admin_pemda).

Setiap perubahan: server-side check dulu (otoritatif), UI hide tombol sebagai UX.

---

## Fase 4 — UI Manajemen RBAC

Route baru di bawah `src/routes/admin.rbac.*`:

- `/admin/rbac` — daftar user + role + position + asn_type (filter, search)
- `/admin/rbac/$userId` — detail: assign role, asn_type, system_position, override permission (grant/deny + expiry), lihat **effective permissions**
- `/admin/rbac/audit` — view `rbac_audit` (append-only)

Guard: `can_manage_roles`. Pakai komponen UI existing (`AdminShell`, shadcn table/dialog).

---

## Fase 5 — Hardening RLS & Cleanup

- Refactor RLS policies penting ke pola `has_permission(...)` (paralel dulu sebagai policy tambahan, lalu drop policy lama setelah QA).
- Tambah index: `user_permissions(user_id, permission_code)`, `profiles(opd_id)`, `profiles(system_position)`.
- Linter Supabase + test smoke seluruh route existing.
- Dokumentasi `workflow.md` di-update dengan section RBAC.

---

## Backward Compatibility Checklist

- Enum `app_role` hanya **ditambah**, tidak diubah/dihapus → user_roles existing valid
- `has_role` tetap berfungsi → semua RLS lama jalan
- `useAuth().isAdmin/isAdminOpd/...` tetap ada (alias) → semua komponen lama jalan
- Route `/admin/*`, `/berbagi/*`, `/asn/*`, `/auth` tidak berubah path-nya
- Session Supabase tidak diutak-atik (storage, refresh, listener tetap)
- Migrasi idempoten (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING` di seed)

---

## Detail Teknis Penting

- **Cloudflare Workers compat**: semua logic baru di server fn (`createServerFn`) — tidak ada Node-only dep. RLS hitungan di Postgres.
- **Performance permission check**: `has_permission()` adalah single SQL function (stable, security definer). Di client, permission set di-cache di `AuthProvider`, refresh hanya pada `SIGNED_IN`/`TOKEN_REFRESHED`/realtime `user_permissions` perubahan untuk user itu.
- **Audit immutability**: `rbac_audit` punya policy `INSERT` only untuk authenticated, no UPDATE/DELETE (kecuali via DB role service_role).
- **Type safety**: `PERMISSIONS` adalah `as const` object; `Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]`. Tidak ada string permission hardcoded di luar `constants.ts`.

---

## Yang Saya Butuhkan dari Anda

1. **Konfirmasi**: lanjut implementasi Fase 1 sekarang (migrasi DB + seed permission)? Fase 2–5 bisa dilanjut di pesan berikutnya supaya bisa di-review per fase.
2. **Default permission mapping**: pakai default di atas, atau ada penyesuaian (misal admin_pemda boleh apa saja persis)?
3. **`admin_desa`**: dipertahankan apa adanya (saat ini hanya cek role + desa), atau sekalian disetarakan ke pola permission?

Setelah Anda OK, saya mulai Fase 1.
