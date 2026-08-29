"use client";

// ACCESOS Y CONTRASEÑAS (Ajustes → Herramientas → Accesos)
//
// Separación deliberada respecto a "Aplicaciones":
//  · APLICACIONES (cohete) → el ENLACE: nombre, logo, URL, categoría, quién la ve.
//  · ACCESOS (candado)     → las CREDENCIALES: usuario, contraseña, datos extra
//                            (PIN, PUK…) y qué roles pueden revelarlas.
//
// Aquí NO se crean ni se borran aplicaciones: se eligen de las ya existentes y
// se editan solo sus credenciales. Las contraseñas nunca viajan en claro al
// cliente; se revelan una a una con verificación de identidad (revelarAccesoApp).

import { useEffect, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Eye, Copy, Search, ChevronDown, X, ArrowUpRight, Check } from "lucide-react";
import { GoogleIcon } from "@/shared/components/GoogleIcon";
import {
  type AccesoApp,
  type AccesoCredencial,
  type DatoExtra,
  MAX_ACCESOS_POR_APP,
  MAX_DATOS_EXTRA_POR_ACCESO,
} from "@/features/rrhh/data/accesos-apps";
import {
  listAllAccesosApps,
  createAccesoApp,
  updateAccesoApp,
  revelarAccesoApp,
} from "@/features/rrhh/actions/accesos-apps-actions";
import {
  VerificacionAccesosProvider,
  useVerificacionAccesos,
} from "@/features/rrhh/components/useVerificacionAccesos";
import { getRolesEmpresaNombres } from "@/features/ajustes/actions/roles-actions";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { AppLogo } from "@/features/ajustes/components/AppLogo";

const accesoVacio: AccesoCredencial = {
  etiqueta: "",
  usuario: "",
  contrasena: "",
  accesoGoogle: false,
  roles: [],
  datosExtra: [],
};

