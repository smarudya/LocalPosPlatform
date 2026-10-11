const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "config.json");

const defaults = {
  port: 3847,
  /** Absolute path to the USB / pendrive folder that holds menu data */
  pendrivePath: path.join(ROOT, "pendrive-data"),
  maxViewDevices: 3,
  restaurantName: "My Kitchen",
  aggregators: {
    swiggy: { enabled: true, outletId: "", apiKey: "", dryRun: true },
    zomato: { enabled: true, outletId: "", apiKey: "", dryRun: true },
    toing: { enabled: true, outletId: "", apiKey: "", dryRun: true },
  },
};

function loadConfig() {
  let file = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      file = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch {
      file = {};
    }
  }
  const cfg = {
    ...defaults,
    ...file,
    aggregators: {
      ...defaults.aggregators,
      ...(file.aggregators || {}),
    },
  };
  if (process.env.PENDRIVE_PATH) cfg.pendrivePath = process.env.PENDRIVE_PATH;
  if (process.env.PORT) cfg.port = Number(process.env.PORT);
  if (cfg.pendrivePath && !path.isAbsolute(cfg.pendrivePath)) {
    cfg.pendrivePath = path.resolve(ROOT, cfg.pendrivePath);
  }
  return cfg;
}

function saveConfig(partial) {
  const current = loadConfig();
  const next = {
    ...current,
    ...partial,
    aggregators: {
      ...current.aggregators,
      ...(partial.aggregators || {}),
    },
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH, ROOT };
