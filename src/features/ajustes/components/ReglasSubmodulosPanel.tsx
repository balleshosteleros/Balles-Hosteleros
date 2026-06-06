"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Lock, Shield, ShieldCheck, ShieldPlus, Sliders } from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CATALOGO,
  camposExigidos,
  REGLA_MODULO_SENTINEL,
  type ModoReglas,
  type ModuloDef,
  type ReglaSubmoduloRow,
  type SubmoduloDef,
} from "@/features/ajustes/lib/reglas-submodulos-catalogo";
import {
  listReglasSubmodulo,
  upsertReglaSubmodulo,
} from "@/features/ajustes/actions/reglas-submodulo-actions";
import {
  getProveedoresConfig,
  saveProveedoresConfig,
  type ProveedoresConfig,
} from "@/features/logistica/actions/categorias-proveedor-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { ValidadoresSolicitudesConfig } from "@/features/ajustes/components/RrhhConfigTab";

// ============================================================
// Tarjetas de modo (las 4 modalidades) — UI muy visual
// ============================================================

interface ModoCard {
  modo: ModoReglas;
  label: string;
  descripcion: string;
  icon: typeof Shield;
  color: string;
  bg: string;
  border: string;
}

// Iconos en progresión de protección: escudo simple → verificado → reforzado.
const MODO_CARDS: ModoCard[] = [
  {
    modo: "basico",
    label: "BÁSICO",
    descripcion: "Mínimo imprescindible",
    icon: Shield,
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-300 dark:border-emerald-800",
  },
  {
    modo: "estandar",
    label: "ESTÁNDAR",
    descripcion: "Campos clave",
    icon: ShieldCheck,
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-300 dark:border-blue-800",
  },
  {
    modo: "avanzado",
    label: "AVANZADO",
    descripcion: "Todos los campos",
    icon: ShieldPlus,
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-800",
  },
  {
    modo: "personalizado",
    label: "PERSONALIZADO",
    descripcion: "Tú decides",
    icon: Sliders,
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-300 dark:border-purple-800",
  },
];

const cardForModo = (m: ModoReglas) => MODO_CARDS.find((c) => c.modo === m)!;

// ============================================================
// Tipado del estado local
// ============================================================

type ReglaKey = string;
const claveSub = (modulo: string, submodulo: string): ReglaKey => `${modulo}|${submodulo}`;

interface ReglaLocalSub {
  modo: ModoReglas;
  camposPersonalizados: string[];
}

function reglaSubDefault(): ReglaLocalSub {
  return { modo: "estandar", camposPersonalizados: [] };
}

function rowToLocalSub(row: ReglaSubmoduloRow): ReglaLocalSub {
  return { modo: row.modo, camposPersonalizados: row.campos_obligatorios ?? [] };
}

// ============================================================
// Selector de modo (4 tarjetas) — usado a nivel módulo y submódulo
// ============================================================

