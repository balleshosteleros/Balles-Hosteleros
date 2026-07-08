"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CATALOGO,
  camposObligatoriosEfectivos,
  REGLA_MODULO_SENTINEL,
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
import { IvaDefaultConfig } from "@/features/logistica/components/productos/IvaDefaultConfig";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { ValidadoresSolicitudesConfig } from "@/features/ajustes/components/RrhhConfigTab";
import { FichajesConfigPanel } from "@/features/ajustes/components/FichajesConfigPanel";
import { NotifLiquidacionesConfigPanel } from "@/features/notificaciones/components/NotifLiquidacionesConfigPanel";
import { JornadasVacantesPanel } from "@/features/ajustes/components/JornadasVacantesPanel";
import { TiposContratoPanel } from "@/features/ajustes/components/TiposContratoPanel";
import { GestoriaConfig } from "@/features/rrhh/components/reclutamiento/config/GestoriaConfig";
import { ConfigGeneralConfig } from "@/features/rrhh/components/reclutamiento/config/ConfigGeneralConfig";
import { OnboardingPruebaConfig } from "@/features/rrhh/components/reclutamiento/config/OnboardingPruebaConfig";
import type { ConfigSectionHandle } from "@/features/rrhh/components/reclutamiento/config/tipos";

// ============================================================
// Tipado del estado local
//
// Ya no existen "modos" (básico/estándar/avanzado/personalizado): cada
// submódulo es configuración normal. Internamente seguimos guardando la
// regla como "personalizado" + lista de campos obligatorios, que es lo
// que consumen los formularios al validar.
// ============================================================

type ReglaKey = string;
const claveSub = (modulo: string, submodulo: string): ReglaKey => `${modulo}|${submodulo}`;

interface ReglaLocalSub {
  camposObligatorios: string[];
}

/** Campos obligatorios efectivos de una regla guardada (resuelve filas antiguas). */
function reglaToCampos(submodulo: SubmoduloDef, row: ReglaSubmoduloRow | undefined): ReglaLocalSub {
  return { camposObligatorios: camposObligatoriosEfectivos(submodulo, row) };
}

// ============================================================
// Checklist de campos obligatorios — siempre editable
// ============================================================

