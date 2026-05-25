// Store sederhana berbasis useSyncExternalStore agar perubahan status / assignment
// langsung tercermin di seluruh komponen tanpa setup library state management.
import { useSyncExternalStore } from "react";
import {
  OPD_LIST,
  PERMOHONAN_AWAL,
  PETUGAS_LIST,
  type Permohonan,
  type StatusPermohonan,
} from "@/data/admin-mock";

type State = {
  opdAktifId: string;
  permohonan: Permohonan[];
};

let state: State = {
  opdAktifId: OPD_LIST[0].id,
  permohonan: PERMOHONAN_AWAL,
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAdminStore() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function setOpdAktif(id: string) {
  if (state.opdAktifId === id) return;
  state = { ...state, opdAktifId: id };
  emit();
}

export function ubahStatus(
  id: string,
  status: StatusPermohonan,
  catatan: string,
  oleh: string,
) {
  state = {
    ...state,
    permohonan: state.permohonan.map((p) =>
      p.id === id
        ? {
            ...p,
            status,
            riwayat: [
              ...p.riwayat,
              {
                ts: new Date().toISOString(),
                oleh,
                aksi: `Status diubah menjadi ${status}`,
                catatan: catatan || undefined,
              },
            ],
          }
        : p,
    ),
  };
  emit();
}

export function tugaskanPetugas(id: string, petugasId: string, oleh: string) {
  const ptg = PETUGAS_LIST.find((p) => p.id === petugasId);
  state = {
    ...state,
    permohonan: state.permohonan.map((p) =>
      p.id === id
        ? {
            ...p,
            petugasId,
            riwayat: [
              ...p.riwayat,
              {
                ts: new Date().toISOString(),
                oleh,
                aksi: `Ditugaskan ke ${ptg?.nama ?? petugasId}`,
              },
            ],
          }
        : p,
    ),
  };
  emit();
}

export function tambahCatatan(id: string, catatan: string, oleh: string) {
  if (!catatan.trim()) return;
  state = {
    ...state,
    permohonan: state.permohonan.map((p) =>
      p.id === id
        ? {
            ...p,
            riwayat: [
              ...p.riwayat,
              {
                ts: new Date().toISOString(),
                oleh,
                aksi: "Catatan ditambahkan",
                catatan,
              },
            ],
          }
        : p,
    ),
  };
  emit();
}
