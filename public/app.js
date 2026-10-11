const STORAGE_KEY = "pendrive-menu-device";

const state = {
  deviceId: null,
  role: "viewer",
  label: "",
  menu: null,
  heartbeat: null,
};

const $ = (id) => document.getElementById(id);

function loadDevice() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveDevice(d) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

function api(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (state.deviceId) headers["x-device-id"] = state.deviceId;
  return fetch(path, { ...opts, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      err.data = data;
      throw err;
    }
    return data;
  });
}

async function initGate() {
  const saved = loadDevice();
  if (saved?.label) $("deviceLabel").value = saved.label;
  try {
    const lan = await fetch("/api/lan").then((r) => r.json());
    if (lan.urls?.length) {
      $("lanHint").textContent =
        "Other devices on Wi‑Fi: " + lan.urls.join(" · ");
    }
  } catch {
    /* ignore */
  }

  $("joinBtn").onclick = async () => {
    $("gateError").hidden = true;
    const label = $("deviceLabel").value.trim() || "Device";
    const asHost = $("asHost").checked;
    const deviceId =
      saved?.deviceId ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    try {
      const result = await api("/api/session/join", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          label,
          role: asHost ? "host" : "viewer",
        }),
      });
      state.deviceId = deviceId;
      state.role = result.session.role;
      state.label = label;
      saveDevice({ deviceId, label });
      await enterApp();
    } catch (e) {
      $("gateError").hidden = false;
      $("gateError").textContent = e.message;
      if (e.data?.devices) {
        $("gateError").textContent +=
          " Online: " + e.data.devices.map((d) => d.label).join(", ");
      }
    }
  };
}

async function enterApp() {
  $("gate").hidden = true;
  $("app").hidden = false;
  $("roleBadge").textContent = state.role;
  document.querySelectorAll(".host-only").forEach((el) => {
    el.hidden = state.role !== "host";
  });
  await refreshMenu();
  await refreshDevices();
  startHeartbeat();
  wireTabs();
  wireHost();
}

async function refreshMenu() {
  state.menu = await api("/api/menu");
  $("restName").textContent = state.menu.restaurantName;
  renderMenu();
}

async function refreshDevices() {
  const data = await api("/api/session/list");
  const viewers = (data.devices || []).filter((d) => d.role !== "host").length;
  $("deviceCount").textContent = `${viewers}/${data.max} viewers`;
}

function startHeartbeat() {
  clearInterval(state.heartbeat);
  state.heartbeat = setInterval(async () => {
    try {
      await api("/api/session/heartbeat", {
        method: "POST",
        body: JSON.stringify({ deviceId: state.deviceId }),
      });
      await refreshDevices();
    } catch {
      /* session expired */
    }
  }, 15000);
}

function renderMenu() {
  const root = $("menuList");
  root.innerHTML = "";
  for (const cat of state.menu.categories) {
    const block = document.createElement("div");
    block.className = "category";
    block.innerHTML = `<h3>${escapeHtml(cat.name)}</h3>`;
    for (const item of cat.items) {
      const row = document.createElement("div");
      row.className = "item";
      const vegClass = item.isVeg ? "" : "nonveg";
      const off = item.available === false ? "off" : "";
      const rates = item.aggregatorRates || {};
      row.innerHTML = `
        <div>
          <div class="item-name"><span class="dot ${vegClass} ${off}"></span>${escapeHtml(item.name)}</div>
          ${item.description ? `<p class="item-desc">${escapeHtml(item.description)}</p>` : ""}
          <div class="item-meta">S ₹${rates.swiggy ?? item.rate} · Z ₹${rates.zomato ?? item.rate} · T ₹${rates.toing ?? item.rate}</div>
        </div>
        <div class="item-side">
          <div class="price">₹${item.rate}</div>
          ${
            state.role === "host"
              ? `<div class="item-actions">
                  <button type="button" class="ghost" data-edit="${item.id}">Edit</button>
                  <button type="button" class="ghost" data-del="${item.id}">Delete</button>
                </div>`
              : ""
          }
        </div>`;
      block.appendChild(row);
    }
    root.appendChild(block);
  }

  root.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => openItemDialog(btn.dataset.edit);
  });
  root.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Delete this item?")) return;
      const data = await api(`/api/menu/item/${btn.dataset.del}`, {
        method: "DELETE",
      });
      state.menu = data.menu;
      renderMenu();
    };
  });
}

function wireTabs() {
  document.querySelectorAll("#tabs button").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll("#tabs button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      ["menu", "sync", "settings"].forEach((t) => {
        $(`tab-${t}`).hidden = btn.dataset.tab !== t;
      });
      if (btn.dataset.tab === "settings") loadSettings();
    };
  });
}