function ChecklistCampos({
  submodulo,
  camposObligatorios,
  onToggle,
}: {
  submodulo: SubmoduloDef;
  camposObligatorios: string[];
  onToggle: (campoKey: string) => void;
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

  const exigidos = new Set(camposObligatorios);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Marca los campos obligatorios
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {submodulo.campos.map((campo) => {
          const activo = exigidos.has(campo.key);
          return (
            <button
              key={campo.key}
              type="button"
              onClick={() => onToggle(campo.key)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all cursor-pointer ${
                activo
                  ? "border-primary/50 bg-primary/5 hover:shadow-sm"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                  activo ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}
              >
                {activo && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
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

interface ReclutamientoRefs {
  gestoria: React.RefObject<ConfigSectionHandle | null>;
  onboarding: React.RefObject<ConfigSectionHandle | null>;
  general: React.RefObject<ConfigSectionHandle | null>;
}

function SubmoduloRow({
  submodulo,
  reglaSub,
  onChangeRegla,
  reclutamientoRefs,
}: {
  submodulo: SubmoduloDef;
  reglaSub: ReglaLocalSub;
  onChangeRegla: (r: ReglaLocalSub) => void;
  reclutamientoRefs?: ReclutamientoRefs;
}) {
  const [open, setOpen] = useState(false);

  const toggleCampo = (campoKey: string) => {
    const set = new Set(reglaSub.camposObligatorios);
    if (set.has(campoKey)) set.delete(campoKey);
    else set.add(campoKey);
    onChangeRegla({ camposObligatorios: Array.from(set) });
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
        <span className="text-sm font-medium flex-1">{submodulo.label}</span>
        {submodulo.placeholder &&
          !["solicitudes", "fichajes", "pagos", "jornadas", "contratos"].includes(submodulo.key) && (
            <Badge variant="outline" className="text-[9px] text-muted-foreground">
              PRÓXIMAMENTE
            </Badge>
          )}
      </button>

      {/* Reclutamiento: sus secciones exponen un ref imperativo (guardar/hayCambios)
          que el botón «Guardar» global recorre. Se mantienen MONTADAS aunque el
          acordeón esté cerrado (se ocultan con CSS), no con `{open && …}`: si se
          desmontaran al colapsar, el ref quedaría a null, el estado tecleado (p. ej.
          el email de la gestoría) se destruiría y el guardado global lo saltaría en
          silencio dejando el dato sin persistir. El resto de submódulos no tienen
          ref, así que conservan su montaje perezoso (solo al abrir). */}
      {submodulo.key === "reclutamiento" ? (
        <div className={open ? "border-t px-3 py-3 space-y-3" : "hidden"}>
          <ChecklistCampos
            submodulo={submodulo}
            camposObligatorios={reglaSub.camposObligatorios}
            onToggle={toggleCampo}
          />
          <div className="border-t pt-3">
            <GestoriaConfig embedded ref={reclutamientoRefs?.gestoria} />
          </div>
          <div className="border-t pt-3">
            <OnboardingPruebaConfig embedded ref={reclutamientoRefs?.onboarding} />
          </div>
          <div className="border-t pt-3">
            <ConfigGeneralConfig embedded ref={reclutamientoRefs?.general} />
          </div>
        </div>
      ) : open ? (
        <div className="border-t px-3 py-3 space-y-3">
          {submodulo.key === "solicitudes" ? (
            <ValidadoresSolicitudesConfig embedded />
          ) : submodulo.key === "fichajes" ? (
            <FichajesConfigPanel embedded />
          ) : submodulo.key === "pagos" ? (
            <NotifLiquidacionesConfigPanel embedded />
          ) : submodulo.key === "jornadas" ? (
            <JornadasVacantesPanel />
          ) : submodulo.key === "contratos" ? (
            <TiposContratoPanel />
          ) : (
            <>
              <ChecklistCampos
                submodulo={submodulo}
                camposObligatorios={reglaSub.camposObligatorios}
                onToggle={toggleCampo}
              />

              {submodulo.key === "proveedores" && <OperativaCompraProveedores />}

              {submodulo.key === "productos" && <IvaDefaultConfig />}
            </>
          )}
        </div>
      ) : null}
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

  const [reglasSub, setReglasSub] = useState<Map<ReglaKey, ReglaLocalSub>>(new Map());
  const [reglasSubIniciales, setReglasSubIniciales] = useState<Map<ReglaKey, ReglaLocalSub>>(new Map());
  // True si en BD la regla a nivel módulo NO es "personalizado": al guardar
  // hay que fijarla a personalizado para que los submódulos surtan efecto.
  const [moduloNoPersonalizado, setModuloNoPersonalizado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Secciones de Reclutamiento embebidas: guardan vía handle imperativo para
  // que el botón «Guardar» del panel las persista junto con los campos
  // obligatorios (un único botón en lugar de cuatro).
  const reclutamientoRefs = useRef<ReclutamientoRefs>({
    gestoria: { current: null },
    onboarding: { current: null },
    general: { current: null },
  }).current;
  const tieneReclutamiento = useMemo(
    () => !!modulo?.submodulos.some((s) => s.key === "reclutamiento"),
    [modulo],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReglasSubmodulo(empresaDbId).then((rows) => {
      if (cancelled) return;
      const mod = CATALOGO.find((m) => m.key === moduloKey);
      const byKey = new Map<string, ReglaSubmoduloRow>();
      let moduloModo = "personalizado";
      for (const r of rows) {
        if (r.modulo !== moduloKey) continue;
        if (r.submodulo === REGLA_MODULO_SENTINEL) moduloModo = r.modo;
        else byKey.set(r.submodulo, r);
      }
      const subMap = new Map<ReglaKey, ReglaLocalSub>();
      for (const sub of mod?.submodulos ?? []) {
        subMap.set(claveSub(moduloKey, sub.key), reglaToCampos(sub, byKey.get(sub.key)));
      }
      setReglasSub(new Map(subMap));
      setReglasSubIniciales(new Map(subMap));
      setModuloNoPersonalizado(moduloModo !== "personalizado");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [empresaDbId, moduloKey]);

  const hayCambios = useMemo(() => {
    if (!modulo) return false;
    for (const sub of modulo.submodulos) {
      const k = claveSub(modulo.key, sub.key);
      const a = reglasSub.get(k)?.camposObligatorios ?? [];
      const i = reglasSubIniciales.get(k)?.camposObligatorios ?? [];
      if (a.join(",") !== i.join(",")) return true;
    }
    return false;
  }, [modulo, reglasSub, reglasSubIniciales]);

  if (!modulo) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        No hay catálogo definido para este departamento.
      </div>
    );
  }

  const getReglaSub = (subKey: string): ReglaLocalSub =>
    reglasSub.get(claveSub(modulo.key, subKey)) ?? { camposObligatorios: [] };

  const setReglaSub = (subKey: string, r: ReglaLocalSub) => {
    const next = new Map(reglasSub);
    next.set(claveSub(modulo.key, subKey), r);
    setReglasSub(next);
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const tareas: Promise<{ data?: ReglaSubmoduloRow; error?: string }>[] = [];

      // Asegura que el módulo quede en "personalizado" para que las reglas
      // por submódulo tengan efecto en los formularios.
      if (moduloNoPersonalizado) {
        tareas.push(
          upsertReglaSubmodulo({
            modulo: modulo.key,
            submodulo: REGLA_MODULO_SENTINEL,
            modo: "personalizado",
            camposObligatorios: [],
            empresaId: empresaDbId,
          }),
        );
      }

      for (const sub of modulo.submodulos) {
        const k = claveSub(modulo.key, sub.key);
        const a = reglasSub.get(k)?.camposObligatorios ?? [];
        const i = reglasSubIniciales.get(k)?.camposObligatorios ?? [];
        if (a.join(",") !== i.join(",")) {
          tareas.push(
            upsertReglaSubmodulo({
              modulo: modulo.key,
              submodulo: sub.key,
              modo: "personalizado",
              camposObligatorios: a,
              empresaId: empresaDbId,
            }),
          );
        }
      }

      // Secciones de Reclutamiento (gestoría, onboarding, config general):
      // cada handle guarda sólo si tiene cambios y devuelve si fue bien.
      const handles = tieneReclutamiento
        ? [
            reclutamientoRefs.gestoria.current,
            reclutamientoRefs.onboarding.current,
            reclutamientoRefs.general.current,
          ].filter((h): h is ConfigSectionHandle => h != null)
        : [];
      const hayCambiosReclutamiento = handles.some((h) => h.hayCambios());

      if (tareas.length === 0 && !hayCambiosReclutamiento) {
        toast.info("No hay cambios pendientes");
        return;
      }

      const [resultados, oks] = await Promise.all([
        Promise.all(tareas),
        Promise.all(handles.map((h) => h.guardar())),
      ]);

      const errores = resultados.filter((r) => r.error);
      if (errores.length > 0) {
        toast.error(`Error al guardar: ${errores[0].error}`);
        return;
      }
      if (oks.some((ok) => !ok)) {
        // El handle que falló ya mostró su propio toast de error.
        return;
      }

      setReglasSubIniciales(new Map(reglasSub));
      setModuloNoPersonalizado(false);
      toast.success("Configuración guardada");
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

  return (
    <div className="space-y-3">
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
              onChangeRegla={(r) => setReglaSub(sub.key, r)}
              reclutamientoRefs={tieneReclutamiento ? reclutamientoRefs : undefined}
            />
          ))}
        </div>
      </div>

      {/* Botón guardar único — persiste campos obligatorios + (si aplica) las
          secciones de Reclutamiento embebidas. En módulos con Reclutamiento el
          botón queda siempre activo: los cambios de esas secciones no se
          reflejan en `hayCambios` y la propia acción decide si hay algo que
          guardar. */}
      <div className="flex justify-end pt-2 border-t">
        <Button
          size="sm"
          onClick={guardar}
          disabled={saving || (!hayCambios && !tieneReclutamiento)}
        >
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
