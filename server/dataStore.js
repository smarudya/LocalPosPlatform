const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");

const MENU_FILE = "menu.json";
const META_FILE = "meta.json";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function menuPath(base) {
  return path.join(base, MENU_FILE);
}

function metaPath(base) {
  return path.join(base, META_FILE);
}

function defaultMenu(restaurantName) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    restaurantName,
    categories: [
      {
        id: uuid(),
        name: "Starters",
        items: [
          {
            id: uuid(),
            name: "Veg Manchurian",
            description: "Crispy veg balls in spicy sauce",
            rate: 180,
            isVeg: true,
            available: true,
            aggregatorRates: { swiggy: 180, zomato: 185, toing: 180 },
          },
          {
            id: uuid(),
            name: "Chicken 65",
            description: "South Indian fried chicken",
            rate: 260,
            isVeg: false,
            available: true,
            aggregatorRates: { swiggy: 260, zomato: 265, toing: 255 },
          },
        ],
      },
      {
        id: uuid(),
        name: "Mains",
        items: [
          {
            id: uuid(),
            name: "Paneer Butter Masala",
            description: "Cottage cheese in tomato gravy",
            rate: 240,
            isVeg: true,
            available: true,
            aggregatorRates: { swiggy: 240, zomato: 245, toing: 240 },
          },
          {
            id: uuid(),
            name: "Butter Chicken",
            description: "Classic creamy chicken curry",
            rate: 320,
            isVeg: false,
            available: true,
            aggregatorRates: { swiggy: 320, zomato: 330, toing: 315 },
          },
        ],
      },
    ],
  };
}

function initStore(pendrivePath, restaurantName) {
  ensureDir(pendrivePath);
  if (!fs.existsSync(menuPath(pendrivePath))) {
    writeMenu(pendrivePath, defaultMenu(restaurantName));
  }
  if (!fs.existsSync(metaPath(pendrivePath))) {
    writeMeta(pendrivePath, {
      createdAt: new Date().toISOString(),
      lastSync: null,
      syncLog: [],
    });
  }
}

function readMenu(pendrivePath) {
  return JSON.parse(fs.readFileSync(menuPath(pendrivePath), "utf8"));
}

function writeMenu(pendrivePath, menu) {
  menu.updatedAt = new Date().toISOString();
  menu.version = (menu.version || 0) + 1;
  const tmp = menuPath(pendrivePath) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(menu, null, 2));
  fs.renameSync(tmp, menuPath(pendrivePath));
  return menu;
}

function readMeta(pendrivePath) {
  return JSON.parse(fs.readFileSync(metaPath(pendrivePath), "utf8"));
}

function writeMeta(pendrivePath, meta) {
  const tmp = metaPath(pendrivePath) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2));
  fs.renameSync(tmp, metaPath(pendrivePath));
  return meta;
}

function findItem(menu, itemId) {
  for (const cat of menu.categories) {
    const item = cat.items.find((i) => i.id === itemId);
    if (item) return { category: cat, item };
  }
  return null;
}

function upsertItem(menu, { categoryId, item }) {
  let cat = menu.categories.find((c) => c.id === categoryId);
  if (!cat) {
    cat = { id: categoryId || uuid(), name: "Uncategorized", items: [] };
    menu.categories.push(cat);
  }
  if (!item.id) {
    item.id = uuid();
    if (!item.aggregatorRates) {
      item.aggregatorRates = {
        swiggy: item.rate,
        zomato: item.rate,
        toing: item.rate,
      };
    }
    cat.items.push(item);
    return item;
  }
  const idx = cat.items.findIndex((i) => i.id === item.id);
  if (idx === -1) {
    cat.items.push(item);
  } else {
    cat.items[idx] = { ...cat.items[idx], ...item };
  }
  return cat.items.find((i) => i.id === item.id);
}

function deleteItem(menu, itemId) {
  for (const cat of menu.categories) {
    const idx = cat.items.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      cat.items.splice(idx, 1);
      return true;
    }
  }
  return false;
}

function flatItems(menu) {
  return menu.categories.flatMap((c) =>
    c.items.map((item) => ({
      ...item,
      categoryId: c.id,
      categoryName: c.name,
    }))
  );
}

module.exports = {
  initStore,
  readMenu,
  writeMenu,
  readMeta,
  writeMeta,
  findItem,
  upsertItem,
  deleteItem,
  flatItems,
  defaultMenu,
  uuid,
};
