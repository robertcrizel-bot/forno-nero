const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const STEPS = [
  "Pedido Confirmado",
  "Abrindo a Massa 48h",
  "No Forno a Lenha 485°C",
  "Saiu para Entrega / Pronto no Balcão",
  "Pedido Entregue"
];

const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const makeCode = () => "FN-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

function authorized(request, env) {
  const pin = request.headers.get("x-kitchen-pin") || "";
  return Boolean(env.KITCHEN_PIN && pin && pin === env.KITCHEN_PIN);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "allow": "GET, POST, PATCH, OPTIONS" } });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Banco de pedidos ainda não configurado." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  const customer = clean(body.customer, 100);
  const phone = clean(body.phone, 30).replace(/[^\d+]/g, "");
  const city = clean(body.city, 100);
  const mode = clean(body.mode, 40);
  const street = clean(body.street, 160);
  const number = clean(body.number, 30);
  const neighborhood = clean(body.neighborhood, 100);
  const complement = clean(body.complement, 160);
  const payment = clean(body.payment, 80);
  const notes = clean(body.notes, 1000);
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  const total = Number(body.total);

  if (!customer || phone.replace(/\D/g, "").length < 10 || !city || !mode || !payment || !items.length || !Number.isFinite(total) || total <= 0) {
    return json({ error: "Confira nome, celular, cidade, pagamento e itens do pedido." }, 400);
  }
  if (mode === "Delivery" && (!street || !number || !neighborhood)) {
    return json({ error: "Para delivery, informe rua, número e bairro." }, 400);
  }

  const code = makeCode();
  const trackingToken = crypto.randomUUID().replace(/-/g, "");
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO orders
      (code, tracking_token, customer, phone, city, mode, street, address_number, neighborhood, complement, payment, notes, items_json, total, step_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
      .bind(code, trackingToken, customer, phone, city, mode, street, number, neighborhood, complement, payment, notes, JSON.stringify(items), total, createdAt, createdAt)
      .run();
    await env.DB.prepare("INSERT INTO order_events (order_code, step_index, title, created_at) VALUES (?, 0, ?, ?)")
      .bind(code, STEPS[0], createdAt).run();
    return json({ ok: true, code, trackingToken, stepIndex: 0, createdAt }, 201);
  } catch (error) {
    return json({ error: "Não foi possível registrar o pedido.", detail: String(error?.message || error) }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Banco de pedidos ainda não configurado." }, 503);
  const url = new URL(request.url);
  const code = clean(url.searchParams.get("code"), 20);

  if (code) {
    const token = clean(url.searchParams.get("token"), 80);
    if (!token) return json({ error: "Código de acompanhamento inválido." }, 401);
    const row = await env.DB.prepare("SELECT * FROM orders WHERE code = ? AND tracking_token = ?")
      .bind(code, token).first();
    if (!row) return json({ error: "Pedido não encontrado." }, 404);
    return json({ order: { ...row, items: JSON.parse(row.items_json || "[]"), items_json: undefined } });
  }

  if (!authorized(request, env)) return json({ error: "Acesso da cozinha não autorizado." }, 401);
  const rows = await env.DB.prepare("SELECT * FROM orders WHERE step_index < 4 ORDER BY created_at DESC LIMIT 100").all();
  return json({ orders: (rows.results || []).map(row => ({ ...row, items: JSON.parse(row.items_json || "[]"), items_json: undefined })) });
}

export async function onRequestPatch({ request, env }) {
  if (!env.DB) return json({ error: "Banco de pedidos ainda não configurado." }, 503);
  if (!authorized(request, env)) return json({ error: "Acesso da cozinha não autorizado." }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const code = clean(body.code, 20);
  const stepIndex = Number(body.stepIndex);
  if (!code || !Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= STEPS.length) {
    return json({ error: "Pedido ou etapa inválida." }, 400);
  }
  const updatedAt = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE orders SET step_index = ?, updated_at = ? WHERE code = ?")
    .bind(stepIndex, updatedAt, code).run();
  if (!result.meta?.changes) return json({ error: "Pedido não encontrado." }, 404);
  await env.DB.prepare("INSERT INTO order_events (order_code, step_index, title, created_at) VALUES (?, ?, ?, ?)")
    .bind(code, stepIndex, STEPS[stepIndex], updatedAt).run();
  return json({ ok: true, code, stepIndex, title: STEPS[stepIndex], updatedAt });
}
