"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { Card } from "@/components/ui/card";
import {
  Crown, UtensilsCrossed, ChefHat, Briefcase, CheckCircle2, User, Camera,
  Package, Calculator, FileText, Scale, type LucideIcon,
} from "lucide-react";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_LARGOS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

function saludoSegunHora(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

interface DepartamentoTile {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

interface DepartamentoTileExt extends DepartamentoTile {
  modulo: string;
}

const ALL_DEPARTAMENTOS: DepartamentoTileExt[] = [
  { key: "direccion",    modulo: "DIRECCIÓN",        label: "DIRECCIÓN",    href: "/direccion",    icon: Crown,           description: "Organigrama, cronogramas, aperturas",       color: "text-amber-600" },
  { key: "sala",         modulo: "SALA",             label: "SALA",         href: "/sala",         icon: UtensilsCrossed, description: "POS, reservas, clientes",                    color: "text-rose-600" },
  { key: "cocina",       modulo: "COCINA",           label: "COCINA",       href: "/cocina",       icon: ChefHat,         description: "Comandas, escandallos, partidas",            color: "text-orange-600" },
  { key: "gerencia",     modulo: "GERENCIA",         label: "GERENCIA",     href: "/gerencia",     icon: Briefcase,       description: "Mantenimiento, cierres, ratios, comunicados", color: "text-blue-600" },
  { key: "calidad",      modulo: "CALIDAD",          label: "CALIDAD",      href: "/calidad",      icon: CheckCircle2,    description: "Auditorías, inspecciones",                   color: "text-emerald-600" },
  { key: "rrhh",         modulo: "RECURSOS HUMANOS", label: "RECURSOS HUMANOS", href: "/rrhh",     icon: User,            description: "Empleados, fichajes, horarios, formación",   color: "text-violet-600" },
  { key: "marketing",    modulo: "MARKETING",        label: "MARKETING",    href: "/marketing",    icon: Camera,          description: "Calendario, campañas, fidelización",         color: "text-pink-600" },
  { key: "logistica",    modulo: "LOGÍSTICA",        label: "LOGÍSTICA",    href: "/logistica",    icon: Package,         description: "Proveedores, productos, pedidos, stock",     color: "text-teal-600" },
  { key: "contabilidad", modulo: "CONTABILIDAD",     label: "CONTABILIDAD", href: "/contabilidad", icon: Calculator,      description: "Facturas, transacciones, conciliación",      color: "text-cyan-600" },
  { key: "gestoria",     modulo: "GESTORÍA",         label: "GESTORÍA",     href: "/gestoria",     icon: FileText,        description: "Modelos y presentaciones",                   color: "text-sky-600" },
  { key: "juridico",     modulo: "JURÍDICO",         label: "JURÍDICO",     href: "/juridico",     icon: Scale,           description: "Procesos legales",                           color: "text-fuchsia-600" },
];

// Subtítulo según el nivel real de acceso: DIRECCIÓN (admin de plataforma) ve
// todo; el resto ve solo sus departamentos permitidos.
function dashboardSubtitle(esAdminPlataforma: boolean): string {
  return esAdminPlataforma
    ? "Tienes visión completa del grupo. Selecciona un departamento para entrar."
    : "Estas son las áreas a las que tienes acceso.";
}

export function MisDepartamentosView() {
  const {
    profile, user, puedeVer, permisosLoaded, loading,
    esAdminPlataforma, tieneAccesoDepartamentos, accesoDeptosServidor,
  } = useAuth();
  const router = useRouter();

  // Acceso a esta vista: quien tiene ≥1 departamento permitido (o es admin de
  // plataforma). Admin ve todo; el resto ve solo sus departamentos (ver `tiles`).
  const esDireccion = tieneAccesoDepartamentos;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // El auth-context resuelve `roles` de forma asíncrona (server action
  // getUserPermisos + reintentos por la carrera de cookies post-login). Hasta
  // que NO esté `permisosLoaded` no sabemos el rol real: un director aparece
  // momentáneamente sin roles. `permisosLoaded` pasa a true solo cuando el
  // fetch (o el caché) ha resuelto de verdad, así que es la señal correcta para
  // saber "ya conozco el rol" — sin temporizadores arbitrarios que en dev (más
  // lento que prod) expiraban antes de cargar el rol y rebotaban al director.
  const rolesPendientes = !permisosLoaded;

  // Esta vista (MIS DEPARTAMENTOS) es para quien tiene ≥1 departamento. Cualquier
  // otro rol que aterrice aquí se redirige a su panel personal (Mi Panel), que
  // es su landing por defecto.
  //
  // La expulsión se decide ÚNICAMENTE con el veredicto del servidor, nunca con
  // el estado de permisos en curso (`tieneAccesoDepartamentos`). Ese estado
  // oscila durante el arranque: el provider lo reescribe en varias oleadas
  // (seed SSR, loadFreshAuth con reintentos a 250/500/750 ms, revalidación cada
  // 60 s) y cualquier bajada momentánea a false por la carrera de cookies
  // echaba a un usuario con acceso legítimo — incluido DIRECCIÓN, que llegaba a
  // ver la cuadrícula un instante antes del rebote.
  //
  //   null  → el servidor aún no se ha pronunciado: ESPERAMOS, no expulsamos.
  //   false → confirmado sin acceso (te lo han quitado): fuera de inmediato.
  //   true  → confirmado con acceso: nos quedamos.
  useEffect(() => {
    if (accesoDeptosServidor === false) router.replace("/mi-panel");
  }, [accesoDeptosServidor, router]);

  const tiles = useMemo(() => {
    // Admin de plataforma (DIRECCIÓN) tiene bypass total — ve todos los deptos.
    if (esAdminPlataforma) return ALL_DEPARTAMENTOS;
    // Hasta que carguen permisos no mostramos nada para evitar el parpadeo
    // "todo abierto" → "filtrado".
    if (!permisosLoaded) return [];
    // El resto: solo los departamentos que sus permisos reales permiten ver.
    return ALL_DEPARTAMENTOS.filter((d) => puedeVer(d.modulo));
  }, [esAdminPlataforma, permisosLoaded, puedeVer]);

  // Loading hasta que (a) el componente esté montado, (b) auth deje de cargar y
  // (c) los permisos hayan resuelto (`rolesPendientes = !permisosLoaded`).
  // Mientras un no-dirección está siendo redirigido a Mi Panel mantenemos el
  // skeleton para no mostrar la cuadrícula. Esto también evita pintar "No tienes
  // departamentos" en falso mientras el rol (p.ej. director) termina de resolver.
  const isLoading =
    !mounted ||
    loading ||
    rolesPendientes ||
    !esDireccion;

  const userName = profile?.nombre
    ? profile.apellidos
      ? `${profile.nombre} ${profile.apellidos}`
      : profile.nombre
    : (user?.email?.split("@")[0] ?? "");

  const today = mounted ? new Date() : null;
  const fechaLarga = today
    ? `${DIAS_LARGOS[today.getDay()]} ${today.getDate()} de ${MESES_LARGOS[today.getMonth()]}`
    : "";

  // El subtítulo depende del rol, que se resuelve async. Mientras se carga no lo
  // mostramos en vez de pintar el genérico de rol=null y que parpadee al genérico
  // → real (lo que hacía que la cabecera se viera incompleta/rota al entrar).
  const subtitulo = !isLoading ? dashboardSubtitle(esAdminPlataforma) : "";

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Cabecera — se renderiza solo tras montar para evitar hydration mismatch
          (saludo por hora local, fecha por zona local y subtítulo por rol cargado async). */}
      <div className="min-h-[5.5rem]">
        {mounted ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {saludoSegunHora()}{userName ? `, ${userName.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{fechaLarga}</p>
            <p className="text-sm text-muted-foreground mt-1 min-h-[1.25rem]">
              {subtitulo}
            </p>
          </>
        ) : null}
      </div>

      {isLoading ? (
        // Skeleton mientras montamos y resolvemos permisos. Insinúa la estructura
        // real de la tarjeta (icono + dos líneas de texto) para que se lea como
        // "cargando" y no como bloques grises vacíos que parecen rotos.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 h-full border-muted">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-xl bg-muted/60 p-3 animate-pulse">
                  <div className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <div className="h-3.5 w-2/3 rounded bg-muted/60 animate-pulse" />
                  <div className="h-3 w-full rounded bg-muted/40 animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : tiles.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No tienes departamentos asignados todavía.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((d) => {
            const Icon = d.icon;
            return (
              <Link key={d.key} href={d.href} className="group">
                <Card className="p-5 h-full border transition-all hover:border-primary/40 hover:shadow-md group-hover:-translate-y-0.5">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 rounded-xl bg-muted/60 p-3 ${d.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold tracking-wider uppercase truncate">
                        {d.label}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {d.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
