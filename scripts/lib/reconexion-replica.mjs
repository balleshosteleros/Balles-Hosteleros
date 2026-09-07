/**
 * PRP-088 — Devuelve el trozo de página que hace que una copia VUELVA A
 * FUNCIONAR con lo nuestro.
 *
 * Al clonar se quitan los scripts del origen, así que los botones que abrían el
 * formulario de GoHighLevel se quedan mudos: se ven, se pueden pulsar y no pasa
 * nada. Esto les devuelve la acción, pero contra el software: los datos caen en
 * `leads_web` (el mismo sitio que los formularios de las webs) y el visitante
 * pasa al paso siguiente del embudo.
 *
 * El formulario lleva estilos propios y aislados (prefijo `bh-`): tiene que
 * verse bien encima de CUALQUIER copia, sin heredar nada de ella ni pisarle
 * nada suyo.
 */

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/**
 * @param {object} cfg
 * @param {string} cfg.empresaId
 * @param {string} cfg.paginaId
 * @param {string|null} cfg.siguiente     Ruta a la que se pasa tras pulsar.
 * @param {boolean} cfg.pedirDatos        Pedir nombre, correo y teléfono antes de pasar.
 * @param {string} cfg.tituloFormulario
 * @param {string} cfg.hrefPrivacidad
 */
