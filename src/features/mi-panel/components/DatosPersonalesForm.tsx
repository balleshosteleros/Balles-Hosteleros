"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Check,
  ChevronsUpDown,
  AlertTriangle,
  ShieldCheck,
  IdCard,
  Phone,
  Home,
  Banknote,
  Heart,
  Shirt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  guardarDatosPersonales,
  type DatosPersonalesCompletos,
} from "@/features/mi-panel/actions/datos-personales-actions";
import {
  BANCOS_ESPANA,
  buscarBancoPorCodigo,
  buscarBancoPorIban,
} from "@/features/mi-panel/data/bancos-espana";
import {
  compararTitular,
  detectarTipoDocumento,
  formatearIban,
  validarDocumento,
  validarIban,
  type TipoDocumento,
} from "@/features/mi-panel/lib/datos-personales-validators";

interface Props {
  initial: DatosPersonalesCompletos;
}

type FormState = {
  nombre: string;
  apellidos: string;
  tipo_documento: TipoDocumento | "";
  dni_nie: string;
  fecha_nacimiento: string;
  nacionalidad: string;
  genero: string;
  estado_civil: string;
  numero_ss: string;
  telefono: string;
  telefono_secundario: string;
  email_personal: string;
  direccion: string;
  codigo_postal: string;
  ciudad: string;
  provincia: string;
  pais: string;
  iban: string;
  banco_codigo: string;
  banco_nombre: string;
  titular_cuenta: string;
  emergencia_nombre: string;
  emergencia_relacion: string;
  emergencia_telefono: string;
  permiso_trabajo: string;
  permiso_caducidad: string;
  carnet_manipulador: string;
  talla_uniforme: string;
  alergias: string;
};

function fromInitial(d: DatosPersonalesCompletos): FormState {
  return {
    nombre: d.nombre ?? "",
    apellidos: d.apellidos ?? "",
    tipo_documento: (d.tipo_documento ?? "") as TipoDocumento | "",
    dni_nie: d.dni_nie ?? "",
    fecha_nacimiento: d.fecha_nacimiento ?? "",
    nacionalidad: d.nacionalidad ?? "Española",
    genero: d.genero ?? "",
    estado_civil: d.estado_civil ?? "",
    numero_ss: d.numero_ss ?? "",
    telefono: d.telefono ?? "",
    telefono_secundario: d.telefono_secundario ?? "",
    email_personal: d.email_personal ?? "",
    direccion: d.direccion ?? "",
    codigo_postal: d.codigo_postal ?? "",
    ciudad: d.ciudad ?? "",
    provincia: d.provincia ?? "",
    pais: d.pais ?? "España",
    iban: d.iban ? formatearIban(d.iban) : "",
    banco_codigo: d.banco_codigo ?? "",
    banco_nombre: d.banco_nombre ?? "",
    titular_cuenta: d.titular_cuenta ?? "",
    emergencia_nombre: d.emergencia_nombre ?? "",
    emergencia_relacion: d.emergencia_relacion ?? "",
    emergencia_telefono: d.emergencia_telefono ?? "",
    permiso_trabajo: d.permiso_trabajo ?? "",
    permiso_caducidad: d.permiso_caducidad ?? "",
    carnet_manipulador: d.carnet_manipulador ?? "",
    talla_uniforme: d.talla_uniforme ?? "",
    alergias: d.alergias ?? "",
  };
}

