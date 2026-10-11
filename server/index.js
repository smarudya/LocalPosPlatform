const path = require("path");
const os = require("os");
const express = require("express");
const cors = require("cors");
const { loadConfig, saveConfig, ROOT } = require("./config");
const store = require("./dataStore");
const { SessionManager } = require("./sessions");
const { syncAll, pushToPlatform } = require("./aggregators");

const cfg = loadConfig();
store.initStore(cfg.pendrivePath, cfg.restaurantName);

const sessions = new SessionManager(cfg.maxViewDevices);
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(ROOT, "public")));

function requireSession(req, res, next) {
  const deviceId = req.header("x-device-id") || req.query.deviceId;
  sessions.prune();
  if (!deviceId || !sessions.sessions.has(deviceId)) {
    return res.status(401).json({
      error: "Register this device first (view slots are limited).",
    });
  }
  req.deviceId = deviceId;
  req.session = sessions.sessions.get(deviceId);
  next();
}

function requireHost(req, res, next) {
  if (req.session?.role !== "host") {
    return res.status(403).json({ error: "Only the host device can edit or sync." });
  }
  next();
}

app.get("/api/health", (_req, res) => {
  const c = loadConfig();
  res.json({
    ok: true,
    restaurantName: store.readMenu(c.pendrivePath).restaurantName,
    pendrivePath: c.pendrivePath,
    maxViewDevices: c.maxViewDevices,
    host: os.hostname(),
  });
});

app.get("/api/lan", (_req, res) => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === "IPv4" && !n.internal) addrs.push(n.address);
    }
  }
  const c = loadConfig();
  res.json({
    port: c.port,
    urls: addrs.map((a) => `http://${a}:${c.port}`),
  });
});

app.post("/api/session/join", (req, res) => {
  const { deviceId, label, role } = req.body || {};
  const result = sessions.join({
    deviceId,
    label,
    role: role === "host" ? "host" : "viewer",
  });
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

app.post("/api/session/heartbeat", (req, res) => {
  const { deviceId } = req.body || {};
  const result = sessions.heartbeat(deviceId);
  if (!result.ok) return res.status(401).json(result);
  res.json(result);
});

app.post("/api/session/leave", (req, res) => {
  const { deviceId } = req.body || {};
  res.json(sessions.leave(deviceId));
});

app.get("/api/session/list", (_req, res) => {
  res.json({ devices: sessions.list(), max: sessions.maxDevices });
});

app.get("/api/menu", requireSession, (req, res) => {
  const c = loadConfig();
  sessions.heartbeat(req.deviceId);
  res.json(store.readMenu(c.pendrivePath));
});

app.get("/api/meta", requireSession, (req, res) => {
  const c = loadConfig();
  res.json(store.readMeta(c.pendrivePath));
});

app.put("/api/menu/item", requireSession, requireHost, (req, res) => {
  const c = loadConfig();
  const menu = store.readMenu(c.pendrivePath);
  const { categoryId, item } = req.body || {};
  if (!item || !item.name) {
    return res.status(400).json({ error: "item.name required" });
  }
  const saved = store.upsertItem(menu, { categoryId, item });
  store.writeMenu(c.pendrivePath, menu);
  res.json({ ok: true, item: saved, menu: store.readMenu(c.pendrivePath) });
});

app.delete("/api/menu/item/:id", requireSession, requireHost, (req, res) => {
  const c = loadConfig();
  const menu = store.readMenu(c.pendrivePath);
  const ok = store.deleteItem(menu, req.params.id);
  if (!ok) return res.status(404).json({ error: "item not found" });
  store.writeMenu(c.pendrivePath, menu);
  res.json({ ok: true, menu: store.readMenu(c.pendrivePath) });
});

app.post("/api/menu/category", requireSession, requireHost, (req, res) => {
  const c = loadConfig();
  const menu = store.readMenu(c.pendrivePath);
  const name = (req.body && req.body.name) || "New category";
  menu.categories.push({ id: store.uuid(), name, items: [] });
  store.writeMenu(c.pendrivePath, menu);
  res.json({ ok: true, menu: store.readMenu(c.pendrivePath) });
});

app.patch("/api/settings", requireSession, requireHost, (req, res) => {
  const partial = req.body || {};
  const next = saveConfig(partial);
  if (partial.restaurantName) {
    const menu = store.readMenu(next.pendrivePath);
    menu.restaurantName = partial.restaurantName;
    store.writeMenu(next.pendrivePath, menu);
  }
  if (partial.pendrivePath) {
    store.initStore(next.pendrivePath, next.restaurantName);
  }
  if (partial.maxViewDevices) {
    sessions.maxDevices = next.maxViewDevices;
  }
  res.json({ ok: true, config: sanitizeConfig(next) });
});

app.get("/api/settings", requireSession, requireHost, (_req, res) => {
  res.json(sanitizeConfig(loadConfig()));
});

app.post("/api/sync", requireSession, requireHost, async (req, res) => {
  const c = loadConfig();
  const menu = store.readMenu(c.pendrivePath);
  const platforms = req.body?.platforms || ["swiggy", "zomato", "toing"];
  const results = await syncAll(menu, c, platforms);
  const meta = store.readMeta(c.pendrivePath);
  meta.lastSync = new Date().toISOString();
  meta.syncLog = [...(meta.syncLog || []), ...results].slice(-50);
  store.writeMeta(c.pendrivePath, meta);
  res.json({ ok: true, results, meta });
});

app.post("/api/sync/:platform", requireSession, requireHost, async (req, res) => {
  const platform = req.params.platform;
  if (!["swiggy", "zomato", "toing"].includes(platform)) {
    return res.status(400).json({ error: "unknown platform" });
  }
  const c = loadConfig();
  const menu = store.readMenu(c.pendrivePath);
  const result = await pushToPlatform(platform, menu, c);
  const meta = store.readMeta(c.pendrivePath);
  meta.lastSync = new Date().toISOString();
  meta.syncLog = [...(meta.syncLog || []), result].slice(-50);
  store.writeMeta(c.pendrivePath, meta);
  res.json({ ok: true, result, meta });
});

function sanitizeConfig(c) {
  const ag = {};
  for (const [k, v] of Object.entries(c.aggregators || {})) {
    ag[k] = {
      enabled: !!v.enabled,
      dryRun: v.dryRun !== false,
      outletId: v.outletId || "",
      apiKeySet: !!(v.apiKey && String(v.apiKey).length),
    };
  }
  return {
    port: c.port,
    pendrivePath: c.pendrivePath,
    maxViewDevices: c.maxViewDevices,
    restaurantName: c.restaurantName,
    aggregators: ag,
  };
}

// POS SPA fallback only — never impersonate other apps (e.g. /smart-green).
app.get("*", (req, res, next) => {
  if (req.path === "/smart-green" || req.path.startsWith("/smart-green/")) {
    return res.status(404).type("text").send("Smart Green is served separately — not part of Pendrive Menu.");
  }
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

const port = cfg.port;
app.listen(port, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === "IPv4" && !n.internal) addrs.push(n.address);
    }
  }
  console.log(`Pendrive Menu POS listening on http://0.0.0.0:${port}`);
  console.log(`Data folder (USB): ${cfg.pendrivePath}`);
  for (const a of addrs) console.log(`  LAN view: http://${a}:${port}`);
  console.log(`Max view devices: ${cfg.maxViewDevices}`);
});
