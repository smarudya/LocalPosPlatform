/**
 * Aggregator push adapters.
 * Partner APIs (Swiggy/Zomato/Toing) require real outlet credentials.
 * Default mode is dryRun: builds the payload and logs it without calling live APIs.
 * Set dryRun:false + apiKey + outletId in config.json when you have partner access.
 */

function buildPayload(platform, menu) {
  const items = [];
  for (const cat of menu.categories) {
    for (const item of cat.items) {
      const rate =
        (item.aggregatorRates && item.aggregatorRates[platform]) ?? item.rate;
      items.push({
        external_id: item.id,
        name: item.name,
        description: item.description || "",
        category: cat.name,
        price: Number(rate),
        is_veg: !!item.isVeg,
        in_stock: item.available !== false,
      });
    }
  }
  return {
    platform,
    restaurant: menu.restaurantName,
    updatedAt: menu.updatedAt,
    itemCount: items.length,
    items,
  };
}

async function postJson(url, apiKey, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const ENDPOINTS = {
  swiggy: (outletId) =>
    `https://partner.swiggy.com/api/v1/outlets/${outletId}/menu/bulk-update`,
  zomato: (outletId) =>
    `https://api.zomato.com/partner/v1/outlets/${outletId}/menu`,
  toing: (outletId) =>
    `https://api.toing.app/v1/outlets/${outletId}/catalog/sync`,
};

async function pushToPlatform(platform, menu, cfg) {
  const started = new Date().toISOString();
  const payload = buildPayload(platform, menu);
  const platformCfg = cfg.aggregators?.[platform] || {};

  if (!platformCfg.enabled) {
    return {
      platform,
      status: "skipped",
      reason: "disabled",
      at: started,
      itemCount: payload.itemCount,
    };
  }

  if (platformCfg.dryRun !== false || !platformCfg.apiKey || !platformCfg.outletId) {
    return {
      platform,
      status: "dry_run",
      reason:
        platformCfg.dryRun !== false
          ? "dryRun mode (set dryRun:false + credentials to go live)"
          : "missing apiKey or outletId",
      at: started,
      itemCount: payload.itemCount,
      preview: payload.items.slice(0, 5),
    };
  }

  try {
    const url = ENDPOINTS[platform](platformCfg.outletId);
    const result = await postJson(url, platformCfg.apiKey, payload);
    return {
      platform,
      status: "ok",
      at: started,
      itemCount: payload.itemCount,
      result,
    };
  } catch (e) {
    return {
      platform,
      status: "error",
      at: started,
      itemCount: payload.itemCount,
      error: e.message,
      detail: e.data || null,
    };
  }
}

async function syncAll(menu, cfg, platforms = ["swiggy", "zomato", "toing"]) {
  const results = [];
  for (const p of platforms) {
    results.push(await pushToPlatform(p, menu, cfg));
  }
  return results;
}

module.exports = { buildPayload, pushToPlatform, syncAll };
