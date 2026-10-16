import { getStore } from "@netlify/blobs";

export const config = { path: "/api" };

const store = getStore("pregao");
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const defaults = () => ({
  groups: Array.from({ length: 8 }, (_, i) => ({ id: "g" + (i + 1), name: "Grupo " + (i + 1), password: "" })),
  products: [], initialBalance: 10000, roundOpen: false, pin: "2026",
});
const getConfig = async () => (await store.get("config", { type: "json" })) || defaults();
// Visão pública: nunca expõe PIN nem senhas dos grupos.
const publicView = (c) => ({
  groups: c.groups.map((g) => ({ id: g.id, name: g.name, hasPassword: !!g.password })),
  products: c.products, initialBalance: c.initialBalance, roundOpen: c.roundOpen,
});

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad" }, 400); }
  const c = await getConfig();

  if (b.action === "state") return json({ config: publicView(c) });

  if (b.action === "claim") {
    if (!b.sid || !c.groups.some((g) => g.id === b.groupId)) return json({ ok: false });
    const key = "claim:" + b.groupId, now = Date.now();
    const cur = await store.get(key, { type: "json" });
    if (cur && cur.sid !== b.sid && cur.exp > now) return json({ ok: false });
    await store.setJSON(key, { sid: b.sid, exp: now + 30000 });
    if (!cur || cur.sid !== b.sid) { // confirma que ninguém escreveu ao mesmo tempo
      await wait(350);
      const chk = await store.get(key, { type: "json" });
      if (!chk || chk.sid !== b.sid) return json({ ok: false });
    }
    const inv = await store.get("inv:" + b.groupId, { type: "json" });
    return json({ ok: true, investment: inv || {} });
  }

  if (b.action === "submit") {
    const g = c.groups.find((x) => x.id === b.groupId);
    if (!g) return json({ ok: false, error: "Grupo inválido." });
    if (!c.roundOpen) return json({ ok: false, error: "A rodada está fechada." });
    const cl = await store.get("claim:" + g.id, { type: "json" });
    if (!cl || cl.sid !== b.sid || cl.exp < Date.now())
      return json({ ok: false, error: "Login do grupo expirou. Selecione o grupo novamente." });
    if (g.password && b.password !== g.password) return json({ ok: false, error: "Senha do grupo incorreta." });
    const ids = new Set(c.products.map((p) => p.id)), alloc = {};
    for (const [k, v] of Object.entries(b.alloc || {})) {
      const n = Math.floor(Number(v));
      if (ids.has(k) && n > 0) alloc[k] = n;
    }
    if (sum(alloc) > c.initialBalance) return json({ ok: false, error: "O total ultrapassa o saldo do grupo." });
    await store.setJSON("inv:" + g.id, alloc);
    return json({ ok: true });
  }

  if (b.action === "admin") {
    if (b.pin !== c.pin) return json({ ok: false }, 401);
    if (b.op === "get") {
      const investments = {};
      const { blobs } = await store.list({ prefix: "inv:" });
      for (const x of blobs) investments[x.key.slice(4)] = (await store.get(x.key, { type: "json" })) || {};
      const { pin, ...rest } = c;
      return json({ ok: true, config: rest, investments });
    }
    if (b.op === "save") {
      const n = b.config || {};
      const next = {
        groups: (n.groups || []).slice(0, 40).map((g) => ({
          id: String(g.id).replace(/[^\w-]/g, ""), name: String(g.name).slice(0, 60), password: String(g.password || ""),
        })),
        products: (n.products || []).slice(0, 10).map((p) => ({
          id: String(p.id).replace(/[^\w-]/g, ""), name: String(p.name).slice(0, 80), desc: String(p.desc || "").slice(0, 200),
        })),
        initialBalance: Math.max(0, Number(n.initialBalance) || 0),
        roundOpen: !!n.roundOpen,
        pin: n.pin ? String(n.pin) : c.pin,
      };
      await store.setJSON("config", next);
      return json({ ok: true });
    }
    if (b.op === "reset") {
      const { blobs } = await store.list({ prefix: "inv:" });
      for (const x of blobs) await store.delete(x.key);
      return json({ ok: true });
    }
  }
  return json({ error: "unknown" }, 400);
};
