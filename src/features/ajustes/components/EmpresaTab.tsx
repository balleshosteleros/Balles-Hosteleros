"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ConfiguracionTab, type ConfiguracionTabHandle } from "@/features/ajustes/components/ConfiguracionTab";
import { LocalesEmpresaTab } from "@/features/ajustes/components/locales/LocalesEmpresaTab";
import { AlmacenamientoEmpresa } from "@/features/ajustes/components/AlmacenamientoTab";
import { CrearEmpresaModal } from "@/features/ajustes/components/CrearEmpresaModal";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Plus, Trash2, AlertTriangle, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import {
  deleteEmpresa,
  cancelarEliminacionEmpresa,
  getEmpresaEliminacion,
} from "@/features/empresa/actions/empresas-actions";
import { EMPRESA_RETENCION_DIAS } from "@/features/empresa/constants";

/**
 * Editor de la empresa ACTIVA. Los tres botones (Guardar, Crear nueva empresa,
 * Borrar empresa) viven juntos al final. Los avisos (30 días al borrar, info al
 * crear) aparecen solo en pop-up al pulsar.
 */
export function EmpresaTab() {
  const { empresaActual } = useEmpresa();
  const dbId = empresaActual.dbId;
  const configRef = useRef<ConfiguracionTabHandle>(null);

  const [savingCfg, setSavingCfg] = useState(false);
  const [avisoCrear, setAvisoCrear] = useState(false);
  const [crearOpen, setCrearOpen] = useState(false);
  const [confirm1, setConfirm1] = useState(false);
  const [confirm2, setConfirm2] = useState(false);
  const [working, setWorking] = useState(false);
  const [programadaEn, setProgramadaEn] = useState<string | null>(null);

  const cargarEliminacion = useCallback(async () => {
    if (!dbId) {
      setProgramadaEn(null);
      return;
    }
    const { programadaEn } = await getEmpresaEliminacion(dbId);
    setProgramadaEn(programadaEn);
  }, [dbId]);

  useEffect(() => {
    cargarEliminacion();
  }, [cargarEliminacion]);

  const handleGuardar = async () => {
    setSavingCfg(true);
    try {
      await configRef.current?.save();
    } finally {
      setSavingCfg(false);
    }
  };

  const handleBorrar = async () => {
    if (!dbId) {
      toast.error("Empresa no sincronizada con la base de datos");
      return;
    }
    setWorking(true);
    try {
      const res = await deleteEmpresa(dbId);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo borrar la empresa");
        return;
      }
      toast.success(
        `Empresa marcada para eliminación. Seguirá accesible ${EMPRESA_RETENCION_DIAS} días; después se borrará todo automáticamente.`,
      );
      setConfirm2(false);
      await cargarEliminacion();
    } finally {
      setWorking(false);
    }
  };

  const handleCancelar = async () => {
    if (!dbId) return;
    setWorking(true);
    try {
      const res = await cancelarEliminacionEmpresa(dbId);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cancelar la eliminación");
        return;
      }
      toast.success("Eliminación cancelada. La empresa se conserva.");
      await cargarEliminacion();
    } finally {
      setWorking(false);
    }
  };

  // Días restantes hasta el borrado definitivo.
  const diasRestantes = programadaEn
    ? Math.max(
        0,
        EMPRESA_RETENCION_DIAS -
          Math.floor((Date.now() - new Date(programadaEn).getTime()) / (24 * 60 * 60 * 1000)),
      )
    : null;

  return (
    <div className="space-y-4 pb-0">
      {/* Aviso de eliminación programada (solo aparece si está marcada) */}
      {programadaEn && (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Esta empresa está marcada para eliminación. Se borrará todo automáticamente en{" "}
              <strong>{diasRestantes} {diasRestantes === 1 ? "día" : "días"}</strong>. Puedes cancelarlo mientras tanto.
            </span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCancelar} disabled={working}>
            <RotateCcw className="h-3.5 w-3.5" /> Cancelar eliminación
          </Button>
        </div>
      )}

      <ConfiguracionTab ref={configRef} hideSaveButton />
      <LocalesEmpresaTab empresaId={dbId} />
      <AlmacenamientoEmpresa />

      {/* Botonera inferior: gestión a la izquierda, Guardar a la derecha */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-2">
          <Button
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setAvisoCrear(true)}
          >
            <Plus className="h-4 w-4" /> Nueva empresa
          </Button>
          <Button
            variant="destructive"
            className="gap-1.5"
            onClick={() => setConfirm1(true)}
            disabled={!!programadaEn || !dbId}
          >
            <Trash2 className="h-4 w-4" /> Borrar empresa
          </Button>
        </div>
        <Button onClick={handleGuardar} disabled={savingCfg} className="gap-1.5">
          <Save className="h-4 w-4" /> {savingCfg ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      {/* Aviso al CREAR (pop-up, solo al pulsar) */}
      <AlertDialog open={avisoCrear} onOpenChange={setAvisoCrear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Crear una empresa nueva
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a crear una empresa desde cero. Nacerá con toda la estructura estándar del software (departamentos,
              roles, organigrama, plantillas, configuraciones base…) y tendrás que rellenar todos sus datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(ev) => { ev.preventDefault(); setAvisoCrear(false); setCrearOpen(true); }}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Formulario de alta */}
      <CrearEmpresaModal open={crearOpen} onOpenChange={setCrearOpen} />

      {/* 1ª confirmación al BORRAR (aviso de 30 días, solo al pulsar) */}
      <AlertDialog open={confirm1} onOpenChange={(o) => { if (!o) setConfirm1(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-destructive" /> ¿Borrar {empresaActual.nombre}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a iniciar la eliminación de esta empresa. Seguirá accesible {EMPRESA_RETENCION_DIAS} días y podrás
              cancelarlo; pasado ese plazo se borrará todo definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => { ev.preventDefault(); setConfirm1(false); setConfirm2(true); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2ª confirmación al BORRAR */}
      <AlertDialog open={confirm2} onOpenChange={(o) => { if (!o && !working) setConfirm2(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confírmalo una vez más
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta es la última confirmación. Se programará la eliminación de <strong>{empresaActual.nombre}</strong> y
              todos sus datos. Tras {EMPRESA_RETENCION_DIAS} días sin cancelarlo, el borrado es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => { ev.preventDefault(); handleBorrar(); }}
              disabled={working}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {working ? "Procesando…" : "Sí, borrar empresa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
