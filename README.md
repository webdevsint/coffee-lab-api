# Coffee Lab Admin API Documentation

This document provides a comprehensive overview of the Coffee Lab Admin Panel's backend implementation, API usage, and core features.

---

## 🚀 Tech Stack

- **Backend Framework**: Express.js (v5.x)
- **Database**: Flat JSON files (located in `./data/`)
- **Image Processing**: Sharp (WebP optimization)
- **File Uploads**: Multer
- **Unique Identifiers**: Nanoid (8-character IDs)

---

## 🏗️ Project Architecture

### 🛡️ Data Layer (`db.js`)

The `db.js` utility acts as a lightweight ORM for the flat-file database.

- **CRUD Operations**: Generic `getAll`, `getByIdOrSlug`, `create`, `update`, and `delete` methods.
- **Auto-Processing**: Handles slug generation, read-time calculation for blogs, variant-to-price syncing for products, and normalization of array fields (keywords/cupping notes).
- **ID/Slug System**: Supports dual-lookup; entities can be fetched using their unique ID or their URL-friendly slug.

### 🖼️ Media Management

- **Storage**: All uploaded images are stored in the `./uploads/` directory.
- **Optimization**: The `imageOptimizer.js` middleware uses `sharp` to automatically convert images to high-performance `.webp` format and resize them for consistency.
- **Automatic Cleanup**: When a product or blog entry is deleted, the backend physically unlinks (deletes) all associated image files from the disk.

### 📝 Core Modules

- **`index.js`**: Standard REST entry point using native Express middleware and route grouping.
- **`imageOptimizer.js`**: Asynchronous middleware for sequential image processing.

---

## 📡 API Reference

### Entities

The following entities are supported:

- `beans` (Products)
- `machines` (Products)
- `syrups` (Products)
- `sauces` (Products)
- `blogs` (Articles)
- `orders` (Management)

### Generic Endpoints

| Method     | Endpoint               | Description                                                             |
| :--------- | :--------------------- | :---------------------------------------------------------------------- |
| **GET**    | `/:entity`             | Fetch all records for an entity.                                        |
| **GET**    | `/:entity/:id_or_slug` | Fetch a single record by ID or Slug.                                    |
| **POST**   | `/:entity`             | Create a new record (supports JSON or Multi-part form-data for images). |
| **PUT**    | `/:entity/:id_or_slug` | Update an existing record.                                              |
| **DELETE** | `/:entity/:id_or_slug` | Delete a record and its associated physical images.                     |

---

## 📊 Data Models

### Products (Beans, Syrups, etc.)

```json
{
  "id": "YvU20Y7n",
  "slug": "shadows-of-the-east",
  "name": "Shadows of the East",
  "price": 500,
  "inStock": true,
  "isFeatured": false,
  "discountPercentage": 10,
  "variants": [
    { "size": "250gm", "price": 500 },
    { "size": "500gm", "price": 950 }
  ],
  "images": ["opt-123456.webp"],
  "keywords": ["new", "dark-roast"]
}
```

### Blogs

```json
{
  "id": "68_juAgA",
  "title": "The Art of Brewing",
  "slug": "art-of-brewing",
  "content": "<p>Content HTML...</p>",
  "category": "Coffee Culture",
  "author": "Coffee Lab Team",
  "date": "07/02/2026",
  "readTime": "3 min read",
  "images": ["opt-789.webp"]
}
```

### Orders (Historical Record)

> [!NOTE]
> Orders use **historical persistence**. Product names and prices are snapshotted into the order item at the time of creation so that they remain accurate even if the original product is deleted.

```json
{
  "id": "ord_123",
  "customerName": "John Doe",
  "items": [
    {
      "productId": "YvU20Y7n",
      "productName": "Shadows of the East",
      "variant": "250gm",
      "price": 500,
      "quantity": 2
    }
  ],
  "totalAmount": 1000,
  "status": "Pending",
  "createdAt": "2026-02-07T10:00:00Z"
}
```

---

## 🛠️ Specialized Features

### 1. Historical Order Persistence

When an order is saved, it doesn't just store IDs. It stores the `productName` and `price`. The admin panel is designed to correctly display these even if the product is later removed from the catalog.

### 2. Physical File Unlinking

The `DELETE` route is hooked into the filesystem. Deleting an entry triggers a cleanup loop that removes all associated WebP files from the server automatically.

### 3. Native Express Stack

The API utilizes native `express.json()` and `express.urlencoded()` middleware, removing the need for external body-parsing dependencies and reducing the attack surface.

---

## ⚙️ Setup & Running

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Start the Server**:

   ```bash
   node index.js
   ```

   _The server runs on port **3000** by default._

3. **Access Admin Panel**:
   Open `public/index.html` (or your local dev server equivalent) in your browser.

---

## 🌍 Deployment

### Hosting on Render (Recommended)

1. **GitHub Sync**: Connect your repository to Render.
2. **Environment**: Select **Node** as the runtime.
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Port**: Render will automatically assign a port via `process.env.PORT`.

### Hosting on cPanel

1. **Node.js Setup**: Use the "Setup Node.js App" tool in cPanel.
2. **Application Root**: Select your project folder.
3. **Startup File**: Set to `index.js`.
4. **Environment Variables**: Add `PORT` if your shared hosting requires a specific port.
5. **Run Script**: Click "Run JS Script" to execute `npm install`.
