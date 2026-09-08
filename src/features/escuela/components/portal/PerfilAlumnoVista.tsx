import { Building2, CalendarCheck, GraduationCap, Mail, Phone, UserRound } from "lucide-react";
import { fechaLarga } from "../../lib/calendario";
import type { PerfilAlumno } from "../../types";

/**
 * Ficha del alumno: sus datos, tal y como están dados de alta.
 *
 * Es SOLO LECTURA a propósito. Los datos del alumno los mantiene la escuela; si
 * algo está mal, se corrige desde dentro, no aquí.
 */
export function PerfilAlumnoVista({ perfil }: { perfil: PerfilAlumno }) {
  const datos = [
    { icono: UserRound, etiqueta: "Nombre", valor: perfil.nombre || "—" },
    { icono: Mail, etiqueta: "Correo", valor: perfil.email },
    { icono: Phone, etiqueta: "Teléfono", valor: perfil.telefono || "—" },
    { icono: Building2, etiqueta: "Empresa", valor: perfil.empresaClienteNombre || "—" },
    {
      icono: CalendarCheck,
      etiqueta: "Alumno desde",
      valor: perfil.altaEl ? fechaLarga(perfil.altaEl.slice(0, 10)) : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4 rounded-2xl border bg-background p-5">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-lg font-semibold"
          style={{ background: "var(--marca-primario)", color: "var(--marca-texto)" }}
        >
          {(perfil.nombre || perfil.email).slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{perfil.nombre || perfil.email}</h1>
          <p className="text-sm text-muted-foreground">
            {perfil.cursosActivos} {perfil.cursosActivos === 1 ? "curso" : "cursos"} ·{" "}
            {perfil.leccionesCompletadas}{" "}
            {perfil.leccionesCompletadas === 1 ? "lección completada" : "lecciones completadas"}
          </p>
        </div>
        <GraduationCap className="ml-auto hidden h-6 w-6 text-muted-foreground sm:block" />
      </div>

      <dl className="divide-y rounded-2xl border bg-background">
        {datos.map((d) => {
          const Icono = d.icono;
          return (
            <div key={d.etiqueta} className="flex items-center gap-3 px-5 py-3.5">
              <Icono className="h-4 w-4 shrink-0 text-muted-foreground" />
              <dt className="w-32 shrink-0 text-sm text-muted-foreground">{d.etiqueta}</dt>
              <dd className="min-w-0 flex-1 truncate text-sm font-medium">{d.valor}</dd>
            </div>
          );
        })}
      </dl>

      <p className="text-center text-xs text-muted-foreground">
        ¿Hay algo mal en tus datos? Escríbenos y lo corregimos.
      </p>
    </div>
  );
}
