import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, GraduationCap, Milestone, ShieldCheck, UserCog, Zap, Settings, FileText, Power, PowerOff, KeyRound, Eye, PenLine } from "lucide-react";
import type { FichaEmpleado } from "@/features/rrhh/data/empleados-ficha";
import { getAccesoDeEmpleado, AccesoPortal, ROLES_PORTAL, permisosDesdeRol } from "@/features/rrhh/data/accesos-portal";
import { toast } from "sonner";

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input defaultValue={value} className="h-9" />
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground tracking-wide border-b pb-2">{titulo}</h3>
      {children}
    </div>
  );
}

/* ─── DATOS PERSONALES ─── */
export function DatosPersonalesSection({ ficha }: { ficha: FichaEmpleado }) {
  const dp = ficha.datosPersonales;
  const dir = ficha.direccion;
  const ct = ficha.contacto;

  return (
    <div className="space-y-8">
      <Bloque titulo="Información personal">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Campo label="Nombre" value={ficha.empleadoId} />
          <Campo label="Tipo de identificación" value={dp.tipoIdentificacion} />
          <Campo label="Número de identificación" value={dp.numeroIdentificacion} />
          <Campo label="Tipo identificación secundaria" value={dp.tipoIdentificacion2 ?? "—"} />
          <Campo label="Número identificación secundaria" value={dp.numeroIdentificacion2 ?? "—"} />
          <Campo label="Nacionalidad" value={dp.nacionalidad} />
          <Campo label="Estado civil" value={dp.estadoCivil} />
          <Campo label="Fecha de nacimiento" value={dp.fechaNacimiento} />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Género</Label>
            <Select defaultValue={dp.genero}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Femenino">Femenino</SelectItem>
                <SelectItem value="No binario">No binario</SelectItem>
                <SelectItem value="Prefiero no decir">Prefiero no decir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Checkbox defaultChecked={dp.compartirCumple} id="cumple" />
            <Label htmlFor="cumple" className="text-sm">Compartir cumpleaños</Label>
          </div>
        </div>
      </Bloque>

      <Bloque titulo="Dirección">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Campo label="Domicilio" value={dir.domicilio} />
          <Campo label="Código postal" value={dir.codigoPostal} />
          <Campo label="Localidad" value={dir.localidad} />
          <Campo label="Provincia" value={dir.provincia} />
          <Campo label="País" value={dir.pais} />
        </div>
      </Bloque>

      <Bloque titulo="Contacto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Campo label="Email de empresa" value={ct.emailEmpresa} />
          <Campo label="Email personal" value={ct.emailPersonal} />
          <Campo label="Teléfono de empresa" value={ct.telefonoEmpresa} />
          <Campo label="Teléfono personal" value={ct.telefonoPersonal} />
          <Campo label="Email notificaciones" value={ct.emailNotificaciones} />
        </div>
      </Bloque>
    </div>
  );
}

/* ─── DATOS LABORALES ─── */
export function DatosLaboralesSection({ ficha }: { ficha: FichaEmpleado }) {
  const dl = ficha.datosLaborales;
  return (
    <Bloque titulo="Datos laborales">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Campo label="Puesto" value={dl.puesto} />
        <Campo label="Departamento" value={dl.departamento} />
        <Campo label="Centro" value={dl.centro} />
        <Campo label="Fecha de alta" value={dl.fechaAlta} />
        <Campo label="Estado" value={dl.estado} />
        <Campo label="Responsable" value={dl.responsable} />
        <Campo label="Tipo de contrato" value={dl.tipoContrato} />
        <Campo label="Jornada" value={dl.jornada} />
        <Campo label="Salario bruto anual" value={dl.salarioBrutoAnual} />
        <Campo label="Coste por hora" value={dl.costePorHora} />
        <Campo label="Horario base" value={dl.horarioBase} />
      </div>
    </Bloque>
  );
}

/* ─── CAMPOS PERSONALIZADOS ─── */
export function CamposPersonalizadosSection({ ficha }: { ficha: FichaEmpleado }) {
  const entries = Object.entries(ficha.camposPersonalizados);
  return (
    <Bloque titulo="Campos personalizados">
      {entries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map(([k, v]) => <Campo key={k} label={k} value={v} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No hay campos personalizados definidos.</p>
      )}
      <Button variant="outline" size="sm" className="gap-2 mt-2"><Plus className="h-3 w-3" /> Añadir campo</Button>
    </Bloque>
  );
}

