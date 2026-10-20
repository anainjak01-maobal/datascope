(function () {
  "use strict";
  var CFG = window.DS_CONFIG || {};
  var CANALES = ["WhatsApp", "Facebook", "Instagram"];
  var TEMAS_ANALISIS = ["Salud", "Seguridad", "Política"];
  var TEMAS = TEMAS_ANALISIS.concat(["Otros"]);
  var FUENTES = ["Entidad", "Solo un perfil", "Ninguna"];
  var COL_SIN = "#f28c6b", COL_CON = "#7fd1c7", COL_EJE = "#9db0c4", COL_GRID = "#24395a";
  var clave = "", datos = [], filtros = { tema: "Todos", canal: "Todos" };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function msg(el, t, tipo) { el.textContent = t; el.className = "msg" + (tipo ? " " + tipo : ""); }
  function dec(n) { return n == null || isNaN(n) ? "—" : n.toFixed(2).replace(".", ","); }
  function promedio(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function pct(n, total) { return total ? Math.round((n / total) * 100) + " % del total" : ""; }

  function enviar(accion, extra) {
    if (!CFG.REGISTRO) return Promise.resolve({ ok: false, error: "Falta la dirección del registro en config.js." });
    var cuerpo = Object.assign({ accion: accion, clave: clave }, extra || {});
    return fetch(CFG.REGISTRO, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(cuerpo)
    }).then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: "No hay conexión con el registro. Intenta de nuevo." }; });
  }

  /* ---------- Navegación ---------- */
  var VISTAS = ["panel", "registrar", "libreta"];
  function mostrar(vista) {
    VISTAS.forEach(function (v) { $("vista-" + v).hidden = v !== vista; });
    document.querySelectorAll("[data-vista]").forEach(function (b) {
      b.setAttribute("aria-current", b.dataset.vista === vista ? "page" : "false");
    });
    if (vista === "panel") pintarPanel();
    if (vista === "libreta") pintarLibreta();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("[data-vista]").forEach(function (b) {
    b.addEventListener("click", function () { mostrar(b.dataset.vista); });
  });

  /* ---------- Acceso ---------- */
  $("acc-form").addEventListener("submit", function (e) {
    e.preventDefault();
    clave = $("clave").value;
    if (!clave) return;
    $("acc-btn").disabled = true; msg($("acc-msg"), "Entrando…");
    enviar("verificar").then(function (r) {
      $("acc-btn").disabled = false;
      if (!r.ok) { clave = ""; msg($("acc-msg"), r.error || "Clave incorrecta.", "error"); return; }
      $("clave").value = "";
      $("vista-acceso").hidden = true;
      $("barra").hidden = false;
      $("titulo").textContent = "Panel del equipo";
      prepararFormulario();
      cargarTodo().then(function () { mostrar("panel"); });
    });
  });
  $("salir").addEventListener("click", function () {
    clave = ""; datos = [];
    VISTAS.forEach(function (v) { $("vista-" + v).hidden = true; });
    $("barra").hidden = true;
    $("vista-acceso").hidden = false;
    $("titulo").textContent = "Entrar";
    msg($("acc-msg"), "");
  });

  /* ---------- Carga de datos ---------- */
  function cargarTodo() {
    return enviar("listar").then(function (r) {
      if (!r.ok) { msg($("panel-msg"), r.error || "No pude cargar los datos.", "error"); return; }
      datos = (r.datos || []).map(function (d) { d.veces = Number(d.veces) || 0; return d; });
      llenarFiltros();
      pintarPanel();
      pintarLibreta();
    });
  }

  /* ---------- Filtros del panel ---------- */
  function llenarFiltros() {
    $("f-tema").innerHTML = ["Todos"].concat(TEMAS_ANALISIS).map(function (t) {
      return '<option' + (t === filtros.tema ? " selected" : "") + ">" + esc(t) + "</option>";
    }).join("");
    $("f-canal").innerHTML = ["Todos"].concat(CANALES).map(function (c) {
      return '<option' + (c === filtros.canal ? " selected" : "") + ">" + esc(c) + "</option>";
    }).join("");
  }
  $("f-tema").addEventListener("change", function () { filtros.tema = $("f-tema").value; pintarPanel(); });
  $("f-canal").addEventListener("change", function () { filtros.canal = $("f-canal").value; pintarPanel(); });

  function filasFiltradas() {
    return datos.filter(function (d) {
      return d.tema !== "Otros" && (filtros.tema === "Todos" || d.tema === filtros.tema) && (filtros.canal === "Todos" || d.canal === filtros.canal);
    });
  }

  /* ---------- Panel ---------- */
  function pintarPanel() {
    if (!datos.length) {
      msg($("panel-msg"), "Todavía no hay publicaciones registradas.");
      ["kpis", "g-canales", "g-veces", "tbody-matriz", "tbody-entidad"].forEach(function (id) { $(id).innerHTML = ""; });
      return;
    }
    var rs = filasFiltradas();
    msg($("panel-msg"), rs.length ? "" : "Ninguna publicación con estos filtros.");
    var sin = rs.filter(function (d) { return d.fuente === "Ninguna"; });
    var ent = rs.filter(function (d) { return d.fuente === "Entidad"; });
    var per = rs.filter(function (d) { return d.fuente === "Solo un perfil"; });
    var reen = rs.filter(function (d) { return d.reenvio === "Sí"; });
    var reenSin = sin.filter(function (d) { return d.reenvio === "Sí"; });
    var kpis = [
      { l: "Publicaciones", v: rs.length },
      { l: "Sin fuente", v: sin.length, sub: pct(sin.length, rs.length), alerta: true },
      { l: "Nombran una entidad", v: ent.length, sub: pct(ent.length, rs.length) },
      { l: "Solo un perfil", v: per.length, sub: pct(per.length, rs.length) },
      { l: "Piden reenvío", v: reen.length, sub: pct(reen.length, rs.length) },
      { l: "Piden reenvío y no nombran fuente", v: reenSin.length, sub: "de " + sin.length + " sin fuente", alerta: true }
    ];
    $("kpis").innerHTML = kpis.map(function (k, i) {
      return '<div class="kpi" style="animation-delay:' + (i * 60) + 'ms"><div class="lbl">' + esc(k.l) + '</div>' +
        '<div class="val' + (k.alerta ? " alerta" : "") + '">' + k.v + '</div>' +
        (k.sub ? '<div class="sub">' + esc(k.sub) + '</div>' : "") + "</div>";
    }).join("");
    $("g-canales").innerHTML = graficoCanales(rs);
    $("g-veces").innerHTML = graficoVeces(rs);
    $("tbody-matriz").innerHTML = CANALES.map(function (c) {
      var del = rs.filter(function (d) { return d.canal === c; });
      var s = del.filter(function (d) { return d.fuente === "Ninguna"; });
      var k = del.filter(function (d) { return d.fuente !== "Ninguna"; });
      return "<tr><td>" + c + '</td><td class="n">' + s.length + '</td><td class="n">' + dec(promedio(s.map(function (d) { return d.veces; }))) +
        '</td><td class="n">' + k.length + '</td><td class="n">' + dec(promedio(k.map(function (d) { return d.veces; }))) + "</td></tr>";
    }).join("");
    $("tbody-entidad").innerHTML = ent.length ? ent.map(function (d) {
      return "<tr><td>" + esc(d.id) + "</td><td>" + esc(d.fecha) + "</td><td>" + esc(d.canal) + "</td><td>" + esc(d.tema) +
        '</td><td class="n">' + d.veces + "</td></tr>";
    }).join("") : '<tr><td colspan="5" class="muted">Ninguna con estos filtros.</td></tr>';
  }

  function graficoCanales(rs) {
    var W = 640, H = 300, L = 44, R = 16, T = 44, B = 44, pw = W - L - R, ph = H - T - B;
    var filas = CANALES.map(function (c) {
      var del = rs.filter(function (d) { return d.canal === c; });
      return { c: c, sin: del.filter(function (d) { return d.fuente === "Ninguna"; }).length,
               con: del.filter(function (d) { return d.fuente !== "Ninguna"; }).length };
    });
    var max = Math.max(1, Math.max.apply(null, filas.map(function (f) { return f.sin + f.con; }))) * 1.15;
    function sy(v) { return T + ph - (v / max) * ph; }
    var out = "";
    [0, 0.5, 1].forEach(function (t) {
      var v = Math.round(max * t);
      out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(v) + '" y2="' + sy(v) + '" stroke="' + COL_GRID + '"/>' +
        '<text class="eje" x="' + (L - 8) + '" y="' + (sy(v) + 4) + '" text-anchor="end">' + v + "</text>";
    });
    var slot = pw / CANALES.length, bw = Math.min(90, slot * 0.5);
    filas.forEach(function (f, i) {
      var cx = L + slot * i + slot / 2, x = cx - bw / 2, tot = f.sin + f.con;
      if (f.sin) out += '<rect class="barra" x="' + x + '" y="' + sy(f.sin) + '" width="' + bw + '" height="' + (sy(0) - sy(f.sin)) +
        '" rx="4" fill="' + COL_SIN + '"><title>' + f.c + ": " + f.sin + " sin fuente</title></rect>";
      if (f.con) out += '<rect class="barra" x="' + x + '" y="' + sy(tot) + '" width="' + bw + '" height="' + (sy(f.sin) - sy(tot)) +
        '" rx="4" fill="' + COL_CON + '"><title>' + f.c + ": " + f.con + " con fuente</title></rect>";
      out += '<text class="etiq" x="' + cx + '" y="' + (H - B + 24) + '" text-anchor="middle">' + f.c + "</text>";
      if (tot) out += '<text class="etiq" x="' + cx + '" y="' + (sy(tot) - 8) + '" text-anchor="middle">' + tot + "</text>";
    });
    out += '<rect x="' + L + '" y="14" width="12" height="12" rx="3" fill="' + COL_SIN + '"/><text class="eje" x="' + (L + 18) + '" y="25">Sin fuente</text>' +
      '<rect x="' + (L + 110) + '" y="14" width="12" height="12" rx="3" fill="' + COL_CON + '"/><text class="eje" x="' + (L + 128) + '" y="25">Con fuente</text>';
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Publicaciones por canal, con y sin fuente">' + out + "</svg>";
  }

  function graficoVeces(rs) {
    var W = 640, H = 260, L = 44, R = 16, T = 24, B = 48, pw = W - L - R, ph = H - T - B;
    var filas = FUENTES.map(function (f) {
      var v = rs.filter(function (d) { return d.fuente === f; }).map(function (d) { return d.veces; });
      return { f: f, n: v.length, m: promedio(v) };
    });
    var max = Math.max(1, Math.ceil(Math.max.apply(null, filas.map(function (x) { return x.m || 0; }))));
    function sy(v) { return T + ph - (v / max) * ph; }
    var out = "";
    [0, max / 2, max].forEach(function (v) {
      out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(v) + '" y2="' + sy(v) + '" stroke="' + COL_GRID + '"/>' +
        '<text class="eje" x="' + (L - 8) + '" y="' + (sy(v) + 4) + '" text-anchor="end">' + String(v).replace(".", ",") + "</text>";
    });
    var slot = pw / FUENTES.length, bw = Math.min(110, slot * 0.5);
    filas.forEach(function (x, i) {
      var cx = L + slot * i + slot / 2, bx = cx - bw / 2;
      var color = x.f === "Ninguna" ? COL_SIN : COL_CON;
      if (x.m != null) out += '<rect class="barra" x="' + bx + '" y="' + sy(x.m) + '" width="' + bw + '" height="' + (sy(0) - sy(x.m)) +
        '" rx="4" fill="' + color + '"><title>' + x.f + ": " + dec(x.m) + " veces en promedio (" + x.n + " publicaciones)</title></rect>" +
        '<text class="etiq" x="' + cx + '" y="' + (sy(x.m) - 8) + '" text-anchor="middle">' + dec(x.m) + "</text>";
      else out += '<text class="eje" x="' + cx + '" y="' + (sy(0) - 10) + '" text-anchor="middle">sin datos</text>';
      out += '<text class="etiq" x="' + cx + '" y="' + (H - B + 24) + '" text-anchor="middle">' + x.f + "</text>" +
        '<text class="eje" x="' + cx + '" y="' + (H - B + 42) + '" text-anchor="middle">n = ' + x.n + "</text>";
    });
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Promedio de veces que circuló según la fuente">' + out + "</svg>";
  }

  /* ---------- Registrar ---------- */
  function hoyBogota() {
    try { return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" }); }
    catch (e) { return ""; }
  }
  function opciones(lista) {
    return lista.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("");
  }
  function prepararFormulario() {
    $("r-canal").innerHTML = opciones(CANALES);
    $("r-tema").innerHTML = opciones(TEMAS);
    $("r-fuente").innerHTML = opciones(FUENTES);
    limpiarFormulario();
  }
  function limpiarFormulario() {
    $("r-id").value = "";
    $("r-titulo").textContent = "Registrar una publicación";
    $("r-fecha").value = hoyBogota();
    $("r-canal").selectedIndex = 0; $("r-tema").selectedIndex = 0; $("r-fuente").selectedIndex = 0;
    $("r-reenvio").selectedIndex = 0; $("r-veces").value = ""; $("r-resumen").value = "";
  }
  $("r-limpiar").addEventListener("click", function () { limpiarFormulario(); msg($("r-msg"), ""); });

  function validarLocal(f) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) return "Escribe la fecha.";
    if (CANALES.indexOf(f.canal) < 0 || TEMAS.indexOf(f.tema) < 0 || FUENTES.indexOf(f.fuente) < 0) return "Revisa canal, tema y fuente.";
    if (!/^\d{1,4}$/.test(f.veces)) return "Las veces deben ser un número entero entre 0 y 9999.";
    if (f.resumen.length > 200) return "El resumen no puede tener más de 200 caracteres.";
    if (/\d{7,}/.test(f.resumen.replace(/[\s.\-]/g, "")) || /@|https?:\/\/|www\./i.test(f.resumen)) {
      return "Quita teléfonos, correos o enlaces del resumen.";
    }
    return "";
  }
  $("r-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = {
      id: $("r-id").value, fecha: $("r-fecha").value, canal: $("r-canal").value, tema: $("r-tema").value,
      fuente: $("r-fuente").value, reenvio: $("r-reenvio").value, veces: $("r-veces").value.trim(), resumen: $("r-resumen").value.trim()
    };
    var err = validarLocal(f);
    if (err) { msg($("r-msg"), err, "error"); return; }
    $("r-guardar").disabled = true; msg($("r-msg"), "Guardando…");
    enviar("guardar", { fila: f }).then(function (r) {
      $("r-guardar").disabled = false;
      if (!r.ok) { msg($("r-msg"), r.error || "No se pudo guardar.", "error"); return; }
      var recordar = f.id;
      limpiarFormulario();
      msg($("r-msg"), r.mensaje, "ok");
      cargarTodo();
      if (recordar) mostrar("libreta");
    });
  });

  /* ---------- Libreta ---------- */
  function pintarLibreta() {
    var rs = datos.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id < b.id ? -1 : 1; });
    $("l-resumen").textContent = datos.length + " publicaciones registradas.";
    $("tbody-libreta").innerHTML = rs.length ? rs.map(function (d) {
      return "<tr><td>" + esc(d.id) + "</td><td>" + esc(d.fecha) + "</td><td>" + esc(d.canal) + "</td><td>" + esc(d.tema) +
        "</td><td>" + esc(d.fuente) + "</td><td>" + esc(d.reenvio) + '</td><td class="n">' + d.veces + '</td><td class="resumen">' + esc(d.resumen) +
        '</td><td><button class="btn pequeno" type="button" data-accion="editar" data-id="' + esc(d.id) + '">Editar</button> ' +
        '<button class="btn pequeno peligro" type="button" data-accion="quitar" data-id="' + esc(d.id) + '">Quitar</button></td></tr>';
    }).join("") : '<tr><td colspan="9" class="muted">Todavía no hay publicaciones.</td></tr>';
  }
  $("tbody-libreta").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-accion]");
    if (!b) return;
    var id = b.dataset.id;
    var d = datos.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    if (b.dataset.accion === "editar") {
      $("r-id").value = d.id; $("r-titulo").textContent = "Editar publicación " + d.id;
      $("r-fecha").value = d.fecha; $("r-canal").value = d.canal; $("r-tema").value = d.tema;
      $("r-fuente").value = d.fuente; $("r-reenvio").value = d.reenvio; $("r-veces").value = d.veces; $("r-resumen").value = d.resumen;
      msg($("r-msg"), ""); mostrar("registrar");
      return;
    }
    if (!confirm("¿Quitar la publicación " + id + " de la libreta?")) return;
    enviar("borrar", { id: id }).then(function (r) {
      msg($("l-msg"), r.ok ? "Publicación " + id + " quitada." : (r.error || "No se pudo quitar."), r.ok ? "ok" : "error");
      if (r.ok) cargarTodo();
    });
  });
})();
