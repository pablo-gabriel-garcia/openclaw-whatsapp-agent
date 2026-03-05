const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_API_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// ── FASE 1: Verificación del webhook (challenge) ──────────────────────────────
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[WEBHOOK] Solicitud de verificación recibida. Mode: ${mode}`);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WEBHOOK] ✅ Verificación exitosa. Respondiendo con challenge.');
    res.status(200).send(challenge);
  } else {
    console.warn('[WEBHOOK] ❌ Token inválido. Verificación rechazada.');
    res.sendStatus(403);
  }
});

// ── FASE 2: Recepción de mensajes ─────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object !== 'whatsapp_business_account') {
    console.warn('[EVENTO] Objeto desconocido recibido:', body.object);
    return res.sendStatus(404);
  }

  // Confirmar recepción inmediatamente (requerido por WhatsApp)
  res.sendStatus(200);

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      console.log('[EVENTO] Notificación recibida sin mensajes (estado/leído).');
      return;
    }

    const message = messages[0];
    const from = message.from; // número del remitente
    const msgType = message.type;

    console.log(`[MENSAJE] De: ${from} | Tipo: ${msgType}`);

    // ── CONDICIÓN: Solo procesar mensajes de texto ────────────────────────────
    if (msgType !== 'text') {
      console.log(`[CONDICIÓN] Tipo de mensaje no soportado: ${msgType}. Ignorado.`);
      return;
    }

    const textoRecibido = message.text.body.toLowerCase().trim();
    console.log(`[MENSAJE] Texto: "${textoRecibido}"`);

    // ── LÓGICA DEL AGENTE ─────────────────────────────────────────────────────
    let respuesta = '';

    if (textoRecibido.includes('hola') || textoRecibido.includes('buenas')) {
      respuesta = '👋 ¡Hola! Soy el agente OpenClaw. ¿En qué puedo ayudarte?';
    } else if (textoRecibido.includes('info') || textoRecibido.includes('información')) {
      respuesta = 'ℹ️ Estoy configurado como agente de prueba. Podés escribirme "hola", "ayuda" o "estado".';
    } else if (textoRecibido.includes('estado') || textoRecibido.includes('status')) {
      respuesta = '✅ Sistema operativo. Agente activo y funcionando correctamente.';
    } else if (textoRecibido.includes('ayuda') || textoRecibido.includes('help')) {
      respuesta = '📋 Comandos disponibles:\n• *hola* — Saludo\n• *estado* — Estado del sistema\n• *info* — Información del agente';
    } else {
      respuesta = `🤖 Recibí tu mensaje: "${message.text.body}". Por ahora solo entiendo: hola, estado, info, ayuda.`;
    }

    // ── ACCIÓN: Enviar respuesta ──────────────────────────────────────────────
    await enviarMensaje(from, respuesta);

  } catch (error) {
    console.error('[ERROR] Fallo al procesar mensaje:', error.message);
  }
});

// ── Función para enviar mensajes vía API de WhatsApp ──────────────────────────
async function enviarMensaje(destinatario, texto) {
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: destinatario,
    type: 'text',
    text: { body: texto }
  };

  console.log(`[ACCIÓN] Enviando mensaje a ${destinatario}: "${texto}"`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (response.ok) {
    console.log(`[ACCIÓN] ✅ Mensaje enviado correctamente. ID: ${result.messages?.[0]?.id}`);
  } else {
    console.error('[ACCIÓN] ❌ Error al enviar mensaje:', JSON.stringify(result));
  }
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    agente: 'OpenClaw WhatsApp Agent',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[INICIO] ✅ Agente OpenClaw corriendo en puerto ${PORT}`);
  console.log(`[INICIO] Webhook disponible en: /webhook`);
  console.log(`[INICIO] VERIFY_TOKEN configurado: ${VERIFY_TOKEN ? '✅ Sí' : '❌ No'}`);
  console.log(`[INICIO] WHATSAPP_TOKEN configurado: ${WHATSAPP_TOKEN ? '✅ Sí' : '❌ No'}`);
  console.log(`[INICIO] PHONE_NUMBER_ID configurado: ${PHONE_NUMBER_ID ? '✅ Sí' : '❌ No'}`);
});