/* ─── FORMACIÓN Y HABILIDADES ─── */
export function FormacionSection({ ficha }: { ficha: FichaEmpleado }) {
  return (
    <div className="space-y-6">
      <Bloque titulo="Formación y certificaciones">
        {ficha.formacion.length > 0 ? (
          <div className="space-y-3">
            {ficha.formacion.map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <GraduationCap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{f.titulo}</p>
                  <p className="text-xs text-muted-foreground">{f.centro} · {f.anio} · {f.tipo === "formacion" ? "Formación" : f.tipo === "curso" ? "Curso" : "Certificación"}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Sin formación registrada.</p>}
        <Button variant="outline" size="sm" className="gap-2 mt-2"><Plus className="h-3 w-3" /> Añadir formación</Button>
      </Bloque>
      <Bloque titulo="Habilidades">
        <div className="flex flex-wrap gap-2">
          {ficha.habilidades.map((h) => <Badge key={h} variant="secondary">{h}</Badge>)}
          {ficha.habilidades.length === 0 && <p className="text-sm text-muted-foreground">Sin habilidades registradas.</p>}
        </div>
        <Button variant="outline" size="sm" className="gap-2 mt-2"><Plus className="h-3 w-3" /> Añadir habilidad</Button>
      </Bloque>
    </div>
  );
}

/* ─── JOURNEY ─── */
export function JourneySection({ ficha }: { ficha: FichaEmpleado }) {
  return (
    <Bloque titulo="Journey del empleado">
      {ficha.journey.length > 0 ? (
        <div className="relative pl-6 space-y-4">
          <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-border" />
          {ficha.journey.map((j, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
              <p className="text-xs text-muted-foreground">{j.fecha}</p>
              <p className="text-sm font-medium text-foreground">{j.titulo}</p>
              <p className="text-xs text-muted-foreground">{j.descripcion}</p>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Sin hitos registrados.</p>}
      <Button variant="outline" size="sm" className="gap-2 mt-2"><Plus className="h-3 w-3" /> Añadir hito</Button>
    </Bloque>
  );
}

/* ─── ACCESOS ─── */
export function AccesosSection({ ficha, empresaId }: { ficha: FichaEmpleado; empresaId: string }) {
  const acceso = getAccesoDeEmpleado(empresaId, ficha.empleadoId);
  const [estado, setEstado] = useState(acceso?.estadoAcceso ?? "Sin acceso");

  const activar = () => { setEstado("Activo"); toast.success("Acceso activado"); };
  const desactivar = () => { setEstado("Inactivo"); toast.success("Acceso desactivado"); };

  if (!acceso) {
    return (
      <Bloque titulo="Acceso al portal">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Este empleado no tiene acceso al portal.</p>
          <p className="text-xs text-muted-foreground mt-1">Puedes dar acceso desde Ajustes → Usuarios y accesos.</p>
        </div>
      </Bloque>
    );
  }

  const estadoColor: Record<string, string> = {
    Activo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    Inactivo: "bg-muted text-muted-foreground border-muted-foreground/30",
    Pendiente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  };

  return (
    <div className="space-y-6">
      <Bloque titulo="Acceso al portal">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Usuario</Label>
            <Input defaultValue={acceso.emailUsuario} className="h-9" readOnly />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <div className="flex items-center gap-2 h-9">
              <Badge variant="outline" className={`text-xs ${estadoColor[estado] ?? ""}`}>{estado}</Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Rol</Label>
            <div className="flex items-center gap-2 h-9">
              <Badge variant="secondary" className="text-xs gap-1"><UserCog className="h-3 w-3" />{acceso.rol}</Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Última conexión</Label>
            <p className="text-sm text-foreground h-9 flex items-center">{acceso.ultimaConexion}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fecha de creación</Label>
            <p className="text-sm text-foreground h-9 flex items-center">{acceso.fechaCreacion}</p>
          </div>
        </div>
      </Bloque>

      <Bloque titulo="Acciones rápidas">
        <div className="flex flex-wrap gap-2">
          {estado !== "Activo" && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={activar}>
              <Power className="h-3 w-3" /> Activar acceso
            </Button>
          )}
          {estado === "Activo" && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={desactivar}>
              <PowerOff className="h-3 w-3" /> Desactivar acceso
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.success("Contraseña reseteada")}>
            <KeyRound className="h-3 w-3" /> Resetear contraseña
          </Button>
        </div>
      </Bloque>

      <Bloque titulo="Permisos del rol">
        <div className="bg-card rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">MÓDULO</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center justify-center gap-1"><Eye className="h-3 w-3" /> VER</span>
                </th>
                <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center justify-center gap-1"><PenLine className="h-3 w-3" /> EDITAR</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {acceso.permisos.map((p: { modulo: string; ver: boolean; editar: boolean }) => (
                <tr key={p.modulo} className="border-b last:border-0">
                  <td className="px-3 py-1.5 text-foreground">{p.modulo}</td>
                  <td className="text-center px-3 py-1.5">
                    {p.ver ? <span className="text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="text-center px-3 py-1.5">
                    {p.editar ? <span className="text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloque>
    </div>
  );
}

/* ─── ROLES ─── */
export function RolesSection({ ficha }: { ficha: FichaEmpleado }) {
  return (
    <Bloque titulo="Roles del empleado">
      <div className="flex flex-wrap gap-2">
        {ficha.roles.map((r) => (
          <Badge key={r} className="gap-1.5"><UserCog className="h-3 w-3" />{r}</Badge>
        ))}
      </div>
      <Button variant="outline" size="sm" className="gap-2 mt-2"><Plus className="h-3 w-3" /> Gestionar roles</Button>
    </Bloque>
  );
}

/* ─── AUTOMATIZACIONES ─── */
export function AutomatizacionesSection() {
  return (
    <Bloque titulo="Automatizaciones">
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Zap className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No hay automatizaciones configuradas para este empleado.</p>
        <Button variant="outline" size="sm" className="gap-2 mt-4"><Plus className="h-3 w-3" /> Crear automatización</Button>
      </div>
    </Bloque>
  );
}

/* ─── CONFIGURACIÓN ─── */
export function ConfiguracionSection() {
  return (
    <Bloque titulo="Configuración del empleado">
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Settings className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Ajustes específicos del empleado. Próximamente.</p>
      </div>
    </Bloque>
  );
}