function wireHost() {
  $("leaveBtn").onclick = async () => {
    await api("/api/session/leave", {
      method: "POST",
      body: JSON.stringify({ deviceId: state.deviceId }),
    });
    clearInterval(state.heartbeat);
    location.reload();
  };

  if (state.role !== "host") return;

  $("addCatBtn").onclick = async () => {
    const name = prompt("Category name");
    if (!name) return;
    const data = await api("/api/menu/category", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    state.menu = data.menu;
    renderMenu();
  };

  $("addItemBtn").onclick = () => openItemDialog(null);

  $("itemCancel").onclick = () => $("itemDialog").close();

  $("itemForm").onsubmit = async (e) => {
    e.preventDefault();
    const rate = Number($("itemRate").value);
    const item = {
      id: $("itemId").value || undefined,
      name: $("itemName").value.trim(),
      description: $("itemDesc").value.trim(),
      rate,
      isVeg: $("itemVeg").checked,
      available: $("itemAvail").checked,
      aggregatorRates: {
        swiggy: Number($("rateSwiggy").value || rate),
        zomato: Number($("rateZomato").value || rate),
        toing: Number($("rateToing").value || rate),
      },
    };
    const data = await api("/api/menu/item", {
      method: "PUT",
      body: JSON.stringify({
        categoryId: $("itemCategory").value,
        item,
      }),
    });
    state.menu = data.menu;
    $("itemDialog").close();
    renderMenu();
  };

  document.querySelectorAll("[data-sync]").forEach((btn) => {
    btn.onclick = async () => {
      $("syncOut").textContent = "Syncing…";
      const which = btn.dataset.sync;
      try {
        const data =
          which === "all"
            ? await api("/api/sync", {
                method: "POST",
                body: JSON.stringify({}),
              })
            : await api(`/api/sync/${which}`, { method: "POST", body: "{}" });
        $("syncOut").textContent = JSON.stringify(
          data.results || data.result,
          null,
          2
        );
      } catch (err) {
        $("syncOut").textContent = err.message;
      }
    };
  });

  $("saveSettings").onclick = saveSettings;
}

function openItemDialog(itemId) {
  const sel = $("itemCategory");
  sel.innerHTML = state.menu.categories
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");

  let item = null;
  let categoryId = state.menu.categories[0]?.id;
  if (itemId) {
    for (const c of state.menu.categories) {
      const found = c.items.find((i) => i.id === itemId);
      if (found) {
        item = found;
        categoryId = c.id;
        break;
      }
    }
  }

  $("itemDialogTitle").textContent = item ? "Edit item" : "New item";
  $("itemId").value = item?.id || "";
  $("itemCategory").value = categoryId;
  $("itemName").value = item?.name || "";
  $("itemDesc").value = item?.description || "";
  $("itemRate").value = item?.rate ?? "";
  $("rateSwiggy").value = item?.aggregatorRates?.swiggy ?? item?.rate ?? "";
  $("rateZomato").value = item?.aggregatorRates?.zomato ?? item?.rate ?? "";
  $("rateToing").value = item?.aggregatorRates?.toing ?? item?.rate ?? "";
  $("itemVeg").checked = item ? !!item.isVeg : true;
  $("itemAvail").checked = item ? item.available !== false : true;
  $("itemDialog").showModal();
}

async function loadSettings() {
  const cfg = await api("/api/settings");
  $("setName").value = cfg.restaurantName || "";
  $("setPath").value = cfg.pendrivePath || "";
  $("setMax").value = cfg.maxViewDevices || 3;
  const root = $("aggFields");
  root.innerHTML = "";
  for (const [name, ag] of Object.entries(cfg.aggregators || {})) {
    const row = document.createElement("div");
    row.className = "agg-row";
    row.dataset.platform = name;
    row.innerHTML = `
      <strong>${name}</strong>
      <label>Outlet ID<input data-k="outletId" value="${escapeAttr(ag.outletId || "")}" /></label>
      <label>API key<input data-k="apiKey" type="password" placeholder="${ag.apiKeySet ? "•••• saved" : "paste key"}" /></label>
      <label class="check"><input data-k="dryRun" type="checkbox" ${ag.dryRun ? "checked" : ""} /> Dry-run</label>`;
    root.appendChild(row);
  }
}

async function saveSettings() {
  const aggregators = {};
  $("aggFields").querySelectorAll(".agg-row").forEach((row) => {
    const p = row.dataset.platform;
    const outletId = row.querySelector('[data-k="outletId"]').value.trim();
    const apiKey = row.querySelector('[data-k="apiKey"]').value.trim();
    const dryRun = row.querySelector('[data-k="dryRun"]').checked;
    aggregators[p] = { enabled: true, outletId, dryRun };
    if (apiKey) aggregators[p].apiKey = apiKey;
  });
  await api("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({
      restaurantName: $("setName").value.trim(),
      pendrivePath: $("setPath").value.trim(),
      maxViewDevices: Number($("setMax").value),
      aggregators,
    }),
  });
  $("settingsMsg").textContent = "Saved.";
  await refreshMenu();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s);
}

initGate();
