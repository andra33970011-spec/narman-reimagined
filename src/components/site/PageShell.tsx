import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 animate-page-in">{children}</main>
      <Footer />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="bg-gradient-hero text-primary-foreground">
      <div className="container-page py-16 md:py-20">
        {eyebrow && (
          <div className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide uppercase backdrop-blur">
            {eyebrow}
          </div>
        )}
        <h1 className="max-w-3xl text-balance text-3xl font-bold md:text-5xl">{title}</h1>
        {description && (
          <p className="mt-4 max-w-2xl text-base text-white/85 md:text-lg">{description}</p>
        )}
      </div>
    </section>
  );
}
