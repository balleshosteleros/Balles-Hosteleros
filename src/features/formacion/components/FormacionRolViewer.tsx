"use client";

/**
 * FormacionRolViewer — versión filtrada por rol de la formación inicial.
 * Se usa dentro del portal de Ayuda para que cada empleado repase
 * únicamente el contenido relevante a su puesto.
 */

import {
  ArrowRight, BookOpenCheck, Brain, Compass,
  Package, Sparkles, Target,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Modulo {
  href: string;
  titulo: string;
  descripcion: string;
  roles: string[]; // roles que ven este módulo (vacío = todos)
}

const TODOS_MODULOS: Modulo[] = [
  {
    href: "/direccion",
    titulo: "Dirección",
    descripcion: "Visión, valores y estructura jerárquica de la empresa.",
    roles: ["director", "admin"],
  },
  {
    href: "/sala",
    titulo: "Sala",
    descripcion: "Atención al cliente, reservas y temperaturas.",
    roles: ["sala", "gerencia", "director", "admin"],
  },
  {
    href: "/cocina",
    titulo: "Cocina",
    descripcion: "Escandallos, partidas y elaboraciones.",
    roles: ["cocina", "gerencia", "director", "admin"],
  },
  {
    href: "/gerencia",
    titulo: "Gerencia",
    descripcion: "Mantenimiento, ratios, comunicados y descuentos.",
    roles: ["gerencia", "director", "admin"],
  },
  {
    href: "/calidad",
    titulo: "Calidad",
    descripcion: "Auditorías, inspecciones y control de empleados.",
    roles: ["calidad", "gerencia", "director", "admin"],
  },
  {
    href: "/rrhh",
    titulo: "Recursos Humanos",
    descripcion: "Empleados, fichajes, calendarios y formación.",
    roles: ["rrhh", "gerencia", "director", "admin"],
  },
  {
    href: "/marketing",
    titulo: "Marketing",
    descripcion: "Calendario, contenido, fidelización y captación.",
    roles: ["marketing", "gerencia", "director", "admin"],
  },
  {
    href: "/logistica",
    titulo: "Logística",
    descripcion: "Proveedores, productos, pedidos, stock y subida de precio.",
    roles: ["logistica", "gerencia", "director", "admin"],
  },
  {
    href: "/contabilidad",
    titulo: "Contabilidad",
    descripcion: "Facturas, impuestos, transacciones y conciliación.",
    roles: ["contabilidad", "gerencia", "director", "admin"],
  },
];

interface MaterialPuesto {
  puesto: string;
  roles: string[]; // roles que ven este bloque de material
  items: string[];
}

const MATERIAL_POR_PUESTO: MaterialPuesto[] = [
  {
    puesto: "Sala",
    roles: ["sala"],
    items: [
      "Uniforme de sala (camisa, pantalón, delantal y mandil)",
      "Bolígrafo, libreta y abridor",
      "Manual de carta vigente y fichas de alérgenos",
      "PDA / TPV personal con credenciales",
    ],
  },
  {
    puesto: "Cocina",
    roles: ["cocina"],
    items: [
      "Uniforme de cocina (chaquetilla, pantalón, gorro y zapato antideslizante)",
      "Cuchillos básicos y funda",
      "Termómetro y guantes anticorte",
      "Acceso a escandallos y planning de partidas",
    ],
  },
  {
    puesto: "Logística",
    roles: ["logistica"],
    items: [
      "EPI: zapato de seguridad y guantes",
      "Lectora de códigos / móvil corporativo",
      "Acceso a Logística → Proveedores, Productos, Pedidos y Stock",
      "Plantilla de control de subida de precios",
    ],
  },
  {
    puesto: "Gerencia / Mandos",
    roles: ["gerencia", "director", "admin"],
    items: [
      "Móvil y portátil corporativo",
      "Acceso a comunicados, mantenimiento y ratios",
      "Tarjeta de gastos del local",
      "Llaves o credenciales de apertura/cierre",
    ],
  },
];

function modulosVisibles(userRoles: string[]): Modulo[] {
  const esAdmin = userRoles.some((r) =>
    ["admin", "director", "gerencia"].includes(r)
  );
  if (esAdmin) return TODOS_MODULOS;
  return TODOS_MODULOS.filter(
    (m) => m.roles.length === 0 || m.roles.some((r) => userRoles.includes(r))
  );
}

function materialVisible(userRoles: string[]): MaterialPuesto[] {
  const esAdmin = userRoles.some((r) =>
    ["admin", "director", "gerencia"].includes(r)
  );
  if (esAdmin) return MATERIAL_POR_PUESTO;
  const filtered = MATERIAL_POR_PUESTO.filter((m) =>
    m.roles.some((r) => userRoles.includes(r))
  );
  // Si no coincide ningún puesto específico, mostrar todo
  return filtered.length > 0 ? filtered : MATERIAL_POR_PUESTO;
}

interface Props {
  userRoles: string[];
}

export function FormacionRolViewer({ userRoles }: Props) {
  const modulos = modulosVisibles(userRoles);
  const material = materialVisible(userRoles);

  const rolLabel = userRoles.length > 0
    ? userRoles[0].charAt(0).toUpperCase() + userRoles[0].slice(1)
    : "General";

  return (
    <div className="space-y-8">
      {/* Cabecera de contexto */}
      <Card className="border-blue-600/30 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <Sparkles className="h-4 w-4" />
            Formación inicial — {rolLabel}
          </div>
          <p className="text-base text-foreground">
            Aquí puedes repasar toda la formación inicial que viste cuando
            entraste. El contenido está filtrado según tu perfil de acceso.
          </p>
          <p className="text-sm text-muted-foreground">
            Puedes volver cuantas veces quieras. No hay que memorizar nada;
            esta pantalla es tu guía de referencia permanente.
          </p>
        </CardContent>
      </Card>

      {/* Módulos del sistema */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            Tu recorrido por los módulos
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Pulsa cada módulo para abrirlo y recordar cómo funciona.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((m, i) => (
            <Link
              key={m.href}
              href={m.href}
              className={cn(
                "group rounded-lg border bg-card p-4 transition-all",
                "hover:border-primary hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Módulo {i + 1}
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

      {/* Filosofía Ikigai p. 94 */}
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
            también lo bastante claro como para no agobiarte.
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
            <li>Una sola tarea cada vez.</li>
            <li>Un objetivo claro antes de empezar.</li>
            <li>Feedback inmediato: si algo va mal, decirlo en el momento.</li>
            <li>Reto justo: ni demasiado fácil, ni imposible.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Filosofía Ikigai p. 102 */}
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
            plato, estás <strong>en el plato</strong>.
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
            <li>Móvil personal fuera del puesto durante el servicio.</li>
            <li>Cuida pequeñas señales: el detalle es lo que el cliente recuerda.</li>
            <li>Respira antes de cada tarea importante. Tres segundos.</li>
            <li>Cuando termines, pasa a la siguiente tarea con foco renovado.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Material por puesto */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            Material entregado el primer día
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Esto es lo que la empresa te entrega según tu puesto. Si te falta
          algo, avisa a tu responsable.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {material.map((bloque) => (
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
