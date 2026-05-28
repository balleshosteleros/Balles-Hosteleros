import { MasGrid } from "@/features/mi-panel/mobile/components/MasGrid";

export const dynamic = "force-dynamic";

export default function MasPage() {
  return (
    <>
      <header className="px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <h1 className="text-xl font-semibold">Mis Paneles</h1>
        <p className="text-sm text-muted-foreground">Todas tus secciones</p>
      </header>
      <MasGrid />
    </>
  );
}
