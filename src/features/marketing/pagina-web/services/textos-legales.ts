/**
 * Generador de textos legales por empresa (RGPD + LSSI-CE + LOPDGDD).
 *
 * POR QUÉ EXISTE:
 * Cada empresa nueva necesita política de privacidad, aviso legal y política de
 * cookies con SUS datos fiscales. Redactarlos a mano por restaurante es trabajo
 * repetido y, sobre todo, fuente de incumplimiento: basta que alguien olvide el
 * CIF o el correo de derechos para que la cláusula sea inaplicable.
 *
 * Aquí los textos se generan SIEMPRE desde `empresas.datos_generales`, de modo
 * que una empresa recién dada de alta tiene sus tres páginas legales correctas
 * sin que nadie escriba nada.
 *
 * IMPORTANTE — no es asesoramiento jurídico. Cubre los mínimos exigidos por el
 * RGPD (arts. 13-14), la LSSI-CE (art. 10) y la guía de cookies de la AEPD, pero
 * un abogado debe validarlo una vez por grupo empresarial.
 *
 * Los datos que faltan NO se inventan: se devuelven en `avisos` para que la UI
 * obligue a completarlos en Ajustes antes de publicar.
 */

/** Subconjunto de `empresas.datos_generales` que necesitan los textos legales. */
export interface DatosLegalesEmpresa {
  razonSocial: string;
  nombreComercial: string;
  cif: string;
  direccionFiscal: string;
  codigoPostal: string;
  ciudad: string;
  provincia: string;
  pais: string;
  /** Correo al que llegan las solicitudes de derechos RGPD. */
  correoDerechos: string;
  telefono: string;
  web: string;
}

export type TipoPaginaLegal = "privacidad" | "aviso_legal" | "cookies";

export interface PaginaLegalGenerada {
  tipo: TipoPaginaLegal;
  nombre: string;
  slug: string;
  titulo: string;
  html: string;
}

export interface ResultadoTextosLegales {
  paginas: PaginaLegalGenerada[];
  /** Datos obligatorios que faltan en Ajustes. Bloquean la publicación. */
  avisos: string[];
}

const PENDIENTE = "[PENDIENTE DE COMPLETAR EN AJUSTES]";

function limpio(valor: string | null | undefined): string {
  return (valor ?? "").trim();
}

function oPendiente(valor: string | null | undefined): string {
  return limpio(valor) || PENDIENTE;
}

