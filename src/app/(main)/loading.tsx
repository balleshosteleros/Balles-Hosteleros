export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-2 border-muted border-t-foreground animate-spin" />
        <span className="text-xs uppercase tracking-widest">Cargando…</span>
      </div>
    </div>
  );
}
