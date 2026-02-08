# Coffee Lab Admin API Documentation

Comprehensive guide to the Coffee Lab Admin Panel backend API, covering all available endpoints, data models, and usage examples.

## 🚀 Overview

The API is built with **Express.js** and uses a flat-file JSON database (`/data/*.json`) for persistence. It supports image uploads via `multer` and automatic image optimization using `sharp`.

- **Base URL**: `http://localhost:3000` (default)
- **API Prefix**: All API endpoints use the `/api` prefix
- **Content Types**:
  - `application/json` for Orders and Coupons
  - `multipart/form-data` for Products and Blogs (due to image uploads)

---

## 🔐 Authentication

The API uses **API Key authentication**.

- **GET requests** to `/api/*` are **PUBLIC** (no auth required).
- **POST/PUT/DELETE** requests require authentication.

### How Authentication Works

1.  **Login** to get an authentication cookie.
2.  **Include the cookie** (`admin_token`) in subsequent requests.
3.  **Alternatively**, send the API Key via `x-api-key` header.
4.  The default API Key is `test` (configurable in `.env`).

### Login

`POST /api/login`

**Body:**

```json
{
  "username": "admin",
  "password": "yourpassword"
}
```

**Response (Success):**

```json
{ "message": "Logged in successfully" }
```

The server sets an HTTP-only cookie named `admin_token` containing the API Key.

### Logout

`POST /api/logout`

Clears the authentication cookie.

### Using the API with External Tools

#### cURL

**Option 1: Using Header (Recommended for Scripts)**

```bash
# Create a product
curl -X POST http://localhost:3000/api/beans \
  -H "x-api-key: test" \
  -F "name=Ethiopia Yirgacheffe" \
  -F "price=1200"
```

**Option 2: Using Cookies (Like Browser)**

```bash
# Step 1: Login and save the cookie
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}' \
  -c cookies.txt

# Step 2: Use the cookie for authenticated requests
curl -X POST http://localhost:3000/api/beans \
  -b cookies.txt \
  -F "name=Ethiopia Yirgacheffe" \
  -F "price=1200"
```

#### Postman

**Option 1: API Key Header**

1.  Go to the **Headers** tab.
2.  Add Key: `x-api-key`, Value: `test` (or your configured key).

**Option 2: Browser Cookies**

1.  Send a `POST` request to `/api/login` with username/password.
2.  Postman automatically saves cookies - subsequent requests will include them.

#### JavaScript (Browser/Fetch)

```javascript
// Login
await fetch("/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // Important: include cookies
  body: JSON.stringify({ username: "admin", password: "password" }),
});

// Authenticated request (cookies are sent automatically)
const response = await fetch("/api/beans", {
  credentials: "include",
});
const data = await response.json();
```

### Unauthenticated Response

If you make a request without a valid cookie:

- **For API requests (JSON)**: Returns `401 Unauthorized`
  ```json
  { "message": "Unauthorized" }
  ```
- **For page requests (HTML)**: Redirects to `/login`

---

## 📦 Entities

The API manages the following entities:

- **Products**: `beans`, `machines`, `syrups`, `sauces`
- **Content**: `blogs`
- **Business**: `orders`, `coupons`

---

## 📡 API Endpoints

### 1. Generic Endpoints

Available for **ALL** entities.

#### Get All Records

`GET /api/:entity`

**Example:**

```bash
curl http://localhost:3000/api/beans
```

**Response:**

```json
[
  {
    "id": "A1b2C3d4",
    "slug": "example-item",
    "name": "Example Item",
    ...
  }
]
```

#### Get Single Record

`GET /api/:entity/:id_or_slug`

- **Params**: `id_or_slug` (The unique 8-char ID or the URL-friendly slug)

**Example:**

```bash
curl http://localhost:3000/api/beans/A1b2C3d4
# or
curl http://localhost:3000/api/beans/ethiopia-yirgacheffe
```

**Response:**

```json
{
  "id": "A1b2C3d4",
  "slug": "example-item",
  ...
}
```

#### Delete Record

`DELETE /api/:entity/:id_or_slug`

- **Behavior**: Deletes the record from JSON and permanently removes associated images from the `/uploads` directory.

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/beans/A1b2C3d4
```

**Response:**

```json
{ "message": "Deleted successfully" }
```

---

### 2. Products API

**Entities**: `beans`, `machines`, `syrups`, `sauces`
**Content-Type**: `multipart/form-data`

#### Create Product

`POST /api/:entity`

**Form Data Fields:**

- `name` (string, required)
- `description` (string)
- `price` (number)
- `inStock` (boolean: "true"/"false")
- `isFeatured` (boolean: "true"/"false")
- `discountPercentage` (number)
- `variants` (JSON string, e.g., `[{"size": "250g", "price": 500}]`)
- `images` (File[], max 5)
- **Machines Only**: `specifications`, `features` (JSON strings)
- **Beans/Syrups Only**: `cupping_notes` (comma-separated string)

**Example Request (cURL):**

```bash
curl -X POST http://localhost:3000/api/beans \
  -F "name=Ethiopia Yirgacheffe" \
  -F "price=1200" \
  -F "inStock=true" \
  -F "cupping_notes=Floral,Citrus" \
  -F "images=@/path/to/bean.jpg"