/** Escapa texto que se interpola dentro del HTML generado. */
function esc(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Extrae los datos legales del JSONB `datos_generales`.
 *
 * El correo de derechos sale de gerencia (criterio de negocio: es quien atiende
 * las solicitudes RGPD), con caída a jurídico, admin y general.
 */
export function extraerDatosLegales(
  datosGenerales: Record<string, unknown> | null | undefined,
): DatosLegalesEmpresa {
  const d = (datosGenerales ?? {}) as Record<string, string | undefined>;

  const correoDerechos =
    limpio(d.correoGerencia) ||
    limpio(d.correoJuridico) ||
    limpio(d.correoAdmin);

  return {
    razonSocial: limpio(d.razonSocial),
    nombreComercial: limpio(d.nombreComercial) || limpio(d.razonSocial),
    cif: limpio(d.cif),
    direccionFiscal: limpio(d.direccionFiscal) || limpio(d.direccionLocal),
    codigoPostal: limpio(d.codigoPostal),
    ciudad: limpio(d.ciudad),
    provincia: limpio(d.provincia),
    pais: limpio(d.pais) || "España",
    correoDerechos,
    telefono: limpio(d.telefonoPrincipal) || limpio(d.telefonoSecundario),
    web: limpio(d.web),
  };
}

/** Comprueba los datos que el RGPD y la LSSI exigen sí o sí. */
export function validarDatosLegales(datos: DatosLegalesEmpresa): string[] {
  const avisos: string[] = [];
  if (!datos.razonSocial) avisos.push("Falta la razón social de la empresa.");
  if (!datos.cif) avisos.push("Falta el CIF/NIF de la empresa.");
  if (!datos.direccionFiscal) avisos.push("Falta el domicilio fiscal.");
  if (!datos.codigoPostal || !datos.ciudad) {
    avisos.push("Falta el código postal o la ciudad del domicilio.");
  }
  if (!datos.correoDerechos) {
    avisos.push(
      "Falta un correo de contacto (gerencia) para atender los derechos de protección de datos.",
    );
  }
  return avisos;
}

/** Domicilio completo en una línea. */
function domicilioCompleto(d: DatosLegalesEmpresa): string {
  const calle = limpio(d.direccionFiscal);
  const provincia = limpio(d.provincia);
  const ciudad = limpio(d.ciudad);

  // "28945 Fuenlabrada (Madrid)" — la provincia va pegada a la localidad, sin
  // coma intermedia. Si ciudad y provincia coinciden (Madrid, Madrid) no se
  // repite.
  let localidad = [limpio(d.codigoPostal), ciudad].filter(Boolean).join(" ");
  if (provincia && provincia.toLowerCase() !== ciudad.toLowerCase()) {
    localidad = localidad ? `${localidad} (${provincia})` : `(${provincia})`;
  }

  const texto = [calle, localidad, limpio(d.pais)].filter(Boolean).join(", ");
  return texto || PENDIENTE;
}

/** Bloque "Responsable del tratamiento" — se repite en varios documentos. */
function bloqueResponsable(d: DatosLegalesEmpresa): string {
  return `<ul>
<li><strong>Titular:</strong> ${esc(oPendiente(d.razonSocial))}</li>
<li><strong>NIF/CIF:</strong> ${esc(oPendiente(d.cif))}</li>
<li><strong>Domicilio:</strong> ${esc(domicilioCompleto(d))}</li>
<li><strong>Correo electrónico:</strong> ${esc(oPendiente(d.correoDerechos))}</li>${
    d.telefono ? `\n<li><strong>Teléfono:</strong> ${esc(d.telefono)}</li>` : ""
  }${d.web ? `\n<li><strong>Sitio web:</strong> ${esc(d.web)}</li>` : ""}
</ul>`;
}

function htmlPrivacidad(d: DatosLegalesEmpresa): string {
  const nombre = esc(oPendiente(d.nombreComercial));
  const correo = esc(oPendiente(d.correoDerechos));

  return `<h1>Política de privacidad</h1>

<p>En ${nombre} nos importa tu privacidad. Queremos explicarte de manera transparente cómo tratamos tus datos personales y cómo usamos las cookies en nuestro sitio web.</p>

<h2>1. Responsable del tratamiento</h2>
${bloqueResponsable(d)}

<h2>2. Qué datos recopilamos</h2>
<p>Recopilamos la información que nos facilitas voluntariamente:</p>
<ul>
<li>Nombre y apellidos</li>
<li>Correo electrónico</li>
<li>Teléfono</li>
<li>Información de tu reserva (fecha, hora, número de comensales)</li>
<li>Preferencias gastronómicas, alergias o intolerancias que nos comuniques</li>
<li>Cualquier otro dato que incluyas en el mensaje de un formulario</li>
</ul>

<p>Además, de forma automática recopilamos datos técnicos:</p>
<ul>
<li>Dirección IP</li>
<li>Navegador y dispositivo</li>
<li>Datos de navegación en el sitio web</li>
</ul>

<p>Si nos facilitas datos de terceras personas (por ejemplo, los acompañantes de una reserva), te comprometes a haberles informado previamente de lo que se recoge en esta política.</p>

<h2>3. Para qué usamos tus datos y con qué legitimación</h2>
<table>
<thead>
<tr><th>Finalidad</th><th>Base jurídica</th></tr>
</thead>
<tbody>
<tr><td>Gestionar tu reserva y prestarte el servicio</td><td>Ejecución de un contrato (art. 6.1.b RGPD)</td></tr>
<tr><td>Atender tus consultas y solicitudes</td><td>Consentimiento del interesado (art. 6.1.a RGPD)</td></tr>
<tr><td>Enviarte comunicaciones comerciales o promociones</td><td>Consentimiento, revocable en cualquier momento (art. 6.1.a RGPD)</td></tr>
<tr><td>Mejorar la web y analizar su uso</td><td>Consentimiento mediante el banner de cookies (art. 6.1.a RGPD)</td></tr>
<tr><td>Gestionar alergias e intolerancias que nos comuniques</td><td>Consentimiento explícito (art. 9.2.a RGPD)</td></tr>
<tr><td>Cumplir obligaciones legales (fiscales, contables, sanitarias)</td><td>Obligación legal (art. 6.1.c RGPD)</td></tr>
<tr><td>Seguridad de las instalaciones y prevención del fraude</td><td>Interés legítimo (art. 6.1.f RGPD)</td></tr>
</tbody>
</table>

<p>La información sobre alergias e intolerancias es un dato de salud. Solo la tratamos si nos la comunicas tú, con la única finalidad de preparar tu servicio con seguridad, y se conserva el tiempo imprescindible.</p>

<h2>4. Durante cuánto tiempo conservamos tus datos</h2>
<ul>
<li><strong>Datos de reservas:</strong> mientras dure la relación y hasta 1 año después, salvo que exista una reclamación.</li>
<li><strong>Consultas y formularios de contacto:</strong> 1 año desde la última comunicación.</li>
<li><strong>Comunicaciones comerciales:</strong> hasta que retires tu consentimiento.</li>
<li><strong>Datos con obligaciones fiscales o contables:</strong> los plazos legales aplicables (con carácter general, 6 años según el Código de Comercio y 4 años en materia tributaria).</li>
<li><strong>Datos de navegación y cookies:</strong> según los plazos indicados en la política de cookies.</li>
</ul>

<h2>5. A quién comunicamos tus datos</h2>
<p>No vendemos tus datos. Para poder funcionar, compartimos la información estrictamente necesaria con proveedores que actúan como encargados del tratamiento por nuestra cuenta y bajo contrato (art. 28 RGPD):</p>
<ul>
<li>Proveedores de alojamiento web e infraestructura tecnológica</li>
<li>Plataformas de gestión de reservas</li>
<li>Herramientas de correo electrónico y comunicación con clientes</li>
<li>Servicios de analítica web</li>
<li>Asesoría fiscal, contable y laboral</li>
<li>Entidades bancarias y pasarelas de pago</li>
</ul>

<p>También comunicaremos tus datos a Administraciones Públicas, Fuerzas y Cuerpos de Seguridad o Juzgados cuando exista una obligación legal.</p>

<h3>Transferencias internacionales</h3>
<p>Algunos de estos proveedores están ubicados fuera del Espacio Económico Europeo o pueden acceder a los datos desde terceros países. En esos casos, la transferencia se ampara en una decisión de adecuación de la Comisión Europea o en cláusulas contractuales tipo, con garantías adicionales cuando resultan necesarias. Puedes solicitarnos información sobre estas garantías escribiendo a ${correo}.</p>

<h2>6. Cuáles son tus derechos</h2>
<p>Puedes ejercer en cualquier momento los siguientes derechos:</p>
<ul>
<li><strong>Acceso:</strong> saber qué datos tuyos tratamos.</li>
<li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
<li><strong>Supresión:</strong> solicitar que eliminemos tus datos.</li>
<li><strong>Oposición:</strong> oponerte a determinados tratamientos.</li>
<li><strong>Limitación:</strong> pedir que restrinjamos el tratamiento.</li>
<li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
<li><strong>Retirar el consentimiento</strong> en cualquier momento, sin que ello afecte a la licitud del tratamiento previo.</li>
</ul>

<p>Para ejercerlos, escríbenos a <strong>${correo}</strong> indicando el derecho que deseas ejercer y adjuntando una copia de tu DNI o documento equivalente que acredite tu identidad. Responderemos en el plazo máximo de un mes.</p>

<p>Si consideras que no hemos atendido correctamente tu solicitud, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD), C/ Jorge Juan, 6, 28001 Madrid — <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>.</p>

<h2>7. Seguridad de tus datos</h2>
<p>Adoptamos medidas técnicas y organizativas apropiadas para proteger tu información y evitar el acceso no autorizado, la alteración o la pérdida de tus datos personales.</p>

<h2>8. Menores de edad</h2>
<p>No dirigimos nuestros servicios a menores de 14 años ni recogemos conscientemente sus datos sin autorización de quien ejerza la patria potestad o tutela.</p>

<h2>9. Actualizaciones de esta política</h2>
<p>Podremos actualizar esta política ocasionalmente para reflejar cambios en la legislación o en nuestro servicio. La versión actualizada estará siempre disponible en nuestro sitio web.</p>`;
}

function htmlAvisoLegal(d: DatosLegalesEmpresa): string {
  const nombre = esc(oPendiente(d.nombreComercial));
  const correo = esc(oPendiente(d.correoDerechos));
  const dominio = d.web ? esc(d.web) : "este sitio web";

  return `<h1>Aviso legal</h1>

<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se ponen a disposición de los usuarios los datos identificativos del titular de este sitio web.</p>

<h2>1. Datos identificativos</h2>
${bloqueResponsable(d)}

<h2>2. Objeto</h2>
<p>Este aviso legal regula el acceso y uso de ${dominio}, cuyo titular es ${esc(oPendiente(d.razonSocial))}. El acceso al sitio web es gratuito y atribuye la condición de usuario, lo que implica la aceptación de las condiciones aquí recogidas.</p>

<h2>3. Uso del sitio web</h2>
<p>El usuario se compromete a utilizar el sitio web conforme a la ley, a este aviso legal, a la buena fe y al orden público, absteniéndose de:</p>
<ul>
<li>Realizar actividades ilícitas o contrarias a la buena fe.</li>
<li>Introducir o difundir contenidos que atenten contra los derechos humanos o la dignidad de las personas.</li>
<li>Provocar daños en los sistemas del titular o de terceros, o introducir programas maliciosos.</li>
<li>Intentar acceder sin autorización a cuentas de correo o áreas restringidas.</li>
</ul>

<h2>4. Propiedad intelectual e industrial</h2>
<p>Todos los contenidos del sitio web —textos, fotografías, gráficos, imágenes, diseño, marcas, logotipos y código fuente— son titularidad de ${nombre} o de terceros que han autorizado su uso, y están protegidos por la normativa de propiedad intelectual e industrial.</p>
<p>Queda prohibida su reproducción, distribución, comunicación pública o transformación sin autorización expresa y por escrito del titular.</p>

<h2>5. Exclusión de responsabilidad</h2>
<p>El titular no se hace responsable de los daños derivados de interrupciones del servicio, errores u omisiones en los contenidos, ni de la presencia de virus o programas maliciosos introducidos por terceros ajenos a su control.</p>
<p>La información sobre platos, precios y disponibilidad puede variar. Las fotografías de los productos son orientativas.</p>

<h2>6. Enlaces a terceros</h2>
<p>Este sitio puede contener enlaces a páginas de terceros. El titular no controla ni se responsabiliza de sus contenidos ni de sus políticas de privacidad.</p>

<h2>7. Protección de datos</h2>
<p>El tratamiento de los datos personales de los usuarios se rige por lo dispuesto en nuestra política de privacidad.</p>

<h2>8. Legislación aplicable y jurisdicción</h2>
<p>Este aviso legal se rige por la legislación española. Para la resolución de cualquier controversia, las partes se someten a los Juzgados y Tribunales del domicilio del titular, salvo que la normativa de consumidores establezca otro fuero imperativo.</p>

<p>Para cualquier consulta sobre este aviso legal puedes escribirnos a ${correo}.</p>`;
}

function htmlCookies(d: DatosLegalesEmpresa): string {
  const correo = esc(oPendiente(d.correoDerechos));

  return `<h1>Política de cookies</h1>

<h2>¿Qué son las cookies?</h2>
<p>Las cookies son pequeños archivos que se almacenan en tu dispositivo cuando visitas nuestro sitio web. Nos ayudan a ofrecerte una mejor experiencia de usuario, analizar el tráfico y personalizar contenido.</p>

<h2>¿Qué tipos de cookies utilizamos?</h2>
<ul>
<li><strong>Cookies técnicas (necesarias):</strong> imprescindibles para el funcionamiento básico del sitio, como la navegación o el envío de formularios. No requieren consentimiento.</li>
<li><strong>Cookies de preferencias:</strong> permiten recordar tus elecciones, como el idioma o la región.</li>
<li><strong>Cookies de análisis:</strong> nos permiten comprender cómo navegas por la web para mejorarla. Requieren tu consentimiento.</li>
<li><strong>Cookies de marketing:</strong> se usan para mostrarte contenido y publicidad relevante. Requieren tu consentimiento.</li>
</ul>

<h2>Cookies de terceros</h2>
<p>Algunos servicios que utilizamos pueden instalar sus propias cookies, como herramientas de analítica web, mapas incrustados, vídeos, plataformas de reservas y redes sociales. Estos terceros tratan los datos conforme a sus propias políticas de privacidad.</p>

<h2>¿Cómo puedes gestionar las cookies?</h2>
<p>Al entrar en nuestro sitio te mostramos un banner de consentimiento donde puedes aceptar todas las cookies, rechazarlas o configurarlas una a una. Las cookies no necesarias solo se instalan si das tu consentimiento.</p>
<p>Puedes retirar o modificar tu consentimiento en cualquier momento, con la misma facilidad con la que lo diste, desde el enlace de configuración de cookies disponible en el sitio web.</p>
<p>También puedes configurar tu navegador para bloquear o eliminar las cookies:</p>
<ul>
<li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
<li><a href="https://support.mozilla.org/es/kb/Borrar%20cookies" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
<li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
<li><a href="https://support.microsoft.com/es-es/microsoft-edge" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
</ul>

<p><strong>Nota:</strong> al desactivar ciertas cookies, algunas funciones del sitio podrían verse afectadas.</p>

<h2>Conservación</h2>
<p>Las cookies de sesión se eliminan al cerrar el navegador. Las cookies persistentes se conservan durante el plazo establecido para cada una, con un máximo de 24 meses, transcurrido el cual se te vuelve a solicitar el consentimiento.</p>

<h2>Más información</h2>
<p>Si tienes dudas sobre nuestra política de cookies, escríbenos a ${correo}. Para más información sobre el tratamiento de tus datos, consulta nuestra política de privacidad.</p>`;
}

const GENERADORES: Record<
  TipoPaginaLegal,
  { nombre: string; slug: string; titulo: string; html: (d: DatosLegalesEmpresa) => string }
> = {
  privacidad: {
    nombre: "Política de privacidad",
    slug: "politica-de-privacidad",
    titulo: "Política de privacidad",
    html: htmlPrivacidad,
  },
  aviso_legal: {
    nombre: "Aviso legal",
    slug: "aviso-legal",
    titulo: "Aviso legal",
    html: htmlAvisoLegal,
  },
  cookies: {
    nombre: "Política de cookies",
    slug: "politica-de-cookies",
    titulo: "Política de cookies",
    html: htmlCookies,
  },
};

export const TIPOS_PAGINA_LEGAL = Object.keys(GENERADORES) as TipoPaginaLegal[];

/**
 * Genera los tres documentos legales de una empresa a partir de su
 * `datos_generales`. Los datos que falten quedan marcados como pendientes y se
 * reportan en `avisos`.
 */
export function generarTextosLegales(
  datosGenerales: Record<string, unknown> | null | undefined,
  tipos: TipoPaginaLegal[] = TIPOS_PAGINA_LEGAL,
): ResultadoTextosLegales {
  const datos = extraerDatosLegales(datosGenerales);
  const avisos = validarDatosLegales(datos);

  const paginas = tipos.map((tipo) => {
    const gen = GENERADORES[tipo];
    return {
      tipo,
      nombre: gen.nombre,
      slug: gen.slug,
      titulo: gen.titulo,
      html: gen.html(datos),
    };
  });

  return { paginas, avisos };
}
