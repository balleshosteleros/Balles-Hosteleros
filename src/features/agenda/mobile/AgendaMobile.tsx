"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Wrench,
  Truck,
  Sparkles,
  Siren,
  Users,
  Tag,
  Notebook,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  CONTACTO_CATEGORIAS,
  CATEGORIA_LABELS,
  type Contacto,
  type ContactoCategoria,
  type ContactoInput,
  type Etiqueta,
} from "@/features/agenda/types";
import {
  listContactos,
  createContacto,
  listEtiquetas,
} from "@/features/agenda/actions/contactos-actions";

const CATEGORIA_ICON: Record<ContactoCategoria, React.ElementType> = {
  mantenimiento: Wrench,
  proveedores: Truck,
  servicios: Sparkles,
  emergencias: Siren,
  empleados: Users,
  otros: Tag,
};

const CATEGORIA_TINT: Record<ContactoCategoria, string> = {
  mantenimiento: "text-amber-600 bg-amber-50",
  proveedores: "text-blue-600 bg-blue-50",
  servicios: "text-violet-600 bg-violet-50",
  emergencias: "text-red-600 bg-red-50",
  empleados: "text-emerald-600 bg-emerald-50",
  otros: "text-gray-600 bg-gray-50",
};

const EMPTY_FORM: ContactoInput = {
  nombre: "",
  empresa_contacto: "",
  categoria: "proveedores",
  etiqueta_id: null,
  telefono: "",
  email: "",
  whatsapp: "",
  direccion: "",
  notas: "",
};

