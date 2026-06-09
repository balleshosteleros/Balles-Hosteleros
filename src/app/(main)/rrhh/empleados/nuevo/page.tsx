"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { ArrowLeft, UserPlus, Loader2, Copy, Check, Building2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import {
  createEmpleado, listDepartamentos, guardarPerfilEmpleado,
} from "@/features/rrhh/actions/empleados-actions";
import { listPuestosCatalogo } from "@/features/rrhh/actions/vacantes-actions";
import { setPuestosDeEmpleado } from "@/features/rrhh/actions/empleado-puestos-actions";
import { getEmpresasAccesibles, type EmpresaAccesible } from "@/features/empresa/actions/empresas-accesibles-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  DatosPersonalesForm, type DatosPersonalesFormHandle,
} from "@/features/mi-panel/components/DatosPersonalesForm";
import type {
  DatosPersonalesCompletos, DatosPersonalesInput,
} from "@/features/mi-panel/actions/datos-personales-actions";

type CredencialesAlta = { email: string; password: string };
type LocalOpt = { id: string; nombre: string };

// Perfil en blanco: el alta abre la MISMA ficha que se edita después, vacía.
const PERFIL_VACIO: DatosPersonalesCompletos = {
  nombre: null, apellidos: null, email: null,
  tipo_documento: null, dni_nie: null, fecha_nacimiento: null,
  nacionalidad: null, genero: null, estado_civil: null, numero_ss: null,
  telefono: null, telefono_empresa: null, email_personal: null, email_empresa: null,
  direccion: null, codigo_postal: null, ciudad: null, provincia: null, pais: null,
  iban: null, banco_codigo: null, banco_nombre: null, titular_cuenta: null,
  iban_verificado: false,
  emergencia_nombre: null, emergencia_relacion: null, emergencia_telefono: null,
  talla_camiseta: null, talla_pantalon: null,
};

// Campos del perfil que DEBEN estar completos para poder crear al empleado.
// Quedan fuera (opcionales) por reglas del negocio: email_empresa (solo si hay
// cuenta corporativa) y telefono_empresa; banco/titular se autocompletan.
const PERFIL_REQUERIDOS: Array<[keyof DatosPersonalesInput, string]> = [
  ["nombre", "Nombre"],
  ["apellidos", "Apellidos"],
  ["tipo_documento", "Tipo de documento"],
  ["dni_nie", "Nº de documento"],
  ["fecha_nacimiento", "Fecha de nacimiento"],
  ["nacionalidad", "Nacionalidad"],
  ["genero", "Género"],
  ["estado_civil", "Estado civil"],
  ["numero_ss", "Nº Seguridad Social"],
  ["telefono", "Teléfono"],
  ["email_personal", "Email personal"],
  ["direccion", "Dirección"],
  ["codigo_postal", "Código postal"],
  ["ciudad", "Ciudad"],
  ["provincia", "Provincia"],
  ["pais", "País"],
  ["iban", "IBAN"],
  ["emergencia_nombre", "Contacto de emergencia (nombre)"],
  ["emergencia_relacion", "Contacto de emergencia (relación)"],
  ["emergencia_telefono", "Contacto de emergencia (teléfono)"],
  ["talla_camiseta", "Talla de camiseta"],
  ["talla_pantalon", "Talla de pantalón"],
];

function ordenarEmpresasConFichaje(
  empresaIds: string[],
  empresaFichajeId: string | null,
) {
  if (!empresaFichajeId) return empresaIds;
  const resto = empresaIds.filter((id) => id !== empresaFichajeId);
  return empresaIds.includes(empresaFichajeId)
    ? [empresaFichajeId, ...resto]
    : empresaIds;
}

// Cada empresa marcada DEBE tener al menos un local de fichaje seleccionado: sin
// local el empleado no podría fichar en esa empresa. Devuelve los ids de las
// empresas marcadas que no tienen ningún local elegido (o que no tienen locales).
function empresasSinLocalSeleccionado(
  empresasMarcadas: string[],
  localesPorEmpresa: Record<string, LocalOpt[]>,
  localesSeleccionados: string[],
): string[] {
  const sel = new Set(localesSeleccionados);
  return empresasMarcadas.filter((empId) => {
    const locales = localesPorEmpresa[empId] ?? [];
    return !locales.some((l) => sel.has(l.id));
  });
}

