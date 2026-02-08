const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
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
app.use(cookieParser());

// Cache control and logging middleware
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Check if user is authenticated
const isAuthenticated = (req) => {
  const token = req.cookies.admin_token;
  if (!token) return false;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
};

// Auth Middleware for API routes
const authMiddleware = (req, res, next) => {
  const publicPaths = ["/login", "/login.html", "/api/login", "/logo.png"];
  if (
    publicPaths.includes(req.path) ||
    req.path.startsWith("/uploads/") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".js") ||
    req.path.includes("sheetjs")
  ) {
    return next();
  }

  const token = req.cookies.admin_token;
  if (!token) {
    if (
      req.xhr ||
      (req.headers.accept && req.headers.accept.indexOf("json") > -1)
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return res.redirect("/login");
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie("admin_token");
    if (
      req.xhr ||
      (req.headers.accept && req.headers.accept.indexOf("json") > -1)
    ) {
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.redirect("/login");
  }
};

app.use(authMiddleware);

// Login Route
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    const token = jwt.sign({ user: username }, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });
    res.cookie("admin_token", token, {
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000,
    });
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Logout Route
app.post("/api/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ success: true });
});

const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

// Serve static assets (CSS, JS, images)
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false, // Disable automatic index.html serving
  }),
);

// Login page route - redirect to dashboard if already logged in
app.get("/login", (req, res) => {
  if (isAuthenticated(req)) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Also handle /login.html for backward compatibility
app.get("/login.html", (req, res) => {
  if (isAuthenticated(req)) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Protected page routes
const protectedPages = [
  { route: "/", file: "index.html" },
  { route: "/products", file: "index.html" },
  { route: "/orders", file: "orders.html" },
  { route: "/blogs", file: "blogs.html" },
  { route: "/coupons", file: "coupons.html" },
  { route: "/add-product", file: "add-product.html" },
  { route: "/add-order", file: "add-order.html" },
  { route: "/add-blog", file: "add-blog.html" },
  { route: "/add-coupon", file: "add-coupon.html" },
];

protectedPages.forEach(({ route, file }) => {
  app.get(route, (req, res) => {
    if (!isAuthenticated(req)) {
      return res.redirect("/login");
    }
    res.sendFile(path.join(__dirname, "public", file));
  });
});

// Generic GET all
const entities = [
  "beans",
  "machines",
  "syrups",
  "sauces",
  "blogs",
  "orders",
  "coupons",
];
entities.forEach((entity) => {
  app.get(`/api/${entity}`, (req, res) => {
    res.json(db.getAll(entity));
  });

  app.get(`/api/${entity}/:identifier`, (req, res) => {
    const item = db.getByIdOrSlug(entity, req.params.identifier);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  });

  app.delete(`/api/${entity}/:identifier`, (req, res) => {
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
app.post("/api/beans", upload.array("images"), optimizeImages, (req, res) => {
  const payload = {
    ...req.body,
    images: req.files.map((file) => file.filename),
  };
  const newItem = db.create("beans", payload);
  res.json({ message: "Bean added successfully", payload: newItem });
});

app.post("/api/blogs", upload.single("image"), optimizeImages, (req, res) => {
  const payload = {
    ...req.body,
    images: req.file ? [req.file.filename] : [],
  };
  const newItem = db.create("blogs", payload);
  res.json({ message: "Blog added successfully", payload: newItem });
});

["machines", "syrups", "sauces"].forEach((entity) => {
  app.post(
    `/api/${entity}`,
    upload.array("images"),
    optimizeImages,
    (req, res) => {
      const payload = {
        ...req.body,
        images: req.files.map((file) => file.filename),
      };
      const newItem = db.create(entity, payload);
      res.json({ message: `${entity} added successfully`, payload: newItem });
    },
  );
});

app.post("/api/orders", (req, res) => {
  const newItem = db.create("orders", req.body);
  res.json({ message: "Order placed successfully", payload: newItem });
});

app.post("/api/coupons", (req, res) => {
  const newItem = db.create("coupons", req.body);
  res.json({ message: "Coupon created successfully", payload: newItem });
});

// PUT routes (Update)
app.put(
  "/api/beans/:identifier",
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
  "/api/blogs/:identifier",
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
    `/api/${entity}/:identifier`,
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

app.put("/api/orders/:identifier", (req, res) => {
  const updatedItem = db.update("orders", req.params.identifier, req.body);
  if (!updatedItem) return res.status(404).json({ message: "Order not found" });
  res.json({ message: "Order updated successfully", payload: updatedItem });
});

app.put("/api/coupons/:identifier", (req, res) => {
  const updatedItem = db.update("coupons", req.params.identifier, req.body);
  if (!updatedItem)
    return res.status(404).json({ message: "Coupon not found" });
  res.json({ message: "Coupon updated successfully", payload: updatedItem });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log(
    `[${new Date().toISOString()}] Received shutdown signal. Closing server...`,
  );
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