export function bloqueDeReconexion(cfg) {
  const config = {
    empresaId: cfg.empresaId,
    paginaId: cfg.paginaId,
    siguiente: cfg.siguiente ?? null,
    pedirDatos: Boolean(cfg.pedirDatos),
  };

  const titulo = escapar(cfg.tituloFormulario ?? "Déjanos tus datos y sigue");
  const privacidad = escapar(cfg.hrefPrivacidad ?? "/politica-de-privacidad");

  return `
<!-- Reconexión con el software (PRP-088). Este bloque es NUESTRO, no del origen. -->
<style>
  .bh-capa{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);padding:16px}
  .bh-capa[data-abierta="1"]{display:flex}
  .bh-caja{width:100%;max-width:420px;background:#fff;color:#111;border-radius:14px;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.4);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-height:92vh;overflow:auto}
  .bh-caja h2{margin:0 0 4px;font-size:19px;line-height:1.25;font-weight:700;color:#111}
  .bh-caja p.bh-ayuda{margin:0 0 18px;font-size:13px;color:#555}
  .bh-campo{margin-bottom:12px}
  .bh-campo label{display:block;font-size:12px;font-weight:600;margin-bottom:5px;color:#333}
  .bh-campo input[type=text],.bh-campo input[type=email],.bh-campo input[type=tel]{width:100%;box-sizing:border-box;padding:11px 12px;font-size:15px;border:1px solid #d4d4d8;border-radius:9px;background:#fff;color:#111;-webkit-appearance:none;appearance:none}
  .bh-campo input:focus{outline:2px solid #2563eb;outline-offset:1px;border-color:#2563eb}
  .bh-legal{display:flex;gap:9px;align-items:flex-start;font-size:12px;color:#444;margin-bottom:10px;line-height:1.45}
  .bh-legal input{margin-top:2px;width:16px;height:16px;flex:none}
  .bh-legal a{color:#2563eb;text-decoration:underline}
  .bh-enviar{width:100%;padding:13px;font-size:15px;font-weight:700;border:0;border-radius:9px;background:#111;color:#fff;cursor:pointer;margin-top:6px}
  .bh-enviar:disabled{opacity:.55;cursor:progress}
  .bh-cerrar{position:absolute;top:14px;right:16px;background:none;border:0;font-size:26px;line-height:1;color:#888;cursor:pointer}
  .bh-error{font-size:13px;color:#b91c1c;margin:8px 0 0}
</style>
<div class="bh-capa" id="bh-capa" role="dialog" aria-modal="true" aria-labelledby="bh-titulo">
  <div class="bh-caja" style="position:relative">
    <button class="bh-cerrar" type="button" id="bh-cerrar" aria-label="Cerrar">&times;</button>
    <h2 id="bh-titulo">${titulo}</h2>
    <p class="bh-ayuda">Solo lo necesario para avisarte. Nada de spam.</p>
    <form id="bh-form" novalidate>
      <div class="bh-campo">
        <label for="bh-nombre">Nombre</label>
        <input id="bh-nombre" name="nombre" type="text" autocomplete="name" required />
      </div>
      <div class="bh-campo">
        <label for="bh-email">Correo</label>
        <input id="bh-email" name="email" type="email" autocomplete="email" placeholder="carlos@gmail.com" required />
      </div>
      <div class="bh-campo">
        <label for="bh-telefono">Teléfono</label>
        <input id="bh-telefono" name="telefono" type="tel" autocomplete="tel" required />
      </div>
      <label class="bh-legal">
        <input type="checkbox" id="bh-privacidad" required />
        <span>He leído y acepto la <a href="${privacidad}" target="_blank" rel="noopener">política de privacidad</a>.</span>
      </label>
      <label class="bh-legal">
        <input type="checkbox" id="bh-comercial" />
        <span>Quiero enterarme de las novedades.</span>
      </label>
      <p class="bh-error" id="bh-error" hidden></p>
      <button class="bh-enviar" type="submit" id="bh-enviar">Continuar</button>
    </form>
  </div>
</div>
<script>
(function () {
  var cfg = ${JSON.stringify(config)};
  var capa = document.getElementById("bh-capa");
  var form = document.getElementById("bh-form");
  var error = document.getElementById("bh-error");
  var enviar = document.getElementById("bh-enviar");

  function abrir() { capa.setAttribute("data-abierta", "1"); document.getElementById("bh-nombre").focus(); }
  function cerrar() { capa.removeAttribute("data-abierta"); }
  function seguir() { if (cfg.siguiente) window.location.href = cfg.siguiente; }

  document.getElementById("bh-cerrar").addEventListener("click", cerrar);
  capa.addEventListener("click", function (e) { if (e.target === capa) cerrar(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrar(); });

  // Los botones del original se quedaron sin acción al quitar los scripts del
  // origen. Se les devuelve el trabajo: pedir los datos (o pasar directamente)
  // y llevar al siguiente paso del embudo.
  var botones = document.querySelectorAll("button:not([id^=bh-])");
  for (var i = 0; i < botones.length; i++) {
    (function (b) {
      // Los controles internos de un widget (calendario, selectores) no son
      // llamadas a la acción: no se tocan.
      if (b.closest("[class*=calendar], [class*=multiselect], [class*=vjs]")) return;
      b.addEventListener("click", function (e) {
        e.preventDefault();
        if (cfg.pedirDatos) abrir(); else seguir();
      });
    })(botones[i]);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    error.hidden = true;
    var nombre = document.getElementById("bh-nombre").value.trim();
    var email = document.getElementById("bh-email").value.trim();
    var telefono = document.getElementById("bh-telefono").value.trim();
    var privacidad = document.getElementById("bh-privacidad").checked;

    if (!nombre || !email || !telefono) { error.textContent = "Faltan datos por rellenar."; error.hidden = false; return; }
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) { error.textContent = "Ese correo no parece correcto."; error.hidden = false; return; }
    if (!privacidad) { error.textContent = "Hay que aceptar la política de privacidad."; error.hidden = false; return; }

    enviar.disabled = true;
    enviar.textContent = "Enviando…";

    fetch("/api/pagina-web/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresaId: cfg.empresaId,
        paginaId: cfg.paginaId,
        bloqueId: "embudo",
        payload: {
          nombre: nombre,
          email: email,
          telefono: telefono,
          comercial: document.getElementById("bh-comercial").checked,
        },
        referrer: document.referrer || null,
      }),
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.error || "No se ha podido guardar.");
        seguir();
      })
      .catch(function (err) {
        error.textContent = err.message;
        error.hidden = false;
        enviar.disabled = false;
        enviar.textContent = "Continuar";
      });
  });
})();
</script>
<!-- /Reconexión -->
`;
}
