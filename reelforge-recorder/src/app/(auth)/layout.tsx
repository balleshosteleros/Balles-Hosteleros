export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-bg items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🎬</span>
            </div>
            <span className="text-2xl font-bold">ReelForge Recorder</span>
          </div>
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Genera videos profesionales en segundos con IA
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Sin edición manual. Sin costos por render. Solo videos automáticos
            listos para publicar.
          </p>
          <div className="space-y-4">
            {[
              "✅ 5 templates listos para usar",
              "✅ IA genera el contenido por ti",
              "✅ Descarga tu MP4 en segundos",
              "✅ Sin tarjeta de crédito en plan free",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-white/90">
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
