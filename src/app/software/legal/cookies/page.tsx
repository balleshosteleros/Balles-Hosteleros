import type { Metadata } from "next";
import { LegalLayout, Seccion } from "../LegalLayout";
import { TITULAR } from "../datos-titular";

export const metadata: Metadata = {
  title: "Política de cookies — Balles Hosteleros",
  description:
    "Qué cookies usa Balles Hosteleros, para qué sirven y cómo gestionarlas.",
  alternates: {
    canonical: "https://software.balleshosteleros.com/legal/cookies",
  },
};

/**
 * Inventario real de cookies. Si añades una cookie nueva al software, añádela
 * aquí: una política de cookies incompleta es infracción sancionable y motivo
 * de rechazo en la verificación de Google.
 */
const cookies = [
  {
    nombre: "bh_empresa_activa",
    finalidad:
      "Recuerda con qué empresa estás trabajando cuando tienes acceso a varias.",
    duracion: "Sesión",
  },
  {
    nombre: "bh_view_mode",
    finalidad:
      "Recuerda si prefieres la vista de escritorio o la de móvil.",
    duracion: "Sesión",
  },
  {
    nombre: "g_accounts",
    finalidad:
      "Guarda qué cuentas de Google tienes vinculadas, para no pedirte que las conectes en cada visita.",
    duracion: "Sesión",
  },
  {
    nombre: "g_accounts_meta",
    finalidad:
      "Guarda datos auxiliares de esas cuentas, como cuál es la activa.",
    duracion: "Sesión",
  },
  {
    nombre: "sb-*-auth-token",
    finalidad:
      "Mantiene tu sesión iniciada para que no tengas que escribir la contraseña en cada página. La gestiona Supabase, nuestro proveedor de autenticación.",
    duracion: "8 horas",
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      titulo="Política de cookies"
      descripcion="Qué guardamos en tu navegador, para qué sirve y cómo puedes gestionarlo."
    >
      <Seccion titulo="1. Qué es una cookie">
        <p>
          Una cookie es un pequeño archivo que un sitio web guarda en tu
          navegador. Sirve para que la página recuerde información entre
          visitas, como que ya has iniciado sesión.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué cookies usamos">
        <p>
          Balles Hosteleros usa <strong className="text-slate-200">
          únicamente cookies técnicas necesarias
          </strong> para que el software funcione.{" "}
          <strong className="text-slate-200">
            No usamos cookies de publicidad, de seguimiento ni de análisis
          </strong>
          , ni propias ni de terceros. Por eso no te mostramos un banner de
          consentimiento: la normativa no lo exige para las cookies
          estrictamente necesarias.
        </p>

        <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-white/[0.04] text-xs tracking-widest text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Cookie</th>
                <th className="px-4 py-3 font-semibold">Finalidad</th>
                <th className="px-4 py-3 font-semibold">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cookies.map((c) => (
                <tr key={c.nombre}>
                  <td className="px-4 py-3 align-top font-mono text-xs text-slate-300">
                    {c.nombre}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-400">
                    {c.finalidad}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-400">
                    {c.duracion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="3. Cómo gestionarlas">
        <p>
          Puedes borrar o bloquear las cookies desde la configuración de tu
          navegador. Ten en cuenta que, al ser todas necesarias,{" "}
          <strong className="text-slate-200">
            si las bloqueas no podrás iniciar sesión ni usar el software
          </strong>
          .
        </p>
        <p>
          Cada navegador tiene sus propias instrucciones: búscalas en la ayuda
          de Chrome, Firefox, Safari o Edge según el que uses.
        </p>
      </Seccion>

      <Seccion titulo="4. Cambios">
        <p>
          Si en el futuro incorporamos cookies de análisis o de terceros,
          actualizaremos esta página y te pediremos consentimiento antes de
          instalarlas. Para cualquier duda, escríbenos a{" "}
          <a
            href={`mailto:${TITULAR.email}`}
            className="text-slate-200 underline underline-offset-4 hover:text-white"
          >
            {TITULAR.email}
          </a>
          .
        </p>
      </Seccion>
    </LegalLayout>
  );
}
