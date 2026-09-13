/**
 * Reenvía las actas de entrega cuyo correo salió con un enlace a localhost.
 *
 * Las 32 actas de HABANA y BACANAL se mandaron desde el portátil, y `.env.local`
 * apunta a `http://localhost:3000`. Los correos salieron "bien" —el envío no
 * falla— pero el botón de firmar llevaba a una dirección que solo existe en esta
 * máquina. Nadie podía firmar, y nadie firmó.
 *
 * Uso:
 *   npx tsx scripts/reenviar-actas-entrega-enlace-roto.ts
 *   npx tsx scripts/reenviar-actas-entrega-enlace-roto.ts --aplicar
 *
 * Sin `--aplicar` no manda nada: dice a quién se le reenviaría y a qué correo.
 *
 * Hace lo mismo que el botón «Reenviar» de la app (`reenviarFirma`), que no se
 * puede llamar desde aquí porque exige sesión de administrador:
 *   · Tira el enlace anterior Y los códigos de un solo uso. Renovar el enlace
 *     reinicia el doble factor; si no, un código ya validado antes seguiría
 *     autorizando la firma a quien reciba el enlace nuevo.
 *   · Manda el correo con un enlace nuevo al dominio real.
 *   · Rehace el aviso de la app, que apuntaba al enlace que se acaba de anular.
 *
 * El dominio se fija aquí y se comprueba: este script existe precisamente porque
 * confiar en el entorno mandó 32 enlaces muertos a personas reales.
 */

import { readFileSync } from "node:fs";