export function AgendaMobile() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState<ContactoCategoria | "todos">("todos");
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [form, setForm] = useState<ContactoInput>(EMPTY_FORM);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      // Independientes: si fallan las etiquetas, los contactos igualmente se ven.
      const c = await listContactos();
      setContactos(c);
      try {
        setEtiquetas(await listEtiquetas());
      } catch {
        setEtiquetas([]);
      }
    } catch {
      toast.error("Error al cargar contactos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    setEtiquetaFiltro(null);
  }, [grupo]);

  const conteos = useMemo(() => {
    const c: Record<ContactoCategoria, number> = {
      mantenimiento: 0,
      proveedores: 0,
      servicios: 0,
      emergencias: 0,
      empleados: 0,
      otros: 0,
    };
    contactos.forEach((x) => (c[x.categoria] += 1));
    return c;
  }, [contactos]);

  const etiquetaById = useMemo(() => {
    const m = new Map<string, Etiqueta>();
    etiquetas.forEach((e) => m.set(e.id, e));
    return m;
  }, [etiquetas]);

  const etiquetasGrupo = useMemo(
    () => (grupo === "todos" ? [] : etiquetas.filter((e) => e.categoria === grupo)),
    [etiquetas, grupo],
  );

  const filtrados = useMemo(() => {
    let lista = contactos;
    if (grupo !== "todos") lista = lista.filter((c) => c.categoria === grupo);
    if (etiquetaFiltro) lista = lista.filter((c) => c.etiqueta_id === etiquetaFiltro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.empresa_contacto ?? "").toLowerCase().includes(q) ||
          (c.telefono ?? "").includes(q),
      );
    }
    return lista;
  }, [contactos, grupo, etiquetaFiltro, busqueda]);

  // Agrupado por categoría cuando estamos en "Todos" (vista por etiquetas)
  const secciones = useMemo(() => {
    if (grupo !== "todos") return null;
    return CONTACTO_CATEGORIAS.map((cat) => ({
      cat,
      items: filtrados.filter((c) => c.categoria === cat),
    })).filter((s) => s.items.length > 0);
  }, [filtrados, grupo]);

  async function guardar() {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      setGuardando(true);
      const res = await createContacto(form);
      if (!res.ok) {
        toast.error(res.error ?? "Error al crear");
        return;
      }
      toast.success("Contacto creado");
      setNuevoOpen(false);
      setForm(EMPTY_FORM);
      await cargar();
    } catch {
      toast.error("Error al crear contacto");
    } finally {
      setGuardando(false);
    }
  }

  const grupos: Array<ContactoCategoria | "todos"> = ["todos", ...CONTACTO_CATEGORIAS];

  return (
    <div className="space-y-3">
      {/* Buscador + Nuevo */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar contacto…"
            className="h-10 w-full rounded-full border-0 bg-muted/60 pl-9 pr-4 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => {
            setForm({
              ...EMPTY_FORM,
              categoria: grupo === "todos" ? "proveedores" : grupo,
            });
            setNuevoOpen(true);
          }}
          className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-yellow-400 px-3 text-sm font-semibold text-yellow-950 active:bg-yellow-500"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      {/* Chips de categoría */}
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {grupos.map((g) => {
          const total = g === "todos" ? contactos.length : conteos[g];
          const activo = grupo === g;
          const Icon = g === "todos" ? Notebook : CATEGORIA_ICON[g];
          return (
            <button
              key={g}
              onClick={() => setGrupo(g)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                activo
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {g === "todos" ? "Todos" : CATEGORIA_LABELS[g]}
              <span className="tabular-nums opacity-70">{total}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-etiquetas de la categoría */}
      {grupo !== "todos" && etiquetasGrupo.length > 0 && (
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setEtiquetaFiltro(null)}
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
              etiquetaFiltro === null ? "border-foreground text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            Todas
          </button>
          {etiquetasGrupo.map((e) => (
            <button
              key={e.id}
              onClick={() => setEtiquetaFiltro(etiquetaFiltro === e.id ? null : e.id)}
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
                etiquetaFiltro === e.id ? "border-foreground text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {cargando ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : filtrados.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay contactos.
        </p>
      ) : secciones ? (
        <div className="space-y-4">
          {secciones.map((s) => (
            <div key={s.cat} className="space-y-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {CATEGORIA_LABELS[s.cat]}
              </p>
              <ul className="space-y-1.5">
                {s.items.map((c) => (
                  <FilaContacto key={c.id} c={c} etiqueta={c.etiqueta_id ? etiquetaById.get(c.etiqueta_id) : null} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtrados.map((c) => (
            <FilaContacto key={c.id} c={c} etiqueta={c.etiqueta_id ? etiquetaById.get(c.etiqueta_id) : null} />
          ))}
        </ul>
      )}

      {/* Sheet Nuevo contacto */}
      {nuevoOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40"
          onClick={() => setNuevoOpen(false)}
        >
          <div
            className="max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(env(safe-area-inset-bottom),20px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Nuevo contacto</h2>
              <button
                onClick={() => setNuevoOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Campo label="Nombre">
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Juan García"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                />
              </Campo>
              <Campo label="Categoría">
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value as ContactoCategoria })}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                >
                  {CONTACTO_CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORIA_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Teléfono">
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.telefono ?? ""}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="+34 600 000 000"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                />
              </Campo>
              <Campo label="Email">
                <input
                  type="email"
                  inputMode="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                />
              </Campo>
              <Campo label="Empresa">
                <input
                  value={form.empresa_contacto ?? ""}
                  onChange={(e) => setForm({ ...form, empresa_contacto: e.target.value })}
                  placeholder="Opcional"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                />
              </Campo>
            </div>

            <button
              onClick={guardar}
              disabled={guardando}
              className="mt-5 h-12 w-full rounded-2xl bg-yellow-400 text-sm font-semibold text-yellow-950 active:bg-yellow-500 disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar contacto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FilaContacto({ c, etiqueta }: { c: Contacto; etiqueta?: Etiqueta | null }) {
  const Icon = CATEGORIA_ICON[c.categoria];
  const sub =
    c.empresa_contacto && c.empresa_contacto !== c.nombre
      ? c.empresa_contacto
      : c.telefono ?? null;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card px-3 py-2.5">
      <div className={`shrink-0 rounded-xl p-2 ${CATEGORIA_TINT[c.categoria]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
          {c.nombre}
          {!c.activo && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">
              {c.estado_origen ?? "Inactivo"}
            </span>
          )}
        </p>
        {(sub || etiqueta) && (
          <p className="truncate text-[11px] text-muted-foreground">
            {etiqueta ? `${etiqueta.nombre}${sub ? " · " : ""}` : ""}
            {sub}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {c.email && (
          <a
            href={`mailto:${c.email}`}
            aria-label="Enviar email"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground active:bg-muted/70"
          >
            <Mail className="h-4 w-4" />
          </a>
        )}
        {c.telefono && (
          <a
            href={`tel:${c.telefono}`}
            aria-label="Llamar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white active:bg-emerald-600"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>
    </li>
  );
}
