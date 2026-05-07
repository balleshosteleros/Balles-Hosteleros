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
import { ArrowLeft, UserPlus, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  createEmpleado, listDepartamentos,
} from "@/features/rrhh/actions/empleados-actions";

type CredencialesAlta = { email: string; password: string };

export default function NuevoEmpleadoPage() {
  const router = useRouter();

  const [departamentos, setDepartamentos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [credenciales, setCredenciales] = useState<CredencialesAlta | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    listDepartamentos().then((res) => {
      setDepartamentos((res.data ?? []) as Array<{ id: string; nombre: string }>);
    });
  }, []);

  async function handleSubmit(formData: FormData) {
    const nombre = (formData.get("nombre") as string)?.trim();
    const emailEmpresa = ((formData.get("email_empresa") as string) || "").trim();
    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!emailEmpresa) {
      toast.error("El email de empresa es obligatorio (será el login del empleado)");
      return;
    }

    setSaving(true);
    const res = await createEmpleado({
      nombre,
      apellidos: (formData.get("apellidos") as string) || undefined,
      departamentoId: (formData.get("departamento_id") as string) || undefined,
      puesto: (formData.get("puesto") as string) || undefined,
      emailEmpresa,
      emailPersonal: (formData.get("email_personal") as string) || undefined,
      telefono: (formData.get("telefono") as string) || undefined,
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
            Al dar de alta se crea también su usuario para el portal. El email
            de empresa será el login.
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
              Email empresa <span className="text-rose-500">*</span>
            </Label>
            <Input name="email_empresa" type="email" required placeholder="nombre.apellido@empresa.es" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Email personal
            </Label>
            <Input name="email_personal" type="email" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Teléfono
          </Label>
          <Input name="telefono" />
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
