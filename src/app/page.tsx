import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Balles Hosteleros
        </h1>
        <p className="mt-6 text-xl text-slate-600">
          Software de gestión integral para hostelería
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-slate-900 px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Entrar al sistema
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </main>
  );
}
