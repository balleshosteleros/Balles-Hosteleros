/**
 * Vista pública (solo lectura) de un estudio de apertura.
 * Server component — no requiere JS de cliente.
 *
 * Muestra todas las secciones del estudio en formato presentable
 * para socio / inversor: datos, marca, local, gastronomía, inversión,
 * costes y escenario financiero estimado.
 */
import {
  ESCENARIOS,
  calcularEscenario,
  calcularPilar,
  pilarFijo,
  pilarVariablePct,
  totalFacturacion,
} from "@/features/direccion/data/aperturas";
import type { EstudioPublico } from "@/features/direccion/services/estudio-publico-fetch";

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) : "—";
}

function eur(n: number): string {
  return `${fmt(n)} €`;
}

function recuperacion(meses: number): string {
  if (!Number.isFinite(meses) || meses <= 0) return "—";
  const m = Math.ceil(meses);
  const anos = Math.floor(m / 12);
  const rest = m % 12;
  if (anos === 0) return `${rest} ${rest === 1 ? "mes" : "meses"}`;
  if (rest === 0) return `${anos} ${anos === 1 ? "año" : "años"}`;
  return `${anos} ${anos === 1 ? "año" : "años"} ${rest} ${rest === 1 ? "mes" : "meses"}`;
}

export function EstudioPublicoView({ data }: { data: EstudioPublico }) {
  const { estudio, empresaNombre, empresaLogoUrl } = data;
  const { datos, local, imagenMarca, propuesta, procedencia, destinos, costes } = estudio;

  const ventasMensuales = totalFacturacion(estudio.facturacion) || datos.ventasEstimadas || 0;
  const escenarios = ESCENARIOS.map(e => ({ ...e, ...calcularEscenario(ventasMensuales, e.factor, costes) }));
  const medio = escenarios[2];
  const inversionTotal = procedencia.reduce((s, l) => s + (l.total || 0), 0);
  const beneficioMensual = medio.beneficio;
  const beneficioAnual = beneficioMensual * 12;
  const facturacionAnual = medio.facturacion * 12;
  const tieneInversion = inversionTotal > 0;
  const roiAnualPct = tieneInversion ? (beneficioAnual / inversionTotal) * 100 : 0;
  const recupera = tieneInversion && beneficioMensual > 0 ? inversionTotal / beneficioMensual : Infinity;

  const fotosFachada = local.fotos?.fachada ?? [];
  const fotosInterior = local.fotos?.interior ?? [];
  const galeria = [...fotosFachada, ...fotosInterior, ...(local.fotos?.terraza ?? []), ...(local.fotos?.cocina ?? [])]
    .filter(f => f.url)
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Cabecera empresa ── */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          {empresaLogoUrl ? (
            <img src={empresaLogoUrl} alt={empresaNombre} className="h-9 w-auto" />
          ) : null}
          <div className="text-sm font-medium text-slate-600">{empresaNombre}</div>
          <div className="ml-auto text-xs text-slate-400">Estudio de viabilidad · solo lectura</div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estudio.viabilidad === "viable" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {estudio.viabilidad === "viable" ? "Viable" : "No viable"}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estudio.actividad === "activo" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                {estudio.actividad === "activo" ? "Activo" : "No activo"}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">{datos.nombre}</h1>
            <p className="text-slate-600 text-lg">
              {datos.ciudad}{datos.zona ? ` · ${datos.zona}` : ""}
            </p>
            {imagenMarca.claim ? (
              <p className="text-xl italic text-slate-700">"{imagenMarca.claim}"</p>
            ) : null}
          </div>
          {estudio.imagen ? (
            <img
              src={estudio.imagen}
              alt={datos.nombre}
              className="w-full md:w-80 h-56 object-cover rounded-xl border shadow-sm"
            />
          ) : null}
        </div>
      </section>

      {/* ── KPIs principales ── */}
      <section className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Inversión total" value={tieneInversion ? eur(inversionTotal) : "—"} />
          <Kpi label="Facturación / año" value={eur(facturacionAnual)} hint="Escenario estimado" />
          <Kpi label="Beneficio / año" value={eur(beneficioAnual)} positive={beneficioAnual >= 0} />
          <Kpi label="ROI anual" value={tieneInversion ? `${roiAnualPct.toFixed(1)}%` : "—"} positive={tieneInversion && roiAnualPct >= 0} />
        </div>
        {tieneInversion ? (
          <p className="text-sm text-slate-500 mt-3">
            Recuperación de la inversión: <strong>{recuperacion(recupera)}</strong> en escenario estimado.
          </p>
        ) : null}
      </section>

      {/* ── Datos del proyecto ── */}
      <Section title="Datos del proyecto">
        <Grid>
          <Row label="Población" value={fmt(datos.poblacion)} />
          <Row label="Afluencia" value={datos.afluencia || "—"} />
          <Row label="Tipo de local" value={datos.tipoLocal || "—"} />
          <Row label="Metros cuadrados" value={`${fmt(datos.metrosCuadrados)} m²`} />
          <Row label="Ticket medio" value={eur(datos.ticketMedio)} />
          <Row label="Clientes estimados" value={fmt(datos.clientesEstimados)} />
          <Row label="Estacionalidad" value={datos.estacionalidad || "—"} />
          <Row label="Competencia" value={datos.competencia || "—"} />
        </Grid>
        {datos.observaciones ? (
          <p className="mt-4 text-sm text-slate-600 whitespace-pre-line">{datos.observaciones}</p>
        ) : null}
      </Section>

      {/* ── Imagen de marca ── */}
      {(imagenMarca.descripcion || imagenMarca.logoUrl || imagenMarca.paleta?.length) ? (
        <Section title="Imagen de marca">
          <div className="flex flex-col md:flex-row gap-6">
            {imagenMarca.logoUrl ? (
              <img src={imagenMarca.logoUrl} alt="Logo" className="h-32 w-32 object-contain rounded-lg bg-white border p-3" />
            ) : null}
            <div className="flex-1 space-y-3">
              {imagenMarca.descripcion ? (
                <p className="text-slate-700 whitespace-pre-line">{imagenMarca.descripcion}</p>
              ) : null}
              {imagenMarca.publicoObjetivo ? (
                <Row label="Público objetivo" value={imagenMarca.publicoObjetivo} />
              ) : null}
              {imagenMarca.valores?.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {imagenMarca.valores.map((v, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{v}</span>
                  ))}
                </div>
              ) : null}
              {imagenMarca.paleta?.length ? (
                <div className="flex flex-wrap gap-3 pt-2">
                  {imagenMarca.paleta.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-md border" style={{ backgroundColor: c.hex }} />
                      <div className="text-xs">
                        <div className="font-medium">{c.nombre}</div>
                        <div className="text-slate-500">{c.hex}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── Local ── */}
      <Section title="El local">
        <Grid>
          <Row label="Tipo" value={local.caracteristicas?.tipoEstablecimiento || "—"} />
          <Row label="Metros útiles" value={local.caracteristicas?.metrosUtiles ? `${fmt(local.caracteristicas.metrosUtiles)} m²` : "—"} />
          <Row label="Metros terraza" value={local.caracteristicas?.metrosTerraza ? `${fmt(local.caracteristicas.metrosTerraza)} m²` : "—"} />
          <Row label="Plazas interior" value={fmt(local.caracteristicas?.plazasInterior ?? 0)} />
          <Row label="Plazas terraza" value={fmt(local.caracteristicas?.plazasTerraza ?? 0)} />
          <Row label="Aseos" value={fmt(local.caracteristicas?.banos ?? 0)} />
          <Row label="Estado" value={local.caracteristicas?.estadoLocal || "—"} />
          <Row label="Licencia" value={local.caracteristicas?.licenciaActividad || "—"} />
          <Row label="Salida humos" value={local.caracteristicas?.salidaHumos || "—"} />
          <Row label="Alquiler mensual" value={local.caracteristicas?.alquilerMensual ? eur(local.caracteristicas.alquilerMensual) : "—"} />
          <Row label="Traspaso" value={local.caracteristicas?.traspaso ? eur(local.caracteristicas.traspaso) : "—"} />
          <Row label="Duración contrato" value={local.caracteristicas?.duracionContrato || "—"} />
        </Grid>
        {local.ubicacion?.direccion ? (
          <p className="mt-4 text-sm text-slate-600">
            <strong className="text-slate-700">Dirección:</strong>{" "}
            {local.ubicacion.direccion}
            {local.ubicacion.codigoPostal ? `, ${local.ubicacion.codigoPostal}` : ""}
            {local.ubicacion.ciudad ? `, ${local.ubicacion.ciudad}` : ""}
          </p>
        ) : null}
        {galeria.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {galeria.map(f => (
              <img key={f.id} src={f.url} alt="" className="w-full h-32 object-cover rounded-lg border" />
            ))}
          </div>
        ) : null}
      </Section>

      {/* ── Gastronomía ── */}
      {(propuesta.concepto || propuesta.descripcion || propuesta.platos?.length) ? (
        <Section title="Propuesta gastronómica">
          <Grid>
            <Row label="Concepto" value={propuesta.concepto || "—"} />
            <Row label="Estilo de servicio" value={propuesta.estiloServicio || "—"} />
            <Row label="Rango de precio" value={propuesta.rangoPrecioMedio || "—"} />
            <Row label="Platos en carta" value={propuesta.numeroPlatosCarta ? fmt(propuesta.numeroPlatosCarta) : "—"} />
          </Grid>
          {propuesta.descripcion ? (
            <p className="mt-4 text-slate-700 whitespace-pre-line">{propuesta.descripcion}</p>
          ) : null}
          {propuesta.platos?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
              {propuesta.platos.map(p => (
                <div key={p.id} className="rounded-lg border bg-white overflow-hidden">
                  {p.foto?.url ? (
                    <img src={p.foto.url} alt={p.nombre} className="w-full h-40 object-cover" />
                  ) : null}
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{p.nombre}</strong>
                      <span className="text-sm font-semibold text-slate-700">{eur(p.precio)}</span>
                    </div>
                    {p.categoria ? <div className="text-xs text-slate-500">{p.categoria}</div> : null}
                    {p.descripcion ? <p className="text-xs text-slate-600">{p.descripcion}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* ── Inversión ── */}
      {procedencia.length > 0 ? (
        <Section title="Procedencia del capital">
          <Tabla
            cabeceras={["Origen", "Entidad", "Destino", "Total"]}
            filas={procedencia.map(l => [l.origen || "—", l.entidad || "—", l.destino || "—", eur(l.total || 0)])}
            totales={["", "", "Total", eur(inversionTotal)]}
          />
        </Section>
      ) : null}

      {destinos.length > 0 ? (
        <Section title="Destino de la inversión">
          <Tabla
            cabeceras={["Categoría", "Concepto", "Destino", "Total"]}
            filas={destinos.map(l => [l.tipo || "—", l.concepto || "—", l.destino || "—", eur(l.total || 0)])}
          />
        </Section>
      ) : null}

      {/* ── Costes ── */}
      <Section title="Estructura de costes (escenario estimado)">
        <Grid>
          {(["generales", "personal", "producto", "marketing"] as const).map(k => {
            const total = calcularPilar(medio.facturacion, costes[k]);
            return (
              <div key={k} className="rounded-lg border bg-white p-4 space-y-1">
                <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
                <div className="text-xl font-bold">{eur(total)}</div>
                <div className="text-xs text-slate-500">
                  Fijo {eur(pilarFijo(costes[k]))} · Variable {pilarVariablePct(costes[k]).toFixed(1)}%
                </div>
              </div>
            );
          })}
        </Grid>
      </Section>

      {/* ── Escenarios ── */}
      <Section title="Escenarios financieros">
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Escenario</th>
                <th className="text-right px-3 py-2">Facturación</th>
                <th className="text-right px-3 py-2">Coste total</th>
                <th className="text-right px-3 py-2">Beneficio</th>
                <th className="text-right px-3 py-2">Margen</th>
              </tr>
            </thead>
            <tbody>
              {escenarios.map((e, i) => (
                <tr key={i} className={`border-t ${i === 2 ? "bg-blue-50/50" : ""}`}>
                  <td className="px-3 py-2 font-medium">{e.nombre}</td>
                  <td className="px-3 py-2 text-right">{eur(e.facturacion)}</td>
                  <td className="px-3 py-2 text-right">{eur(e.costeTotal)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${e.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{eur(e.beneficio)}</td>
                  <td className={`px-3 py-2 text-right ${e.margen >= 0 ? "text-green-600" : "text-red-600"}`}>{e.margen.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">Cifras mensuales. El escenario "Estimado" es el caso base.</p>
      </Section>

      {/* ── Footer ── */}
      <footer className="max-w-5xl mx-auto px-6 py-10 text-center text-xs text-slate-400">
        Documento confidencial · {empresaNombre}
      </footer>
    </main>
  );
}

/* ── Subcomponentes presentacionales ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-8">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white border px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function Kpi({ label, value, hint, positive }: { label: string; value: string; hint?: string; positive?: boolean }) {
  return (
    <div className="rounded-xl bg-white border p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${positive === undefined ? "" : positive ? "text-green-600" : "text-red-600"}`}>{value}</div>
      {hint ? <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div> : null}
    </div>
  );
}

function Tabla({
  cabeceras,
  filas,
  totales,
}: {
  cabeceras: string[];
  filas: string[][];
  totales?: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
          <tr>
            {cabeceras.map((c, i) => (
              <th key={i} className={`px-3 py-2 ${i === cabeceras.length - 1 ? "text-right" : "text-left"}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, r) => (
            <tr key={r} className="border-t">
              {fila.map((celda, c) => (
                <td key={c} className={`px-3 py-2 ${c === fila.length - 1 ? "text-right font-medium" : ""}`}>{celda}</td>
              ))}
            </tr>
          ))}
          {totales ? (
            <tr className="border-t bg-slate-50 font-semibold">
              {totales.map((t, i) => (
                <td key={i} className={`px-3 py-2 ${i === totales.length - 1 ? "text-right" : ""}`}>{t}</td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
