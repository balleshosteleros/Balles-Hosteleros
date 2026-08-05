"use client";

/**
 * Subir albarán por foto (la ENTRADA del asistente de albaranes — decisión Iván 29-jul).
 *
 * Flujo (P1 de Iván: SIEMPRE hay pantalla de verificación antes de guardar):
 *   1. elegir     → adjuntar archivo o hacer foto (mismo patrón que AlbaranUploadModal).
 *   2. analizando → OCR extractivo con Gemini (`analizarAlbaranFoto`) + emparejado contra
 *                   el catálogo (`emparejarLineasAlbaran`) para pre-ligar lo reconocido.
 *   3. verificar  → cabecera editable (proveedor/fecha/nº) + tabla de líneas con cantidad
 *                   y precio editables. Al guardar: `createAlbaran({estado:"Revisión"})`
 *                   (NO suma stock) + foto adjunta. La resolución fina (vincular/crear/
 *                   ignorar) se hace después en el detalle con AsistenteAlbaranPanel.
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Upload, FileImage, Loader2, X, CheckCircle2, HelpCircle } from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { useSubirAlbaran } from "@/features/logistica/hooks/use-subir-albaran";
import { ProveedorCombobox } from "@/features/logistica/components/productos/ProveedorCombobox";
import { MesaIncidenciasDialog } from "@/features/logistica/components/albaranes/MesaIncidenciasDialog";
import { formatNumero } from "@/shared/lib/numero";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama con el id del albarán recién creado (en estado Revisión). */
  onCreado: (albaranId: string) => void;
}

