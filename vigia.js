// Vigilante de FairPadel para Railway (servicio con horario: corre, revisa y termina).
// Railway lo arranca cada 5 minutos (railway.json → cronSchedule).
//
// Revisa la API (con la base) y la web. Si fallan 3 veces seguidas (40 s entre
// intentos) avisa por WhatsApp "Servidor CAIDO"; cuando vuelve, "Servidor de vuelta".
// Sólo avisa en los CAMBIOS: el último estado se guarda en el volumen /data.
//
// Variables (en Railway, por referencia a las del servidor; nunca escritas acá):
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, AVISO_WHATSAPP
//   ESTADO_PATH (opcional, por defecto /data/estado.txt)
const fs = require('fs');
const path = require('path');

const ESTADO_PATH = process.env.ESTADO_PATH || '/data/estado.txt';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function revisar() {
  try {
    const api = await fetch('https://api.fairpadel.com/api/health', { signal: AbortSignal.timeout(20000) });
    const cuerpo = await api.text();
    const web = await fetch('https://www.fairpadel.com/', { signal: AbortSignal.timeout(20000) });
    if (api.ok && cuerpo.includes('"db":"ok"') && web.status === 200) return null;
    return `servidor=${api.status} ${cuerpo.slice(0, 80)} web=${web.status}`;
  } catch (e) {
    return `sin respuesta (${e.message})`;
  }
}

function leerEstado() {
  try { return fs.readFileSync(ESTADO_PATH, 'utf8').trim() || 'arriba'; } catch { return 'arriba'; }
}

function guardarEstado(estado) {
  try {
    fs.mkdirSync(path.dirname(ESTADO_PATH), { recursive: true });
    fs.writeFileSync(ESTADO_PATH, estado);
  } catch (e) {
    console.log(`No se pudo guardar el estado: ${e.message}`);
  }
}

async function whatsapp(titulo, detalle) {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneId, AVISO_WHATSAPP: para } = process.env;
  if (!token || !phoneId || !para) { console.log(`Faltan variables de WhatsApp: no se avisó "${titulo}"`); return; }
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'template',
      template: {
        name: 'fairpadel_aviso_admin',
        language: { code: 'es' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: titulo }, { type: 'text', text: detalle }] }],
      },
    }),
  });
  console.log(`WhatsApp (${titulo}): HTTP ${r.status}`);
}

const horaPY = () =>
  new Date().toLocaleTimeString('es-PY', { timeZone: 'America/Asuncion', hour: '2-digit', minute: '2-digit', hour12: false });

async function main() {
  if (process.argv.includes('--probar')) {
    await whatsapp('Vigilante de prueba', `El vigilante de FairPadel en Railway funciona (${horaPY()})`);
    return;
  }
  let falla = null;
  for (let i = 1; i <= 3; i++) {
    falla = await revisar();
    if (!falla) break;
    console.log(`intento ${i}: ${falla}`);
    if (i < 3) await esperar(40000);
  }
  const ahora = falla ? 'caido' : 'arriba';
  const antes = leerEstado();
  console.log(`antes=${antes} ahora=${ahora}`);
  if (ahora !== antes) {
    if (ahora === 'caido') {
      await whatsapp('Servidor CAIDO', `FairPadel no responde desde las ${horaPY()} (revisado 3 veces en 2 minutos). Revisá Railway`);
    } else {
      await whatsapp('Servidor de vuelta', `FairPadel volvió a responder a las ${horaPY()}`);
    }
  }
  guardarEstado(ahora);
}

main().catch((e) => { console.log(`Vigilante falló: ${e.message}`); process.exitCode = 1; });
