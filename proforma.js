/* Genera la proforma como archivo PDF de verdad (no impresión del navegador),
   para poder compartirla por WhatsApp, correo o donde sea desde el menú del sistema.
   Requiere jsPDF cargado antes que este archivo. */

const EMISOR = {
  rs: "TRANSPORTES AVENDAÑO Y AVENDAÑO LTDA",
  rut: "76.101.886-8",
  giro: "TRANSPORTE DE CARGA POR CARRETERA",
  dir: "Bulnes 832, Puerto Natales",
  mail: "finanzastransportes@gruposuperfrut.cl"
};

const TINTA   = [22, 32, 43];
const MARCA   = [45, 46, 130];
const CELESTE = [53, 168, 224];
const GRIS    = [74, 85, 104];
const LINEA   = [226, 232, 240];
const CREMA   = [255, 247, 230];
const AMBAR   = [184, 131, 12];
const SUAVE   = [244, 246, 249];

const pesos = n => "$" + Math.round(n).toLocaleString("es-CL");

/* f: la misma estructura que devuelve facturas() en la bandeja
   dias: días de vencimiento a mostrar en la nota */
function creaProformaPDF(f, dias){
  const { jsPDF } = window.jspdf;
  const d = new jsPDF({ unit: "mm", format: "letter" });
  const W = d.internal.pageSize.getWidth();
  const H = d.internal.pageSize.getHeight();
  const M = 16;
  const anchoUtil = W - M * 2;

  const hoy = new Date();
  const fecha = hoy.toLocaleDateString("es-CL", { day:"2-digit", month:"long", year:"numeric" });
  const nro = "PF-" + hoy.toISOString().slice(0,10).replace(/-/g,"") + "-" +
              f.cli.rut.replace(/[^0-9]/g,"").slice(-4);

  let y = M + 4;

  /* ----- Encabezado ----- */
  d.setFont("helvetica","bold").setFontSize(12).setTextColor(...MARCA);
  d.text(EMISOR.rs, M, y);
  d.setFont("helvetica","normal").setFontSize(8.5).setTextColor(...GRIS);
  [ "RUT " + EMISOR.rut, EMISOR.giro, EMISOR.dir, EMISOR.mail ].forEach((t,i) => {
    d.text(t, M, y + 5.5 + i * 4.2);
  });

  /* Sello de proforma */
  const sw = 58, sh = 24, sx = W - M - sw, sy = M - 2;
  d.setDrawColor(...MARCA).setLineWidth(0.6).roundedRect(sx, sy, sw, sh, 2, 2);
  d.setFont("helvetica","bold").setFontSize(14).setTextColor(...MARCA);
  d.text("PROFORMA", sx + sw/2, sy + 9, { align:"center" });
  d.setFont("helvetica","normal").setFontSize(8).setTextColor(...GRIS);
  d.text(nro, sx + sw/2, sy + 15, { align:"center" });
  d.text(fecha, sx + sw/2, sy + 20, { align:"center" });

  y += 27;
  d.setDrawColor(...MARCA).setLineWidth(1).line(M, y, W - M, y);
  y += 9;

  /* ----- Cliente ----- */
  d.setFont("helvetica","bold").setFontSize(9).setTextColor(...MARCA);
  d.text("SEÑORES", M, y);
  y += 4;

  const datosCli = [
    f.cli.rs,
    "RUT " + f.cli.rut,
    f.cli.gir || "",
    [f.cli.dir, f.cli.com].filter(Boolean).join(", ")
  ].filter(Boolean);
  const altoCli = datosCli.length * 4.6 + 7;
  d.setFillColor(...SUAVE).rect(M, y, anchoUtil, altoCli, "F");
  d.setFillColor(...CELESTE).rect(M, y, 1.4, altoCli, "F");
  datosCli.forEach((t,i) => {
    d.setFont("helvetica", i === 0 ? "bold" : "normal").setFontSize(i === 0 ? 10 : 8.5)
     .setTextColor(...(i === 0 ? TINTA : GRIS));
    d.text(t, M + 6, y + 6.5 + i * 4.6);
  });
  y += altoCli + 10;

  /* ----- Detalle ----- */
  d.setFont("helvetica","bold").setFontSize(9).setTextColor(...MARCA);
  d.text("DETALLE", M, y);
  y += 4;

  const cN = M + 6;            // número
  const cS = M + 12;           // servicio
  const cCant = W - M - 74;    // cantidad (derecha)
  const cUnit = W - M - 38;    // valor unitario (derecha)
  const cNeto = W - M - 2;     // neto (derecha)
  const anchoServ = cCant - cS - 12;

  d.setFillColor(...MARCA).rect(M, y, anchoUtil, 8, "F");
  d.setFont("helvetica","bold").setFontSize(7.5).setTextColor(255,255,255);
  d.text("#", cN, y + 5.3, { align:"center" });
  d.text("SERVICIO", cS, y + 5.3);
  d.text("CANTIDAD", cCant, y + 5.3, { align:"right" });
  d.text("VALOR UNITARIO", cUnit, y + 5.3, { align:"right" });
  d.text("NETO", cNeto, y + 5.3, { align:"right" });
  y += 8;

  f.lineas.forEach((l, i) => {
    const neto = Math.round(l.cantidad * l.unit);
    d.setFont("helvetica","bold").setFontSize(9).setTextColor(...TINTA);
    const glosa = d.splitTextToSize(l.glosa, anchoServ);
    d.setFont("helvetica","normal").setFontSize(8).setTextColor(...GRIS);
    const desc = l.desc ? d.splitTextToSize(l.desc, anchoServ) : [];
    const alto = glosa.length * 4.4 + desc.length * 3.9 + 7;

    if(y + alto > H - 46){ d.addPage(); y = M; }

    d.setFont("helvetica","normal").setFontSize(8).setTextColor(150,157,168);
    d.text(String(i+1), cN, y + 5.5, { align:"center" });

    d.setFont("helvetica","bold").setFontSize(9).setTextColor(...TINTA);
    glosa.forEach((t,k) => d.text(t, cS, y + 5.5 + k * 4.4));

    if(desc.length){
      d.setFont("helvetica","normal").setFontSize(8).setTextColor(...GRIS);
      desc.forEach((t,k) => d.text(t, cS, y + 5.5 + glosa.length * 4.4 + k * 3.9));
    }

    d.setFont("helvetica","normal").setFontSize(9).setTextColor(...TINTA);
    d.text(l.cantidad.toLocaleString("es-CL"), cCant, y + 5.5, { align:"right" });
    d.text(pesos(l.unit), cUnit, y + 5.5, { align:"right" });
    d.setFont("helvetica","bold");
    d.text(pesos(neto), cNeto, y + 5.5, { align:"right" });

    y += alto;
    d.setDrawColor(...LINEA).setLineWidth(0.2).line(M, y, W - M, y);
  });

  /* ----- Totales ----- */
  y += 8;
  if(y > H - 60){ d.addPage(); y = M + 8; }
  const tx = W - M - 72;
  d.setFont("helvetica","normal").setFontSize(9).setTextColor(...GRIS);
  d.text("Neto", tx, y);
  d.setTextColor(...TINTA).text(pesos(f.neto), cNeto, y, { align:"right" });
  y += 6;
  d.setTextColor(...GRIS).text("IVA 19%", tx, y);
  d.setTextColor(...TINTA).text(pesos(f.iva), cNeto, y, { align:"right" });
  y += 4;
  d.setDrawColor(...MARCA).setLineWidth(0.6).line(tx, y, W - M, y);
  y += 7;
  d.setFont("helvetica","bold").setFontSize(12).setTextColor(...TINTA);
  d.text("TOTAL", tx, y);
  d.text(pesos(f.total), cNeto, y, { align:"right" });

  /* ----- Nota ----- */
  y += 12;
  const nota1 = "Este documento no tiene valor tributario. Es una proforma emitida para su revisión y para que " +
                "pueda generar la orden de compra correspondiente. La factura electrónica se emitirá una vez " +
                "recibida su conformidad.";
  const nota2 = "Condición de pago: crédito " + dias + " días desde la emisión de la factura. " +
                "Valores expresados en pesos chilenos.";
  const l1 = d.splitTextToSize(nota1, anchoUtil - 12);
  const l2 = d.splitTextToSize(nota2, anchoUtil - 12);
  const altoNota = (l1.length + l2.length) * 4 + 12;
  if(y + altoNota > H - 22){ d.addPage(); y = M + 8; }
  d.setFillColor(...CREMA).rect(M, y, anchoUtil, altoNota, "F");
  d.setFillColor(...AMBAR).rect(M, y, 1.4, altoNota, "F");
  d.setFontSize(8).setTextColor(...TINTA);
  l1.forEach((t,i) => {
    d.setFont("helvetica", i === 0 ? "bold" : "normal");
    d.text(t, M + 6, y + 6 + i * 4);
  });
  d.setFont("helvetica","normal").setTextColor(...GRIS);
  l2.forEach((t,i) => d.text(t, M + 6, y + 10 + l1.length * 4 + i * 4));

  /* ----- Pie en todas las páginas ----- */
  const n = d.getNumberOfPages();
  for(let p = 1; p <= n; p++){
    d.setPage(p);
    d.setDrawColor(...LINEA).setLineWidth(0.2).line(M, H - 16, W - M, H - 16);
    d.setFont("helvetica","normal").setFontSize(7).setTextColor(150,157,168);
    d.text(EMISOR.rs + " · " + EMISOR.dir + " · " + EMISOR.mail, W/2, H - 11, { align:"center" });
    if(n > 1) d.text("Página " + p + " de " + n, W - M, H - 11, { align:"right" });
  }

  return { doc: d, nombre: nro + " " + f.cli.cliente.replace(/[^A-Za-z0-9 ]/g,"") + ".pdf" };
}