```

#### Update Product

`PUT /api/:entity/:id`

**Form Data Fields:**

- Include any fields from POST to update them.
- `existingImages` (JSON string): Array of image filenames to keep.
- `images` (File[]): New images to append.

**Example:**

```bash
curl -X PUT http://localhost:3000/api/beans/A1b2C3d4 \
  -F "price=1500" \
  -F "existingImages=[\"old-image.jpg\"]" \
  -F "images=@/path/to/new-bean.jpg"
```

---

### 3. Blogs API

**Entity**: `blogs`
**Content-Type**: `multipart/form-data`

#### Create Blog Post

`POST /api/blogs`

**Form Data Fields:**

- `title` (string, required)
- `content` (string, HTML allowed)
- `excerpt` (string)
- `category` (string)
- `author` (string)
- `image` (File, single)

**Behavior**: Automatically calculates `readTime` and sets `date` to current date.

**Example:**

```bash
curl -X POST http://localhost:3000/api/blogs \
  -F "title=The Art of Coffee Brewing" \
  -F "content=<p>Coffee is an art...</p>" \
  -F "category=Brewing" \
  -F "author=Coffee Lab" \
  -F "image=@/path/to/image.jpg"
```

#### Update Blog Post

`PUT /api/blogs/:id`

- Same fields as POST.
- New image upload replaces the existing one.

---

### 4. Orders API

**Entity**: `orders`
**Content-Type**: `application/json`

#### Create Order

`POST /api/orders`

**Body:**

```json
{
  "customerName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+8801700000000",
  "address": "Dhaka, Bangladesh",
  "items": [
    {
      "productId": "A1b2C3d4",
      "productName": "Ethiopia Yirgacheffe",
      "variant": "250g",
      "price": 1200,
      "quantity": 1
    }
  ],
  "totalAmount": 1200,
  "paymentMethod": "COD"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Jane Doe","email":"jane@example.com","items":[{"productId":"A1b2C3d4","productName":"Ethiopia Yirgacheffe","variant":"250g","price":1200,"quantity":1}],"totalAmount":1200}'
```

#### Update Order

`PUT /api/orders/:id`

**Body**: Any subset of the order object (e.g., status update).

```json
{ "status": "Shipped", "isPaid": true }
```

**Example:**

```bash
curl -X PUT http://localhost:3000/api/orders/A1b2C3d4 \
  -H "Content-Type: application/json" \
  -d '{"isPaid": true}'
```

---

### 5. Coupons API

**Entity**: `coupons`
**Content-Type**: `application/json`

#### Data Model

| Field         | Type    | Description                                    |
| :------------ | :------ | :--------------------------------------------- |
| `code`        | String  | Unique code (e.g., "SAVE20"). Auto-uppercased. |
| `type`        | String  | `percentage` or `flat`.                        |
| `value`       | Number  | Amount or percentage value.                    |
| `isActive`    | Boolean | Whether the coupon can be used.                |
| `maxUses`     | Number  | Total times it can be redeemed.                |
| `currentUses` | Number  | Current redemption count.                      |
| `expiryDate`  | String  | Date string (YYYY-MM-DD).                      |
| `maxDiscount` | Number  | Cap for percentage discounts.                  |

#### Create Coupon

`POST /api/coupons`

**Body:**

```json
{
  "code": "WELCOME10",
  "type": "percentage",
  "value": 10,
  "isActive": true,
  "maxUses": 100,
  "expiryDate": "2026-12-31"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/coupons \
  -H "Content-Type: application/json" \
  -d '{"code":"WELCOME10","type":"percentage","value":10,"isActive":true,"maxUses":100}'
```

#### Update Coupon

`PUT /api/coupons/:id`

**Body**: Any subset of fields to update.

```json
{ "isActive": false }
```

---

## 📄 Admin Panel Routes

The admin panel is served at the following routes:

| Route           | Description           |
| :-------------- | :-------------------- |
| `/`             | Products Dashboard    |
| `/orders`       | Orders Management     |
| `/blogs`        | Blog Posts Management |
| `/coupons`      | Coupons Management    |
| `/add-product`  | Add Product           |
| `/edit-product` | Edit Product          |
| `/add-order`    | Add Order             |
| `/edit-order`   | Edit Order            |
| `/add-blog`     | Add Blog Post         |
| `/edit-blog`    | Edit Blog Post        |
| `/add-coupon`   | Add Coupon            |
| `/edit-coupon`  | Edit Coupon           |
| `/login`        | Login Page            |

---

## 🛠️ Setup & Development

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure Environment**

   Create a `.env` file with:

   ```
   ADMIN_USER=admin
   ADMIN_PASS=yourpassword
   API_KEY=test
   PORT=3000
   ```

3. **Start Server**

   ```bash
   node index.js
   ```

   Server runs on `http://localhost:3000`.

4. **Data Storage**
   - JSON Data: `./data/{entity}.json`
   - Uploads: `./uploads/`

## ⚠️ Important Notes

- **Slug Generation**: Slugs are auto-generated from `name` (Products) or `title` (Blogs) on creation. They are immutable afterwards.
- **Image Deletion**: Deleting a product/blog permanently deletes its images from disk. This is irreversible.
- **Historical Orders**: Order items snapshot the product name/price at time of purchase. Changing a product's price later does not affect past orders.
- **Authentication**: `GET` requests are public. Other methods require `admin_token` cookie or `x-api-key` header.
