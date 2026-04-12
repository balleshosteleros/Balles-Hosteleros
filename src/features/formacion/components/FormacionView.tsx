"use client";

import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  Compass,
  Package,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const recorridoModulos: Array<{
  href: string;
  titulo: string;
  descripcion: string;
}> = [
  {
    href: "/direccion",
    titulo: "Dirección",
    descripcion: "Visión, valores y estructura jerárquica de la empresa.",
  },
  {
    href: "/sala",
    titulo: "Sala",
    descripcion: "Atención al cliente, reservas y temperaturas.",
  },
  {
    href: "/cocina",
    titulo: "Cocina",
    descripcion: "Fichas técnicas, partidas y elaboraciones.",
  },
  {
    href: "/gerencia",
    titulo: "Gerencia",
    descripcion: "Mantenimiento, ratios, comunicados y descuentos.",
  },
  {
    href: "/calidad",
    titulo: "Calidad",
    descripcion: "Auditorías, inspecciones y control de empleados.",
  },
  {
    href: "/rrhh",
    titulo: "Recursos Humanos",
    descripcion: "Empleados, fichajes, calendarios y formación.",
  },
  {
    href: "/marketing",
    titulo: "Marketing",
    descripcion: "Calendario, contenido, fidelización y captación.",
  },
  {
    href: "/logistica",
    titulo: "Logística",
    descripcion: "Proveedores, productos, pedidos, stock y subida de precio.",
  },
  {
    href: "/contabilidad",
    titulo: "Contabilidad",
    descripcion: "Facturas, impuestos, transacciones y conciliación.",
  },
];

const materialPorPuesto: Array<{ puesto: string; items: string[] }> = [
  {
    puesto: "Sala",
    items: [
      "Uniforme de sala (camisa, pantalón, delantal y mandil)",
      "Bolígrafo, libreta y abridor",
      "Manual de carta vigente y fichas de alérgenos",
      "PDA / TPV personal con credenciales",
    ],
  },
  {
    puesto: "Cocina",
    items: [
      "Uniforme de cocina (chaquetilla, pantalón, gorro y zapato antideslizante)",
      "Cuchillos básicos y funda",
      "Termómetro y guantes anticorte",
      "Acceso a fichas técnicas y planning de partidas",
    ],
  },
  {
    puesto: "Logística",
    items: [
      "EPI: zapato de seguridad y guantes",
      "Lectora de códigos / móvil corporativo",
      "Acceso a Logística → Proveedores, Productos, Pedidos y Stock",
      "Plantilla de control de subida de precios",
    ],
  },
  {
    puesto: "Gerencia / Mandos",
    items: [
      "Móvil y portátil corporativo",
      "Acceso a comunicados, mantenimiento y ratios",
      "Tarjeta de gastos del local",
      "Llaves o credenciales de apertura/cierre",
    ],
  },
];

export function FormacionView() {
  return (
    <div className="space-y-8">
      {/* Bienvenida — qué es esta página */}
      <Card className="border-blue-600/30 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <Sparkles className="h-4 w-4" />
            Bienvenido a Balles Hosteleros
          </div>
          <p className="text-base text-foreground">
            Tu formación dentro de la empresa empieza por <strong>recorrer
            esta web interactiva</strong>. Cada apartado del menú lateral
            corresponde a un área del negocio: léelo, navega tranquilo y
            entenderás cómo funcionamos.
          </p>
          <p className="text-sm text-muted-foreground">
            No tienes que memorizar nada. Tómate tu tiempo, ve módulo por
            módulo y vuelve aquí siempre que necesites repasar.
          </p>
        </CardContent>
      </Card>

      {/* Recorrido por los módulos */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            Tu recorrido por los módulos
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Estos son los apartados que tienes que conocer. Pulsa cada uno
          para abrirlo y ver cómo funciona.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recorridoModulos.map((m, i) => (
            <Link
              key={m.href}
              href={m.href}
              className={cn(
                "group rounded-lg border bg-card p-4 transition-all",
                "hover:border-primary hover:shadow-sm",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Paso {i + 1}
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {m.titulo}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {m.descripcion}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Ikigai p. 94 — Fluir en el trabajo */}
      <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">
              Filosofía Ikigai · pág. 94 — Fluir en el trabajo
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            En Balles Hosteleros queremos que disfrutes lo que haces. El libro
            del <em>Ikigai</em> describe el estado de <strong>fluir</strong>:
            cuando lo que haces es lo bastante exigente como para retarte, pero
            también lo bastante claro como para no agobiarte. Ese punto medio
            es donde se trabaja a gusto y se rinde de verdad.
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
            <li>Una sola tarea cada vez. Sin saltar de WhatsApp al servicio.</li>
            <li>Un objetivo claro: saber qué tienes que terminar antes de empezar.</li>
            <li>Feedback inmediato: si algo va mal, decirlo en el momento.</li>
            <li>Reto justo: ni demasiado fácil (te aburres), ni imposible (te frustras).</li>
          </ul>
          <p className="text-muted-foreground">
            Si en algún momento sientes que no fluyes, habla con tu responsable.
            Reorganizar tu turno o tu carga es parte del trabajo de la empresa.
          </p>
        </CardContent>
      </Card>

      {/* Ikigai p. 102 — Concentración */}
      <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">
              Filosofía Ikigai · pág. 102 — La concentración como hábito
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            La calidad del servicio depende de la atención plena. Cuando estás
            en la sala, estás <strong>en la sala</strong>. Cuando elaboras un
            plato, estás <strong>en el plato</strong>. Concentrarte no es ir
            más rápido: es <em>hacerlo bien a la primera</em>.
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
            <li>Móvil personal fuera del puesto durante el servicio.</li>
            <li>Cuida pequeñas señales: el detalle es lo que el cliente recuerda.</li>
            <li>Respira antes de cada tarea importante. Tres segundos.</li>
            <li>Cuando termines, levanta la cabeza y pasa a la siguiente con foco renovado.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Material de Entregas por puesto */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            Material de Entregas por puesto
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Esto es lo que la empresa te entrega el primer día según tu puesto.
          Si te falta algo, avisa a tu responsable.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {materialPorPuesto.map((bloque) => (
            <Card key={bloque.puesto}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  {bloque.puesto}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {bloque.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
