import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "warga" | "admin_opd" | "super_admin" | "admin_desa" | "asn";

export type AuthProfile = {
  nama_lengkap: string | null;
  nik: string | null;
  no_hp: string | null;
  desa: string | null;
  verified_at: string | null;
  verified_by: string | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: AuthProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAdminDesa: boolean;
  isAdminOpd: boolean;
  isAsn: boolean;
  isStaff: boolean;
  isVerified: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }
  async function loadProfile(uid: string) {
    const { data } = await supabase
      .from("profiles")
      .select("nama_lengkap,nik,no_hp,desa,verified_at,verified_by")
      .eq("id", uid)
      .maybeSingle();
    setProfile((data as AuthProfile | null) ?? null);
  }
  // Catatan: auto-signOut pada login dihapus untuk mencegah user ter-logout
  // otomatis akibat race condition (roles/profile belum termuat) atau perubahan
  // konfigurasi. Pembatasan akses (block_login / block_permohonan) ditegakkan
  // oleh route guard & form permohonan, bukan dengan memaksa signOut sesi.

  useEffect(() => {
    let settled = false;
    const markSettled = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(async () => {
          await Promise.all([loadRoles(sess.user.id), loadProfile(sess.user.id)]);
        }, 0);
      } else {
        setRoles([]);
        setProfile(null);
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        markSettled();
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession((prev) => prev ?? sess);
      setUser((prev) => prev ?? sess?.user ?? null);
      if (sess?.user) {
        // Jangan jalankan enforceBlockLogin di sini — sudah ditangani saat SIGNED_IN.
        Promise.all([loadRoles(sess.user.id), loadProfile(sess.user.id)])
          .finally(markSettled);
      } else markSettled();
    });

    const safety = setTimeout(markSettled, 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(safety);
    };
  }, []);

  // Realtime: dengarkan perubahan profil pengguna saat ini agar status
  // verifikasi & data lain langsung sinkron dengan dashboard admin.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (!row) return;
          setProfile({
            nama_lengkap: (row.nama_lengkap as string | null) ?? null,
            nik: (row.nik as string | null) ?? null,
            no_hp: (row.no_hp as string | null) ?? null,
            desa: (row.desa as string | null) ?? null,
            verified_at: (row.verified_at as string | null) ?? null,
            verified_by: (row.verified_by as string | null) ?? null,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __origFetch?: typeof fetch };
    if (!w.__origFetch) w.__origFetch = window.fetch.bind(window);
    const orig = w.__origFetch;
    window.fetch = async (input, init) => {
      try {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        const isServerFn = headers.get("x-tsr-serverfn") === "true";
        if (isServerFn && !headers.has("authorization")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            headers.set("authorization", `Bearer ${token}`);
            return orig(input, { ...init, headers });
          }
        }
      } catch {
        // fall-through
      }
      return orig(input, init);
    };
    return () => {
      if (w.__origFetch) window.fetch = w.__origFetch;
    };
  }, []);

  const value: AuthCtx = {
    user,
    session,
    roles,
    profile,
    loading,
    isAdmin: roles.includes("admin_opd") || roles.includes("super_admin") || roles.includes("admin_desa"),
    isSuperAdmin: roles.includes("super_admin"),
    isAdminDesa: roles.includes("admin_desa"),
    isAdminOpd: roles.includes("admin_opd"),
    isAsn: roles.includes("asn"),
    isStaff:
      roles.includes("super_admin") ||
      roles.includes("admin_opd") ||
      roles.includes("admin_desa") ||
      roles.includes("asn"),
    isVerified:
      !!profile?.verified_at ||
      roles.includes("super_admin") ||
      roles.includes("admin_opd") ||
      roles.includes("admin_desa"),
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshRoles: async () => {
      if (user) await loadRoles(user.id);
    },
    refreshProfile: async () => {
      if (user) await loadProfile(user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
