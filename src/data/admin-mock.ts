// Mockup data untuk Dashboard Admin OPD
// Catatan: data ini hanya in-memory; perubahan status di UI tidak persist setelah refresh.

export type StatusPermohonan = "baru" | "diproses" | "selesai" | "ditolak";

export type OPD = {
  id: string;
  nama: string;
  singkatan: string;
  kategori: string[]; // kategori layanan yang ditangani
};

export type Petugas = {
  id: string;
  nama: string;
  jabatan: string;
  opdId: string;
  inisial: string;
};

export type RiwayatItem = {
  ts: string; // ISO date
  oleh: string;
  aksi: string;
  catatan?: string;
};

export type Lampiran = {
  nama: string;
  ukuran: string;
};

export type Permohonan = {
  id: string; // contoh: PRM-2025-0421
  judul: string;
  kategori: string;
  opdId: string;
  status: StatusPermohonan;
  prioritas: "rendah" | "normal" | "tinggi";
  tanggalMasuk: string; // ISO
  tenggat: string; // ISO
  pemohon: {
    nama: string;
    nik: string;
    telepon: string;
    email: string;
    alamat: string;
  };
  ringkasan: string;
  lampiran: Lampiran[];
  petugasId: string | null;
  riwayat: RiwayatItem[];
};

export const OPD_LIST: OPD[] = [
  {
    id: "disdukcapil",
    nama: "Dinas Kependudukan & Pencatatan Sipil",
    singkatan: "Disdukcapil",
    kategori: ["Adminduk", "Akta Kelahiran", "KTP-el", "Kartu Keluarga"],
  },
  {
    id: "dpmptsp",
    nama: "Dinas Penanaman Modal & PTSP",
    singkatan: "DPMPTSP",
    kategori: ["Perizinan Usaha", "IMB / PBG", "Izin Reklame"],
  },
  {
    id: "dishub",
    nama: "Dinas Perhubungan",
    singkatan: "Dishub",
    kategori: ["Izin Trayek", "Parkir", "Pengaduan Lalin"],
  },
  {
    id: "dinkes",
    nama: "Dinas Kesehatan",
    singkatan: "Dinkes",
    kategori: ["Izin Praktik", "Layanan Kesehatan", "Vaksinasi"],
  },
];

export const PETUGAS_LIST: Petugas[] = [
  { id: "p1", nama: "Andi Saputra", jabatan: "Kepala Seksi Adminduk", opdId: "disdukcapil", inisial: "AS" },
  { id: "p2", nama: "Rini Marlina", jabatan: "Staf Pelayanan", opdId: "disdukcapil", inisial: "RM" },
  { id: "p3", nama: "Budi Hartono", jabatan: "Staf Pencatatan Sipil", opdId: "disdukcapil", inisial: "BH" },
  { id: "p4", nama: "Siti Nurhaliza", jabatan: "Kasi Perizinan", opdId: "dpmptsp", inisial: "SN" },
  { id: "p5", nama: "Eko Prasetyo", jabatan: "Verifikator Izin", opdId: "dpmptsp", inisial: "EP" },
  { id: "p6", nama: "Dewi Anggraini", jabatan: "Staf Trayek", opdId: "dishub", inisial: "DA" },
  { id: "p7", nama: "Rahmat Hidayat", jabatan: "Staf Lalin", opdId: "dishub", inisial: "RH" },
  { id: "p8", nama: "Lestari Wulandari", jabatan: "Kasi Yankes", opdId: "dinkes", inisial: "LW" },
];

const namaWarga = [
  "Ahmad Fauzi", "Maya Putri", "Joko Susilo", "Linda Permata", "Hendra Wijaya",
  "Sari Indah", "Agus Setiawan", "Tina Mulyani", "Bambang Suryo", "Ratna Dewi",
  "Yusuf Ramadhan", "Citra Kirana", "Dimas Aji", "Farah Salsabila", "Nanda Pratama",
  "Indri Lestari", "Rio Saputra", "Mega Anjani", "Hadi Pranoto", "Vina Oktaviani",
];

const ringkasanContoh: Record<string, string> = {
  "Adminduk": "Permohonan pencetakan ulang dokumen kependudukan karena hilang/rusak.",
  "Akta Kelahiran": "Permohonan penerbitan Akta Kelahiran untuk anak yang baru lahir.",
  "KTP-el": "Permohonan perekaman & pencetakan KTP-el untuk warga usia 17 tahun.",
  "Kartu Keluarga": "Permohonan perubahan data Kartu Keluarga (penambahan anggota).",
  "Perizinan Usaha": "Permohonan NIB / izin usaha mikro untuk warung kelontong.",
  "IMB / PBG": "Permohonan Persetujuan Bangunan Gedung untuk rumah tinggal 2 lantai.",
  "Izin Reklame": "Permohonan izin pemasangan reklame baliho di Jl. Diponegoro.",
  "Izin Trayek": "Permohonan perpanjangan izin trayek angkutan kota jalur 04.",
  "Parkir": "Permohonan izin penyelenggaraan parkir di lahan milik sendiri.",
  "Pengaduan Lalin": "Pengaduan kerusakan rambu lalu lintas di simpang Pasar Baru.",
  "Izin Praktik": "Permohonan SIP untuk praktik dokter umum mandiri.",
  "Layanan Kesehatan": "Permohonan rujukan layanan kesehatan rujukan tingkat lanjut.",
  "Vaksinasi": "Pendaftaran jadwal vaksinasi balita di Puskesmas terdekat.",
};