function cargarEnv(): void {
  const txt = readFileSync(".env.local", "utf8");
  for (const linea of txt.split("\n")) {
    if (!linea.includes("=") || linea.trimStart().startsWith("#")) continue;
    const i = linea.indexOf("=");
    const clave = linea.slice(0, i).trim();
    if (process.env[clave]) continue;
    process.env[clave] = linea.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
cargarEnv();

const DOMINIO_PRODUCCION = "https://sistema.balleshosteleros.com";
const argBase = process.argv.find((a) => a.startsWith("--base="));
const BASE = (argBase ? argBase.slice("--base=".length) : DOMINIO_PRODUCCION).replace(/\/+$/, "");

if (/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error("✗ El enlace apuntaría a localhost y nadie podría abrirlo. Abortado.");
  process.exit(1);
}

// El correo y el aviso componen el enlace con `getSiteUrl()`, que lee esta
// variable EN EL MOMENTO de enviar. Se fija antes de importar nada que envíe.
process.env.NEXT_PUBLIC_APP_URL = BASE;

const APLICAR = process.argv.includes("--aplicar");

type FilaDocumento = {
  id: string;
  empresa_id: string;
  empleado_id: string;
  titulo: string;
  expira_en: string | null;
  reenviado_count: number | null;
};

async function main() {
  // Imports dinámicos: así el dominio ya está fijado cuando se cargan.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { generarToken, hashToken } = await import("@/features/rrhh/services/firmas/crypto");
  const { enviarInvitacionFirma } = await import("@/features/rrhh/services/firmas/email");
  const { registrarEvento } = await import("@/features/rrhh/services/firmas/audit");

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("firmas_documentos")
    .select("id, empresa_id, empleado_id, titulo, expira_en, reenviado_count")
    .eq("tipo", "entrega_material")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("✗ No se pudieron leer los documentos:", error.message);
    process.exit(1);
  }

  const documentos = (data ?? []) as FilaDocumento[];
  if (documentos.length === 0) {
    console.log("No hay ninguna entrega pendiente de firma. Nada que reenviar.");
    return;
  }

  // Empleados y empresas, de una vez.
  const empleadoIds = [...new Set(documentos.map((d) => d.empleado_id))];
  const { data: empleados } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, email_empresa, email_personal")
    .in("id", empleadoIds);

  type FilaEmpleado = {
    id: string;
    nombre: string | null;
    apellidos: string | null;
    email_empresa: string | null;
    email_personal: string | null;
  };
  const ficha = new Map<string, { nombre: string; destino: string | null }>();
  for (const e of (empleados ?? []) as FilaEmpleado[]) {
    ficha.set(e.id, {
      nombre: `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim(),
      // Igual que el envío original: el material le concierne a él, así que va a
      // su correo personal y podrá firmar la devolución aunque salga de la empresa.
      destino: e.email_personal || e.email_empresa,
    });
  }

  const { data: empresas } = await admin.from("empresas").select("id, nombre, logo_url");
  const empresa = new Map(
    ((empresas ?? []) as { id: string; nombre: string; logo_url: string | null }[]).map((e) => [
      e.id,
      e,
    ]),
  );

  console.log(
    APLICAR
      ? `MODO REAL — se reenvían los correos con enlaces a ${BASE}\n`
      : `MODO PRUEBA — no se manda nada. Los enlaces irían a ${BASE}\n`,
  );

  const sinCorreo: string[] = [];
  const porEmpleado = new Map<string, FilaDocumento[]>();
  for (const doc of documentos) {
    const f = ficha.get(doc.empleado_id);
    if (!f?.destino) {
      if (f && !sinCorreo.includes(f.nombre)) sinCorreo.push(f.nombre);
      continue;
    }
    const lista = porEmpleado.get(doc.empleado_id) ?? [];
    lista.push(doc);
    porEmpleado.set(doc.empleado_id, lista);
  }

  let total = 0;
  for (const [empleadoId, docs] of porEmpleado) {
    const f = ficha.get(empleadoId)!;
    console.log(`${f.nombre} — ${docs.length} correo(s) → ${f.destino}`);
    total += docs.length;
  }
  if (sinCorreo.length) {
    console.log(`\n⚠ Sin correo, no se les puede reenviar: ${sinCorreo.join(", ")}`);
  }
  console.log(`\n${total} correo(s) por reenviar.`);

  if (!APLICAR) {
    console.log("\nNada enviado. Repite con --aplicar.");
    return;
  }

  let enviados = 0;
  const fallos: string[] = [];

  for (const [empleadoId, docs] of porEmpleado) {
    const f = ficha.get(empleadoId)!;

    for (const doc of docs) {
      const emp = empresa.get(doc.empresa_id);
      const expira = doc.expira_en
        ? new Date(doc.expira_en)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      // Fuera el enlace viejo y sus códigos: renovar enlace reinicia el 2FA.
      await admin.from("firmas_tokens").delete().eq("documento_id", doc.id);
      await admin.from("firmas_otps").delete().eq("documento_id", doc.id);

      const token = generarToken();
      const { error: errToken } = await admin.from("firmas_tokens").insert({
        documento_id: doc.id,
        token_hash: hashToken(token),
        expira_en: expira.toISOString(),
      });
      if (errToken) {
        fallos.push(`${f.nombre} · ${doc.titulo}: ${errToken.message}`);
        continue;
      }

      const envio = await enviarInvitacionFirma({
        to: f.destino!,
        empresaId: doc.empresa_id,
        empresaNombre: emp?.nombre ?? "Tu empresa",
        empresaLogoUrl: emp?.logo_url ?? null,
        empleadoNombre: f.nombre,
        tituloDocumento: doc.titulo,
        enviadoPor: "Dirección",
        token,
        expiraEn: expira,
      });

      await admin
        .from("firmas_documentos")
        .update({ reenviado_count: (doc.reenviado_count ?? 0) + 1 })
        .eq("id", doc.id);

      await registrarEvento({
        documentoId: doc.id,
        tipo: "reenviado",
        actorUserId: null,
        metadata: {
          destino: f.destino,
          emailOk: envio.ok,
          motivo: "El enlace anterior apuntaba a localhost",
        },
      });

      // El aviso de la app apuntaba al enlace que se acaba de anular: se rehace.
      await admin
        .from("notificaciones")
        .delete()
        .eq("entidad_tipo", "firmas_documentos")
        .eq("entidad_id", doc.id)
        .is("vista_at", null);

      const { data: usuario } = await admin
        .from("empleados")
        .select("user_id")
        .eq("id", empleadoId)
        .maybeSingle();
      const userId = (usuario as { user_id: string | null } | null)?.user_id;

      if (userId) {
        await admin.from("notificaciones").insert({
          empresa_id: doc.empresa_id,
          usuario_id: userId,
          empleado_id: empleadoId,
          tipo: "firma_pendiente",
          titulo: "Tienes una entrega pendiente de firmar",
          mensaje: `«${doc.titulo}» está esperando tu firma. Pulsa Firmar para abrir el documento.`,
          accion_label: "Firmar",
          requiere_accion: true,
          accion_url: `${BASE}/firmar/${encodeURIComponent(token)}`,
          entidad_tipo: "firmas_documentos",
          entidad_id: doc.id,
          dedupe_key: `firma-${doc.id}`,
        });
      }

      if (envio.ok) enviados += 1;
      else {
        const detalle = "error" in envio ? envio.error : "sin detalle";
        fallos.push(`${f.nombre} · ${doc.titulo}: ${detalle}`);
      }
    }
  }

  console.log(`\n✓ ${enviados} correo(s) reenviados con el enlace bueno.`);
  if (fallos.length) {
    console.log(`\n⚠ ${fallos.length} con problemas:`);
    for (const f of fallos) console.log(`  · ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
