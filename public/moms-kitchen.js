(() => {
  "use strict";

  const MIN_KIDS = 1;
  const MAX_KIDS = 6;
  const GRAMS_PER_KID = 250;
  const EXTRA_STEP_G = 100;
  const STORAGE_KEY = "moms-kitchen-tiffin-v1";

  const CATALOG = {
    veggies: [
      { id: "lady-finger", name: "Lady Finger", price: 45, hue: "#6f9e4a", accent: "#3d6b24" },
      { id: "spinach", name: "Spinach", price: 35, hue: "#2f7a45", accent: "#184f2b" },
      { id: "potato", name: "Potato", price: 30, hue: "#d4a35a", accent: "#8a6230" },
      { id: "tomato", name: "Tomato", price: 40, hue: "#d4543a", accent: "#9a2f1c" },
      { id: "carrot", name: "Carrot", price: 38, hue: "#e07a2f", accent: "#a04a12" },
      { id: "cauliflower", name: "Cauliflower", price: 42, hue: "#efe8d8", accent: "#8a7f68" },
    ],
    sprouts: [
      { id: "moong", name: "Moong Sprouts", price: 48, hue: "#8bc34a", accent: "#4a7a22" },
      { id: "chana", name: "Chana Sprouts", price: 52, hue: "#c4a35a", accent: "#7a5a28" },
      { id: "mixed", name: "Mixed Sprouts", price: 58, hue: "#7cb342", accent: "#3e6b1e" },
      { id: "methi", name: "Methi Sprouts", price: 50, hue: "#66bb6a", accent: "#2e7d32" },
    ],
    salad: [
      { id: "cucumber", name: "Cucumber", price: 0, free: true, hue: "#7cb342", accent: "#33691e" },
      { id: "lettuce", name: "Lettuce Mix", price: 0, free: true, hue: "#9ccc65", accent: "#558b2f" },
      { id: "beetroot", name: "Beetroot", price: 0, free: true, hue: "#ad1457", accent: "#6a0f36" },
      { id: "radish", name: "Radish", price: 0, free: true, hue: "#f5f5f5", accent: "#9e9e9e" },
    ],
    addons: [
      { id: "paneer", name: "Paneer Cubes", price: 65, hue: "#fff8e7", accent: "#c4a35a" },
      { id: "cheese", name: "Cheese Slice", price: 40, hue: "#ffd54f", accent: "#c49000" },
      { id: "nuts", name: "Trail Nuts", price: 55, hue: "#a1887f", accent: "#5d4037" },
      { id: "fruit", name: "Fruit Cup", price: 50, hue: "#ef9a9a", accent: "#c62828" },
    ],
  };

  const TAB_HINTS = {
    veggies: "Fixed weight on every card. It grows with each child.",
    sprouts: "Protein boosters with the same child-scaled weight.",
    salad: "FREE · 1:1 with each selected veggie. Pick your mix.",
    addons: "Optional extras. Not part of the free salad ratio.",
  };

  const state = {
    kids: 2,
    tab: "veggies",
    cartOpen: false,
    items: {},
  };

  const el = {
    kidCount: document.getElementById("kidCount"),
    kidWord: document.getElementById("kidWord"),
    kidBadge: document.getElementById("kidBadge"),
    kidsDec: document.getElementById("kidsDec"),
    kidsInc: document.getElementById("kidsInc"),
    track: document.getElementById("track"),
    trackText: document.getElementById("trackText"),
    tabHint: document.getElementById("tabHint"),
    grid: document.getElementById("grid"),
    aromaEq: document.getElementById("aromaEq"),
    saladEq: document.getElementById("saladEq"),
    saladNote: document.getElementById("saladNote"),
    barTotal: document.getElementById("barTotal"),
    barSplit: document.getElementById("barSplit"),
    ctaCount: document.getElementById("ctaCount"),
    sheet: document.getElementById("sheet"),
    sheetBody: document.getElementById("sheetBody"),
    sheetTotal: document.getElementById("sheetTotal"),
    sheetSub: document.getElementById("sheetSub"),
    live: document.getElementById("live"),
    scrim: document.querySelector(".scrim"),
  };

  function gramsForKids(kids) {
    return kids * GRAMS_PER_KID;
  }

  function formatGrams(g) {
    return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)}kg` : `${g}g`;
  }

  function itemKey(tab, id) {
    return `${tab}:${id}`;
  }

  function ensureItem(tab, id) {
    const key = itemKey(tab, id);
    if (!state.items[key]) {
      state.items[key] = {
        tab,
        id,
        selected: false,
        extra: 0,
        cut: false,
        washed: false,
      };
    }
    return state.items[key];
  }

  function catalogItem(tab, id) {
    return CATALOG[tab].find((x) => x.id === id);
  }

  function selectedVeggiesCount() {
    return Object.values(state.items).filter((it) => it.tab === "veggies" && it.selected).length;
  }

  function selectedCount() {
    return Object.values(state.items).filter((it) => it.selected).length;
  }

  function priceBreakdown() {
    let base = 0;
    let topUps = 0;
    for (const it of Object.values(state.items)) {
      if (!it.selected) continue;
      const meta = catalogItem(it.tab, it.id);
      if (!meta || meta.free) continue;
      base += meta.price;
      if (it.extra > 0) {
        const units = it.extra / EXTRA_STEP_G;
        topUps += Math.round(meta.price * 0.35 * units);
      }
    }
    return { base, topUps, total: base + topUps };
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ kids: state.kids, items: state.items })
      );
    } catch (_) {
      /* ignore */
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.kids >= MIN_KIDS && data.kids <= MAX_KIDS) state.kids = data.kids;
      if (data.items && typeof data.items === "object") state.items = data.items;
    } catch (_) {
      /* ignore */
    }
  }

  function seedDefaults() {
    if (Object.keys(state.items).length) return;
    ["lady-finger", "spinach", "potato", "tomato"].forEach((id) => {
      const it = ensureItem("veggies", id);
      it.selected = true;
      it.washed = id === "spinach" || id === "tomato";
      it.cut = id === "potato" || id === "lady-finger";
    });
  }

  function veggieArt(meta) {
    const shapes = {
      "lady-finger": `<ellipse cx="50" cy="52" rx="12" ry="28" fill="${meta.hue}" stroke="${meta.accent}" stroke-width="2"/><ellipse cx="50" cy="28" rx="6" ry="8" fill="${meta.accent}"/>`,
      spinach: `<path d="M28 70c8-28 20-40 36-48 4 18-2 40-14 54-8 10-16 8-22-6z" fill="${meta.hue}"/><path d="M42 68c10-22 28-34 40-38-2 20-12 38-28 48-8 5-14 2-12-10z" fill="${meta.accent}"/>`,
      potato: `<ellipse cx="52" cy="50" rx="26" ry="20" fill="${meta.hue}"/><circle cx="40" cy="46" r="2" fill="${meta.accent}"/><circle cx="58" cy="54" r="1.5" fill="${meta.accent}"/><circle cx="50" cy="42" r="1.5" fill="${meta.accent}"/>`,
      tomato: `<circle cx="50" cy="54" r="24" fill="${meta.hue}"/><path d="M42 34c4 4 8 4 12 0 2 6-2 10-6 10s-8-4-6-10z" fill="${meta.accent}"/><ellipse cx="50" cy="30" rx="8" ry="4" fill="#3d6b24"/>`,
      carrot: `<path d="M50 22l10 48c1 6-4 10-10 10s-11-4-10-10l10-48z" fill="${meta.hue}"/><path d="M44 20c2-8 6-12 6-12s4 4 6 12c-4 2-8 2-12 0z" fill="#2f7a45"/>`,
      cauliflower: `<circle cx="50" cy="48" r="22" fill="${meta.hue}" stroke="${meta.accent}" stroke-width="2"/><circle cx="40" cy="44" r="8" fill="#fff"/><circle cx="56" cy="42" r="9" fill="#fff"/><circle cx="48" cy="54" r="8" fill="#fff"/><path d="M36 66c6 4 22 4 28 0-2-6-8-10-14-10s-12 4-14 10z" fill="#6f9e4a"/>`,
    };
    return shapes[meta.id] || `<circle cx="50" cy="50" r="22" fill="${meta.hue}"/><circle cx="50" cy="50" r="12" fill="${meta.accent}" opacity=".35"/>`;
  }

  function sproutArt(meta) {
    return `<circle cx="50" cy="58" r="10" fill="${meta.hue}"/><path d="M50 48V28M50 40l-10-8M50 36l10-6" stroke="${meta.accent}" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="30" r="4" fill="#8bc34a"/><circle cx="60" cy="28" r="4" fill="#aed581"/>`;
  }

  function saladArt(meta) {
    return `<ellipse cx="50" cy="58" rx="28" ry="14" fill="${meta.hue}"/><path d="M30 52c8-16 20-24 40-28-4 14-8 24-18 34-8 8-16 6-22-6z" fill="${meta.accent}" opacity=".85"/>`;
  }

  function addonArt(meta) {
    return `<rect x="28" y="34" width="44" height="32" rx="8" fill="${meta.hue}" stroke="${meta.accent}" stroke-width="2"/><path d="M34 50h32M34 42h20" stroke="${meta.accent}" stroke-width="2" stroke-linecap="round"/>`;
  }

  function artFor(tab, meta) {
    if (tab === "veggies") return veggieArt(meta);
    if (tab === "sprouts") return sproutArt(meta);
    if (tab === "salad") return saladArt(meta);
    return addonArt(meta);
  }

  function photoSvg(tab, meta) {
    return `<svg viewBox="0 0 100 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="g-${meta.id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fffaf2"/>
          <stop offset="100%" stop-color="${meta.hue}" stop-opacity=".35"/>
        </linearGradient>
      </defs>
      <rect width="100" height="84" fill="url(#g-${meta.id})"/>
      ${artFor(tab, meta)}
    </svg>`;
  }

  function announce(msg) {
    el.live.textContent = msg;
  }

  function renderHeader() {
    const g = gramsForKids(state.kids);
    el.kidCount.textContent = String(state.kids);
    el.kidWord.textContent = state.kids === 1 ? "kid" : "kids";
    el.kidsDec.disabled = state.kids <= MIN_KIDS;
    el.kidsInc.disabled = state.kids >= MAX_KIDS;
    el.trackText.textContent = `${state.kids} ${state.kids === 1 ? "child" : "children"} → ${formatGrams(g)} per veggie`;
    el.tabHint.textContent = TAB_HINTS[state.tab];

    document.querySelectorAll(".pill").forEach((pill) => {
      const tab = pill.dataset.tab;
      const on = tab === state.tab;
      pill.setAttribute("aria-selected", on ? "true" : "false");
      const countEl = document.getElementById(`count-${tab}`);
      if (!countEl) return;
      const n = Object.values(state.items).filter((it) => it.tab === tab && it.selected).length;
      if (n > 0) {
        countEl.hidden = false;
        countEl.textContent = String(n);
      } else {
        countEl.hidden = true;
      }
    });
  }

  function renderFree() {
    const vegN = selectedVeggiesCount();
    el.aromaEq.textContent = `${state.kids} ${state.kids === 1 ? "child" : "children"} = ${state.kids} free ${state.kids === 1 ? "kit" : "kits"}`;
    el.saladEq.textContent = `${vegN || 0} ${vegN === 1 ? "veggie" : "veggies"} = ${vegN || 0} free ${vegN === 1 ? "salad" : "salads"}`;
    el.saladNote.textContent =
      vegN > 0 ? "Auto-calculated · Chef’s mix" : "Select veggies to unlock free salads";
  }

  function renderBar() {
    const { base, topUps, total } = priceBreakdown();
    const n = selectedCount();
    el.barTotal.textContent = `₹${total}`;
    el.barSplit.textContent = `Base ₹${base} · top-ups ₹${topUps}`;
    el.sheetTotal.textContent = `₹${total}`;
    if (n > 0) {
      el.ctaCount.hidden = false;
      el.ctaCount.textContent = String(n);
    } else {
      el.ctaCount.hidden = true;
    }
  }

  function cardHtml(tab, meta) {
    const it = ensureItem(tab, meta.id);
    const g = gramsForKids(state.kids);
    const isSalad = tab === "salad";
    const on = it.selected;

    let extraBlock = "";
    if (!isSalad && !meta.free) {
      if (it.extra > 0) {
        extraBlock = `<div class="extra">
          <button type="button" data-action="extra-dec" data-tab="${tab}" data-id="${meta.id}" aria-label="Less extra">−</button>
          <span class="extra-qty">+${formatGrams(it.extra)}</span>
          <button type="button" data-action="extra-inc" data-tab="${tab}" data-id="${meta.id}">+ Add Extra</button>
        </div>`;
      } else {
        extraBlock = `<button type="button" class="add-extra" data-action="extra-inc" data-tab="${tab}" data-id="${meta.id}">+ Add Extra</button>`;
      }
    }

    const prefs =
      tab === "veggies" || tab === "sprouts"
        ? `<div class="prefs">
            <button type="button" class="switch" data-action="toggle-pref" data-pref="cut" data-tab="${tab}" data-id="${meta.id}" aria-pressed="${it.cut}">
              <span class="knob-track"><span class="knob"></span></span>Cut
            </button>
            <button type="button" class="switch" data-action="toggle-pref" data-pref="washed" data-tab="${tab}" data-id="${meta.id}" aria-pressed="${it.washed}">
              <span class="knob-track"><span class="knob"></span></span>Washed
            </button>
          </div>`
        : "";

    const priceLabel = meta.free
      ? `<div class="price-line"><strong>FREE</strong><span>1:1</span></div>`
      : `<div class="price-line"><strong>₹${meta.price}</strong><span>${on ? "in box" : "tap to add"}</span></div>`;

    return `<article class="card${on ? " is-on" : ""}" data-card="${itemKey(tab, meta.id)}">
      <div class="photo">
        <div class="qty-stack">
          <span class="qty">${formatGrams(g)}</span>
          ${it.extra > 0 ? `<span class="qty plus">+${formatGrams(it.extra)}</span>` : ""}
        </div>
        <button type="button" class="check" data-action="toggle" data-tab="${tab}" data-id="${meta.id}" aria-pressed="${on}" aria-label="${on ? "Remove" : "Add"} ${meta.name}">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6.2 11.4 2.8 8l1.2-1.2 2.2 2.2 5-5L12.4 5z"/></svg>
        </button>
        ${photoSvg(tab, meta)}
      </div>
      <h3 class="name">${meta.name}</h3>
      ${priceLabel}
      <p class="status${on ? " in" : ""}">${on ? "Selected for tiffin" : isSalad ? "Unlocked with veggies" : "Not in box yet"}</p>
      ${extraBlock}
      ${prefs}
    </article>`;
  }

  function renderGrid() {
    const list = CATALOG[state.tab];
    el.grid.classList.remove("in");
    void el.grid.offsetWidth;
    el.grid.innerHTML = list.map((meta) => cardHtml(state.tab, meta)).join("");
    el.grid.classList.add("in");
  }

  function renderSheet() {
    const selected = Object.values(state.items).filter((it) => it.selected);
    if (!selected.length) {
      el.sheetBody.innerHTML = `<div class="empty"><p>Your tiffin box is empty.</p><p class="muted">Pick veggies or sprouts to build the kit.</p></div>`;
      el.sheetSub.textContent = "Nothing saved yet";
      return;
    }

    const groups = { veggies: [], sprouts: [], salad: [], addons: [] };
    for (const it of selected) groups[it.tab].push(it);

    const labels = {
      veggies: "Veggies",
      sprouts: "Sprouts",
      salad: "Free salads",
      addons: "Extra add-ons",
    };

    const g = gramsForKids(state.kids);
    let html = "";
    for (const tab of ["veggies", "sprouts", "salad", "addons"]) {
      const rows = groups[tab];
      if (!rows.length) continue;
      html += `<div class="block"><h3>${labels[tab]}</h3>`;
      for (const it of rows) {
        const meta = catalogItem(it.tab, it.id);
        const prefs = [];
        if (it.cut) prefs.push("Cut");
        if (it.washed) prefs.push("Washed");
        const qty = meta.free
          ? "FREE · 1:1"
          : `${formatGrams(g)}${it.extra ? ` + ${formatGrams(it.extra)}` : ""}`;
        const linePrice = meta.free
          ? "FREE"
          : `₹${meta.price + (it.extra ? Math.round(meta.price * 0.35 * (it.extra / EXTRA_STEP_G)) : 0)}`;
        html += `<div class="line">
          <div class="thumb">${photoSvg(it.tab, meta)}</div>
          <div>
            <div class="line-name">${meta.name}</div>
            <div class="line-meta">${qty}${prefs.length ? ` · ${prefs.join(", ")}` : ""}</div>
          </div>
          <div class="line-price${meta.free ? " free" : ""}">${linePrice}</div>
        </div>`;
      }
      html += `</div>`;
    }

    const vegN = selectedVeggiesCount();
    html += `<div class="block"><h3>Included free</h3>
      <div class="line">
        <div class="thumb"><svg viewBox="0 0 100 84"><rect width="100" height="84" fill="#e7f3ec"/><circle cx="50" cy="48" r="18" fill="#1b5e3b"/><path d="M42 48h16M50 40v16" stroke="#fff" stroke-width="3"/></svg></div>
        <div><div class="line-name">Aromatic Kit × ${state.kids}</div><div class="line-meta">Coriander, mint, ginger & lemon</div></div>
        <div class="line-price free">FREE</div>
      </div>
      <div class="line">
        <div class="thumb"><svg viewBox="0 0 100 84"><rect width="100" height="84" fill="#e7f3ec"/><ellipse cx="50" cy="52" rx="24" ry="16" fill="#7cb342"/></svg></div>
        <div><div class="line-name">Proportionate Salad × ${vegN}</div><div class="line-meta">FREE · 1:1 with veggies</div></div>
        <div class="line-price free">FREE</div>
      </div>
    </div>`;

    const { base, topUps, total } = priceBreakdown();
    html += `<div class="receipt">
      <div><span>Base kit</span><span>₹${base}</span></div>
      <div><span>Top-ups</span><span>₹${topUps}</span></div>
      <div class="receipt-total"><span>Kit price</span><strong>₹${total}</strong></div>
    </div>`;

    el.sheetBody.innerHTML = html;
    el.sheetSub.textContent = "Saved on this device";
  }

  function renderAll() {
    renderHeader();
    renderGrid();
    renderFree();
    renderBar();
    if (state.cartOpen) renderSheet();
    save();
  }

  function bump(node) {
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
  }

  function setKids(next) {
    state.kids = Math.min(MAX_KIDS, Math.max(MIN_KIDS, next));
    bump(el.kidBadge);
    bump(el.track);
    announce(`${state.kids} children, ${formatGrams(gramsForKids(state.kids))} per veggie`);
    renderAll();
  }

  function setTab(tab) {
    if (!CATALOG[tab]) return;
    state.tab = tab;
    renderAll();
  }

  function toggleItem(tab, id) {
    const it = ensureItem(tab, id);
    it.selected = !it.selected;
    if (!it.selected) it.extra = 0;
    announce(`${it.selected ? "Added" : "Removed"} ${catalogItem(tab, id).name}`);
    renderAll();
  }

  function changeExtra(tab, id, delta) {
    const it = ensureItem(tab, id);
    if (!it.selected) it.selected = true;
    it.extra = Math.max(0, Math.min(1000, it.extra + delta));
    announce(`Extra ${formatGrams(it.extra)} on ${catalogItem(tab, id).name}`);
    renderAll();
  }

  function togglePref(tab, id, pref) {
    const it = ensureItem(tab, id);
    if (!it.selected) it.selected = true;
    it[pref] = !it[pref];
    announce(`${catalogItem(tab, id).name}: ${pref} ${it[pref] ? "on" : "off"}`);
    renderAll();
  }

  function openCart() {
    state.cartOpen = true;
    el.sheet.hidden = false;
    el.scrim.hidden = false;
    document.body.classList.add("cart-open");
    renderSheet();
  }

  function closeCart() {
    state.cartOpen = false;
    el.sheet.hidden = true;
    el.scrim.hidden = true;
    document.body.classList.remove("cart-open");
  }

  function resetBox() {
    state.items = {};
    seedDefaults();
    closeCart();
    announce("Tiffin box reset");
    renderAll();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const tab = btn.dataset.tab;
    const id = btn.dataset.id;

    switch (action) {
      case "kids-dec":
        setKids(state.kids - 1);
        break;
      case "kids-inc":
        setKids(state.kids + 1);
        break;
      case "tab":
        setTab(tab);
        break;
      case "toggle":
        toggleItem(tab, id);
        break;
      case "extra-inc":
        changeExtra(tab, id, EXTRA_STEP_G);
        break;
      case "extra-dec":
        changeExtra(tab, id, -EXTRA_STEP_G);
        break;
      case "toggle-pref":
        togglePref(tab, id, btn.dataset.pref);
        break;
      case "open-cart":
        openCart();
        break;
      case "close-cart":
        closeCart();
        break;
      case "reset":
        resetBox();
        break;
      default:
        break;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.cartOpen) closeCart();
  });

  load();
  seedDefaults();
  renderAll();
})();
