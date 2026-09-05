/* Librería común del portal de Transportes Avendaño.
   Cargar ANTES del script de cada página.

   Qué cambió respecto de clientes.js: el maestro de clientes ya NO viaja en el
   repositorio. Contenía el RUT y el domicilio de todos los clientes, y GitHub
   Pages es público. Ahora vive en el Worker, detrás de la contraseña, y se
   descarga al abrir cada pantalla interna. */

const API = "https://transportes-api.tonnoaf.workers.dev";

/* ---------- Tarifas (no son secretas: el cotizador público las usa igual) ---------- */
const TARIFAS = { kg: 500, m3: 130000, minima: 25000, bulto: 6000, bins: 45000,
                  aereo_kg: 1200, aereo_minima: 30000 };

/* ---------- Maestro de clientes: se llena al cargar la página ---------- */
let CLIENTES = [];

/* ---------- Clave de acceso ---------- */
/* Se pide una vez y queda mientras dure la pestaña. No se guarda en el equipo
   ni viaja en el código: si alguien encuentra la dirección del portal, sin la
   clave no ve ningún dato. */
function claveGuardada(){
  return sessionStorage.getItem("ta_clave") || "";
}

function pideClave(motivo){
  const c = prompt((motivo ? motivo + "\n\n" : "") + "Clave de acceso del portal:");
  if(c === null) return null;
  sessionStorage.setItem("ta_clave", c.trim());
  return c.trim();
}

function olvidaClave(){ sessionStorage.removeItem("ta_clave"); }

/* ---------- Llamadas al Worker ---------- */
async function pide(ruta, opciones = {}, reintento = false){
  let clave = claveGuardada();
  if(!clave){
    clave = pideClave();
    if(clave === null) throw new Error("Se necesita la clave para continuar.");
  }
  const r = await fetch(API + "/" + ruta, {
    ...opciones,
    cache: "no-store",
    /* Se codifica: una cabecera HTTP no admite ñ ni tildes. */
    headers: { "Content-Type": "application/json",
               "X-Clave": encodeURIComponent(clave), ...(opciones.headers || {}) }
  });
  if(r.status === 401){
    olvidaClave();
    if(!reintento){
      const otra = pideClave("La clave no es correcta.");
      if(otra === null) throw new Error("Se necesita la clave para continuar.");
      return pide(ruta, opciones, true);
    }
    throw new Error("Clave incorrecta.");
  }
  if(!r.ok) throw new Error("HTTP " + r.status);
  return r;
}

async function leer(clave){
  const r = await pide(clave);
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}

async function guardar(clave, datos){
  await pide(clave, { method: "PUT", body: JSON.stringify(datos) });
  return true;
}

/* ---------- Arranque de una pantalla interna ---------- */
/* Descarga el maestro y avisa si algo falla, en vez de dejar la pantalla muda. */
async function iniciaPortal(){
  try{
    const datos = await leer("ta_clientes");
    CLIENTES.length = 0;
    datos.forEach(c => CLIENTES.push(c));
    if(!CLIENTES.length){
      alert("El maestro de clientes está vacío en el servidor.\n\n" +
            "Hay que subirlo una vez con instalar.html.");
    }
    return true;
  }catch(e){
    alert("No se pudo abrir el portal.\n\n" + e.message);
    return false;
  }
}

/* ---------- Búsqueda de clientes ---------- */
function normaliza(t){
  return (t||"").toString().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^A-Z0-9 ]/g," ").replace(/\s+/g," ").trim();
}

function buscaClientes(q){
  const n = normaliza(q);
  if(!n) return CLIENTES;
  const soloRut = n.replace(/[^0-9K]/g, "");
  return CLIENTES.filter(c =>
    normaliza(c.k).includes(n) ||
    normaliza(c.rs).includes(n) ||
    (c.alias && normaliza(c.alias).includes(n)) ||
    (soloRut.length >= 3 && (c.rut||"").replace(/[.\-]/g,"").includes(soloRut))
  );
}

function clientePorRut(rut){ return CLIENTES.find(c => c.rut === rut); }

/* ---------- Cálculo del flete ---------- */
function calculaFlete(cli, kg, m3){
  kg = Number(kg)||0; m3 = Number(m3)||0;
  const tarKg = (cli && cli.tar) ? cli.tar : TARIFAS.kg;
  let base, cantidad, unit, neto, detalle;

  if(cli && cli.rut === "96566100-K"){          // Explora: siempre en kilos
    const equiv = Math.round(m3 * 250);
    cantidad = Math.max(kg, equiv);
    unit = tarKg; base = "KG";
    neto = Math.round(cantidad * unit);
    detalle = "Peso a cobrar " + cantidad.toLocaleString("es-CL") + " kg (kilos reales " +
              kg.toLocaleString("es-CL") + ", equivalente por volumen " + equiv.toLocaleString("es-CL") + ")";
  } else {
    const porKg = Math.round(kg * tarKg);
    const porM3 = Math.round(m3 * TARIFAS.m3);
    if(porKg >= porM3){ base="KG"; cantidad=kg; unit=tarKg; neto=porKg; }
    else { base="MT3"; cantidad=m3; unit=TARIFAS.m3; neto=porM3; }
    detalle = "Por peso $" + porKg.toLocaleString("es-CL") + " · por volumen $" + porM3.toLocaleString("es-CL") +
              " → se cobra " + (base==="KG" ? "el peso" : "el volumen");
  }

  if(neto < TARIFAS.minima){
    base = "CARGA MINIMA"; cantidad = 1; unit = TARIFAS.minima; neto = TARIFAS.minima;
    detalle += ". No alcanza la carga mínima, se cobra $25.000";
  }
  return {base, cantidad, unit, neto, detalle};
}

/* Flete aéreo: $1.200 por kilo, con mínimo propio de $30.000.
   No se compara contra volumen ni usa la carga mínima terrestre. */
function calculaAereo(kg){
  kg = Number(kg)||0;
  let cantidad = kg, unit = TARIFAS.aereo_kg;
  let neto = Math.round(cantidad * unit);
  let detalle = kg.toLocaleString("es-CL") + " kg por $" + TARIFAS.aereo_kg + " el kilo";
  if(neto < TARIFAS.aereo_minima){
    cantidad = 1; unit = TARIFAS.aereo_minima; neto = TARIFAS.aereo_minima;
    detalle += ". No alcanza el mínimo aéreo, se cobra $30.000";
  }
  return {base:"AEREO", cantidad, unit, neto, detalle};
}

/* IVA con la regla que Facto valida: bruto por línea redondeado al final */
function ivaLinea(cantidad, unit){
  return Math.round(cantidad * unit * 1.19) - Math.round(cantidad * unit);
}