export function DatosPersonalesForm({ initial }: Props) {
  const [form, setForm] = useState<FormState>(() => fromInitial(initial));
  const [saving, setSaving] = useState(false);
  const [bancoOpen, setBancoOpen] = useState(false);

  const ibanCheck = useMemo(() => {
    if (!form.iban) return null;
    return validarIban(form.iban);
  }, [form.iban]);

  const docCheck = useMemo(() => {
    if (!form.dni_nie || !form.tipo_documento) return null;
    return validarDocumento(form.tipo_documento, form.dni_nie);
  }, [form.dni_nie, form.tipo_documento]);

  // Auto-detect tipo_documento si el usuario aún no lo ha elegido
  useEffect(() => {
    if (form.tipo_documento) return;
    const tipo = detectarTipoDocumento(form.dni_nie);
    if (tipo) setForm((f) => ({ ...f, tipo_documento: tipo }));
  }, [form.dni_nie, form.tipo_documento]);

  // Auto-rellenar banco al introducir un IBAN válido
  useEffect(() => {
    if (!ibanCheck?.valido) return;
    const banco = buscarBancoPorIban(form.iban);
    if (banco && banco.codigo !== form.banco_codigo) {
      setForm((f) => ({
        ...f,
        banco_codigo: banco.codigo,
        banco_nombre: banco.nombre,
      }));
    }
  }, [form.iban, form.banco_codigo, ibanCheck?.valido]);

  // Coincidencia titular ↔ nombre+apellidos
  const coincidenciaTitular = useMemo(() => {
    if (!form.titular_cuenta) return null;
    const nombreCompleto = `${form.nombre} ${form.apellidos}`.trim();
    if (!nombreCompleto) return null;
    return compararTitular(form.titular_cuenta, nombreCompleto);
  }, [form.titular_cuenta, form.nombre, form.apellidos]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (form.dni_nie && !form.tipo_documento) {
      toast.error("Selecciona el tipo de documento (DNI / NIE / Pasaporte)");
      return;
    }
    if (docCheck && !docCheck.valido) {
      toast.error(docCheck.mensaje ?? "Documento inválido");
      return;
    }
    if (form.iban && ibanCheck && !ibanCheck.valido) {
      toast.error(ibanCheck.mensaje ?? "IBAN inválido");
      return;
    }

    setSaving(true);
    try {
      const res = await guardarDatosPersonales({
        ...form,
        iban: form.iban ? form.iban.replace(/\s+/g, "").toUpperCase() : null,
        tipo_documento: form.tipo_documento || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron guardar tus datos");
      } else {
        toast.success("Datos personales guardados");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const bancoSeleccionado = buscarBancoPorCodigo(form.banco_codigo);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Identidad" icon={<IdCard className="h-4 w-4" />}>
        <Grid>
          <Field label="Nombre" required>
            <Input
              value={form.nombre}
              onChange={(e) => update("nombre", e.target.value)}
              required
            />
          </Field>
          <Field label="Apellidos">
            <Input
              value={form.apellidos}
              onChange={(e) => update("apellidos", e.target.value)}
            />
          </Field>
          <Field label="Fecha de nacimiento">
            <Input
              type="date"
              value={form.fecha_nacimiento}
              onChange={(e) => update("fecha_nacimiento", e.target.value)}
            />
          </Field>
          <Field label="Nacionalidad">
            <Input
              value={form.nacionalidad}
              onChange={(e) => update("nacionalidad", e.target.value)}
            />
          </Field>
          <Field label="Género">
            <Select
              value={form.genero || undefined}
              onValueChange={(v) => update("genero", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mujer">Mujer</SelectItem>
                <SelectItem value="hombre">Hombre</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
                <SelectItem value="prefiero_no_decirlo">Prefiero no decirlo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado civil">
            <Select
              value={form.estado_civil || undefined}
              onValueChange={(v) => update("estado_civil", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soltero">Soltero/a</SelectItem>
                <SelectItem value="casado">Casado/a</SelectItem>
                <SelectItem value="pareja_hecho">Pareja de hecho</SelectItem>
                <SelectItem value="divorciado">Divorciado/a</SelectItem>
                <SelectItem value="viudo">Viudo/a</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Grid>
      </Section>

      <Section title="Documento oficial" icon={<ShieldCheck className="h-4 w-4" />}>
        <Grid>
          <Field label="Tipo de documento">
            <Select
              value={form.tipo_documento || undefined}
              onValueChange={(v) => update("tipo_documento", v as TipoDocumento)}
            >
              <SelectTrigger>
                <SelectValue placeholder="DNI / NIE / Pasaporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DNI">DNI</SelectItem>
                <SelectItem value="NIE">NIE</SelectItem>
                <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Número de documento"
            hint={
              docCheck
                ? docCheck.valido
                  ? "Documento válido"
                  : docCheck.mensaje
                : undefined
            }
            hintTone={docCheck ? (docCheck.valido ? "ok" : "error") : "muted"}
          >
            <Input
              value={form.dni_nie}
              onChange={(e) => update("dni_nie", e.target.value.toUpperCase())}
              placeholder="12345678Z"
              autoComplete="off"
            />
          </Field>
          <Field label="Nº Seguridad Social">
            <Input
              value={form.numero_ss}
              onChange={(e) => update("numero_ss", e.target.value)}
              placeholder="28 / 12345678 / 90"
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Contacto" icon={<Phone className="h-4 w-4" />}>
        <Grid>
          <Field label="Teléfono">
            <Input
              type="tel"
              value={form.telefono}
              onChange={(e) => update("telefono", e.target.value)}
              placeholder="+34 600 000 000"
            />
          </Field>
          <Field label="Teléfono secundario">
            <Input
              type="tel"
              value={form.telefono_secundario}
              onChange={(e) => update("telefono_secundario", e.target.value)}
            />
          </Field>
          <Field label="Email personal">
            <Input
              type="email"
              value={form.email_personal}
              onChange={(e) => update("email_personal", e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Dirección" icon={<Home className="h-4 w-4" />}>
        <Grid>
          <Field label="Dirección" wide>
            <Input
              value={form.direccion}
              onChange={(e) => update("direccion", e.target.value)}
              placeholder="Calle, número, piso…"
            />
          </Field>
          <Field label="Código postal">
            <Input
              value={form.codigo_postal}
              onChange={(e) => update("codigo_postal", e.target.value)}
            />
          </Field>
          <Field label="Ciudad">
            <Input
              value={form.ciudad}
              onChange={(e) => update("ciudad", e.target.value)}
            />
          </Field>
          <Field label="Provincia">
            <Input
              value={form.provincia}
              onChange={(e) => update("provincia", e.target.value)}
            />
          </Field>
          <Field label="País">
            <Input
              value={form.pais}
              onChange={(e) => update("pais", e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Datos bancarios" icon={<Banknote className="h-4 w-4" />}>
        <Grid>
          <Field
            label="IBAN"
            wide
            hint={
              ibanCheck
                ? ibanCheck.valido
                  ? "IBAN válido"
                  : ibanCheck.mensaje
                : "Formato: ES + 22 dígitos"
            }
            hintTone={ibanCheck ? (ibanCheck.valido ? "ok" : "error") : "muted"}
          >
            <Input
              value={form.iban}
              onChange={(e) => update("iban", formatearIban(e.target.value))}
              placeholder="ES00 0000 0000 0000 0000 0000"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <Field label="Banco" wide>
            <Popover open={bancoOpen} onOpenChange={setBancoOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={bancoOpen}
                  className="w-full justify-between font-normal"
                >
                  {bancoSeleccionado ? (
                    <span className="truncate">
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {bancoSeleccionado.codigo}
                      </span>
                      {bancoSeleccionado.nombre}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Detectado por IBAN o elige manualmente…
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command
                  filter={(value, search) => {
                    const v = value.toLowerCase();
                    return v.includes(search.toLowerCase()) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="Buscar banco…" />
                  <CommandEmpty>Sin coincidencias</CommandEmpty>
                  <CommandList className="max-h-72">
                    <CommandGroup>
                      {BANCOS_ESPANA.map((b) => (
                        <CommandItem
                          key={b.codigo}
                          value={`${b.codigo} ${b.nombre} ${(b.alias ?? []).join(" ")}`}
                          onSelect={() => {
                            update("banco_codigo", b.codigo);
                            update("banco_nombre", b.nombre);
                            setBancoOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              form.banco_codigo === b.codigo ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {b.codigo}
                          </span>
                          <span className="truncate">{b.nombre}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Field>

          <Field
            label="Titular de la cuenta"
            wide
            hint={titularHint(coincidenciaTitular)}
            hintTone={titularTone(coincidenciaTitular)}
          >
            <Input
              value={form.titular_cuenta}
              onChange={(e) => update("titular_cuenta", e.target.value)}
              placeholder="Tal y como aparece en el banco"
            />
          </Field>

          {initial.iban_verificado && (
            <div className="md:col-span-2">
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 border-0 gap-1"
              >
                <ShieldCheck className="h-3 w-3" />
                IBAN verificado por RRHH
              </Badge>
            </div>
          )}
        </Grid>
      </Section>

      <Section title="Contacto de emergencia" icon={<Heart className="h-4 w-4" />}>
        <Grid>
          <Field label="Nombre">
            <Input
              value={form.emergencia_nombre}
              onChange={(e) => update("emergencia_nombre", e.target.value)}
            />
          </Field>
          <Field label="Relación">
            <Input
              value={form.emergencia_relacion}
              onChange={(e) => update("emergencia_relacion", e.target.value)}
              placeholder="Pareja, padre/madre, amigo…"
            />
          </Field>
          <Field label="Teléfono">
            <Input
              type="tel"
              value={form.emergencia_telefono}
              onChange={(e) => update("emergencia_telefono", e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Trabajo y prevención" icon={<Shirt className="h-4 w-4" />}>
        <Grid>
          <Field label="Permiso de trabajo">
            <Input
              value={form.permiso_trabajo}
              onChange={(e) => update("permiso_trabajo", e.target.value)}
              placeholder="Tipo / Nº permiso"
            />
          </Field>
          <Field label="Caducidad permiso">
            <Input
              type="date"
              value={form.permiso_caducidad}
              onChange={(e) => update("permiso_caducidad", e.target.value)}
            />
          </Field>
          <Field label="Carnet manipulador (caducidad)">
            <Input
              type="date"
              value={form.carnet_manipulador}
              onChange={(e) => update("carnet_manipulador", e.target.value)}
            />
          </Field>
          <Field label="Talla uniforme">
            <Select
              value={form.talla_uniforme || undefined}
              onValueChange={(v) => update("talla_uniforme", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Talla" />
              </SelectTrigger>
              <SelectContent>
                {["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Alergias / observaciones médicas" wide>
            <Textarea
              value={form.alergias}
              onChange={(e) => update("alergias", e.target.value)}
              placeholder="Información médica relevante para emergencias"
              rows={3}
            />
          </Field>
        </Grid>
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button
          type="submit"
          size="lg"
          className="gap-2 shadow-lg"
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Guardar datos personales
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function titularHint(score: number | null): string | undefined {
  if (score == null) return undefined;
  if (score >= 0.85) return "Coincide con tu nombre completo";
  if (score >= 0.5) return "Coincidencia parcial — revisa que sea correcto";
  return "El titular no coincide con tu nombre — la nómina podría rechazarse";
}

function titularTone(score: number | null): "ok" | "error" | "warn" | "muted" {
  if (score == null) return "muted";
  if (score >= 0.85) return "ok";
  if (score >= 0.5) return "warn";
  return "error";
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <header className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Field({
  label,
  required,
  wide,
  hint,
  hintTone = "muted",
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  hint?: string;
  hintTone?: "ok" | "error" | "warn" | "muted";
  children: React.ReactNode;
}) {
  const toneClass =
    hintTone === "ok"
      ? "text-emerald-600"
      : hintTone === "error"
      ? "text-rose-600"
      : hintTone === "warn"
      ? "text-amber-600"
      : "text-muted-foreground";
  return (
    <div className={wide ? "md:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <span className="text-rose-500 ml-0.5">*</span> : null}
      </Label>
      {children}
      {hint && (
        <p className={`text-xs flex items-center gap-1 ${toneClass}`}>
          {hintTone === "error" || hintTone === "warn" ? (
            <AlertTriangle className="h-3 w-3" />
          ) : null}
          {hint}
        </p>
      )}
    </div>
  );
}
