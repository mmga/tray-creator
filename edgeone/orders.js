/**
 * EdgeOne Pages Function - Orders API (KV)
 *
 * Route suggestion:
 * - Bind this function to /orders*
 *
 * Required bindings / env:
 * - TRAY_ORDERS (KV namespace)
 * - ADMIN_SECRET (string)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      ...CORS_HEADERS,
    },
  });
}

function getKv(env) {
  return env?.TRAY_ORDERS ?? globalThis.TRAY_ORDERS;
}

function getAdminSecret(env) {
  return env?.ADMIN_SECRET ?? globalThis.ADMIN_SECRET;
}

function isAuthorized(request, env) {
  const authHeader = request.headers.get("Authorization");
  const secret = getAdminSecret(env);
  return Boolean(secret) && authHeader === `Bearer ${secret}`;
}

function extractOrderId(request, params) {
  if (params?.id) return params.id;

  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "";

  const last = segments[segments.length - 1];
  if (last === "orders") return "";
  return last;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestPost({ request, env }) {
  const kv = getKv(env);
  if (!kv) {
    return json({ error: "KV binding TRAY_ORDERS not found" }, 500);
  }

  try {
    const payload = await request.json();
    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const orderData = {
      id: orderId,
      timestamp: new Date().toISOString(),
      mode: payload?.mode || "grid",
      params: payload?.params || {},
    };

    await kv.put(orderId, JSON.stringify(orderData));
    return json({ success: true, id: orderId }, 201);
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Invalid request body",
      },
      400,
    );
  }
}

export async function onRequestGet({ request, env }) {
  const kv = getKv(env);
  if (!kv) {
    return json({ error: "KV binding TRAY_ORDERS not found" }, 500);
  }

  if (!isAuthorized(request, env)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  try {
    const listResult = await kv.list();
    const keys = listResult?.keys || [];
    const orders = [];

    for (const keyObj of keys) {
      const value = await kv.get(keyObj.name);
      if (value) {
        try {
          orders.push(JSON.parse(value));
        } catch {
          // ignore malformed value
        }
      }
    }

    orders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return json(orders);
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to list orders",
      },
      500,
    );
  }
}

export async function onRequestDelete({ request, params, env }) {
  const kv = getKv(env);
  if (!kv) {
    return json({ error: "KV binding TRAY_ORDERS not found" }, 500);
  }

  if (!isAuthorized(request, env)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const id = extractOrderId(request, params);
  if (!id) {
    return json({ error: "Missing order id" }, 400);
  }

  try {
    await kv.delete(id);
    return json({ success: true });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to delete order",
      },
      500,
    );
  }
}
