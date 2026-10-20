/* ============================================================
   DataScope Maicao · libreta de publicaciones (Google Apps Script)
   Cambia CLAVE por la clave del equipo.
   Después de cada cambio: Implementar > Administrar implementaciones > Versión nueva.
   Guarda solo lo que dice la ficha: nada de nombres de cuentas, teléfonos, fotos ni grupos.
   ============================================================ */
var CLAVE = "Data12345";
var HOJA = "Publicaciones";
var ZONA = "America/Bogota";
var CABECERA = ["ID", "Fecha", "Canal", "Tema", "Fuente", "Pide reenvío", "Veces", "Resumen", "Creado"];
var CANALES = ["WhatsApp", "Facebook", "Instagram"];
var TEMAS = ["Salud", "Seguridad", "Política"];
var FUENTES = ["Entidad", "Solo un perfil", "Ninguna"];
var SI_NO = ["Sí", "No"];

function doGet(e) {
  return salida({ ok: true, mensaje: "Libreta DataScope activa. Usa la página del proyecto." });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (String(p.clave || "") !== CLAVE) return salida({ ok: false, error: "Clave incorrecta." });
    var accion = String(p.accion || "");
    if (accion === "verificar") return salida({ ok: true, mensaje: "Clave correcta." });
    if (accion === "listar") return salida({ ok: true, datos: leerDatos() });
    if (accion === "guardar") return salida(guardar(p));
    if (accion === "borrar") return salida(borrar(p));
    return salida({ ok: false, error: "Acción no reconocida." });
  } catch (err) {
    return salida({ ok: false, error: "Error en el servidor: " + err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(HOJA);
  if (!h) {
    h = ss.insertSheet(HOJA);
    h.getRange(1, 1, 1, CABECERA.length).setValues([CABECERA]).setFontWeight("bold");
    h.setFrozenRows(1);
  }
  return h;
}

function texto(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, "yyyy-MM-dd");
  return String(v == null ? "" : v).trim();
}

function numero(v) {
  var t = texto(v).replace(",", ".");
  if (t === "") return null;
  var n = Number(t);
  return isNaN(n) ? null : n;
}

function leerDatos() {
  var h = hoja();
  var ultima = h.getLastRow();
  if (ultima < 2) return [];
  var filas = h.getRange(2, 1, ultima - 1, CABECERA.length).getValues();
  return filas.filter(function (f) { return texto(f[0]) !== ""; }).map(function (f) {
    return {
      id: texto(f[0]), fecha: texto(f[1]), canal: texto(f[2]), tema: texto(f[3]), fuente: texto(f[4]),
      reenvio: texto(f[5]), veces: numero(f[6]) || 0, resumen: texto(f[7])
    };
  });
}

function validarFila(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto(f.fecha))) return "Escribe la fecha.";
  if (CANALES.indexOf(texto(f.canal)) < 0) return "Elige un canal de la lista.";
  if (TEMAS.indexOf(texto(f.tema)) < 0) return "Elige un tema de la lista.";
  if (FUENTES.indexOf(texto(f.fuente)) < 0) return "Elige una fuente de la lista.";
  if (SI_NO.indexOf(texto(f.reenvio)) < 0) return "Indica si pide reenvío.";
  var v = numero(f.veces);
  if (v === null || v < 0 || v > 9999 || Math.floor(v) !== v) return "Las veces deben ser un número entero entre 0 y 9999.";
  var r = texto(f.resumen);
  if (r.length > 200) return "El resumen no puede tener más de 200 caracteres.";
  if (/\d{7,}/.test(r.replace(/[\s.\-]/g, "")) || /@|https?:\/\/|www\./i.test(r)) return "Quita teléfonos, correos o enlaces del resumen.";
  return "";
}

function buscarFila(h, id) {
  var ultima = h.getLastRow();
  if (ultima < 2) return 0;
  var ids = h.getRange(2, 1, ultima - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (texto(ids[i][0]) === id) return i + 2;
  return 0;
}

function siguienteNumero(h) {
  var ultima = h.getLastRow(), max = 0;
  if (ultima >= 2) {
    h.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (f) {
      var n = parseInt(texto(f[0]).replace(/\D/g, ""), 10);
      if (n > max) max = n;
    });
  }
  return max + 1;
}

function guardar(p) {
  var f = p.fila || {};
  var err = validarFila(f);
  if (err) return { ok: false, error: err };
  var h = hoja();
  var id = texto(f.id);
  var datos = [
    id, texto(f.fecha), texto(f.canal), texto(f.tema), texto(f.fuente), texto(f.reenvio),
    numero(f.veces), texto(f.resumen), Utilities.formatDate(new Date(), ZONA, "yyyy-MM-dd HH:mm")
  ];
  if (id) {
    var fila = buscarFila(h, id);
    if (!fila) return { ok: false, error: "No encuentro la publicación " + id + "." };
    datos[8] = h.getRange(fila, 9).getValue();
    h.getRange(fila, 1, 1, CABECERA.length).setValues([datos]);
    return { ok: true, mensaje: "Cambios guardados en " + id + "." };
  }
  var n = siguienteNumero(h);
  datos[0] = "P" + (n < 100 ? ("0" + n).slice(-2) : String(n));
  h.appendRow(datos);
  return { ok: true, mensaje: "Publicación " + datos[0] + " guardada." };
}

function borrar(p) {
  var h = hoja();
  var fila = buscarFila(h, texto(p.id));
  if (!fila) return { ok: false, error: "No encuentro la publicación " + texto(p.id) + "." };
  h.deleteRow(fila);
  return { ok: true, mensaje: "Publicación borrada." };
}
