// Tombol "Install Aplikasi" floating yang selalu tampil di setiap halaman,
// kecuali aplikasi sudah dipasang sebagai PWA (display-mode standalone).
import { InstallPWAButton } from "./InstallPWA";

export function InstallPWAFloating() {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex justify-end">
      <div className="pointer-events-auto">
        <InstallPWAButton className="h-11 rounded-full !bg-primary !border-primary/60 px-4 !text-primary-foreground shadow-elevated hover:!bg-primary/90" />
      </div>
    </div>
  );
}