function PasswordAdmin({
  appId,
  indice,
  tiene,
  nombreExtra,
}: {
  appId: string;
  indice: number;
  tiene: boolean;
  nombreExtra?: string;
}) {
  const { ensureVerificado } = useVerificacionAccesos();
  const [valor, setValor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Oculta el valor revelado tras 10s.
  useEffect(() => {
    if (valor === null) return;
    const t = setTimeout(() => setValor(null), 10_000);
    return () => clearTimeout(t);
  }, [valor]);

  if (!tiene) return <span className="text-muted-foreground text-xs">—</span>;

  const revelar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const ok = await ensureVerificado();
      if (!ok) return;
      const res = await revelarAccesoApp(appId, indice, nombreExtra);
      if (res.ok) {
        setValor(res.contrasena);
      } else {
        toast.error(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex min-w-0 max-w-full items-start gap-1 font-mono text-xs">
      <span className="min-w-0 break-all">{valor !== null ? valor : "••••••••"}</span>
      {valor !== null ? (
        <button
          onClick={() => {
            navigator.clipboard.writeText(valor);
            toast.success(nombreExtra ? `${nombreExtra} copiado` : "Contraseña copiada");
          }}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          title="Copiar"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={revelar}
          disabled={loading}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Ver contraseña"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

/**
 * Recuadro de la columna «Enlace».
 *  · Con URL  → verde y pulsable (abre en pestaña nueva).
 *  · Sin URL  → gris, sin cursor ni acción: no abre nada.
 */
function EnlaceCelda({ url, nombre }: { url?: string; nombre: string }) {
  const limpia = (url ?? "").trim();
  if (!limpia) {
    return (
      <span
        aria-disabled
        title="Sin enlace"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground/60"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    );
  }
  const href = limpia.startsWith("http") ? limpia : `https://${limpia}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Abrir ${nombre}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-600/40 bg-emerald-500/15 text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
    >
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

export function AccesosTab() {
  return (
    <VerificacionAccesosProvider>
      <AccesosTabInner />
    </VerificacionAccesosProvider>
  );
}

function AccesosTabInner() {
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;

  const [apps, setApps] = useState<AccesoApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [buscar, setBuscar] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AccesoApp | null>(null);
  const [accesos, setAccesos] = useState<AccesoCredencial[]>([accesoVacio]);
  const [enlace, setEnlace] = useState("");
  // Solo en alta: al editar, el nombre lo aporta la app ya existente.
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [rolesDisponibles, setRolesDisponibles] = useState<string[]>([]);
  const [rolesPopoverIdx, setRolesPopoverIdx] = useState<number>(-1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Solo la empresa activa: sin este filtro se listaban las credenciales de
    // TODAS las empresas (estando en HABANA se veían también las de BACANAL).
    listAllAccesosApps(empresaActual.id)
      .then((rows) => {
        if (alive) setApps(rows);
      })
      .catch((e) => {
        console.error(e);
        toast.error("No se pudieron cargar las contraseñas");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [empresaActual.id]);

  useEffect(() => {
    getRolesEmpresaNombres(empresaDbId)
      .then((nombres) => setRolesDisponibles(nombres))
      .catch((e) => console.error("No se pudieron cargar roles:", e));
  }, [empresaDbId]);

  const toggleRolAcceso = (idx: number, rol: string) => {
    setAccesos((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const set = new Set(a.roles ?? []);
        if (set.has(rol)) set.delete(rol);
        else set.add(rol);
        return { ...a, roles: Array.from(set) };
      }),
    );
  };

  const updateAcceso = (idx: number, patch: Partial<AccesoCredencial>) => {
    setAccesos((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };
  const removeAcceso = (idx: number) => {
    setAccesos((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ ...accesoVacio }];
    });
  };
  // Una app admite tantos accesos como haga falta (BBVA: Contabilidad,
  // Dirección, Gerencia…). Todos comparten el mismo enlace de la app.
  const addAcceso = () => {
    setAccesos((prev) => {
      if (prev.length >= MAX_ACCESOS_POR_APP) {
        toast.error(`Máximo ${MAX_ACCESOS_POR_APP} accesos por aplicación`);
        return prev;
      }
      return [...prev, { ...accesoVacio, datosExtra: [] }];
    });
  };

  // --- Datos extra de cada acceso (PIN, PUK, código empresa...) ---
  const addDatoExtra = (idxAcceso: number) => {
    setAccesos((prev) =>
      prev.map((a, i) => {
        if (i !== idxAcceso) return a;
        const actuales = a.datosExtra ?? [];
        if (actuales.length >= MAX_DATOS_EXTRA_POR_ACCESO) {
          toast.error(`Máximo ${MAX_DATOS_EXTRA_POR_ACCESO} datos por acceso`);
          return a;
        }
        return { ...a, datosExtra: [...actuales, { nombre: "", valor: "" }] };
      }),
    );
  };
  const updateDatoExtra = (idxAcceso: number, idxExtra: number, patch: Partial<DatoExtra>) => {
    setAccesos((prev) =>
      prev.map((a, i) =>
        i === idxAcceso
          ? {
              ...a,
              datosExtra: (a.datosExtra ?? []).map((d, j) => (j === idxExtra ? { ...d, ...patch } : d)),
            }
          : a,
      ),
    );
  };
  const removeDatoExtra = (idxAcceso: number, idxExtra: number) => {
    setAccesos((prev) =>
      prev.map((a, i) =>
        i === idxAcceso ? { ...a, datosExtra: (a.datosExtra ?? []).filter((_, j) => j !== idxExtra) } : a,
      ),
    );
  };

  const filteredApps = apps.filter((a) => {
    if (buscar) {
      const q = buscar.toLowerCase();
      const enNombre = a.nombre.toLowerCase().includes(q);
      const enAccesos = a.accesos.some(
        (acc) =>
          (acc.usuario ?? "").toLowerCase().includes(q) ||
          (acc.etiqueta ?? "").toLowerCase().includes(q),
      );
      if (!enNombre && !enAccesos) return false;
    }
    return true;
  });

  // Alta desde la bóveda: una entrada nueva de credenciales. El enlace es
  // opcional — sin él es una credencial suelta (caja fuerte, PIN, wifi) y no
  // aparecerá en «Aplicaciones», que solo lista las que tienen enlace web.
  const openCreate = () => {
    setEditingApp(null);
    setNombreNuevo("");
    setEnlace("");
    setAccesos([{ ...accesoVacio, datosExtra: [] }]);
    setRolesPopoverIdx(-1);
    setModalOpen(true);
  };

  const openEdit = (app: AccesoApp) => {
    setEditingApp(app);
    setNombreNuevo("");
    setEnlace(app.url ?? "");
    // Compat: apps antiguas tenían roles a nivel de app. Si un acceso no tiene
    // roles propios, hereda los roles globales de la app para no perder permisos.
    const base = app.accesos.length ? app.accesos : [{ ...accesoVacio }];
    setAccesos(
      base.map((a) => ({
        ...a,
        // La contraseña NUNCA viaja al cliente (viene oculta/cifrada). Al editar
        // se muestra vacía; si se deja vacía, la action preserva la cifrada previa.
        contrasena: "",
        roles: a.roles?.length ? a.roles : [...(app.rolesAutorizados ?? [])],
        // Datos extra: no tenemos el valor (vacío = no cambiar); conservamos
        // nombre y `tiene` para mostrar que ya hay valor guardado.
        datosExtra: (a.datosExtra ?? []).map((d) => ({
          nombre: d.nombre,
          valor: "",
          tiene: d.tiene,
        })),
      })),
    );
    setRolesPopoverIdx(-1);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // rolesAutorizados (nivel app) = unión de los roles de cada acceso.
      // Se usa como pre-filtro de visibilidad; el filtrado fino de qué acceso
      // ve cada quien se hace por acceso.
      const rolesUnion = Array.from(new Set(accesos.flatMap((a) => a.roles ?? [])));

      // Alta: crea la entrada nueva en la bóveda de la empresa activa.
      if (!editingApp) {
        const nombre = nombreNuevo.trim();
        if (!nombre) {
          toast.error("Pon un nombre");
          return;
        }
        const creada = await createAccesoApp({
          nombre,
          descripcion: "",
          url: enlace.trim(),
          icono: "🔗",
          logoUrl: undefined,
          categoria: "Otros",
          departamentos: [],
          rolesAutorizados: rolesUnion,
          accesos,
          usuario: "",
          contrasena: "",
          estado: "Activo",
          responsable: "",
          notas: "",
          tipoIntegracion: "enlace",
          empresaId: empresaActual.id,
        });
        setApps((prev) => [...prev, creada]);
        toast.success(`"${creada.nombre}" creada`);
        setModalOpen(false);
        return;
      }

      const updated = await updateAccesoApp(editingApp.id, {
        nombre: editingApp.nombre,
        descripcion: editingApp.descripcion,
        url: enlace.trim(),
        icono: editingApp.icono,
        logoUrl: editingApp.logoUrl || undefined,
        categoria: editingApp.categoria,
        departamentos: editingApp.departamentos,
        rolesAutorizados: rolesUnion,
        accesos,
        usuario: editingApp.usuario,
        contrasena: editingApp.contrasena,
        estado: editingApp.estado,
        responsable: editingApp.responsable,
        notas: editingApp.notas,
        tipoIntegracion: editingApp.tipoIntegracion,
        empresaId: editingApp.empresaId,
      });
      setApps((prev) => prev.map((a) => (a.id === editingApp.id ? updated : a)));
      toast.success(`Contraseñas de "${updated.nombre}" actualizadas`);
      setModalOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Bóveda de contraseñas de <strong>{empresaActual.nombre}</strong>. Las
        aplicaciones (nombre, enlace, logo) se dan de alta en «Aplicaciones»;
        aquí solo se guardan sus credenciales y se decide qué roles pueden
        verlas. Para ver las de otra empresa, cambia de empresa arriba.
      </p>

      {/* Cabecera idéntica a «Aplicaciones»: buscador a la izquierda y el
          botón «Nuevo» pequeño a la derecha, ambos en la misma fila. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aplicación o usuario..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Aplicación</TableHead>
            <TableHead>Datos</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead className="w-16 text-center">Enlace</TableHead>
            <TableHead className="text-right w-16">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                <LoadingSpinner />
              </TableCell>
            </TableRow>
          )}
          {!loading && filteredApps.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                No hay aplicaciones. Créalas primero en «Aplicaciones».
              </TableCell>
            </TableRow>
          )}
          {filteredApps.map((app) => (
            <TableRow key={app.id}>
              <TableCell>
                <AppLogo nombre={app.nombre} logoUrl={app.logoUrl} />
              </TableCell>
              <TableCell>
                <div className="font-medium text-sm">{app.nombre}</div>
              </TableCell>
              <TableCell className="align-top">
                <div className="space-y-1">
                  {(app.accesos[0]?.usuario || app.usuario) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Usuario:
                      </span>
                      <span className="font-mono text-xs break-all">
                        {app.accesos[0]?.usuario || app.usuario}
                      </span>
                    </div>
                  )}
                  {app.accesos[0]?.accesoGoogle ? (
                    // Se entra con la cuenta de Google: no hay contraseña que
                    // revelar, así que se dice en vez de pintar un candado vacío.
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <GoogleIcon />
                      Acceso con Google
                    </div>
                  ) : (
                    <PasswordAdmin
                      appId={app.id}
                      indice={app.accesos[0]?.indiceReal ?? 0}
                      tiene={app.accesos[0]?.tieneContrasena ?? false}
                    />
                  )}
                  {(app.accesos[0]?.datosExtra ?? [])
                    .filter((d) => d.tiene)
                    .map((d) => (
                      <div key={d.nombre} className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {d.nombre}:
                        </span>
                        <PasswordAdmin
                          appId={app.id}
                          indice={app.accesos[0]?.indiceReal ?? 0}
                          tiene={!!d.tiene}
                          nombreExtra={d.nombre}
                        />
                      </div>
                    ))}
                  {app.accesos.length > 1 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{app.accesos.length - 1} acceso(s) más
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-wrap gap-1">
                  {(app.accesos[0]?.roles ?? app.rolesAutorizados ?? []).length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">Solo dirección</span>
                  ) : (
                    (app.accesos[0]?.roles ?? app.rolesAutorizados ?? []).map((rol) => (
                      <Badge key={rol} variant="secondary" className="text-[10px]">
                        {rol}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center align-top">
                <EnlaceCelda url={app.url} nombre={app.nombre} />
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(app)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        {filteredApps.length} de {apps.length} aplicaciones
      </p>

      {/* Modal: solo credenciales de la app seleccionada */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingApp ? `Contraseñas de ${editingApp.nombre}` : "Nueva contraseña"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {/* Solo en alta: al editar, el nombre ya lo tiene la app. */}
            {!editingApp && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nombre</Label>
                <Input
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="Ej: Caja fuerte, BBVA, Wifi del local…"
                  className="h-8 text-xs"
                />
              </div>
            )}

            {/* Enlace de la app: alimenta la columna «Enlace» de la tabla. */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Enlace</Label>
              <Input
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
                placeholder="https://… (vacío = sin enlace)"
                className="h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Si lo dejas vacío, el recuadro de la columna «Enlace» se verá en
                gris y no abrirá nada.
              </p>
            </div>

            <Label className="text-xs font-semibold">
              Accesos (usuario, contraseña y quién puede verla)
            </Label>
            <p className="text-xs text-muted-foreground">
              Marca con un tick qué roles pueden ver cada contraseña. Solo esos
              usuarios la verán y podrán revelarla. Sin ningún tick, solo la ve
              dirección.
            </p>
            <div className="space-y-2">
              {accesos.map((acc, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-md border border-border/60 p-2">
                  <div className="grid flex-1 gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Acceso {idx + 1}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        value={acc.etiqueta}
                        onChange={(e) => updateAcceso(idx, { etiqueta: e.target.value })}
                        placeholder="Etiqueta (ej: Contabilidad)"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={acc.usuario}
                        onChange={(e) => updateAcceso(idx, { usuario: e.target.value })}
                        placeholder={acc.accesoGoogle ? "correo@gmail.com" : "usuario@empresa.es"}
                        autoComplete="off"
                        className="h-8 text-xs"
                      />
                      {acc.accesoGoogle ? (
                        <div className="flex h-8 items-center gap-1.5 rounded-md border border-dashed border-input px-2.5 text-xs text-muted-foreground">
                          <GoogleIcon />
                          Se entra con Google
                        </div>
                      ) : (
                        <Input
                          value={acc.contrasena}
                          onChange={(e) => updateAcceso(idx, { contrasena: e.target.value })}
                          placeholder="Dejar vacío = no cambiar"
                          type="password"
                          autoComplete="new-password"
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                    {/* Se entra con la cuenta de Google: solo el correo, sin contraseña. */}
                    <button
                      type="button"
                      onClick={() =>
                        updateAcceso(idx, {
                          accesoGoogle: !acc.accesoGoogle,
                          // Al activarlo se limpia lo que hubiera escrito: con Google
                          // no hay contraseña. El servidor borra también la guardada.
                          ...(acc.accesoGoogle ? {} : { contrasena: "" }),
                        })
                      }
                      className={`flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        acc.accesoGoogle
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-muted-foreground hover:bg-accent/30"
                      }`}
                    >
                      <GoogleIcon />
                      Acceso con Google
                      {acc.accesoGoogle && <Check className="h-3 w-3" />}
                    </button>
                    {/* Roles que pueden ver este acceso */}
                    <Popover
                      open={rolesPopoverIdx === idx}
                      onOpenChange={(o) => setRolesPopoverIdx(o ? idx : -1)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full min-h-8 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-left hover:bg-accent/30"
                        >
                          <div className="flex flex-wrap gap-1 flex-1">
                            {(acc.roles ?? []).length === 0 ? (
                              <span className="text-muted-foreground">
                                ¿Quién puede ver esta contraseña? — marca roles…
                              </span>
                            ) : (
                              (acc.roles ?? []).map((rol) => (
                                <Badge key={rol} variant="secondary" className="gap-1 text-[10px]">
                                  {rol}
                                  <span
                                    role="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRolAcceso(idx, rol);
                                    }}
                                    className="hover:text-destructive cursor-pointer"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </span>
                                </Badge>
                              ))
                            )}
                          </div>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="max-h-64 overflow-y-auto py-1">
                          {rolesDisponibles.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              No hay roles definidos
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between px-3 py-1.5 border-b">
                                <button
                                  type="button"
                                  onClick={() => updateAcceso(idx, { roles: [...rolesDisponibles] })}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Seleccionar todos
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateAcceso(idx, { roles: [] })}
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Limpiar
                                </button>
                              </div>
                              {rolesDisponibles.map((rol) => {
                                const checked = (acc.roles ?? []).includes(rol);
                                return (
                                  <label
                                    key={rol}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/40"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => toggleRolAcceso(idx, rol)}
                                    />
                                    <span>{rol}</span>
                                  </label>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Datos extra del acceso (PIN, PUK, código empresa…) */}
                    <div className="space-y-1.5 rounded-md bg-muted/30 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Datos extra (PIN, PUK, código…)
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {(acc.datosExtra ?? []).length}/{MAX_DATOS_EXTRA_POR_ACCESO}
                        </span>
                      </div>
                      {(acc.datosExtra ?? []).map((dato, idxExtra) => (
                        <div key={idxExtra} className="flex items-center gap-2">
                          <Input
                            value={dato.nombre}
                            onChange={(e) => updateDatoExtra(idx, idxExtra, { nombre: e.target.value })}
                            placeholder="Nombre (ej: PIN)"
                            className="h-8 text-xs flex-1"
                          />
                          <Input
                            value={dato.valor}
                            onChange={(e) => updateDatoExtra(idx, idxExtra, { valor: e.target.value })}
                            placeholder={dato.tiene ? "Vacío = no cambiar" : "Valor"}
                            type="password"
                            autoComplete="new-password"
                            className="h-8 text-xs flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeDatoExtra(idx, idxExtra)}
                            title="Quitar dato extra"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => addDatoExtra(idx)}
                        disabled={(acc.datosExtra ?? []).length >= MAX_DATOS_EXTRA_POR_ACCESO}
                      >
                        <Plus className="h-3 w-3" />Dato extra
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAcceso(idx)}
                    title="Quitar acceso"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full gap-1.5 text-xs"
                onClick={addAcceso}
              >
                <Plus className="h-3.5 w-3.5" />Añadir acceso
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
