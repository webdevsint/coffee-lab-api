const express = require("express");
const path = require("path");
const fs = require("fs");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

const db = require("./db");
const optimizeImages = require("./imageOptimizer");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cache control and logging middleware
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use("/uploads", express.static("uploads"));

app.use(express.static("public"));

// Generic GET all
const entities = ["beans", "machines", "syrups", "sauces", "blogs", "orders"];
entities.forEach((entity) => {
  app.get(`/${entity}`, (req, res) => {
    res.json(db.getAll(entity));
  });

  app.get(`/${entity}/:identifier`, (req, res) => {
    const item = db.getByIdOrSlug(entity, req.params.identifier);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  });

  app.delete(`/${entity}/:identifier`, (req, res) => {
    const deletedItem = db.delete(entity, req.params.identifier);
    if (!deletedItem) return res.status(404).json({ message: "Not found" });

    // Physical deletion of images
    if (deletedItem.images && Array.isArray(deletedItem.images)) {
      deletedItem.images.forEach((img) => {
        const imgPath = path.join(__dirname, "uploads", img);
        if (fs.existsSync(imgPath)) {
          try {
            fs.unlinkSync(imgPath);
            console.log(`Deleted file: ${imgPath}`);
          } catch (err) {
            console.error(`Error deleting file ${imgPath}:`, err);
          }
        }
      });
    }

    res.json({ message: "Deleted successfully" });
  });
});

// POST routes with optimization
app.post("/beans", upload.array("images"), optimizeImages, (req, res) => {
  const payload = {
    ...req.body,
    images: req.files.map((file) => file.filename),
  };
  const newItem = db.create("beans", payload);
  res.json({ message: "Bean added successfully", payload: newItem });
});

app.post("/blogs", upload.single("image"), optimizeImages, (req, res) => {
  const payload = {
    ...req.body,
    images: req.file ? [req.file.filename] : [],
  };
  const newItem = db.create("blogs", payload);
  res.json({ message: "Blog added successfully", payload: newItem });
});

["machines", "syrups", "sauces"].forEach((entity) => {
  app.post(`/${entity}`, upload.array("images"), optimizeImages, (req, res) => {
    const payload = {
      ...req.body,
      images: req.files.map((file) => file.filename),
    };
    const newItem = db.create(entity, payload);
    res.json({ message: `${entity} added successfully`, payload: newItem });
  });
});

app.post("/orders", (req, res) => {
  const newItem = db.create("orders", req.body);
  res.json({ message: "Order placed successfully", payload: newItem });
});

// PUT routes (Update)
app.put(
  "/beans/:identifier",
  upload.array("images"),
  optimizeImages,
  (req, res) => {
    const updates = { ...req.body };
    let currentImages = [];

    // Parse existing images if provided
    if (updates.existingImages) {
      try {
        currentImages = JSON.parse(updates.existingImages);
        delete updates.existingImages;
      } catch (e) {
        currentImages = [];
      }
    }

    // Add new uploads
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => file.filename);
      currentImages = [...currentImages, ...newImages];
    }

    updates.images = currentImages;

    const updatedItem = db.update("beans", req.params.identifier, updates);
    if (!updatedItem) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Updated successfully", payload: updatedItem });
  },
);

app.put(
  "/blogs/:identifier",
  upload.single("image"),
  optimizeImages,
  (req, res) => {
    const updates = { ...req.body };
    if (req.file) {
      updates.images = [req.file.filename];
    }
    const updatedItem = db.update("blogs", req.params.identifier, updates);
    if (!updatedItem) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Updated successfully", payload: updatedItem });
  },
);

["machines", "syrups", "sauces"].forEach((entity) => {
  app.put(
    `/${entity}/:identifier`,
    upload.array("images"),
    optimizeImages,
    (req, res) => {
      const updates = { ...req.body };
      let currentImages = [];

      if (updates.existingImages) {
        try {
          currentImages = JSON.parse(updates.existingImages);
          delete updates.existingImages;
        } catch (e) {
          currentImages = [];
        }
      }

      if (req.files && req.files.length > 0) {
        const newImages = req.files.map((file) => file.filename);
        currentImages = [...currentImages, ...newImages];
      }

      updates.images = currentImages;

      const updatedItem = db.update(entity, req.params.identifier, updates);
      if (!updatedItem) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Updated successfully", payload: updatedItem });
    },
  );
});

app.put("/orders/:identifier", (req, res) => {
  const updatedItem = db.update("orders", req.params.identifier, req.body);
  if (!updatedItem) return res.status(404).json({ message: "Order not found" });
  res.json({ message: "Order updated successfully", payload: updatedItem });
});

app.listen(5000);
