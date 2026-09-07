/**
 * PRP-088 — Selector de huecos propio para una página clonada.
 *
 * Sustituye al calendario de GoHighLevel, que en la copia queda de foto muerta:
 * enseña las horas del día en que se hizo la captura y no reserva nada. Este
 * pide los huecos de verdad al software, en la hora de la EMPRESA, y al
 * reservar crea la cita y el cliente.
 *
 * Estilos con prefijo `bhc-` y aislados: tiene que verse bien encima de
 * cualquier copia, sin heredar ni pisar nada suyo.
 */

export function widgetDeCitas({ calendarioId, paginaId, origen, hrefPrivacidad }) {
  const cfg = JSON.stringify({
    calendarioId,
    paginaId: paginaId ?? null,
    origen: origen ?? null,
  });
  const privacidad = hrefPrivacidad ?? "/politica-de-privacidad";

  return `
<div id="bhc-widget" class="bhc-caja">
  <style>
    .bhc-caja{background:#fff;color:#111;border-radius:14px;padding:22px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:920px;margin:0 auto;box-shadow:0 18px 50px rgba(0,0,0,.25)}
    .bhc-caja *{box-sizing:border-box}
    .bhc-titulo{margin:0 0 2px;font-size:17px;font-weight:700;color:#111}
    .bhc-sub{margin:0 0 16px;font-size:13px;color:#666}
    .bhc-cols{display:grid;gap:18px;grid-template-columns:1fr}
    @media(min-width:720px){.bhc-cols{grid-template-columns:1.15fr .85fr}}
    .bhc-dias{display:flex;flex-wrap:wrap;gap:8px;max-height:270px;overflow:auto;padding-right:4px}
    .bhc-dia{min-width:78px;padding:9px 10px;border:1px solid #dcdce0;border-radius:10px;background:#fff;cursor:pointer;text-align:center;font-size:13px;color:#111}
    .bhc-dia small{display:block;color:#777;font-size:11px;text-transform:capitalize}
    .bhc-dia[aria-pressed="true"]{border-color:#111;background:#111;color:#fff}
    .bhc-dia[aria-pressed="true"] small{color:#ddd}
    .bhc-horas{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;max-height:270px;overflow:auto}
    .bhc-hora{padding:10px;border:1px solid #2563eb;border-radius:10px;background:#fff;color:#2563eb;font-weight:600;font-size:14px;cursor:pointer}
    .bhc-hora[aria-pressed="true"]{background:#2563eb;color:#fff}
    .bhc-etiqueta{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#555;margin:0 0 8px}
    .bhc-form{margin-top:18px;border-top:1px solid #eee;padding-top:16px;display:none}
    .bhc-form[data-abierto="1"]{display:block}
    .bhc-campos{display:grid;gap:10px;grid-template-columns:1fr}
    @media(min-width:600px){.bhc-campos{grid-template-columns:1fr 1fr}}
    .bhc-campo label{display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#333}
    .bhc-campo input{width:100%;padding:10px 11px;font-size:15px;border:1px solid #d4d4d8;border-radius:9px;background:#fff;color:#111;-webkit-appearance:none;appearance:none}
    .bhc-legal{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#444;margin:12px 0 0;line-height:1.45}
    .bhc-legal input{margin-top:2px;width:16px;height:16px;flex:none}
    .bhc-legal a{color:#2563eb}
    .bhc-enviar{margin-top:14px;width:100%;padding:13px;font-size:15px;font-weight:700;border:0;border-radius:9px;background:#111;color:#fff;cursor:pointer}
    .bhc-enviar:disabled{opacity:.55;cursor:progress}
    .bhc-aviso{margin-top:10px;font-size:13px;color:#b91c1c}
    .bhc-ok{text-align:center;padding:26px 10px}
    .bhc-ok h3{margin:0 0 6px;font-size:18px;color:#111}
    .bhc-ok p{margin:0;font-size:14px;color:#555}
    .bhc-vacio{font-size:13px;color:#666}
  </style>

  <div id="bhc-cuerpo">
    <p class="bhc-titulo">Elige el día y la hora</p>
    <p class="bhc-sub" id="bhc-zona">Cargando huecos disponibles…</p>

    <div class="bhc-cols">
      <div>
        <p class="bhc-etiqueta">Día</p>
        <div class="bhc-dias" id="bhc-dias"></div>
      </div>
      <div>
        <p class="bhc-etiqueta">Hora</p>
        <div class="bhc-horas" id="bhc-horas">
          <span class="bhc-vacio">Elige antes un día.</span>
        </div>
      </div>
    </div>

    <form class="bhc-form" id="bhc-form">
      <div class="bhc-campos">
        <div class="bhc-campo">
          <label for="bhc-nombre">Nombre</label>
          <input id="bhc-nombre" type="text" autocomplete="name" required />
        </div>
        <div class="bhc-campo">
          <label for="bhc-email">Correo</label>
          <input id="bhc-email" type="email" autocomplete="email" placeholder="carlos@gmail.com" required />
        </div>
        <div class="bhc-campo">
          <label for="bhc-telefono">Teléfono (con prefijo del país)</label>
          <input id="bhc-telefono" type="tel" autocomplete="tel" placeholder="+34 600 00 00 00" required />
        </div>
        <div class="bhc-campo">
          <label for="bhc-notas">¿Algo que debamos saber? (opcional)</label>
          <input id="bhc-notas" type="text" />
        </div>
      </div>
      <label class="bhc-legal">
        <input type="checkbox" id="bhc-privacidad" required />
        <span>He leído y acepto la <a href="${privacidad}" target="_blank" rel="noopener">política de privacidad</a>.</span>
      </label>
      <p class="bhc-aviso" id="bhc-aviso" hidden></p>
      <button class="bhc-enviar" type="submit" id="bhc-enviar">Confirmar la cita</button>
    </form>
  </div>
</div>
<script>
(function () {
  var cfg = ${cfg};
  var elDias = document.getElementById("bhc-dias");
  var elHoras = document.getElementById("bhc-horas");
  var elForm = document.getElementById("bhc-form");
  var elZona = document.getElementById("bhc-zona");
  var elAviso = document.getElementById("bhc-aviso");
  var elEnviar = document.getElementById("bhc-enviar");
  var elegido = { fecha: null, hora: null };
  var dias = [];

  var MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  var SEMANA = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

  function etiquetaDia(fecha) {
    // Mediodía: así el día no se mueve por la zona del navegador.
    var d = new Date(fecha + "T12:00:00Z");
    return { dia: d.getUTCDate() + " " + MESES[d.getUTCMonth()], semana: SEMANA[d.getUTCDay()] };
  }

  function pintarDias() {
    elDias.innerHTML = "";
    if (dias.length === 0) {
      elDias.innerHTML = '<span class="bhc-vacio">Ahora mismo no hay horas libres. Prueba en unos días.</span>';
      return;
    }
    dias.forEach(function (d) {
      var e = etiquetaDia(d.fecha);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bhc-dia";
      b.setAttribute("aria-pressed", String(elegido.fecha === d.fecha));
      b.innerHTML = e.dia + "<small>" + e.semana + "</small>";
      b.addEventListener("click", function () {
        elegido = { fecha: d.fecha, hora: null };
        pintarDias();
        pintarHoras();
        elForm.removeAttribute("data-abierto");
      });
      elDias.appendChild(b);
    });
  }

  function pintarHoras() {
    elHoras.innerHTML = "";
    var dia = dias.filter(function (d) { return d.fecha === elegido.fecha; })[0];
    if (!dia) { elHoras.innerHTML = '<span class="bhc-vacio">Elige antes un día.</span>'; return; }
    dia.horas.forEach(function (h) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bhc-hora";
      b.textContent = h;
      b.setAttribute("aria-pressed", String(elegido.hora === h));
      b.addEventListener("click", function () {
        elegido.hora = h;
        pintarHoras();
        elForm.setAttribute("data-abierto", "1");
        document.getElementById("bhc-nombre").focus();
      });
      elHoras.appendChild(b);
    });
  }

  fetch("/api/citas/huecos?calendario=" + encodeURIComponent(cfg.calendarioId))
    .then(function (r) { return r.json(); })
    .then(function (r) {
      if (!r.ok) throw new Error(r.error || "No se han podido cargar las horas.");
      dias = r.dias || [];
      elZona.textContent = "Horas de " + (r.zonaHoraria || "la empresa") + " · " + (r.duracionMin || 60) + " minutos";
      pintarDias();
    })
    .catch(function (e) {
      elZona.textContent = e.message;
      elDias.innerHTML = "";
    });

  elForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    elAviso.hidden = true;
    if (!elegido.fecha || !elegido.hora) { elAviso.textContent = "Elige día y hora."; elAviso.hidden = false; return; }
    var privacidad = document.getElementById("bhc-privacidad").checked;
    if (!privacidad) { elAviso.textContent = "Hay que aceptar la política de privacidad."; elAviso.hidden = false; return; }

    elEnviar.disabled = true;
    elEnviar.textContent = "Reservando…";

    fetch("/api/citas/reservar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calendarioId: cfg.calendarioId,
        paginaId: cfg.paginaId,
        origen: cfg.origen,
        fecha: elegido.fecha,
        hora: elegido.hora,
        nombre: document.getElementById("bhc-nombre").value.trim(),
        email: document.getElementById("bhc-email").value.trim(),
        telefono: document.getElementById("bhc-telefono").value.trim(),
        notas: document.getElementById("bhc-notas").value.trim() || null,
        privacidad: true,
      }),
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.error || "No se ha podido reservar.");
        var e = etiquetaDia(elegido.fecha);
        document.getElementById("bhc-cuerpo").innerHTML =
          '<div class="bhc-ok"><h3>Cita confirmada</h3><p>' +
          e.semana + " " + e.dia + " a las " + elegido.hora +
          ". Te llega la confirmación al correo.</p></div>";
      })
      .catch(function (err) {
        elAviso.textContent = err.message;
        elAviso.hidden = false;
        elEnviar.disabled = false;
        elEnviar.textContent = "Confirmar la cita";
      });
  });
})();
</script>
`;
}