const statusPool: StatusPermohonan[] = ["baru", "baru", "diproses", "diproses", "diproses", "selesai", "selesai", "ditolak"];
const prioritasPool: Permohonan["prioritas"][] = ["rendah", "normal", "normal", "normal", "tinggi"];

function pad(n: number, width = 4) {
  return n.toString().padStart(width, "0");
}

function generatePermohonan(): Permohonan[] {
  const items: Permohonan[] = [];
  let counter = 421;
  const now = Date.now();

  OPD_LIST.forEach((opd) => {
    opd.kategori.forEach((kategori) => {
      // 3-5 permohonan per kategori
      const jumlah = 3 + (counter % 3);
      for (let i = 0; i < jumlah; i++) {
        const dayOffset = (counter % 28); // 0-27 hari yang lalu
        const tanggalMasuk = new Date(now - dayOffset * 86400000);
        const tenggat = new Date(tanggalMasuk.getTime() + (5 + (counter % 10)) * 86400000);
        const status = statusPool[counter % statusPool.length];
        const prioritas = prioritasPool[counter % prioritasPool.length];
        const pemohonNama = namaWarga[counter % namaWarga.length];
        const petugasOPD = PETUGAS_LIST.filter((p) => p.opdId === opd.id);
        const petugasId = status === "baru" ? null : petugasOPD[counter % petugasOPD.length].id;

        const id = `PRM-2025-${pad(counter)}`;
        const riwayat: RiwayatItem[] = [
          {
            ts: tanggalMasuk.toISOString(),
            oleh: pemohonNama,
            aksi: "Permohonan diajukan",
            catatan: "Pengajuan melalui portal warga.",
          },
        ];
        if (status !== "baru" && petugasId) {
          const ptg = PETUGAS_LIST.find((p) => p.id === petugasId)!;
          riwayat.push({
            ts: new Date(tanggalMasuk.getTime() + 86400000).toISOString(),
            oleh: ptg.nama,
            aksi: "Diproses",
            catatan: "Berkas masuk antrian verifikasi.",
          });
        }
        if (status === "selesai" && petugasId) {
          const ptg = PETUGAS_LIST.find((p) => p.id === petugasId)!;
          riwayat.push({
            ts: new Date(tanggalMasuk.getTime() + 3 * 86400000).toISOString(),
            oleh: ptg.nama,
            aksi: "Selesai",
            catatan: "Dokumen siap diambil di loket / dikirim digital.",
          });
        }
        if (status === "ditolak" && petugasId) {
          const ptg = PETUGAS_LIST.find((p) => p.id === petugasId)!;
          riwayat.push({
            ts: new Date(tanggalMasuk.getTime() + 2 * 86400000).toISOString(),
            oleh: ptg.nama,
            aksi: "Ditolak",
            catatan: "Berkas tidak lengkap, mohon ajukan ulang.",
          });
        }

        items.push({
          id,
          judul: `${kategori} — ${pemohonNama}`,
          kategori,
          opdId: opd.id,
          status,
          prioritas,
          tanggalMasuk: tanggalMasuk.toISOString(),
          tenggat: tenggat.toISOString(),
          pemohon: {
            nama: pemohonNama,
            nik: `3210${pad(counter * 137, 12).slice(0, 12)}`,
            telepon: `0812-${pad(counter * 13, 4)}-${pad(counter * 7, 4)}`,
            email: `${pemohonNama.toLowerCase().replace(/\s+/g, ".")}@warga.id`,
            alamat: `Jl. Merdeka No. ${(counter % 200) + 1}, Kec. Harapan ${(counter % 5) + 1}`,
          },
          ringkasan: ringkasanContoh[kategori] ?? "Permohonan layanan publik.",
          lampiran: [
            { nama: "KTP_pemohon.pdf", ukuran: "245 KB" },
            { nama: "KK_pemohon.pdf", ukuran: "312 KB" },
            ...(counter % 3 === 0 ? [{ nama: "Surat_pengantar.pdf", ukuran: "128 KB" }] : []),
          ],
          petugasId,
          riwayat,
        });
        counter++;
      }
    });
  });

  return items;
}

export const PERMOHONAN_AWAL: Permohonan[] = generatePermohonan();

export const STATUS_LABEL: Record<StatusPermohonan, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

export const STATUS_TONE: Record<StatusPermohonan, string> = {
  baru: "bg-accent/15 text-accent border-accent/30",
  diproses: "bg-gold/20 text-gold-foreground border-gold/40",
  selesai: "bg-success/15 text-success border-success/30",
  ditolak: "bg-destructive/15 text-destructive border-destructive/30",
};
