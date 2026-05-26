export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absensi_asn: {
        Row: {
          catatan: string | null
          created_at: string
          device_info: string | null
          foto_url: string | null
          id: string
          lat: number | null
          lng: number | null
          lokasi: string | null
          opd_id: string | null
          tipe: string
          user_id: string
          waktu: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          device_info?: string | null
          foto_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          lokasi?: string | null
          opd_id?: string | null
          tipe: string
          user_id: string
          waktu?: string
        }
        Update: {
          catatan?: string | null
          created_at?: string
          device_info?: string | null
          foto_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          lokasi?: string | null
          opd_id?: string | null
          tipe?: string
          user_id?: string
          waktu?: string
        }
        Relationships: [
          {
            foreignKeyName: "absensi_asn_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: false
            referencedRelation: "opd"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absensi_asn_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_setting: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      aset: {
        Row: {
          catatan: string | null
          created_at: string
          deskripsi: string | null
          foto_url: string | null
          id: string
          kategori: string
          kode: string
          kondisi: string
          lat: number | null
          lng: number | null
          lokasi: string | null
          lokasi_terkini: string | null
          merk: string | null
          nama: string
          nilai_perolehan: number | null
          nomor_seri: string | null
          opd_id: string | null
          pemegang_user_id: string | null
          status: Database["public"]["Enums"]["aset_status"]
          tanggal_perolehan: string | null
          updated_at: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          deskripsi?: string | null
          foto_url?: string | null
          id?: string
          kategori?: string
          kode: string
          kondisi?: string
          lat?: number | null
          lng?: number | null
          lokasi?: string | null
          lokasi_terkini?: string | null
          merk?: string | null
          nama: string
          nilai_perolehan?: number | null
          nomor_seri?: string | null
          opd_id?: string | null
          pemegang_user_id?: string | null
          status?: Database["public"]["Enums"]["aset_status"]
          tanggal_perolehan?: string | null
          updated_at?: string
        }
        Update: {
          catatan?: string | null
          created_at?: string
          deskripsi?: string | null
          foto_url?: string | null
          id?: string
          kategori?: string
          kode?: string
          kondisi?: string
          lat?: number | null
          lng?: number | null
          lokasi?: string | null
          lokasi_terkini?: string | null
          merk?: string | null
          nama?: string
          nilai_perolehan?: number | null
          nomor_seri?: string | null
          opd_id?: string | null
          pemegang_user_id?: string | null
          status?: Database["public"]["Enums"]["aset_status"]
          tanggal_perolehan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aset_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: false
            referencedRelation: "opd"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aset_pemegang_user_id_fkey"
            columns: ["pemegang_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aset_riwayat: {
        Row: {
          aksi: string
          aset_id: string
          catatan: string | null
          created_at: string
          data: Json | null
          id: string
          lat: number | null
          lng: number | null
          lokasi_text: string | null
          oleh: string | null
        }
        Insert: {
          aksi: string
          aset_id: string
          catatan?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          lokasi_text?: string | null
          oleh?: string | null
        }
        Update: {
          aksi?: string
          aset_id?: string
          catatan?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          lokasi_text?: string | null
          oleh?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aset_riwayat_aset_id_fkey"
            columns: ["aset_id"]
            isOneToOne: false
            referencedRelation: "aset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aset_riwayat_oleh_fkey"
            columns: ["oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          aksi: string
          created_at: string
          data_sebelum: Json | null
          data_sesudah: Json | null
          entitas: string
          entitas_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          aksi: string
          created_at?: string
          data_sebelum?: Json | null
          data_sesudah?: Json | null
          entitas: string
          entitas_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          aksi?: string
          created_at?: string
          data_sebelum?: Json | null
          data_sesudah?: Json | null
          entitas?: string
          entitas_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_snapshot: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          id: string
          label: string
          size_bytes: number
          table_counts: Json
          tipe: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          label: string
          size_bytes?: number
          table_counts?: Json
          tipe?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          label?: string
          size_bytes?: number
          table_counts?: Json
          tipe?: string
        }
        Relationships: []
      }
      berita: {
        Row: {
          created_at: string
          gambar_url: string | null
          id: string
          isi: string
          judul: string
          penulis_id: string | null
          published_at: string | null
          ringkasan: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gambar_url?: string | null
          id?: string
          isi?: string
          judul: string
          penulis_id?: string | null
          published_at?: string | null
          ringkasan?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gambar_url?: string | null
          id?: string
          isi?: string
          judul?: string
          penulis_id?: string | null
          published_at?: string | null
          ringkasan?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_terpadu_item: {
        Row: {
          aktif: boolean
          created_at: string
          format: string | null
          id: string
          ikon: string | null
          kategori: string
          label: string
          nilai_num: number | null
          nilai_num2: number | null
          nilai_teks: string | null
          opd: string | null
          satuan: string | null
          trend: string | null
          ukuran: string | null
          updated_at: string
          url: string | null
          urutan: number
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          format?: string | null
          id?: string
          ikon?: string | null
          kategori: string
          label: string
          nilai_num?: number | null
          nilai_num2?: number | null
          nilai_teks?: string | null
          opd?: string | null
          satuan?: string | null
          trend?: string | null
          ukuran?: string | null
          updated_at?: string
          url?: string | null
          urutan?: number
        }
        Update: {
          aktif?: boolean
          created_at?: string
          format?: string | null
          id?: string
          ikon?: string | null
          kategori?: string
          label?: string
          nilai_num?: number | null
          nilai_num2?: number | null
          nilai_teks?: string | null
          opd?: string | null
          satuan?: string | null
          trend?: string | null
          ukuran?: string | null
          updated_at?: string
          url?: string | null
          urutan?: number
        }
        Relationships: []
      }
      dataset_submission: {
        Row: {
          data: Json
          id: string
          oleh_user_id: string
          opd_id: string | null
          returned_note: string | null
          status: string
          submitted_at: string
          template_id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          oleh_user_id: string
          opd_id?: string | null
          returned_note?: string | null
          status?: string
          submitted_at?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          oleh_user_id?: string
          opd_id?: string | null
          returned_note?: string | null
          status?: string
          submitted_at?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_submission_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dataset_template"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_template: {
        Row: {
          aktif: boolean
          allow_multiple_submit: boolean
          created_at: string
          created_by: string | null
          deadline: string | null
          deskripsi: string | null
          excel_layout: Json
          id: string
          judul: string
          kode: string | null
          kolom: Json
          opd_pemilik_id: string | null
          target_opd_ids: string[] | null
          target_role: string
          target_scope: string
          updated_at: string
        }
        Insert: {
          aktif?: boolean
          allow_multiple_submit?: boolean
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deskripsi?: string | null
          excel_layout?: Json
          id?: string
          judul: string
          kode?: string | null
          kolom?: Json
          opd_pemilik_id?: string | null
          target_opd_ids?: string[] | null
          target_role?: string
          target_scope?: string
          updated_at?: string
        }
        Update: {
          aktif?: boolean
          allow_multiple_submit?: boolean
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deskripsi?: string | null
          excel_layout?: Json
          id?: string
          judul?: string
          kode?: string | null
          kolom?: Json
          opd_pemilik_id?: string | null
          target_opd_ids?: string[] | null
          target_role?: string
          target_scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      desa: {
        Row: {
          aktif: boolean
          created_at: string
          id: string
          kecamatan: string | null
          nama: string
          updated_at: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          id?: string
          kecamatan?: string | null
          nama: string
          updated_at?: string
        }
        Update: {
          aktif?: boolean
          created_at?: string
          id?: string
          kecamatan?: string | null
          nama?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          job_type: string
          max_attempts: number
          payload: Json
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          max_attempts?: number
          payload?: Json
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          payload?: Json
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: []
      }
      kantor_qr: {
        Row: {
          aktif: boolean
          created_at: string
          id: string
          label: string | null
          lat: number | null
          lng: number | null
          lokasi: string | null
          opd_id: string
          radius_m: number
          token: string
          updated_at: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          lokasi?: string | null
          opd_id: string
          radius_m?: number
          token: string
          updated_at?: string
        }
        Update: {
          aktif?: boolean
          created_at?: string
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          lokasi?: string | null
          opd_id?: string
          radius_m?: number
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kantor_qr_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: true
            referencedRelation: "opd"
            referencedColumns: ["id"]
          },
        ]
      }
      kategori_layanan: {
        Row: {
          aktif: boolean
          created_at: string
          deskripsi: string | null
          id: string
          nama: string
          sla_hari: number
          slug: string
          updated_at: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          deskripsi?: string | null
          id?: string
          nama: string
          sla_hari?: number
          slug: string
          updated_at?: string
        }
        Update: {
          aktif?: boolean
          created_at?: string
          deskripsi?: string | null
          id?: string
          nama?: string
          sla_hari?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      laporan_masyarakat: {
        Row: {
          created_at: string
          ditangani_oleh: string | null
          email: string
          id: string
          kategori: string
          lokasi: string | null
          nama: string
          nik: string | null
          no_hp: string | null
          opd_id: string | null
          status: string
          tindak_lanjut: string | null
          updated_at: string
          uraian: string
        }
        Insert: {
          created_at?: string
          ditangani_oleh?: string | null
          email: string
          id?: string
          kategori: string
          lokasi?: string | null
          nama: string
          nik?: string | null
          no_hp?: string | null
          opd_id?: string | null
          status?: string
          tindak_lanjut?: string | null
          updated_at?: string
          uraian: string
        }
        Update: {
          created_at?: string
          ditangani_oleh?: string | null
          email?: string
          id?: string
          kategori?: string
          lokasi?: string | null
          nama?: string
          nik?: string | null
          no_hp?: string | null
          opd_id?: string | null
          status?: string
          tindak_lanjut?: string | null
          updated_at?: string
          uraian?: string
        }
        Relationships: [
          {
            foreignKeyName: "laporan_masyarakat_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: false
            referencedRelation: "opd"
            referencedColumns: ["id"]
          },
        ]
      }
      layanan_publik: {
        Row: {
          aktif: boolean
          alur: string | null
          created_at: string
          deskripsi: string | null
          id: string
          ikon: string | null
          judul: string
          opd_id: string | null
          persyaratan: string | null
          sla_hari: number
          slug: string
          updated_at: string
          urutan: number
        }
        Insert: {
          aktif?: boolean
          alur?: string | null
          created_at?: string
          deskripsi?: string | null
          id?: string
          ikon?: string | null
          judul: string
          opd_id?: string | null
          persyaratan?: string | null
          sla_hari?: number
          slug: string
          updated_at?: string
          urutan?: number
        }
        Update: {
          aktif?: boolean
          alur?: string | null
          created_at?: string
          deskripsi?: string | null
          id?: string
          ikon?: string | null
          judul?: string
          opd_id?: string | null
          persyaratan?: string | null
          sla_hari?: number
          slug?: string
          updated_at?: string
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "layanan_publik_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: false
            referencedRelation: "opd"
            referencedColumns: ["id"]
          },
        ]
      }
      opd: {
        Row: {
          created_at: string
          id: string
          kategori: string[]
          nama: string
          singkatan: string
        }
        Insert: {
          created_at?: string
          id?: string
          kategori?: string[]
          nama: string
          singkatan: string
        }
        Update: {
          created_at?: string
          id?: string
          kategori?: string[]
          nama?: string
          singkatan?: string
        }
        Relationships: []
      }
      pejabat: {
        Row: {
          aktif: boolean
          created_at: string
          foto_url: string | null
          id: string
          is_pimpinan: boolean
          jabatan: string
          level: string | null
          nama: string
          updated_at: string
          urutan: number
          user_id: string | null
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          is_pimpinan?: boolean
          jabatan: string
          level?: string | null
          nama: string
          updated_at?: string
          urutan?: number
          user_id?: string | null
        }
        Update: {
          aktif?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          is_pimpinan?: boolean
          jabatan?: string
          level?: string | null
          nama?: string
          updated_at?: string
          urutan?: number
          user_id?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          kategori: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          kategori?: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          kategori?: string
          label?: string
        }
        Relationships: []
      }
      permohonan: {
        Row: {
          atas_nama_hp: string | null
          atas_nama_nama: string | null
          atas_nama_nik: string | null
          deskripsi: string | null
          id: string
          judul: string
          kategori: string
          kode: string
          opd_id: string
          pemohon_id: string
          petugas_id: string | null
          prioritas: string
          ringkasan: string | null
          status: Database["public"]["Enums"]["status_permohonan"]
          tanggal_masuk: string
          tenggat: string | null
          untuk_orang_lain: boolean
          updated_at: string
          wakil_ambil_nama: string | null
          wakil_ambil_nik: string | null
        }
        Insert: {
          atas_nama_hp?: string | null
          atas_nama_nama?: string | null
          atas_nama_nik?: string | null
          deskripsi?: string | null
          id?: string
          judul: string
          kategori: string
          kode: string
          opd_id: string
          pemohon_id: string
          petugas_id?: string | null
          prioritas?: string
          ringkasan?: string | null
          status?: Database["public"]["Enums"]["status_permohonan"]
          tanggal_masuk?: string
          tenggat?: string | null
          untuk_orang_lain?: boolean
          updated_at?: string
          wakil_ambil_nama?: string | null
          wakil_ambil_nik?: string | null
        }
        Update: {
          atas_nama_hp?: string | null
          atas_nama_nama?: string | null
          atas_nama_nik?: string | null
          deskripsi?: string | null
          id?: string
          judul?: string
          kategori?: string
          kode?: string
          opd_id?: string
          pemohon_id?: string
          petugas_id?: string | null
          prioritas?: string
          ringkasan?: string | null
          status?: Database["public"]["Enums"]["status_permohonan"]
          tanggal_masuk?: string
          tenggat?: string | null
          untuk_orang_lain?: boolean
          updated_at?: string
          wakil_ambil_nama?: string | null
          wakil_ambil_nik?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permohonan_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: false
            referencedRelation: "opd"
            referencedColumns: ["id"]
          },
        ]
      }
      permohonan_rating: {
        Row: {
          created_at: string
          id: string
          komentar: string | null
          permohonan_id: string
          skor: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          komentar?: string | null
          permohonan_id: string
          skor: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          komentar?: string | null
          permohonan_id?: string
          skor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permohonan_rating_permohonan_id_fkey"
            columns: ["permohonan_id"]
            isOneToOne: false
            referencedRelation: "permohonan"
            referencedColumns: ["id"]
          },
        ]
      }
      permohonan_riwayat: {
        Row: {
          aksi: string
          catatan: string | null
          created_at: string
          id: string
          oleh: string | null
          permohonan_id: string
        }
        Insert: {
          aksi: string
          catatan?: string | null
          created_at?: string
          id?: string
          oleh?: string | null
          permohonan_id: string
        }
        Update: {
          aksi?: string
          catatan?: string | null
          created_at?: string
          id?: string
          oleh?: string | null
          permohonan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permohonan_riwayat_permohonan_id_fkey"
            columns: ["permohonan_id"]
            isOneToOne: false
            referencedRelation: "permohonan"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          asn_type: Database["public"]["Enums"]["asn_type"] | null
          created_at: string
          desa: string | null
          id: string
          jabatan: string | null
          nama_lengkap: string
          nik: string | null
          nip: string | null
          no_hp: string | null
          opd_id: string | null
          status: string
          system_position: Database["public"]["Enums"]["system_position"] | null
          unit_kerja_id: string | null
          updated_at: string
          username: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          asn_type?: Database["public"]["Enums"]["asn_type"] | null
          created_at?: string
          desa?: string | null
          id: string
          jabatan?: string | null
          nama_lengkap?: string
          nik?: string | null
          nip?: string | null
          no_hp?: string | null
          opd_id?: string | null
          status?: string
          system_position?:
            | Database["public"]["Enums"]["system_position"]
            | null
          unit_kerja_id?: string | null
          updated_at?: string
          username?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          asn_type?: Database["public"]["Enums"]["asn_type"] | null
          created_at?: string
          desa?: string | null
          id?: string
          jabatan?: string | null
          nama_lengkap?: string
          nik?: string | null
          nip?: string | null
          no_hp?: string | null
          opd_id?: string | null
          status?: string
          system_position?:
            | Database["public"]["Enums"]["system_position"]
            | null
          unit_kerja_id?: string | null
          updated_at?: string
          username?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_opd_id_fkey"
            columns: ["opd_id"]
            isOneToOne: false
            referencedRelation: "opd"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_kerja_id_fkey"
            columns: ["unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscription: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit: {
        Row: {
          bucket: string
          count: number
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          id?: string
          identifier: string
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      rbac_audit: {
        Row: {
          aksi: string
          created_at: string
          data_sebelum: Json | null
          data_sesudah: Json | null
          entitas: string
          id: string
          target_user_id: string | null
          user_id: string | null
        }
        Insert: {
          aksi: string
          created_at?: string
          data_sebelum?: Json | null
          data_sesudah?: Json | null
          entitas: string
          id?: string
          target_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          aksi?: string
          created_at?: string
          data_sebelum?: Json | null
          data_sesudah?: Json | null
          entitas?: string
          id?: string
          target_user_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_code?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      share_komentar: {
        Row: {
          created_at: string
          id: string
          isi: string
          oleh_user_id: string
          paket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          isi: string
          oleh_user_id: string
          paket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          isi?: string
          oleh_user_id?: string
          paket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_komentar_paket_id_fkey"
            columns: ["paket_id"]
            isOneToOne: false
            referencedRelation: "share_paket"
            referencedColumns: ["id"]
          },
        ]
      }
      share_lampiran: {
        Row: {
          created_at: string
          id: string
          mime: string | null
          mime_type: string | null
          nama_file: string
          paket_id: string
          path: string | null
          size_bytes: number | null
          ukuran: number | null
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime?: string | null
          mime_type?: string | null
          nama_file: string
          paket_id: string
          path?: string | null
          size_bytes?: number | null
          ukuran?: number | null
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime?: string | null
          mime_type?: string | null
          nama_file?: string
          paket_id?: string
          path?: string | null
          size_bytes?: number | null
          ukuran?: number | null
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_lampiran_paket_id_fkey"
            columns: ["paket_id"]
            isOneToOne: false
            referencedRelation: "share_paket"
            referencedColumns: ["id"]
          },
        ]
      }
      share_paket: {
        Row: {
          approval_note: string | null
          approval_required: boolean
          approved_at: string | null
          approver_id: string | null
          created_at: string
          dataset_template_id: string | null
          deskripsi: string | null
          expires_at: string | null
          id: string
          judul: string
          kode: string | null
          pengirim_opd_id: string | null
          pengirim_user_id: string
          prioritas: string
          sensitivitas: string
          status: string
          tipe: string
          updated_at: string
        }
        Insert: {
          approval_note?: string | null
          approval_required?: boolean
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          dataset_template_id?: string | null
          deskripsi?: string | null
          expires_at?: string | null
          id?: string
          judul: string
          kode?: string | null
          pengirim_opd_id?: string | null
          pengirim_user_id: string
          prioritas?: string
          sensitivitas?: string
          status?: string
          tipe: string
          updated_at?: string
        }
        Update: {
          approval_note?: string | null
          approval_required?: boolean
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          dataset_template_id?: string | null
          deskripsi?: string | null
          expires_at?: string | null
          id?: string
          judul?: string
          kode?: string | null
          pengirim_opd_id?: string | null
          pengirim_user_id?: string
          prioritas?: string
          sensitivitas?: string
          status?: string
          tipe?: string
          updated_at?: string
        }
        Relationships: []
      }
      share_riwayat: {
        Row: {
          aksi: string
          catatan: string | null
          created_at: string
          id: string
          meta: Json | null
          oleh_user_id: string | null
          paket_id: string
        }
        Insert: {
          aksi: string
          catatan?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          oleh_user_id?: string | null
          paket_id: string
        }
        Update: {
          aksi?: string
          catatan?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          oleh_user_id?: string | null
          paket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_riwayat_paket_id_fkey"
            columns: ["paket_id"]
            isOneToOne: false
            referencedRelation: "share_paket"
            referencedColumns: ["id"]
          },
        ]
      }
      share_target: {
        Row: {
          created_at: string
          dibuka_at: string | null
          dibuka_oleh: string | null
          dibuka_pada: string | null
          id: string
          paket_id: string
          status_baca: string
          target_opd_id: string | null
          target_pejabat_id: string | null
          target_type: string
          target_user_id: string | null
          tindak_lanjut_catatan: string | null
          tindak_lanjut_pada: string | null
        }
        Insert: {
          created_at?: string
          dibuka_at?: string | null
          dibuka_oleh?: string | null
          dibuka_pada?: string | null
          id?: string
          paket_id: string
          status_baca?: string
          target_opd_id?: string | null
          target_pejabat_id?: string | null
          target_type: string
          target_user_id?: string | null
          tindak_lanjut_catatan?: string | null
          tindak_lanjut_pada?: string | null
        }
        Update: {
          created_at?: string
          dibuka_at?: string | null
          dibuka_oleh?: string | null
          dibuka_pada?: string | null
          id?: string
          paket_id?: string
          status_baca?: string
          target_opd_id?: string | null
          target_pejabat_id?: string | null
          target_type?: string
          target_user_id?: string | null
          tindak_lanjut_catatan?: string | null
          tindak_lanjut_pada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_target_paket_id_fkey"
            columns: ["paket_id"]
            isOneToOne: false
            referencedRelation: "share_paket"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_kerja: {
        Row: {
          aktif: boolean
          created_at: string
          id: string
          kode: string | null
          nama: string
          opd_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          id?: string
          kode?: string | null
          nama: string
          opd_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          aktif?: boolean
          created_at?: string
          id?: string
          kode?: string | null
          nama?: string
          opd_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_kerja_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          expires_at: string | null
          granted: boolean
          granted_by: string | null
          id: string
          permission_code: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_code: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_code?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_token: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          used_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
          used_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_paket: {
        Args: { _paket_id: string; _user_id: string }
        Returns: boolean
      }
      count_permohonan_bulan_ini: { Args: never; Returns: number }
      get_effective_permissions: {
        Args: { _user_id: string }
        Returns: {
          permission_code: string
        }[]
      }
      get_user_asn_type: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["asn_type"]
      }
      get_user_desa: { Args: { _user_id: string }; Returns: string }
      get_user_opd: { Args: { _user_id: string }; Returns: string }
      get_user_position: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["system_position"]
      }
      has_permission: {
        Args: { _code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pimpinan: { Args: { _user_id: string }; Returns: boolean }
      opd_kinerja_agg: {
        Args: never
        Returns: {
          jumlah_selesai: number
          opd_id: string
          selesai_dengan_sla: number
          status: string
          tepat_waktu: number
          total: number
          total_hari_selesai: number
        }[]
      }
      opd_rating_agg: {
        Args: never
        Returns: {
          jumlah_rating: number
          opd_id: string
          total_rating: number
        }[]
      }
      rating_list_admin: {
        Args: never
        Returns: {
          created_at: string
          komentar: string
          opd_id: string
          opd_nama: string
          opd_singkatan: string
          pemohon_nama: string
          permohonan_id: string
          permohonan_judul: string
          permohonan_kode: string
          rating_id: string
          skor: number
          user_id: string
        }[]
      }
      riwayat_dengan_petugas: {
        Args: { _permohonan_id: string }
        Returns: {
          aksi: string
          catatan: string
          created_at: string
          email_petugas: string
          id: string
          nama_petugas: string
          oleh: string
        }[]
      }
      user_in_desa: {
        Args: { _desa: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      absensi_tipe: "masuk" | "pulang"
      app_role:
        | "warga"
        | "admin_opd"
        | "super_admin"
        | "admin_desa"
        | "asn"
        | "admin_pemda"
      aset_status: "aktif" | "rusak" | "dihapuskan"
      asn_type: "pns" | "pppk_penuh_waktu" | "pppk_paruh_waktu" | "honorer"
      job_status: "pending" | "running" | "success" | "failed" | "dead"
      status_permohonan: "baru" | "diproses" | "selesai" | "ditolak"
      system_position:
        | "kepala_opd"
        | "sekretaris"
        | "kepala_bidang"
        | "kepala_sekolah"
        | "operator"
        | "verifikator"
        | "staff"
        | "guru"
        | "tenaga_teknis"
        | "lainnya"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      absensi_tipe: ["masuk", "pulang"],
      app_role: [
        "warga",
        "admin_opd",
        "super_admin",
        "admin_desa",
        "asn",
        "admin_pemda",
      ],
      aset_status: ["aktif", "rusak", "dihapuskan"],
      asn_type: ["pns", "pppk_penuh_waktu", "pppk_paruh_waktu", "honorer"],
      job_status: ["pending", "running", "success", "failed", "dead"],
      status_permohonan: ["baru", "diproses", "selesai", "ditolak"],
      system_position: [
        "kepala_opd",
        "sekretaris",
        "kepala_bidang",
        "kepala_sekolah",
        "operator",
        "verifikator",
        "staff",
        "guru",
        "tenaga_teknis",
        "lainnya",
      ],
    },
  },
} as const