function SelectorModo({
  modoActivo,
  onChange,
  disabled,
  size = "md",
}: {
  modoActivo: ModoReglas;
  onChange: (m: ModoReglas) => void;
  disabled?: boolean;
  size?: "md" | "sm";
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 ${size === "sm" ? "text-xs" : ""}`}>
      {MODO_CARDS.map((card) => {
        const Icon = card.icon;
        const activo = modoActivo === card.modo;
        return (
          <button
            key={card.modo}
            type="button"
            disabled={disabled}
            onClick={() => onChange(card.modo)}
            className={`relative flex flex-col items-start gap-1 rounded-lg border-2 p-2.5 text-left transition-all ${
              activo
                ? `${card.bg} ${card.border} shadow-sm`
                : "bg-card border-border hover:border-muted-foreground/30"
            } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {activo && (
              <div className="absolute top-1.5 right-1.5">
                <Check className={`h-3.5 w-3.5 ${card.color}`} />
              </div>
            )}
            <Icon className={`h-4 w-4 ${activo ? card.color : "text-muted-foreground"}`} />
            <p className={`text-[10px] font-bold tracking-wider ${activo ? card.color : "text-foreground"}`}>
              {card.label}
            </p>
            <p className="text-[9px] text-muted-foreground leading-tight">
              {card.descripcion}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Checklist de campos (gris bloqueado en presets, color en personalizado)
// ============================================================

function ChecklistCampos({
  submodulo,
  modoEfectivo,
  modoSub,
  camposPersonalizados,
  onTogglePersonalizado,
  bloqueadoPorModulo,
}: {
  submodulo: SubmoduloDef;
  modoEfectivo: ModoReglas;
  modoSub: ModoReglas;
  camposPersonalizados: string[];
  onTogglePersonalizado: (campoKey: string) => void;
  bloqueadoPorModulo: boolean;
}) {
  if (submodulo.campos.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-center">
        <p className="text-[11px] text-muted-foreground">
          Este submódulo todavía no tiene formulario de creación. Cuando se añada,
          aparecerán aquí sus campos.
        </p>
      </div>
    );
  }

  const exigidos = new Set(camposExigidos(submodulo, modoEfectivo, camposPersonalizados));
  const editable = !bloqueadoPorModulo && modoSub === "personalizado";

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {editable ? "Marca los campos obligatorios" : "Campos obligatorios"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {submodulo.campos.map((campo) => {
          const activo = exigidos.has(campo.key);
          return (
            <button
              key={campo.key}
              type="button"
              disabled={!editable}
              onClick={() => editable && onTogglePersonalizado(campo.key)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all ${
                editable
                  ? activo
                    ? "border-purple-400 bg-purple-50 dark:bg-purple-950/40 dark:border-purple-700 cursor-pointer hover:shadow-sm"
                    : "border-border bg-card cursor-pointer hover:border-purple-300 dark:hover:border-purple-700"
                  : activo
                  ? "border-muted-foreground/30 bg-muted/60 cursor-default"
                  : "border-border bg-card opacity-50 cursor-default"
              }`}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                  editable
                    ? activo
                      ? "bg-purple-600 border-purple-600 dark:bg-purple-500 dark:border-purple-500"
                      : "border-muted-foreground/40"
                    : activo
                    ? "bg-muted-foreground/60 border-muted-foreground/60"
                    : "border-muted-foreground/30"
                }`}
              >
                {activo && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className={`text-xs ${activo ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {campo.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Operativa de compra de Proveedores (3 toggles guardados en
// `proveedores_config`). Aparece sólo bajo el submódulo Proveedores,
// debajo del checklist de campos obligatorios. Auto-guardado por toggle.
// ============================================================

const OPERATIVA_COMPRA_FIELDS: Array<{ key: keyof ProveedoresConfig; label: string }> = [
  { key: "mostrar_solo_productos_proveedor", label: "Mostrar solo productos de este proveedor en documentos de compra." },
  { key: "avisar_doc_existente", label: "Avisar al crear un documento de compra con un número de documento existente." },
  { key: "ocultar_precios_compra_impresion", label: "Ocultar precios de compra al imprimir pedidos de compra." },
];

function OperativaCompraProveedores() {
  const [config, setConfig] = useState<ProveedoresConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getProveedoresConfig().then((res) => {
      if (alive && res.ok) setConfig(res.data);
    });
    return () => { alive = false; };
  }, []);

  const toggle = async (key: keyof ProveedoresConfig) => {
    if (!config || saving) return;
    const next = { ...config, [key]: !config[key] };
    setConfig(next);
    setSaving(true);
    const res = await saveProveedoresConfig(next);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Error al guardar");
      setConfig(config);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Operativa de compra
      </p>
      <div className="rounded-md border bg-card p-2.5 space-y-2">
        {OPERATIVA_COMPRA_FIELDS.map((f) => (
          <label key={f.key} className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={!!config?.[f.key]}
              onCheckedChange={() => toggle(f.key)}
              disabled={!config || saving}
              className="mt-0.5"
            />
            <span className="text-xs leading-snug">{f.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Fila de submódulo (acordeón anidado dentro del módulo)
// ============================================================

function SubmoduloRow({
  submodulo,
  reglaSub,
  modoModulo,
  onChangeRegla,
}: {
  submodulo: SubmoduloDef;
  reglaSub: ReglaLocalSub;
  modoModulo: ModoReglas;
  onChangeRegla: (r: ReglaLocalSub) => void;
}) {
  const [open, setOpen] = useState(false);

  const bloqueadoPorModulo = modoModulo !== "personalizado";
  // Modo efectivo del submódulo: si el módulo está en preset, ese gana.
  const modoEfectivo: ModoReglas = bloqueadoPorModulo ? modoModulo : reglaSub.modo;
  const card = cardForModo(modoEfectivo);
  const Icon = card.icon;

  // Cuando cambia el modo del submódulo a personalizado, prefill con Estándar.
  const handleSubmoduloModoChange = (nuevoModo: ModoReglas) => {
    if (nuevoModo === "personalizado" && reglaSub.modo !== "personalizado") {
      onChangeRegla({ modo: nuevoModo, camposPersonalizados: [...submodulo.presets.estandar] });
    } else {
      onChangeRegla({ ...reglaSub, modo: nuevoModo });
    }
  };

  const toggleCampo = (campoKey: string) => {
    const set = new Set(reglaSub.camposPersonalizados);
    if (set.has(campoKey)) set.delete(campoKey);
    else set.add(campoKey);
    onChangeRegla({ ...reglaSub, camposPersonalizados: Array.from(set) });
  };

  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <Icon className={`h-3.5 w-3.5 ${card.color} shrink-0`} />
        <span className="text-sm font-medium flex-1">{submodulo.label}</span>
        {submodulo.placeholder && submodulo.key !== "solicitudes" && (
          <Badge variant="outline" className="text-[9px] text-muted-foreground">
            PRÓXIMAMENTE
          </Badge>
        )}
        {submodulo.key !== "solicitudes" && (
          <Badge
            variant="outline"
            className={`text-[10px] ${card.color} ${card.border} ${bloqueadoPorModulo ? "opacity-70" : ""}`}
          >
            {bloqueadoPorModulo && <Lock className="h-2.5 w-2.5 mr-1 inline" />}
            {card.label}
          </Badge>
        )}
      </button>

      {open && (
        <div className="border-t px-3 py-3 space-y-3">
          {submodulo.key === "solicitudes" ? (
            <ValidadoresSolicitudesConfig embedded />
          ) : (
            <>
              {bloqueadoPorModulo && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-2.5 py-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Bloqueado: el módulo está en <strong>{cardForModo(modoModulo).label}</strong>.
                    Para configurar este submódulo aparte, cambia el módulo a <strong>PERSONALIZADO</strong>.
                  </p>
                </div>
              )}

              <SelectorModo
                modoActivo={reglaSub.modo}
                onChange={handleSubmoduloModoChange}
                disabled={bloqueadoPorModulo}
                size="sm"
              />

              <ChecklistCampos
                submodulo={submodulo}
                modoEfectivo={modoEfectivo}
                modoSub={reglaSub.modo}
                camposPersonalizados={reglaSub.camposPersonalizados}
                onTogglePersonalizado={toggleCampo}
                bloqueadoPorModulo={bloqueadoPorModulo}
              />

              {submodulo.key === "proveedores" && <OperativaCompraProveedores />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Componente principal — recibe el moduloKey y muestra TODO inline
// ============================================================

export function ReglasSubmodulosPanel({ moduloKey }: { moduloKey: string }) {
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;

  const modulo: ModuloDef | undefined = useMemo(
    () => CATALOGO.find((m) => m.key === moduloKey),
    [moduloKey],
  );

  const [modoModulo, setModoModulo] = useState<ModoReglas>("personalizado");
  const [modoModuloInicial, setModoModuloInicial] = useState<ModoReglas>("personalizado");
  const [reglasSub, setReglasSub] = useState<Map<ReglaKey, ReglaLocalSub>>(new Map());
  const [reglasSubIniciales, setReglasSubIniciales] = useState<Map<ReglaKey, ReglaLocalSub>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReglasSubmodulo(empresaDbId).then((rows) => {
      if (cancelled) return;
      const subMap = new Map<ReglaKey, ReglaLocalSub>();
      let modModo: ModoReglas = "personalizado";
      for (const r of rows) {
        if (r.modulo !== moduloKey) continue;
        if (r.submodulo === REGLA_MODULO_SENTINEL) {
          modModo = r.modo;
        } else {
          subMap.set(claveSub(r.modulo, r.submodulo), rowToLocalSub(r));
        }
      }
      setModoModulo(modModo);
      setModoModuloInicial(modModo);
      setReglasSub(new Map(subMap));
      setReglasSubIniciales(new Map(subMap));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [empresaDbId, moduloKey]);

  const hayCambios = useMemo(() => {
    if (!modulo) return false;
    if (modoModulo !== modoModuloInicial) return true;
    for (const sub of modulo.submodulos) {
      const k = claveSub(modulo.key, sub.key);
      const a = reglasSub.get(k) ?? reglaSubDefault();
      const i = reglasSubIniciales.get(k) ?? reglaSubDefault();
      if (a.modo !== i.modo) return true;
      if (a.camposPersonalizados.join(",") !== i.camposPersonalizados.join(",")) return true;
    }
    return false;
  }, [modulo, modoModulo, modoModuloInicial, reglasSub, reglasSubIniciales]);

  if (!modulo) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        No hay catálogo definido para este departamento.
      </div>
    );
  }

  const getReglaSub = (subKey: string): ReglaLocalSub =>
    reglasSub.get(claveSub(modulo.key, subKey)) ?? reglaSubDefault();

  const setReglaSub = (subKey: string, r: ReglaLocalSub) => {
    const next = new Map(reglasSub);
    next.set(claveSub(modulo.key, subKey), r);
    setReglasSub(next);
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const tareas: Promise<{ data?: ReglaSubmoduloRow; error?: string }>[] = [];

      if (modoModulo !== modoModuloInicial) {
        tareas.push(
          upsertReglaSubmodulo({
            modulo: modulo.key,
            submodulo: REGLA_MODULO_SENTINEL,
            modo: modoModulo,
            camposObligatorios: [],
            empresaId: empresaDbId,
          }),
        );
      }

      for (const sub of modulo.submodulos) {
        const k = claveSub(modulo.key, sub.key);
        const a = reglasSub.get(k) ?? reglaSubDefault();
        const i = reglasSubIniciales.get(k) ?? reglaSubDefault();
        const distinto =
          a.modo !== i.modo ||
          a.camposPersonalizados.join(",") !== i.camposPersonalizados.join(",");
        if (distinto) {
          tareas.push(
            upsertReglaSubmodulo({
              modulo: modulo.key,
              submodulo: sub.key,
              modo: a.modo,
              camposObligatorios: a.camposPersonalizados,
              empresaId: empresaDbId,
            }),
          );
        }
      }

      if (tareas.length === 0) {
        toast.info("No hay cambios pendientes");
        return;
      }

      const resultados = await Promise.all(tareas);
      const errores = resultados.filter((r) => r.error);
      if (errores.length > 0) {
        toast.error(`Error al guardar: ${errores[0].error}`);
        return;
      }

      setModoModuloInicial(modoModulo);
      setReglasSubIniciales(new Map(reglasSub));
      toast.success(`Reglas guardadas (${tareas.length} cambio${tareas.length > 1 ? "s" : ""})`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner />
      </div>
    );
  }

  const cardModulo = cardForModo(modoModulo);

  return (
    <div className="space-y-3">
      {/* Cabecera con modo del módulo */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Privacidad del módulo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Elige cómo se comporta <strong>todo el módulo</strong>. En modo
              <span className={`font-semibold mx-1 ${cardForModo("personalizado").color}`}>
                Personalizado
              </span>
              cada submódulo puede tener su propia configuración.
            </p>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 ${cardModulo.color} ${cardModulo.border}`}
          >
            {cardModulo.label}
          </Badge>
        </div>

        <SelectorModo modoActivo={modoModulo} onChange={setModoModulo} />
      </div>

      {/* Submódulos */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Submódulos ({modulo.submodulos.length})
        </p>
        <div className="space-y-1.5">
          {modulo.submodulos.map((sub) => (
            <SubmoduloRow
              key={sub.key}
              submodulo={sub}
              reglaSub={getReglaSub(sub.key)}
              modoModulo={modoModulo}
              onChangeRegla={(r) => setReglaSub(sub.key, r)}
            />
          ))}
        </div>
      </div>

      {/* Botón guardar (sticky al final) */}
      <div className="flex justify-end pt-2 border-t">
        <Button size="sm" onClick={guardar} disabled={!hayCambios || saving}>
          {saving ? "GUARDANDO..." : "GUARDAR REGLAS"}
        </Button>
      </div>
    </div>
  );
}
