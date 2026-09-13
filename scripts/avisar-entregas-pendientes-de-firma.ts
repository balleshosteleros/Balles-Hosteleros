/**
 * Avisa dentro de la app a quien tiene una entrega de material sin firmar.
 *
 * Las 32 actas de HABANA y BACANAL salieron por correo, pero el correo se pierde
 * entre cien y nadie había firmado. Este aviso salta al entrar en la app —en el
 * móvil y en el escritorio— con un botón que abre directamente el documento.
 *
 * Uso:
 *   npx tsx scripts/avisar-entregas-pendientes-de-firma.ts
 *   npx tsx scripts/avisar-entregas-pendientes-de-firma.ts --aplicar
 *
 * Sin `--aplicar` no escribe nada: dice a quién avisaría y de qué.
 *
 * ENLACE NUEVO, NO EL DEL CORREO. Del enlace original solo se guarda su huella,
 * nunca el enlace en claro — que es justo lo que hace que un enlace de firma sea
 * seguro. Así que el botón lleva un enlace propio, con la misma caducidad que el
 * del correo. Los dos valen: el trabajador puede firmar por donde le pille.
 *
 * Repetible: un aviso por documento (`dedupe_key`), así que ejecutarlo dos veces
 * no llena la bandeja de nadie. Solo mira lo que sigue pendiente: en cuanto
 * alguien firma, deja de avisarle.
 */

import { readFileSync } from "node:fs";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarToken, hashToken } from "@/features/rrhh/services/firmas/crypto";

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

const APLICAR = process.argv.includes("--aplicar");

/**
 * El dominio real, SIEMPRE — nunca lo que diga `.env.local`.
 *
 * Un script se ejecuta desde el portátil, donde `NEXT_PUBLIC_APP_URL` apunta a
 * localhost. Ese enlace es un enlace muerto en manos de una persona real: no lo
 * puede abrir nadie más que quien lo generó. Aquí se escriben avisos para gente
 * de verdad, así que el dominio se fija y se puede cambiar a propósito con
 * `--base`, nunca por accidente.
 */
const DOMINIO_PRODUCCION = "https://sistema.balleshosteleros.com";
const argBase = process.argv.find((a) => a.startsWith("--base="));
const BASE = (argBase ? argBase.slice("--base=".length) : DOMINIO_PRODUCCION).replace(/\/+$/, "");

if (/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error("✗ El enlace apuntaría a localhost y nadie podría abrirlo. Abortado.");
  process.exit(1);
}

type FilaDocumento = {
  id: string;
  empresa_id: string;
  empleado_id: string;
  titulo: string;
  expira_en: string | null;
};

async function main() {
  const admin = createAdminClient();

  // Solo lo que sigue esperando firma. Quien ya firmó no recibe nada.
  const { data, error } = await admin
    .from("firmas_documentos")
    .select("id, empresa_id, empleado_id, titulo, expira_en")
    .eq("tipo", "entrega_material")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("✗ No se pudieron leer los documentos:", error.message);
    process.exit(1);
  }

  const documentos = (data ?? []) as FilaDocumento[];
  if (documentos.length === 0) {
    console.log("No hay ninguna entrega pendiente de firma. Nada que avisar.");
    return;
  }

  // Quién es cada uno y con qué usuario entra en la app.
  const empleadoIds = [...new Set(documentos.map((d) => d.empleado_id))];
  const { data: empleados } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, user_id, empresa_id")
    .in("id", empleadoIds);

  const ficha = new Map<
    string,
    { nombre: string; userId: string | null; empresaId: string }
  >();
  for (const e of (empleados ?? []) as {
    id: string;
    nombre: string | null;
    apellidos: string | null;
    user_id: string | null;
    empresa_id: string;
  }[]) {
    ficha.set(e.id, {
      nombre: `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim(),
      userId: e.user_id,
      empresaId: e.empresa_id,
    });
  }

  const { data: empresas } = await admin.from("empresas").select("id, nombre");
  const nombreEmpresa = new Map(
    ((empresas ?? []) as { id: string; nombre: string }[]).map((e) => [e.id, e.nombre]),
  );

  // ─── Qué se va a hacer ──────────────────────────────────────
  const porEmpleado = new Map<string, FilaDocumento[]>();
  const sinUsuario: string[] = [];

  for (const doc of documentos) {
    const f = ficha.get(doc.empleado_id);
    if (!f) continue;
    if (!f.userId) {
      // Sin usuario no puede entrar en la app: el aviso no le llegaría nunca.
      if (!sinUsuario.includes(f.nombre)) sinUsuario.push(f.nombre);
      continue;
    }
    const lista = porEmpleado.get(doc.empleado_id) ?? [];
    lista.push(doc);
    porEmpleado.set(doc.empleado_id, lista);
  }

  console.log(
    APLICAR
      ? "MODO REAL — se crean los avisos\n"
      : "MODO PRUEBA — no se escribe nada\n",
  );

  let aAvisar = 0;
  for (const [empleadoId, docs] of porEmpleado) {
    const f = ficha.get(empleadoId)!;
    console.log(`${f.nombre} · ${nombreEmpresa.get(f.empresaId) ?? "—"} — ${docs.length} aviso(s)`);
    aAvisar += docs.length;
  }

  if (sinUsuario.length) {
    console.log(`\n⚠ Sin usuario en la app, no les llega el aviso: ${sinUsuario.join(", ")}`);
  }
  console.log(`\n${aAvisar} aviso(s) por crear.`);

  if (!APLICAR) {
    console.log("\nNada escrito. Repite con --aplicar para mandarlos.");
    return;
  }

  // ─── Crear el enlace propio y el aviso ──────────────────────
  let creados = 0;
  const fallos: string[] = [];

  for (const [empleadoId, docs] of porEmpleado) {
    const f = ficha.get(empleadoId)!;

    for (const doc of docs) {
      // Enlace nuevo: el del correo no se puede recuperar, solo su huella.
      const token = generarToken();
      const expira =
        doc.expira_en ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const { error: errToken } = await admin.from("firmas_tokens").insert({
        documento_id: doc.id,
        token_hash: hashToken(token),
        expira_en: expira,
      });
      if (errToken) {
        fallos.push(`${f.nombre} · ${doc.titulo}: ${errToken.message}`);
        continue;
      }

      const { error: errNotif } = await admin.from("notificaciones").upsert(
        {
          empresa_id: doc.empresa_id,
          usuario_id: f.userId,
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
        },
        { onConflict: "empresa_id,usuario_id,dedupe_key", ignoreDuplicates: true },
      );

      if (errNotif) {
        fallos.push(`${f.nombre} · ${doc.titulo}: ${errNotif.message}`);
        continue;
      }
      creados += 1;
    }
  }

  console.log(`\n✓ ${creados} aviso(s) creados.`);
  if (fallos.length) {
    console.log(`\n⚠ ${fallos.length} con problemas:`);
    for (const f of fallos) console.log(`  · ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