export function SubirAlbaranDialog({ open, onOpenChange, onCreado }: Props) {
  const { empresaActual } = useEmpresa();
  const { profile } = useAuth();
  const [motivoOverride, setMotivoOverride] = useState("");

  const {
    paso,
    file,
    preview,
    fallo,
    duplicado,
    setDuplicado,
    cabecera,
    proveedor,
    setProveedor,
    fecha,
    setFecha,
    numeroProveedor,
    setNumeroProveedor,
    lineas,
    ligadas,
    totalLineas,
    nReconocidas,
    incidenciasAbiertas,
    vinculosAutomaticos,
    proveedorIdentificado,
    resolverIncidencias,
    handleFile,
    analizar,
    reintentar,
    setLineaCampo,
    guardar,
    reset,
    setFile,
    setPreview,
  } = useSubirAlbaran({
    fechaPorDefecto: hoyEnZona(empresaActual.zonaHoraria),
    creador: profile?.nombre ?? "",
    onCreado: (id) => {
      onOpenChange(false);
      onCreado(id);
    },
  });

  // PRP-074 — la mesa se abre sola al terminar el análisis SI hay algo que aclarar.
  // Si el albarán está limpio no aparece: no se añade fricción a lo que ya funciona.
  const [mesaCerrada, setMesaCerrada] = useState(false);
  const mesaAbierta = paso === "verificar" && incidenciasAbiertas.length > 0 && !mesaCerrada;

  const handleClose = (o: boolean) => {
    if (!o && paso !== "subiendo" && paso !== "analizando" && paso !== "guardando") {
      reset();
      setMesaCerrada(false);
      onOpenChange(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={paso === "verificar" ? "sm:max-w-3xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Subir albarán</DialogTitle>
        </DialogHeader>

        {paso === "elegir" && !preview && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
              <Upload className="h-10 w-10 text-primary" />
              <span className="text-sm font-semibold text-foreground">Adjuntar archivo</span>
              <span className="text-xs text-muted-foreground text-center">PDF o foto del albarán</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
              <Camera className="h-10 w-10 text-primary" />
              <span className="text-sm font-semibold text-foreground">Abrir cámara</span>
              <span className="text-xs text-muted-foreground text-center">Hacer foto al albarán del proveedor</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        )}

        {paso === "elegir" && preview && (
          <div className="space-y-4 py-2">
            <div className="relative rounded-lg overflow-hidden border bg-muted/30">
              {file?.type.startsWith("image/") ? (
                <img src={preview} alt="Preview albarán" className="w-full max-h-[300px] object-contain" />
              ) : (
                <div className="flex items-center justify-center gap-3 p-8">
                  <FileImage className="h-10 w-10 text-primary" />
                  <div>
                    <p className="font-medium text-foreground text-sm">{file?.name}</p>
                    <p className="text-xs text-muted-foreground">{((file?.size || 0) / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-7 w-7 bg-background/80 hover:bg-background"
                onClick={() => { setFile(null); setPreview(null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {fallo && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">{fallo.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Código: {fallo.traceId}</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setFile(null); setPreview(null); }}>Cambiar archivo</Button>
              <Button onClick={fallo ? reintentar : analizar} className="gap-1">
                {fallo ? "Reintentar" : "Analizar albarán"}
              </Button>
            </div>
          </div>
        )}

        {(paso === "subiendo" || paso === "analizando" || paso === "guardando") && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {paso === "subiendo"
                ? "Subiendo el documento…"
                : paso === "analizando"
                  ? "Leyendo el albarán con IA…"
                  : "Guardando el albarán…"}
            </p>
          </div>
        )}

        {paso === "verificar" && (
          <div className="space-y-4">
            {/* Cabecera editable */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Proveedor</label>
                <ProveedorCombobox value={proveedor} onChange={setProveedor} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nº albarán proveedor</label>
                <Input value={numeroProveedor} onChange={(e) => setNumeroProveedor(e.target.value)} className="h-9" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {nReconocidas} de {lineas.length} líneas reconocidas automáticamente. Las demás se
              resuelven después en el asistente (vincular / crear / ignorar).
            </p>

            {/* Líneas: cantidad y precio editables (P1: siempre se verifica lo que leyó la IA) */}
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Producto (según proveedor)</th>
                    <th className="px-3 py-2 font-medium w-24 text-right">Cantidad</th>
                    <th className="px-3 py-2 font-medium w-28 text-right">Precio ud.</th>
                    <th className="px-3 py-2 font-medium w-24 text-right">Importe</th>
                    <th className="px-3 py-2 font-medium w-32">Catálogo</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const ligado = ligadas.get(l.id)?.ligadoAuto ?? null;
                    return (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{l.nombre}</td>
                        <td className="px-3 py-1.5">
                          <Input
                            className="h-8 text-right"
                            inputMode="decimal"
                            defaultValue={String(l.cantidad)}
                            onBlur={(e) => setLineaCampo(l.id, "cantidad", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            className="h-8 text-right"
                            inputMode="decimal"
                            defaultValue={l.precioUnitario != null ? String(l.precioUnitario) : ""}
                            onBlur={(e) => setLineaCampo(l.id, "precioUnitario", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatNumero(l.importe ?? (l.precioUnitario ?? 0) * l.cantidad)}
                        </td>
                        <td className="px-3 py-1.5">
                          {ligado ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> {ligado.nombre}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                              <HelpCircle className="h-3.5 w-3.5" /> Sin reconocer
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {duplicado && (
              <div className="space-y-2 rounded-lg border border-orange-300 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/30">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  Posible duplicado: ya existe el albarán {duplicado.numero} de {duplicado.proveedorNombre}
                  {duplicado.numeroProveedor ? ` (nº proveedor ${duplicado.numeroProveedor})` : ""} con fecha{" "}
                  {duplicado.fecha}.
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  Si es el mismo papel, no lo registres otra vez. Si de verdad es otro documento, explica
                  por qué y registra.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Motivo (obligatorio para registrar)"
                    value={motivoOverride}
                    onChange={(e) => setMotivoOverride(e.target.value)}
                    className="h-9 bg-background"
                  />
                  <Button variant="outline" onClick={() => { setDuplicado(null); setMotivoOverride(""); }}>
                    Revisar datos
                  </Button>
                  <Button
                    disabled={!motivoOverride.trim()}
                    onClick={() => guardar({ posibleDuplicadoDe: duplicado.id, motivo: motivoOverride.trim() })}
                  >
                    Registrar de todos modos
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Suma de líneas: <span className="font-semibold tabular-nums">{formatNumero(totalLineas)} €</span>
                {cabecera.total != null && Math.abs(cabecera.total - totalLineas) > 0.05 && (
                  <span className="ml-2 text-orange-600">
                    (el documento dice {formatNumero(cabecera.total)} € — revisa cantidades/precios)
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                {incidenciasAbiertas.length > 0 && (
                  <Button variant="outline" onClick={() => setMesaCerrada(false)}>
                    Ver lo que no cuadra ({incidenciasAbiertas.length})
                  </Button>
                )}
                <Button variant="outline" onClick={() => { reset(); }}>Empezar de nuevo</Button>
                <Button onClick={() => guardar()} disabled={!!duplicado}>Guardar en Revisión</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <MesaIncidenciasDialog
      open={mesaAbierta}
      onOpenChange={(o) => setMesaCerrada(!o)}
      incidencias={incidenciasAbiertas}
      vinculosAutomaticos={vinculosAutomaticos}
      proveedorNombre={proveedorIdentificado ?? proveedor}
      numeroAlbaran={numeroProveedor}
      onResolver={async (decisiones) => {
        await resolverIncidencias(decisiones);
        setMesaCerrada(true);
      }}
      onGuardarYSalir={() => setMesaCerrada(true)}
    />
    </>
  );
}
