import type { Metadata } from "next";
import { LegalLayout, Seccion, Lista } from "../LegalLayout";
import { TITULAR, DOMICILIO_LINEA } from "../datos-titular";

export const metadata: Metadata = {
  title: "Términos y condiciones — Balles Hosteleros",
  description:
    "Condiciones de contratación y uso del software Balles Hosteleros: precios, pagos, duración y responsabilidades.",
  alternates: {
    canonical: "https://sistema.balleshosteleros.com/software/legal/terminos",
  },
};

export default function TerminosPage() {
  return (
    <LegalLayout
      titulo="Términos y condiciones"
      descripcion="Las condiciones bajo las que se contrata y se usa Balles Hosteleros."
    >
      <Seccion titulo="1. Partes">
        <p>
          Estas condiciones regulan la relación entre {TITULAR.razonSocial}, CIF{" "}
          {TITULAR.cif}, con domicilio en {DOMICILIO_LINEA} (en adelante, «el
          proveedor»), y la empresa que contrata el software (en adelante, «el
          cliente»).
        </p>
        <p>
          Al contratar el servicio o crear una cuenta, el cliente acepta estas
          condiciones en su totalidad.
        </p>
      </Seccion>

      <Seccion titulo="2. Objeto del servicio">
        <p>
          El proveedor cede al cliente el uso de Balles Hosteleros, un software
          de gestión en la nube para empresas de hostelería, que incluye los
          módulos de dirección, recursos humanos, logística, cocina,
          contabilidad, gerencia y jurídico.
        </p>
        <p>
          El servicio se presta en modalidad de suscripción. El cliente{" "}
          <strong className="text-slate-200">
            no adquiere la propiedad del software
          </strong>
          , sino un derecho de uso no exclusivo e intransferible mientras la
          suscripción esté vigente.
        </p>
      </Seccion>

      <Seccion titulo="3. Precio y facturación">
        <Lista
          items={[
            <>
              El precio es de{" "}
              <strong className="text-slate-200">120 € al mes por local</strong>,
              impuestos no incluidos.
            </>,
            <>
              En la modalidad anual se aplica el descuento vigente indicado en la
              página de planes.
            </>,
            <>
              Se ofrecen{" "}
              <strong className="text-slate-200">14 días de prueba</strong> sin
              coste y sin necesidad de tarjeta.
            </>,
            <>
              La facturación es por adelantado, al inicio de cada periodo. El
              impago faculta al proveedor a suspender el acceso tras avisar al
              cliente.
            </>,
          ]}
        />
      </Seccion>

      <Seccion titulo="4. Duración y cancelación">
        <p>
          El contrato no tiene permanencia. El cliente puede cancelarlo cuando
          quiera, con efecto al final del periodo ya facturado, sin penalización.
        </p>
        <p>
          Antes de cancelar, el cliente puede exportar todos sus datos. Tras la
          baja, el proveedor los conserva bloqueados durante los plazos legales
          de prescripción y después los elimina.
        </p>
      </Seccion>

      <Seccion titulo="5. Obligaciones del cliente">
        <Lista
          items={[
            "Facilitar datos veraces y mantenerlos actualizados.",
            "Custodiar sus credenciales y las de su equipo, y comunicar de inmediato cualquier acceso no autorizado.",
            "Usar el software conforme a la ley, en especial en materia laboral y de protección de datos.",
            "Informar a sus empleados del tratamiento de sus datos y obtener las autorizaciones que la normativa le exija.",
            "No revender, ceder ni sublicenciar el acceso a terceros.",
          ]}
        />
      </Seccion>

      <Seccion titulo="6. Obligaciones del proveedor">
        <Lista
          items={[
            "Mantener el servicio operativo y aplicar las medidas de seguridad razonables.",
            "Realizar copias de seguridad periódicas de los datos del cliente.",
            "Prestar soporte por los canales indicados en la página de planes.",
            "Avisar con antelación de las paradas de mantenimiento programadas.",
          ]}
        />
        <p>
          El proveedor puede evolucionar el software y modificar o retirar
          funcionalidades, siempre que ello no altere sustancialmente el servicio
          contratado.
        </p>
      </Seccion>

      <Seccion titulo="7. Propiedad de los datos">
        <p>
          <strong className="text-slate-200">
            Los datos introducidos en el software son propiedad del cliente.
          </strong>{" "}
          El proveedor los trata únicamente para prestar el servicio, conforme al
          contrato de encargo de tratamiento y a la política de privacidad. No
          los vende, no los cede a terceros con fines comerciales ni los usa para
          entrenar modelos de inteligencia artificial.
        </p>
      </Seccion>

      <Seccion titulo="8. Disponibilidad y responsabilidad">
        <p>
          El proveedor se compromete a mantener el servicio disponible con la
          mayor continuidad posible, pero no garantiza que esté libre de
          interrupciones o errores. No responde de los fallos causados por
          terceros proveedores, por la conexión del cliente o por causas de
          fuerza mayor.
        </p>
        <p>
          Salvo dolo o negligencia grave, la responsabilidad del proveedor se
          limita al importe abonado por el cliente en los tres meses anteriores
          al hecho que la origine. No se responde del lucro cesante ni de los
          daños indirectos.
        </p>
      </Seccion>

      <Seccion titulo="9. Integraciones con terceros">
        <p>
          El software puede conectarse con servicios de terceros —como Google,
          para correo y calendario— cuando el cliente lo autoriza expresamente.
          Esas conexiones se rigen además por las condiciones del proveedor
          correspondiente, y el cliente puede revocarlas en cualquier momento.
        </p>
      </Seccion>

      <Seccion titulo="10. Modificación de las condiciones">
        <p>
          El proveedor puede modificar estas condiciones. Los cambios relevantes
          se comunicarán con al menos 30 días de antelación. Si el cliente no
          está conforme, puede cancelar el servicio antes de que entren en vigor.
        </p>
      </Seccion>

      <Seccion titulo="11. Legislación y jurisdicción">
        <p>
          Estas condiciones se rigen por la legislación española. Para cualquier
          controversia, las partes se someten a los juzgados y tribunales de
          Getafe (Madrid), salvo que la normativa aplicable imponga otro fuero.
        </p>
      </Seccion>
    </LegalLayout>
  );
}
