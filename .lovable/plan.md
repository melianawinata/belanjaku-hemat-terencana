# Rencana Build: Web-App BelanjaKu (Customer + Admin)

Membangun web-app terautentikasi penuh di dalam situs landing page BelanjaKu yang sudah ada. Backend pakai **Lovable Cloud** (database + auth + role guard), data tersimpan permanen, dengan seed data realistis agar app langsung hidup. Landing page `/` tetap utuh; tombol Masuk/Daftar mengarah ke alur auth.

## Cakupan
- **Auth**: email+password, role `customer`/`admin`, route guard.
- **Customer** (`/app/*`): 10 area di §6 brief.
- **Admin** (`/admin/*`): 8 layar CRUD di §7 brief.
- **Alur end-to-end** §8 berfungsi dengan perhitungan nyata (estimasi, realisasi, selisih, insight, grafik).

---

## 1. Backend (Lovable Cloud)

### Tabel (skema sesuai §5)
`profiles` (id→auth.users, nama, kategori_user_id, foto_url), `user_roles` (role enum customer/admin, tabel terpisah + fungsi `has_role` security-definer), `kategori_user`, `kategori_barang`, `item`, `satuan`, `toko`, `default_item_kategori`, `item_favorit`, `belanja_bulanan`, `belanja_item`, `histori_harga`, `aktivitas`.

### Keamanan
- Setiap tabel public: `GRANT` + `ENABLE RLS` + policy.
- Data milik user (belanja, favorit, histori, aktivitas, profiles): policy scope `auth.uid()`.
- Master data (kategori, item, toko, satuan, default_item): SELECT untuk `authenticated`; tulis hanya untuk admin (`has_role(auth.uid(),'admin')`).
- Trigger auto-create `profiles` + assign role `customer` saat signup.

### Seed (via migrasi)
Master kategori user/barang, item lokal (Beras, Minyak, Gula, Telur, Sabun, Kopi, Mie...), toko (Indomaret, Alfamart, Superindo, Pasar), default item per kategori, histori harga 2-3 bulan. Akun demo (1 admin + 3 customer per persona) dibuat lewat server function admin/seeding agar Insight & grafik langsung tampil.

## 2. Auth & Routing
- `/auth` (public): tab Masuk + Daftar (Nama, Email, Password, dropdown Kategori User), indikator kekuatan password, validasi zod inline.
- `/auth` redirect: customer→`/app/dashboard`, admin→`/admin/dashboard`.
- `/reset-password` (public) untuk lupa password.
- Onboarding 3 langkah pasca-registrasi (welcome → set budget → pilih default item).
- Guard: `_authenticated/` layout untuk `/app/*`; layout admin tambahan cek `has_role` admin.
- Data lewat `createServerFn` + `requireSupabaseAuth`; query via TanStack Query.

## 3. Layar Customer (§6)
Layout: sidebar (desktop) / bottom-nav (mobile): Dashboard, Belanja Bulan Ini, History, Budget, Favorit, Profil.
- **Dashboard**: ringkasan (budget/estimasi/realisasi/selisih + progress bar), statistik (donut item dibeli), insight (naik/turun harga, paling sering dibeli), grafik per-kategori (donut) & per-bulan (bar) via recharts.
- **Belanja Bulan Ini**: tabel item + subtotal per kategori + total + peringatan budget; tambah/edit/hapus item; tombol Ambil dari Bulan Lalu / Template Kategori / Mulai Belanja.
- **Generate Wizard**: pilih sumber → checklist item → tambah ke daftar (gabung tanpa duplikat).
- **Mulai Belanja**: checklist + input harga aktual + toko, total realisasi sticky vs budget.
- **Selesai Belanja**: summary hemat/over + insight ramah → simpan ke History + HistoriHarga + Aktivitas.
- **History** + detail (edit harga/jumlah/toko, recalc).
- **Budget** bulanan + mini-chart budget vs realisasi.
- **Favorit** (CRUD), **Profil** (edit + ganti password + keluar).

## 4. Layar Admin (§7)
Sidebar admin. Dashboard KPI + grafik. CRUD konsisten (tabel + tambah + modal edit + konfirmasi hapus + search + paginasi) untuk: Kategori User, Kategori Barang, Item, Toko. Default Item per Kategori (checklist). Daftar User + Detail User (tab Profil / History / Aktivitas).

## 5. Logika Perhitungan (nyata, bukan statis)
- Estimasi item = harga terbaru dari `histori_harga` (fallback rata-rata / 0).
- Realisasi = Σ harga_aktual item dibeli. Selisih = budget − realisasi.
- Insight naik/turun = bandingkan 2 harga terbaru per item; paling sering = frekuensi lintas bulan.

## 6. Design System (§3)
Token warna hijau/biru/putih persis dari brief ditambahkan ke `src/styles.css`. Font: Bricolage Grotesque (judul), Inter (body), IBM Plex Mono (angka/label) via `<link>` di `__root.tsx`. Komponen shadcn yang ada dipakai ulang. Format Rupiah `Rp 1.250.000`, bulan & locale Indonesia. State kosong/loading(skeleton)/error + toast + konfirmasi di tiap layar. Responsif mobile-first.

## Catatan teknis
- Komponen modular per route di `src/routes/app.*` dan `src/routes/admin.*`; helper format/locale di `src/lib`.
- Skema admin auth diperkuat dengan `user_roles` + `has_role` (anti privilege-escalation).
- Landing page existing tidak diubah selain menautkan tombol Masuk/Daftar ke `/auth`.

Ini build besar; saya kerjakan backend dulu (skema+seed), lalu auth, lalu layar customer, lalu admin, sambil verifikasi tiap tahap di preview.