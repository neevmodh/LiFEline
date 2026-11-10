import { GedaStrip, Logo } from "@/components/Shell";

/** A centred card on a quiet background, for sign-in and sign-up. */
export function CardPage({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex flex-1 flex-col">
      <GedaStrip />
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-8"><Logo /></header>
      <main className="mx-auto w-full flex-1 px-4 pb-16 sm:px-8" style={{ maxWidth: wide ? 720 : 480 }}>
        <div className="rounded-[28px] border border-border bg-white p-6 shadow-[var(--shadow-lg)] sm:p-8">{children}</div>
      </main>
    </div>
  );
}
