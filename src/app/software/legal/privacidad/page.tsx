import type { Metadata } from "next";
import { LegalLayout, Seccion, Lista } from "../LegalLayout";
import { TITULAR, DOMICILIO_LINEA } from "../datos-titular";

export const metadata: Metadata = {
  title: "Política de privacidad — Balles Hosteleros",
  description:
    "Qué datos trata Balles Hosteleros, con qué finalidad, durante cuánto tiempo y cómo ejercer tus derechos.",
  alternates: { canonical: "https://software.balleshosteleros.com/legal/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <LegalLayout
      titulo="Política de privacidad"
      descripcion="Qué datos tratamos, para qué, durante cuánto tiempo y qué puedes hacer al respecto."
    >
      <Seccion titulo="1. Quién trata tus datos">
        <p>
          El responsable del tratamiento es {TITULAR.razonSocial}, con CIF{" "}
          {TITULAR.cif} y domicilio en {DOMICILIO_LINEA}. Puedes escribirnos a{" "}
          <a
            href={`mailto:${TITULAR.email}`}
            className="text-slate-200 underline underline-offset-4 hover:text-white"
          >
            {TITULAR.email}
          </a>{" "}
          o llamar al {TITULAR.telefono}.
        </p>
        <p>
          Balles Hosteleros es un software de gestión para empresas de
          hostelería. Cuando un restaurante contrata el servicio, ese
          restaurante es el responsable de los datos de su personal y sus
          clientes, y nosotros actuamos como encargado del tratamiento por su
          cuenta, según el contrato de encargo firmado con él.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué datos tratamos y para qué">
        <p>
          Solo tratamos los datos necesarios para prestar el servicio. En
          concreto:
        </p>
        <Lista
          items={[
            <>
              <strong className="text-slate-200">Cuenta y acceso:</strong>{" "}
              nombre, correo electrónico y contraseña cifrada. Para identificarte
              y darte acceso a tu empresa.
            </>,
            <>
              <strong className="text-slate-200">Datos laborales:</strong> datos
              de empleados, contratos, nóminas, turnos, fichajes y ausencias.
              Para que la empresa gestione a su equipo.
            </>,
            <>
              <strong className="text-slate-200">Datos de operativa:</strong>{" "}
              proveedores, productos, escandallos, inventarios, facturas y
              reservas. Para la gestión diaria del negocio.
            </>,
            <>
              <strong className="text-slate-200">Datos técnicos:</strong>{" "}
              dirección IP, tipo de dispositivo y registros de actividad. Para
              mantener la seguridad y auditar los accesos.
            </>,
          ]}
        />
      </Seccion>

      <Seccion titulo="3. Datos de tu cuenta de Google">
        <p>
          Si conectas voluntariamente una cuenta de Google, el software accede a
          esos datos únicamente para ofrecerte las funciones que has activado.
          Detallamos cada permiso y su motivo:
        </p>
        <Lista
          items={[
            <>
              <strong className="text-slate-200">Gmail</strong> (leer, enviar,
              modificar y firma): para mostrar tu bandeja de entrada dentro del
              software, enviar correos en tu nombre desde el módulo de
              comunicación, marcar mensajes como leídos o archivarlos, y aplicar
              la firma corporativa de la empresa.
            </>,
            <>
              <strong className="text-slate-200">Google Calendar</strong> (ver y
              gestionar eventos): para mostrar tu agenda dentro del software y
              crear o actualizar los eventos que generes desde él.
            </>,
            <>
              <strong className="text-slate-200">Contactos</strong> (solo
              lectura): para autocompletar destinatarios al redactar correos,
              sin tener que teclear la dirección entera.
            </>,
          ]}
        />
        <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <strong className="text-slate-200">Compromiso expreso.</strong> El uso
          que Balles Hosteleros hace de la información recibida de las APIs de
          Google se ajusta a la{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-200 underline underline-offset-4 hover:text-white"
          >
            Política de Datos de Usuario de los Servicios API de Google
          </a>
          , incluidos sus requisitos de uso limitado. En particular:{" "}
          <strong className="text-slate-200">
            no vendemos esos datos, no los usamos para publicidad, no los
            empleamos para entrenar modelos de inteligencia artificial y ninguna
            persona los lee
          </strong>
          , salvo que tú lo autorices expresamente, que sea necesario por
          seguridad o para resolver una incidencia que nos comuniques, o que la
          ley nos obligue.
        </p>
        <p>
          Puedes desconectar la cuenta desde el propio software en cualquier
          momento, o revocar el permiso desde{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-200 underline underline-offset-4 hover:text-white"
          >
            la configuración de tu cuenta de Google
          </a>
          . Al hacerlo dejamos de tener acceso de inmediato y borramos los datos
          de esa cuenta que tuviéramos almacenados.
        </p>
      </Seccion>

      <Seccion titulo="4. Con qué legitimación">
        <Lista
          items={[
            <>
              <strong className="text-slate-200">Ejecución del contrato:</strong>{" "}
              para prestar el servicio que la empresa ha contratado.
            </>,
            <>
              <strong className="text-slate-200">Obligación legal:</strong> para
              conservar la documentación laboral, fiscal y contable que exige la
              normativa.
            </>,
            <>
              <strong className="text-slate-200">Consentimiento:</strong> para
              conectar tu cuenta de Google y para las comunicaciones
              comerciales. Puedes retirarlo cuando quieras.
            </>,
            <>
              <strong className="text-slate-200">Interés legítimo:</strong> para
              mantener la seguridad del sistema y prevenir usos fraudulentos.
            </>,
          ]}
        />
      </Seccion>

      <Seccion titulo="5. Quién más accede a los datos">
        <p>
          No vendemos ni cedemos datos a terceros. Para funcionar nos apoyamos en
          proveedores que actúan como encargados, con contrato firmado y
          garantías de protección de datos:
        </p>
        <Lista
          items={[
            <>
              <strong className="text-slate-200">Supabase</strong> — base de
              datos y autenticación. Servidores en la Unión Europea.
            </>,
            <>
              <strong className="text-slate-200">Vercel</strong> — alojamiento de
              la aplicación.
            </>,
            <>
              <strong className="text-slate-200">Cloudflare R2</strong> —
              almacenamiento de documentos y archivos.
            </>,
            <>
              <strong className="text-slate-200">Resend</strong> — envío de
              correos del sistema (avisos, firmas y notificaciones).
            </>,
            <>
              <strong className="text-slate-200">Google</strong> — solo si
              conectas voluntariamente tu cuenta, para Gmail, Calendar y
              Contactos.
            </>,
            <>
              <strong className="text-slate-200">Google Gemini</strong> — para
              funciones de inteligencia artificial, como leer facturas o
              redactar borradores. Los datos enviados no se usan para entrenar
              modelos.
            </>,
          ]}
        />
        <p>
          Algunos proveedores pueden tratar datos fuera del Espacio Económico
          Europeo. En esos casos la transferencia se ampara en las Cláusulas
          Contractuales Tipo aprobadas por la Comisión Europea.
        </p>
      </Seccion>

      <Seccion titulo="6. Cuánto tiempo los guardamos">
        <p>
          Mientras el contrato siga vigente. Al terminar, bloqueamos los datos
          durante los plazos de prescripción legal —seis años en materia
          mercantil y cuatro en materia fiscal— y después los eliminamos. Los
          datos de tu cuenta de Google se borran en cuanto la desconectas.
        </p>
      </Seccion>

      <Seccion titulo="7. Tus derechos">
        <p>
          Puedes pedirnos acceder a tus datos, rectificarlos, suprimirlos,
          limitar u oponerte a su tratamiento, y solicitar su portabilidad.
          Escribe a{" "}
          <a
            href={`mailto:${TITULAR.email}`}
            className="text-slate-200 underline underline-offset-4 hover:text-white"
          >
            {TITULAR.email}
          </a>{" "}
          indicando qué derecho ejerces y adjuntando un documento que acredite tu
          identidad. Responderemos en el plazo máximo de un mes.
        </p>
        <p>
          Si eres empleado de un restaurante que usa el software, dirige tu
          solicitud a tu empresa, que es la responsable de esos datos. Nosotros
          la trasladaremos si nos llega directamente.
        </p>
        <p>
          Si consideras que no hemos atendido bien tu solicitud, puedes reclamar
          ante la Agencia Española de Protección de Datos (
          <a
            href="https://www.aepd.es"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-200 underline underline-offset-4 hover:text-white"
          >
            aepd.es
          </a>
          ).
        </p>
      </Seccion>

      <Seccion titulo="8. Seguridad">
        <p>
          Ciframos las comunicaciones y las contraseñas, controlamos el acceso
          por roles y aislamos los datos de cada empresa para que nadie pueda ver
          los de otra. Registramos los accesos para poder auditarlos. Si se
          produjera una brecha de seguridad que afectase a tus datos, te lo
          comunicaríamos y lo notificaríamos a la autoridad de control conforme
          exige el Reglamento.
        </p>
      </Seccion>

      <Seccion titulo="9. Cambios">
        <p>
          Si modificamos esta política, actualizaremos la fecha del encabezado y
          te avisaremos dentro del software cuando el cambio sea relevante.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
