"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { ArrowLeft, UserPlus, Loader2, Copy, Check, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  createEmpleado, listDepartamentos,
} from "@/features/rrhh/actions/empleados-actions";
import { getEmpresasAccesibles, type EmpresaAccesible } from "@/features/empresa/actions/empresas-accesibles-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";

type CredencialesAlta = { email: string; password: string };
type LocalOpt = { id: string; nombre: string };

function ordenarEmpresasConPrincipal(
  empresaIds: string[],
  empresaPrincipalId: string | null,
) {
  if (!empresaPrincipalId) return empresaIds;
  const resto = empresaIds.filter((id) => id !== empresaPrincipalId);
  return empresaIds.includes(empresaPrincipalId)
    ? [empresaPrincipalId, ...resto]
    : empresaIds;
}

export default function NuevoEmpleadoPage() {
  const router = useRouter();

  const [departamentos, setDepartamentos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [empresas, setEmpresas] = useState<EmpresaAccesible[]>([]);
  const [empresasMarcadas, setEmpresasMarcadas] = useState<string[]>([]);
  const [empresaPrincipalId, setEmpresaPrincipalId] = useState<string | null>(null);
  const [localesPorEmpresa, setLocalesPorEmpresa] = useState<Record<string, LocalOpt[]>>({});
  const [localSeleccionado, setLocalSeleccionado] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [credenciales, setCredenciales] = useState<CredencialesAlta | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    listDepartamentos().then((res) => {
      setDepartamentos((res.data ?? []) as Array<{ id: string; nombre: string }>);
    });
    getEmpresasAccesibles().then((res) => {
      if (res.ok) {
        setEmpresas(res.data);
        // Por defecto, ninguna marcada: el admin elige.
      }
    });
  }, []);

  // Carga locales bajo demanda cuando se marca una empresa.
  useEffect(() => {
    const pendientes = empresasMarcadas.filter((eid) => !(eid in localesPorEmpresa));
    if (pendientes.length === 0) return;
    Promise.all(
      pendientes.map(async (eid) => {
        const res = await listLocales(eid);
        if (!res.ok) {
          const nombreEmpresa = empresas.find((e) => e.id === eid)?.nombre ?? eid;
          toast.error(`No se pudieron cargar locales de ${nombreEmpresa}: ${res.error ?? "error desconocido"}`);
        }
        return [eid, res.ok ? (res.data as LocalOpt[]) : []] as const;
      })
    ).then((entries) => {
      setLocalesPorEmpresa((prev) => {
        const next = { ...prev };
        for (const [eid, locs] of entries) next[eid] = locs;
        return next;
      });
    });
  }, [empresasMarcadas, localesPorEmpresa, empresas]);

  function toggleEmpresa(id: string, checked: boolean) {
    setEmpresasMarcadas((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        setEmpresaPrincipalId((actual) => actual ?? id);
        return next;
      }
      const next = prev.filter((x) => x !== id);
      // Si desmarcamos, limpiamos el local elegido para esa empresa.
      setLocalSeleccionado((s) => {
        const copia = { ...s };
        delete copia[id];
        return copia;
      });
      setEmpresaPrincipalId((actual) => {
        if (actual !== id) return actual;
        return next[0] ?? null;
      });
      return next;
    });
  }

  async function handleSubmit(formData: FormData) {
    const nombre = (formData.get("nombre") as string)?.trim();
    const emailEmpresa = ((formData.get("email_empresa") as string) || "").trim();
    const emailPersonal = ((formData.get("email_personal") as string) || "").trim();
    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!emailPersonal) {
      toast.error("El email personal es obligatorio (se usa como login si no hay email de empresa)");
      return;
    }
    if (empresasMarcadas.length === 0) {
      toast.error("Selecciona al menos una empresa para el empleado");
      return;
    }
    if (!empresaPrincipalId || !empresasMarcadas.includes(empresaPrincipalId)) {
      toast.error("Selecciona una empresa principal válida");
      return;
    }

    const empresasOrdenadas = ordenarEmpresasConPrincipal(
      empresasMarcadas,
      empresaPrincipalId,
    );

    setSaving(true);
    const res = await createEmpleado({
      nombre,
      apellidos: (formData.get("apellidos") as string) || undefined,
      departamentoId: (formData.get("departamento_id") as string) || undefined,
      puesto: (formData.get("puesto") as string) || undefined,
      emailEmpresa: emailEmpresa || undefined,
      emailPersonal,
      telefono: (formData.get("telefono") as string) || undefined,
      empresaIds: empresasOrdenadas,
      empresaPrincipalId,
      localPorEmpresa: localSeleccionado,
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error ?? "Error creando empleado");
      return;
    }
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
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
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
            Al dar de alta se crea también su usuario para el portal. El login
            será el email de empresa si tiene; si no, el personal.
          </p>
        </div>
      </div>

      <form action={handleSubmit} className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Nombre <span className="text-rose-500">*</span>
            </Label>
            <Input name="nombre" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Apellidos
            </Label>
            <Input name="apellidos" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Departamento
            </Label>
            <Select name="departamento_id">
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                {departamentos.length === 0
                  ? <SelectItem value="__none__" disabled>No hay departamentos</SelectItem>
                  : departamentos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Puesto
            </Label>
            <Input name="puesto" placeholder="ej. Camarero/a" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Email personal <span className="text-rose-500">*</span>
            </Label>
            <Input name="email_personal" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Email empresa
            </Label>
            <Input name="email_empresa" type="email" placeholder="solo si tiene cuenta corporativa" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Teléfono
          </Label>
          <Input name="telefono" />
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Acceso a empresas <span className="text-rose-500">*</span>
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Marca las empresas a las que el empleado podrá acceder y elige cuál será la principal.
          </p>
          {empresas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Cargando empresas…</div>
          ) : (
            <div className="space-y-3">
              {empresas.map((e) => {
                const marcada = empresasMarcadas.includes(e.id);
                const esPrincipal = empresaPrincipalId === e.id;
                const locales = localesPorEmpresa[e.id] ?? [];
                return (
                  <div
                    key={e.id}
                    className="rounded-lg border bg-muted/20 p-3 space-y-2"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={marcada}
                        onCheckedChange={(v) => toggleEmpresa(e.id, v === true)}
                      />
                      <span className="font-medium">{e.nombre}</span>
                      {esPrincipal && (
                        <span className="text-[10px] uppercase font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Principal
                        </span>
                      )}
                    </label>
                    {marcada && (
                      <div className="pl-6 space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Empresa principal
                          </Label>
                          <Button
                            type="button"
                            variant={esPrincipal ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEmpresaPrincipalId(e.id);
                              setEmpresasMarcadas((prev) =>
                                ordenarEmpresasConPrincipal(prev, e.id)
                              );
                            }}
                          >
                            {esPrincipal ? "Principal" : "Marcar principal"}
                          </Button>
                        </div>
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Local en esta empresa
                        </Label>
                        <Select
                          value={localSeleccionado[e.id] ?? ""}
                          onValueChange={(v) =>
                            setLocalSeleccionado((prev) => ({ ...prev, [e.id]: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={locales.length === 0 ? "Sin locales disponibles" : "Seleccionar local"} />
                          </SelectTrigger>
                          <SelectContent>
                            {locales.length === 0 ? (
                              <SelectItem value="__none__" disabled>
                                Esta empresa aún no tiene locales
                              </SelectItem>
                            ) : (
                              locales.map((l) => (
                                <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
          <Button type="submit" disabled={saving} className="gap-2">
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Creando…</>
              : <><UserPlus className="h-4 w-4" />Crear empleado y usuario</>}
          </Button>
        </div>
      </form>

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
