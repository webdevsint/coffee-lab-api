const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const DATA_DIR = path.join(__dirname, "data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getFilePath = (entity) => path.join(DATA_DIR, `${entity}.json`);

const readData = (entity) => {
  const filePath = getFilePath(entity);
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf8").trim();
    return JSON.parse(content || "[]");
  } catch (err) {
    console.error(`Error reading ${entity}:`, err);
    return [];
  }
};

const writeData = (entity, data) => {
  const filePath = getFilePath(entity);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-"); // Replace multiple - with single -
};

const findByIdOrSlug = (data, identifier) => {
  return data.find(
    (item) => item.id === identifier || item.slug === identifier,
  );
};

const calculateReadTime = (text) => {
  const wordsPerMinute = 200;
  const words = text ? text.split(/\s+/).length : 0;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min read`;
};

const db = {
  getAll: (entity) => readData(entity),

  getByIdOrSlug: (entity, identifier) => {
    const data = readData(entity);
    return findByIdOrSlug(data, identifier);
  },

  create: (entity, item) => {
    const data = readData(entity);
    const id = nanoid(8);

    // Slug generation
    const nameSource = item.name || item.title || "item";
    const slug = slugify(nameSource);

    const newItem = {
      ...item,
      id,
      slug,
    };

    // Casting status flags
    newItem.isFeatured = item.isFeatured === "true" || item.isFeatured === true;

    // inStock only for products
    if (["beans", "machines", "syrups", "sauces"].includes(entity)) {
      newItem.inStock = item.inStock === "true" || item.inStock === true;
    } else {
      delete newItem.inStock;
    }

    // Casting discount
    if (item.discountPercentage) {
      newItem.discountPercentage = parseFloat(item.discountPercentage) || 0;
    }

    // Blog specific enhancements
    if (entity === "blogs") {
      newItem.date = new Date().toLocaleDateString("en-GB");
      newItem.readTime = calculateReadTime(item.content || "");
      newItem.category = item.category || item.keyword || "Uncategorized";
      newItem.excerpt = item.excerpt || "";
    }

    // Normalizing Array Fields
    const normalizeArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return typeof val === "string"
        ? val
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s)
        : [val];
    };

    newItem.keywords = normalizeArray(item.keywords);
    newItem.images = Array.isArray(item.images) ? item.images : [];

    // Consumables enhancements (Variants)
    if (["beans", "syrups", "sauces"].includes(entity)) {
      newItem.cupping_notes = normalizeArray(item.cupping_notes);
      if (item.variants) {
        newItem.variants =
          typeof item.variants === "string"
            ? JSON.parse(item.variants)
            : item.variants;
        // Sync main price to first variant's price for compatibility
        if (Array.isArray(newItem.variants) && newItem.variants.length > 0) {
          newItem.price = newItem.variants[0].price;
        }
      }
    }

    // Machine specific enhancements (Dynamic Props)
    if (entity === "machines") {
      newItem.specifications =
        typeof item.specifications === "string"
          ? JSON.parse(item.specifications)
          : item.specifications || {};
      newItem.features =
        typeof item.features === "string"
          ? JSON.parse(item.features)
          : item.features || {};
    }

    // Order specific enhancements
    if (entity === "orders") {
      newItem.createdAt = new Date().toISOString();
      newItem.status = item.status || "Pending";
      newItem.items =
        typeof item.items === "string"
          ? JSON.parse(item.items)
          : item.items || [];
      newItem.totalAmount = parseFloat(item.totalAmount) || 0;
      newItem.isPaid = item.isPaid === true || item.isPaid === "true";

      // Remove irrelevant fields added by generic logic
      delete newItem.slug;
      delete newItem.keywords;
      delete newItem.images;
      delete newItem.isFeatured;
    }

    // Coupon specific enhancements
    if (entity === "coupons") {
      newItem.isActive = item.isActive === "true" || item.isActive === true;
      newItem.value = parseFloat(item.value) || 0;
      newItem.maxUses = parseInt(item.maxUses) || 0;
      newItem.maxDiscount = parseFloat(item.maxDiscount) || 0;
      newItem.currentUses = 0;
      newItem.expiryDate = item.expiryDate || "";
      newItem.type = item.type || "percentage"; // percentage or flat
      newItem.code = (item.code || "").toUpperCase();
    }

    data.push(newItem);
    writeData(entity, data);
    return newItem;
  },

  update: (entity, identifier, updates) => {
    const data = readData(entity);
    const index = data.findIndex(
      (item) => item.id === identifier || item.slug === identifier,
    );
    if (index === -1) return null;

    // Parsing dynamic props if they are strings
    if (updates.specifications && typeof updates.specifications === "string") {
      try {
        updates.specifications = JSON.parse(updates.specifications);
      } catch (e) {
        updates.specifications = {};
      }
    }
    if (updates.features && typeof updates.features === "string") {
      try {
        updates.features = JSON.parse(updates.features);
      } catch (e) {
        updates.features = {};
      }
    }

    // Core status flag updates
    if (updates.hasOwnProperty("isFeatured")) {
      updates.isFeatured =
        updates.isFeatured === "true" || updates.isFeatured === true;
    }
    if (updates.hasOwnProperty("inStock")) {
      if (["beans", "machines", "syrups", "sauces"].includes(entity)) {
        updates.inStock =
          updates.inStock === "true" || updates.inStock === true;
      } else {
        delete updates.inStock;
      }
    }
    if (updates.hasOwnProperty("discountPercentage")) {
      updates.discountPercentage = parseFloat(updates.discountPercentage) || 0;
    }

    // Blog specific update enhancements
    if (entity === "blogs") {
      if (updates.content) {
        updates.readTime = calculateReadTime(updates.content);
      }
    }

    // Normalizing updates (if present)
    const normalizeArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return typeof val === "string"
        ? val
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s)
        : [val];
    };

    if (updates.hasOwnProperty("keywords"))
      updates.keywords = normalizeArray(updates.keywords);
    if (updates.hasOwnProperty("cupping_notes"))
      updates.cupping_notes = normalizeArray(updates.cupping_notes);

    // Consumables update enhancements (Variants)
    if (["beans", "syrups", "sauces"].includes(entity)) {
      if (updates.variants) {
        try {
          updates.variants =
            typeof updates.variants === "string"
              ? JSON.parse(updates.variants)
              : updates.variants;
          if (Array.isArray(updates.variants) && updates.variants.length > 0) {
            updates.price = updates.variants[0].price;
          }
        } catch (e) {
          updates.variants = [];
        }
      }
    }

    if (
      entity === "orders" &&
      updates.items &&
      typeof updates.items === "string"
    ) {
      try {
        updates.items = JSON.parse(updates.items);
      } catch (e) {
        updates.items = [];
      }
    }

    if (entity === "coupons") {
      if (updates.hasOwnProperty("isActive")) {
        updates.isActive =
          updates.isActive === "true" || updates.isActive === true;
      }
      if (updates.hasOwnProperty("value")) {
        updates.value = parseFloat(updates.value) || 0;
      }
      if (updates.hasOwnProperty("maxUses")) {
        updates.maxUses = parseInt(updates.maxUses) || 0;
      }
      if (updates.hasOwnProperty("maxDiscount")) {
        updates.maxDiscount = parseFloat(updates.maxDiscount) || 0;
      }
      if (updates.hasOwnProperty("code")) {
        updates.code = (updates.code || "").toUpperCase();
      }
    }

    data[index] = { ...data[index], ...updates };
    writeData(entity, data);
    return data[index];
  },

  delete: (entity, identifier) => {
    const data = readData(entity);
    const itemToDelete = data.find(
      (item) => item.id === identifier || item.slug === identifier,
    );
    if (!itemToDelete) return null;

    const filteredData = data.filter(
      (item) => item.id !== identifier && item.slug !== identifier,
    );
    writeData(entity, filteredData);
    return itemToDelete;
  },
};

module.exports = db;
