import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Check, Monitor, Zap, Shield, Clock, Video, Share2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center text-white text-sm">
              🎬
            </div>
            <span className="font-bold text-lg">ReelForge Recorder</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">Iniciar sesión</Button>
            </Link>
            <Link href="/signup">
              <Button variant="gradient" size="sm">Empezar a grabar</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-200 rounded-full blur-3xl opacity-30" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-30" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6 gap-2">
            <Monitor className="h-3.5 w-3.5" />
            Grabación de pantalla profesional simplificada
          </Badge>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Captura tu pantalla <br />
            <span className="gradient-text">sin límites</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            La herramienta definitiva para crear tutoriales, demos de producto 
            y comunicaciones rápidas. Graba, guarda y organiza tus videos en un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button variant="premium" size="xl" className="gap-2 w-full sm:w-auto">
                <Video className="h-5 w-5" />
                Empezar a grabar gratis
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                Ver características
              </Button>
            </Link>
          </div>
            <p className="text-sm text-muted-foreground mt-4">
            Sin límites de tiempo • Alta calidad • Gestión Local & Privada
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6 bg-accent/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Flujo de trabajo directo</h2>
          <p className="text-center text-muted-foreground mb-12">
            Diseñado para la velocidad
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: <Monitor className="h-8 w-8 text-white" />,
                title: "Inicia la captura",
                desc: "Selecciona tu pantalla, ventana o pestaña. Soporte completo para audio del sistema y micrófono.",
              },
              {
                step: "02",
                icon: <Video className="h-8 w-8 text-white" />,
                title: "Graba tu contenido",
                desc: "Interfaz fluida y transparente que no interfiere con tu trabajo mientras grabas.",
              },
              {
                step: "03",
                icon: <Share2 className="h-8 w-8 text-white" />,
                title: "Guarda y gestiona",
                desc: "Tus grabaciones se guardan localmente para máxima privacidad. Accede a ellas desde tu historial.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110">
                  {item.icon}
                </div>
                <div className="text-xs font-bold text-primary mb-2 uppercase tracking-widest">
                  Paso {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Características Premium
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Zap, title: "Rápido como el rayo", desc: "Sin esperas. Empieza a grabar con un solo click desde tu dashboard." },
              { icon: Shield, title: "Privacidad Total", desc: "Tus grabaciones son privadas y solo tú tienes acceso a ellas." },
              { icon: Clock, title: "Sin Límites", desc: "Graba sesiones largas sin interrupciones ni marcas de agua." },
              { icon: Share2, title: "Organización Eficiente", desc: "Dashboard limpio para categorizar y buscar tus grabaciones antiguas." },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="gradient-bg rounded-3xl p-12 text-white">
            <h2 className="text-4xl font-black mb-4">
              ¿Listo para empezar a capturar?
            </h2>
            <p className="text-white/80 mb-8 text-lg">
              Crea tu cuenta gratuita hoy y olvídate de las herramientas de grabación complejas.
            </p>
            <Link href="/signup">
              <Button
                size="xl"
                className="bg-white text-primary hover:bg-white/90 font-bold gap-2"
              >
                <Monitor className="h-5 w-5" />
                Crear mi cuenta gratis
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎬</span>
            <span className="font-semibold text-foreground">ReelForge Recorder</span>
            <span>© 2026</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground">Iniciar sesión</Link>
            <Link href="/signup" className="hover:text-foreground">Registro</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