export default function NuevoEmpleadoPage() {
  const router = useRouter();
  const datosRef = useRef<DatosPersonalesFormHandle>(null);

  const [departamentos, setDepartamentos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [empresas, setEmpresas] = useState<EmpresaAccesible[]>([]);
  const [empresasMarcadas, setEmpresasMarcadas] = useState<string[]>([]);
  // Empresa donde el empleado ficha (su local "por defecto" vive aquí). No es
  // una jerarquía "principal/secundaria": el empleado aparece igual en todas.
  const [empresaFichajeId, setEmpresaFichajeId] = useState<string | null>(null);
  const [localesPorEmpresa, setLocalesPorEmpresa] = useState<Record<string, LocalOpt[]>>({});
  const [localesSeleccionados, setLocalesSeleccionados] = useState<string[]>([]);
  // Un empleado puede ocupar VARIOS puestos; uno es el principal (de él cuelgan
  // departamento + puesto-texto legacy). Cada puesto aporta su propio horario.
  const [puestosSel, setPuestosSel] = useState<string[]>([]);
  const [principalPuestoId, setPrincipalPuestoId] = useState<string>("");
  const [puestos, setPuestos] = useState<Array<{ id: string; nombre: string; departamento_id: string | null }>>([]);
  const [fechaInicioHorario, setFechaInicioHorario] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [credenciales, setCredenciales] = useState<CredencialesAlta | null>(null);
  const [copiado, setCopiado] = useState(false);
  useGlobalLoadingSync(saving);

  useEffect(() => {
    listDepartamentos().then((res) => {
      setDepartamentos((res.data ?? []) as Array<{ id: string; nombre: string }>);
    });
    listPuestosCatalogo().then((res) => {
      setPuestos((res.data ?? []) as Array<{ id: string; nombre: string; departamento_id: string | null }>);
    });
    getEmpresasAccesibles().then((res) => {
      if (res.ok) setEmpresas(res.data);
    });
  }, []);

  // Cargamos los locales de TODAS las empresas marcadas: el empleado puede
  // fichar en varios locales de cualquiera de sus empresas.
  useEffect(() => {
    for (const empId of empresasMarcadas) {
      if (localesPorEmpresa[empId]) continue;
      listLocales(empId).then((res) => {
        const nombreEmpresa = empresas.find((e) => e.id === empId)?.nombre ?? empId;
        if (!res.ok) {
          toast.error(`No se pudieron cargar locales de ${nombreEmpresa}: ${res.error ?? "error desconocido"}`);
        }
        setLocalesPorEmpresa((prev) =>
          prev[empId] ? prev : { ...prev, [empId]: (res.ok ? res.data : []) as LocalOpt[] },
        );
      });
    }
  }, [empresasMarcadas, localesPorEmpresa, empresas]);

  function toggleLocal(localId: string, checked: boolean) {
    setLocalesSeleccionados((prev) => {
      if (checked) return prev.includes(localId) ? prev : [...prev, localId];
      return prev.filter((id) => id !== localId);
    });
  }

  function togglePuesto(id: string, checked: boolean) {
    setPuestosSel((prev) => {
      const next = checked
        ? (prev.includes(id) ? prev : [...prev, id])
        : prev.filter((x) => x !== id);
      setPrincipalPuestoId((cur) => {
        if (checked) return cur || id;          // primer puesto marcado = principal
        if (cur === id) return next[0] ?? "";   // si quitan el principal, el siguiente
        return cur;
      });
      return next;
    });
  }

  function toggleEmpresa(id: string, checked: boolean) {
    setEmpresasMarcadas((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        setEmpresaFichajeId((actual) => actual ?? id);
        return next;
      }
      const next = prev.filter((x) => x !== id);
      const idsEmpresa = new Set((localesPorEmpresa[id] ?? []).map((l) => l.id));
      setLocalesSeleccionados((sel) => sel.filter((lid) => !idsEmpresa.has(lid)));
      setEmpresaFichajeId((actual) => (actual !== id ? actual : next[0] ?? null));
      return next;
    });
  }

  async function crear() {
    if (saving) return;

    const built = datosRef.current?.getPayload();
    if (!built) {
      toast.error("El formulario aún no está listo");
      return;
    }
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    const payload = built.payload;

    // Todo obligatorio: no se crea al empleado hasta que el perfil esté completo.
    const faltan: string[] = [];
    for (const [campo, label] of PERFIL_REQUERIDOS) {
      if (!String(payload[campo] ?? "").trim()) faltan.push(label);
    }
    if (puestosSel.length === 0) faltan.push("Puesto");
    if (empresasMarcadas.length === 0) faltan.push("Empresa");
    if (!empresaFichajeId) faltan.push("Empresa donde ficha");
    const sinLocal = empresasSinLocalSeleccionado(
      empresasMarcadas, localesPorEmpresa, localesSeleccionados,
    );
    if (sinLocal.length > 0) {
      const nombres = sinLocal.map((id) => empresas.find((e) => e.id === id)?.nombre ?? id);
      faltan.push(`Un local de fichaje en cada empresa (falta en: ${nombres.join(", ")})`);
    }
    if (faltan.length > 0) {
      toast.error(`Faltan campos obligatorios: ${faltan.join(", ")}`);
      return;
    }

    setSaving(true);
    const principal = puestos.find((p) => p.id === (principalPuestoId || puestosSel[0]));
    const empresasOrdenadas = ordenarEmpresasConFichaje(empresasMarcadas, empresaFichajeId);
    const res = await createEmpleado({
      nombre: payload.nombre ?? "",
      apellidos: payload.apellidos ?? undefined,
      departamentoId: principal?.departamento_id ?? "",
      puesto: principal?.nombre ?? "",
      emailEmpresa: payload.email_empresa ?? undefined,
      emailPersonal: payload.email_personal ?? "",
      telefono: payload.telefono ?? undefined,
      empresaIds: empresasOrdenadas,
      empresaPrincipalId: empresaFichajeId ?? undefined,
      localIds: localesSeleccionados,
    });

    if (!res.ok) {
      setSaving(false);
      toast.error(res.error ?? "Error creando empleado");
      return;
    }

    // El empleado ya existe (usuario + ficha + perfil vacío). Completamos el
    // resto del perfil (documento, IBAN, dirección, emergencia, tallas…).
    if (res.empleadoId) {
      const perfilRes = await guardarPerfilEmpleado(res.empleadoId, payload);
      if (!perfilRes.ok) {
        setSaving(false);
        toast.error(
          `Empleado creado, pero no se guardó todo el perfil: ${perfilRes.error ?? ""}. Complétalo en su ficha.`,
        );
        if (res.tempPassword && res.email) {
          setCredenciales({ email: res.email, password: res.tempPassword });
        }
        return;
      }
      // Vincular TODOS los puestos del empleado (M:N): cada uno asigna su plantilla
      // de horario vigente desde la fecha indicada, y marca el principal.
      if (puestosSel.length > 0) {
        const plantRes = await setPuestosDeEmpleado(
          res.empleadoId, puestosSel, principalPuestoId || puestosSel[0], fechaInicioHorario,
        );
        if (!plantRes.ok) {
          toast.error("Empleado creado, pero no se pudieron vincular los puestos/horarios. Asígnalos desde su ficha.");
        }
      }
    }
    setSaving(false);

    if (res.tempPassword && res.email) {
      setCredenciales({ email: res.email, password: res.tempPassword });
    } else {
      toast.success("Empleado creado");
      router.push("/rrhh/empleados");
    }
  }

  async function copiarCredenciales() {
    if (!credenciales) return;
    const texto = `Email: ${credenciales.email}\nContraseña: ${credenciales.password}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  }

  function cerrarDialog() {
    setCredenciales(null);
    router.push("/rrhh/empleados");
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => router.push("/rrhh/empleados")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Nuevo empleado
          </h1>
          <p className="text-sm text-muted-foreground">
            Rellena la ficha completa. Todos los campos son obligatorios: no se
            crea al empleado hasta que esté todo completo. Al crearlo se genera
            también su usuario para el portal.
          </p>
        </div>
      </div>

      {/* Ficha de perfil en blanco — el mismo formulario que se edita después. */}
      <div className="rounded-2xl border bg-card p-4 md:p-6 shadow-sm">
        <DatosPersonalesForm
          ref={datosRef}
          initial={PERFIL_VACIO}
          hideSaveButton
          onSubmitOverride={crear}
        />
      </div>

      {/* Datos laborales */}
      <div className="rounded-2xl border bg-card p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Datos laborales</h2>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Puestos <span className="text-rose-500">*</span>
            <span className="text-muted-foreground/60 normal-case"> (uno o varios; marca el principal)</span>
          </Label>
          {puestos.length === 0 ? (
            <p className="text-xs text-rose-600">No hay puestos — créalos en RRHH → Salarios.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {puestos.map((p) => {
                const marcado = puestosSel.includes(p.id);
                const esPrincipal = principalPuestoId === p.id;
                const dep = departamentos.find((d) => d.id === p.departamento_id)?.nombre;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer min-w-0">
                      <Checkbox checked={marcado} onCheckedChange={(v) => togglePuesto(p.id, v === true)} />
                      <span className="truncate">{p.nombre}</span>
                      {dep && <span className="text-[11px] text-muted-foreground truncate">· {dep}</span>}
                    </label>
                    {marcado && (
                      esPrincipal ? (
                        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                          Principal
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrincipalPuestoId(p.id)}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline shrink-0"
                        >
                          Principal
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            El departamento se hereda de cada puesto. El principal define el departamento y el puesto por defecto.
          </p>
        </div>
        {puestosSel.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Inicio del horario <span className="text-rose-500">*</span>
            </Label>
            <Input
              type="date"
              value={fechaInicioHorario}
              onChange={(e) => setFechaInicioHorario(e.target.value)}
              className="w-48"
            />
            <p className="text-[11px] text-muted-foreground">
              Desde esta fecha se le aplica la plantilla de horario del puesto (si la tiene).
            </p>
          </div>
        )}
      </div>

      {/* Acceso a empresas y locales de fichaje */}
      <div className="rounded-2xl border bg-card p-4 md:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Acceso a empresas <span className="text-rose-500">*</span>
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Marca las empresas en las que trabaja. Aparecerá como empleado en todas
          ellas, con los mismos datos. Dentro de cada una, marca los locales donde
          podrá fichar (uno o varios).
        </p>
        {empresas.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">Cargando empresas…</div>
        ) : (
          <div className="space-y-3">
            {empresas.map((e) => {
              const marcada = empresasMarcadas.includes(e.id);
              const esFichaje = empresaFichajeId === e.id;
              const locales = localesPorEmpresa[e.id];
              return (
                <div key={e.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={marcada}
                        onCheckedChange={(v) => toggleEmpresa(e.id, v === true)}
                      />
                      <span className="font-medium">{e.nombre}</span>
                      {esFichaje && (
                        <span className="text-[10px] uppercase font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Ficha aquí
                        </span>
                      )}
                    </label>
                    {marcada && !esFichaje && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setEmpresaFichajeId(e.id);
                          setEmpresasMarcadas((prev) => ordenarEmpresasConFichaje(prev, e.id));
                        }}
                      >
                        Marcar como local de fichaje
                      </Button>
                    )}
                  </div>
                  {marcada && (() => {
                    const algunoSeleccionado = (locales ?? []).some((l) =>
                      localesSeleccionados.includes(l.id),
                    );
                    return (
                    <div className="pl-6 space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Locales donde ficha <span className="text-rose-500">*</span>
                      </Label>
                      {locales === undefined ? (
                        <p className="text-xs text-muted-foreground">Cargando locales…</p>
                      ) : locales.length === 0 ? (
                        <p className="text-xs text-rose-600">
                          Esta empresa aún no tiene locales: el empleado no podría
                          fichar aquí. Crea un local o desmarca la empresa.
                        </p>
                      ) : (
                        <>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {locales.map((l) => (
                              <label
                                key={l.id}
                                className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm cursor-pointer"
                              >
                                <Checkbox
                                  checked={localesSeleccionados.includes(l.id)}
                                  onCheckedChange={(v) => toggleLocal(l.id, v === true)}
                                />
                                <span>{l.nombre}</span>
                              </label>
                            ))}
                          </div>
                          {!algunoSeleccionado && (
                            <p className="text-xs text-rose-600">
                              Marca al menos un local de fichaje en esta empresa.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/rrhh/empleados")}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={crear} disabled={saving} className="gap-2">
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin" />Creando…</>
            : <><UserPlus className="h-4 w-4" />Crear empleado</>}
        </Button>
      </div>

      <Dialog open={credenciales !== null} onOpenChange={(open) => { if (!open) cerrarDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empleado creado</DialogTitle>
            <DialogDescription>
              Estas son las credenciales temporales para el primer acceso del empleado al portal.
              Se le pedirá cambiar la contraseña al iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          {credenciales && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 font-mono text-sm">
              <div><span className="text-muted-foreground">Email: </span>{credenciales.email}</div>
              <div><span className="text-muted-foreground">Contraseña: </span>{credenciales.password}</div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copiarCredenciales} className="gap-2">
              {copiado ? <><Check className="h-4 w-4" />Copiado</> : <><Copy className="h-4 w-4" />Copiar</>}
            </Button>
            <Button onClick={cerrarDialog}>Hecho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
