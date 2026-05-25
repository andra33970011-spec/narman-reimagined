import { Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin } from "lucide-react";
import lambang from "@/assets/lambang.png";
import { useSiteBranding } from "@/lib/site-settings";

export function Footer() {
  const b = useSiteBranding();
  return (
    <footer className="mt-12 sm:mt-16 md:mt-20 border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <img src={b.logo_url || lambang} alt="Lambang" width={44} height={44} className="h-11 w-11 object-contain" loading="lazy" />
            <div>
              <div className="font-display text-lg font-bold">{b.footer_org}</div>
              <div className="text-xs text-muted-foreground">{b.footer_tagline}</div>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">{b.footer_description}</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Tautan</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/layanan" className="hover:text-primary">Layanan Publik</Link></li>
            <li><Link to="/data" className="hover:text-primary">Satu Data</Link></li>
            <li><Link to="/berita" className="hover:text-primary">Berita & Pengumuman</Link></li>
            <li><Link to="/tentang" className="hover:text-primary">Profil Pemerintah</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Kontak</h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary" /><span>{b.footer_address}</span></li>
            <li className="flex gap-2"><Phone className="h-4 w-4 mt-0.5 text-primary" /><span>{b.footer_phone}</span></li>
            <li className="flex gap-2"><Mail className="h-4 w-4 mt-0.5 text-primary" /><span>{b.footer_email}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-5 text-center text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {b.footer_org}. Hak Cipta Dilindungi.</span>
        </div>
      </div>
    </footer>
  );
}
