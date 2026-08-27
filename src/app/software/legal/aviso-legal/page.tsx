import type { Metadata } from "next";
import { LegalLayout, Seccion } from "../LegalLayout";
import { TITULAR, DOMICILIO_LINEA } from "../datos-titular";

export const metadata: Metadata = {
  title: "Aviso legal — Balles Hosteleros",
  description:
    "Datos identificativos del titular de sistema.balleshosteleros.com y condiciones de uso del sitio web.",
  alternates: {
    canonical: "https://sistema.balleshosteleros.com/software/legal/aviso-legal",
  },
};

export default function AvisoLegalPage() {
  return (
    <LegalLayout
      titulo="Aviso legal"
      descripcion="Quién está detrás de este sitio web y en qué condiciones puedes usarlo."
    >
      <Seccion titulo="1. Datos identificativos">
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la
          sociedad de la información y de comercio electrónico, se informa de
          que el titular de este sitio web es:
        </p>
        <dl className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-5">
          {[
            ["Titular", TITULAR.razonSocial],
            ["CIF", TITULAR.cif],
            ["Domicilio", DOMICILIO_LINEA],
            ["Teléfono", TITULAR.telefono],
            ["Correo electrónico", TITULAR.email],
            ["Sitio web", TITULAR.dominio],
          ].map(([clave, valor]) => (
            <div key={clave} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-xs font-semibold tracking-widest text-slate-400 uppercase">
                {clave}
              </dt>
              <dd className="text-sm text-slate-300">{valor}</dd>
            </div>
          ))}
        </dl>
      </Seccion>

      <Seccion titulo="2. Objeto">
        <p>
          Este sitio web presenta Balles Hosteleros, un software de gestión
          integral para empresas de hostelería, y da acceso a la aplicación a
          quienes tienen contratado el servicio. El acceso al sitio es gratuito,
          salvo el coste de conexión que te aplique tu operador.
        </p>
      </Seccion>

      <Seccion titulo="3. Condiciones de uso">
        <p>
          Al usar este sitio te comprometes a hacerlo conforme a la ley, a este
          aviso legal y a la buena fe. En particular, no puedes emplearlo para
          fines ilícitos, ni intentar acceder a zonas restringidas, ni introducir
          virus o cualquier otro elemento que dañe el sistema.
        </p>
        <p>
          El titular puede interrumpir el acceso al sitio en cualquier momento
          por motivos de mantenimiento o seguridad, sin previo aviso.
        </p>
      </Seccion>

      <Seccion titulo="4. Propiedad intelectual e industrial">
        <p>
          Todos los contenidos del sitio —textos, imágenes, marcas, logotipos,
          diseño y código fuente— pertenecen al titular o cuentan con
          autorización para su uso, y están protegidos por la normativa de
          propiedad intelectual e industrial.
        </p>
        <p>
          Queda prohibida su reproducción, distribución, comunicación pública o
          transformación sin autorización expresa y por escrito del titular.
        </p>
      </Seccion>

      <Seccion titulo="5. Responsabilidad">
        <p>
          El titular no responde de los daños derivados del mal uso del sitio,
          ni de las interrupciones o errores que puedan producirse por causas
          ajenas a su control, como fallos de la red o de terceros proveedores.
        </p>
        <p>
          El sitio puede incluir enlaces a páginas de terceros. El titular no
          controla esos contenidos y no asume responsabilidad sobre ellos.
        </p>
      </Seccion>

      <Seccion titulo="6. Protección de datos">
        <p>
          El tratamiento de datos personales se detalla en la política de
          privacidad, que forma parte de este aviso legal.
        </p>
      </Seccion>

      <Seccion titulo="7. Legislación aplicable">
        <p>
          Este aviso legal se rige por la legislación española. Para cualquier
          controversia, y salvo que la normativa de consumo disponga otro fuero,
          las partes se someten a los juzgados y tribunales de Getafe (Madrid).
        </p>
      </Seccion>
    </LegalLayout>
  );
}
