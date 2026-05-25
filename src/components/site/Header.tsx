import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, Search, LogOut, User as UserIcon, FileText, ShieldCheck, ChevronDown, Share2 } from "lucide-react";
import lambang from "@/assets/lambang.png";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useSiteBranding } from "@/lib/site-settings";

const navItems = [
  { to: "/", label: "Beranda" },
  { to: "/layanan", label: "Layanan" },
  { to: "/data", label: "Data Terpadu" },
  { to: "/kinerja-opd", label: "Kinerja OPD" },
  { to: "/berbagi", label: "Berbagi Data" },
  { to: "/berita", label: "Berita" },
  { to: "/tentang", label: "Tentang" },
  { to: "/kontak", label: "Kontak" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAdmin, isSuperAdmin, isAdminDesa, isAdminOpd, isAsn, signOut } = useAuth();
  const roleBadge = isSuperAdmin
    ? "SUPER ADMIN"
    : isAdminOpd
    ? "ADMIN OPD"
    : isAdminDesa
    ? "ADMIN DESA"
    : isAsn
    ? "ASN"
    : null;
  const menuRef = useRef<HTMLDivElement>(null);
  const [dataVisiblePublic, setDataVisiblePublic] = useState<boolean>(true);
  const [kinerjaVisiblePublic, setKinerjaVisiblePublic] = useState<boolean>(true);
  const branding = useSiteBranding();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    supabase
      .from("app_setting")
      .select("key,value")
      .in("key", ["data_terpadu_visible_public", "kinerja_opd_visible_public"])
      .then(({ data }) => {
        for (const r of data ?? []) {
          const v = (r as { key: string; value: unknown }).value;
          const visible = v === false || v === "false" ? false : true;
          if ((r as { key: string }).key === "data_terpadu_visible_public") setDataVisiblePublic(visible);
          if ((r as { key: string }).key === "kinerja_opd_visible_public") setKinerjaVisiblePublic(visible);
        }
      });
  }, []);

  // Sembunyikan menu Data Terpadu / Kinerja OPD jika visibility OFF dan user bukan super admin
  const visibleNavItems = navItems.filter((item) => {
    if (item.to === "/data" && !dataVisiblePublic && !isSuperAdmin) return false;
    if (item.to === "/kinerja-opd" && !kinerjaVisiblePublic && !isSuperAdmin) return false;
    return true;
  });

  const displayName =
    (user?.user_metadata as { nama_lengkap?: string } | undefined)?.nama_lengkap ||
    user?.email?.split("@")[0] ||
    "Akun";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      {/* Top utility bar */}
      <div className="hidden bg-primary text-primary-foreground md:block">
        <div className="container-page flex h-9 items-center justify-between text-xs">
          <span className="opacity-90">{branding.top_bar_text}</span>
          <div className="flex items-center gap-5 opacity-90">
            {user ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Masuk sebagai <strong className="font-semibold">{displayName}</strong>
                {roleBadge && <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">{roleBadge}</span>}
              </span>
            ) : (
              <a href="#" className="hover:opacity-100">PPID</a>
            )}
            <a href="#" className="hover:opacity-100">LAPOR!</a>
            <a href="#" className="hover:opacity-100">Bahasa: ID</a>
          </div>
        </div>
      </div>

      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 lg:flex-initial">
          <img src={branding.logo_url || lambang} alt="Lambang" width={40} height={40} className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 object-contain" />
          <div className="leading-tight min-w-0">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-sans whitespace-nowrap">{branding.brand_prefix}</div>
            <div className="font-display text-sm sm:text-base font-bold text-foreground whitespace-nowrap">{branding.brand_name}</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {visibleNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-surface-foreground transition-colors hover:bg-primary-soft hover:text-primary"
              activeProps={{ className: "bg-primary-soft text-primary" }}
            >
              {item.label}
            </Link>
          ))}
          {isAsn && <AsnDropdown />}
        </nav>


        <div className="flex items-center gap-2">
          <button
            aria-label="Cari"
            className="hidden md:inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-surface-foreground hover:bg-muted"
          >
            <Search className="h-4 w-4" />
          </button>

          {user ? (
            <div ref={menuRef} className="relative hidden md:block">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-primary text-[11px] font-bold text-primary-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[140px] truncate">{displayName}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                  <div className="border-b border-border px-3 py-2.5 text-xs">
                    <div className="font-semibold text-foreground truncate">{displayName}</div>
                    <div className="truncate text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="py-1 text-sm">
                    <Link to="/akun" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted">
                      <UserIcon className="h-4 w-4" /> Akun Saya
                    </Link>
                    <Link to="/permohonan" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted">
                      <FileText className="h-4 w-4" /> Permohonan Saya
                    </Link>
                    <Link to="/permohonan/baru" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted">
                      <FileText className="h-4 w-4" /> Ajukan Permohonan
                    </Link>
                    <Link to="/berbagi" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted">
                      <Share2 className="h-4 w-4" /> Berbagi Data
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted">
                        <ShieldCheck className="h-4 w-4" /> Dashboard Admin
                      </Link>
                    )}
                  </div>
                  <button
                    onClick={() => { signOut(); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/5"
                  >
                    <LogOut className="h-4 w-4" /> Keluar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              className="hidden md:inline-flex h-10 items-center rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95"
            >
              Masuk Akun
            </Link>
          )}

          {/* Mobile: avatar pill (login) atau tombol Masuk */}
          {user ? (
            <Link
              to="/permohonan"
              aria-label={displayName}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground shrink-0"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-primary text-[12px] font-bold text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="md:hidden inline-flex h-10 items-center rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft"
            >
              Masuk
            </Link>
          )}

          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-border bg-background animate-fade-in">
          <div className="container-page flex flex-col py-2">
            {user && (
              <div className="mb-2 rounded-md bg-primary-soft px-3 py-2 text-xs">
                <div className="font-semibold text-primary">{displayName}</div>
                <div className="truncate text-muted-foreground">{user.email}</div>
                {roleBadge && <span className="mt-1 inline-block rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{roleBadge}</span>}
              </div>
            )}
            {visibleNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-md px-3 py-3 text-sm font-medium text-surface-foreground hover:bg-muted"
                activeProps={{ className: "bg-primary-soft text-primary" }}
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <>
                <div className="my-2 h-px bg-border" />
                <Link to="/akun" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-surface-foreground hover:bg-muted">
                  <UserIcon className="h-4 w-4" /> Akun Saya
                </Link>
                <Link to="/permohonan" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-surface-foreground hover:bg-muted">
                  <FileText className="h-4 w-4" /> Permohonan Saya
                </Link>
                <Link to="/permohonan/baru" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-surface-foreground hover:bg-muted">
                  <FileText className="h-4 w-4" /> Ajukan Permohonan
                </Link>
                <Link to="/berbagi" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-surface-foreground hover:bg-muted">
                  <Share2 className="h-4 w-4" /> Berbagi Data
                </Link>
                {isAsn && (
                  <>
                    <Link to="/asn/absensi" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-surface-foreground hover:bg-muted">
                      <ShieldCheck className="h-4 w-4" /> Absensi ASN
                    </Link>
                    <Link to="/asn/aset" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-surface-foreground hover:bg-muted">
                      <ShieldCheck className="h-4 w-4" /> Tracking Aset
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-surface-foreground hover:bg-muted">
                    <ShieldCheck className="h-4 w-4" /> Dashboard Admin
                  </Link>
                )}
              </>
            )}
            {user ? (
              <button
                onClick={() => { signOut(); setOpen(false); }}
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 text-sm font-semibold text-destructive"
              >
                <LogOut className="h-4 w-4" /> Keluar
              </button>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-gradient-primary text-sm font-semibold text-primary-foreground"
              >
                Masuk Akun
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function AsnDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-surface-foreground hover:bg-primary-soft hover:text-primary"
      >
        ASN <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <Link to="/asn/absensi" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-foreground hover:bg-muted">Absensi (Scan QR Kantor)</Link>
          <Link to="/asn/aset" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-foreground hover:bg-muted">Tracking Aset</Link>
        </div>
      )}
    </div>
  );
}
