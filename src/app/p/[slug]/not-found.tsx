export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Enlace no disponible</h1>
        <p className="text-muted-foreground">
          Este estudio ya no se está compartiendo, o el enlace ha expirado.
          Pídele al propietario un enlace nuevo.
        </p>
      </div>
    </main>
  );
}
