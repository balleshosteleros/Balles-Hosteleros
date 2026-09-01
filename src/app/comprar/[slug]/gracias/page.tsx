import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCredencialesRevolut } from "@/features/sala/actions/revolut-config-actions";
import { obtenerOrden, estaPagada } from "@/lib/revolut/merchant";
import { enviarEmailCompraTicket } from "@/lib/email/tickets/enviar-compra";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import { Check, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresas").select("id, nombre").eq("slug", slug).maybeSingle();
  if (!data) return { title: "Compra" };
  return {
    title: `Compra confirmada · ${data.nombre}`,
    icons: await iconsDeEmpresa({ id: data.id as string }),
  };
}

function euros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export default async function GraciasPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ compra?: string }>;
}) {
  const { slug } = await params;
  const { compra: compraId } = await searchParams;
  if (!compraId) notFound();

  const admin = createAdminClient();

  const { data: empresa } = await admin
    .from("empresas").select("id, nombre, color, color_texto").eq("slug", slug).maybeSingle();
  if (!empresa) notFound();

  const { data: compra } = await admin
    .from("reserva_ticket_compras")
    .select("id, empresa_id, codigo, estado, unidades, precio_unitario, importe_total, revolut_order_id, producto_id, canje_hasta")
    .eq("id", compraId)
    .eq("empresa_id", empresa.id as string)
    .maybeSingle();
  if (!compra) notFound();

  let estado = compra.estado as string;

  // No se espera al webhook: se le pregunta a Revolut directamente. Así el
  // cliente ve su código al instante aunque el aviso tarde en llegar.
  if (estado === "pendiente" && compra.revolut_order_id) {
    const cred = await getCredencialesRevolut(compra.empresa_id as string);
    if (cred) {
      const r = await obtenerOrden(
        cred.secretKey, cred.entorno, compra.revolut_order_id as string,
      );
      if (r.ok && estaPagada(r.orden.state)) {
        await admin
          .from("reserva_ticket_compras")
          .update({
            estado: "pagada",
            revolut_estado: r.orden.state,
            pagado_at: new Date().toISOString(),
          })
          .eq("id", compraId)
          .eq("estado", "pendiente");
        estado = "pagada";
        await enviarEmailCompraTicket(compraId).catch(() => {});
      }
    }
  }

  const acento = (empresa.color as string | null) ?? "#18181b";
  const sobreAcento = (empresa.color_texto as string | null) ?? "#ffffff";

  // Pago aún sin confirmar: no se enseña el código.
  if (estado !== "pagada" && estado !== "canjeada") {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
          <h1 className="text-xl font-semibold text-zinc-900">Estamos confirmando tu pago</h1>
          <p className="mt-2 text-sm text-zinc-600">
            En cuanto se confirme te enviaremos el código por correo. Puedes cerrar esta página.
          </p>
        </div>
      </main>
    );
  }

  const { data: producto } = await admin
    .from("reserva_ticket_productos")
    .select("nombre, modo_precio")
    .eq("id", compra.producto_id as string)
    .maybeSingle();

  const unidades = Number(compra.unidades);
  const porPersona = producto?.modo_precio === "por_persona";
  const desglose = porPersona
    ? `${unidades} ${unidades === 1 ? "persona" : "personas"} × ${euros(Number(compra.precio_unitario))} = ${euros(Number(compra.importe_total))}`
    : euros(Number(compra.importe_total));

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: acento, color: sobreAcento }}
        >
          <Check className="h-6 w-6" />
        </div>

        <h1 className="text-xl font-semibold text-zinc-900">Compra confirmada</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Te hemos enviado el código por correo.
        </p>

        <div className="my-6 rounded-xl border p-4 text-left" style={{ borderColor: "#e4e4e7" }}>
          <p className="text-sm font-medium text-zinc-900">{producto?.nombre ?? "Ticket"}</p>
          <p className="mt-1 text-sm text-zinc-600">{desglose}</p>
        </div>

        <div className="my-6 rounded-xl border-2 border-zinc-900 p-5">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Tu código</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-zinc-900">
            {compra.codigo as string}
          </p>
          <p className="mt-2 text-xs text-zinc-500">Válido para un solo uso</p>
        </div>

        <a
          href={`/reservar/${slug}?ticket=${encodeURIComponent(compra.codigo as string)}`}
          className="inline-block rounded-lg px-6 py-3 text-sm font-semibold"
          style={{ background: acento, color: sobreAcento }}
        >
          Reservar mesa
        </a>

        <p className="mt-4 text-xs text-zinc-500">
          También puedes reservar más adelante con tu código.
        </p>
      </div>
    </main>
  );
}
