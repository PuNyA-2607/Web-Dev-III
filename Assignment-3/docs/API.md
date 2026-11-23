# REST API & Real-Time WebSocket Specification (API.md)

All REST API endpoints are mounted under the base path: `/api/v1`.

---

## 1. Standard Response & Error Envelopes

Every HTTP response returned by the backend conforms strictly to a standardized JSON envelope.

### Success Response Envelope (HTTP 200, 201)
```json
{
  "success": true,
  "message": "Descriptive message of the operation",
  "data": { ... }
}
```
*(Note: Conforms to `src/utils/ApiResponse.js`. The HTTP status code is delivered in the HTTP response status header via `res.status()`, not duplicated inside the JSON payload.)*

### Error Response Envelope (HTTP 400, 401, 403, 404, 409, 429, 500, 503)
```json
{
  "success": false,
  "message": "Primary error summary message",
  "errors": [ ... ],
  "stack": "Error: ...\n    at ... (Included in development mode only; omitted in production)"
}
```
*(Note: Conforms to `src/middleware/errorHandler.js`. The `errors` array is present only when validation or operational error details exist. The `stack` trace is conditionally included only when `NODE_ENV === 'development'`.)*

---

## 2. System Health & Diagnostics

### `GET /api/v1/health`
- **Authentication Required:** No (Public)
- **Allowed Roles:** All (Unauthenticated)
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Backend service is healthy",
    "data": {
      "uptimeSeconds": 154.21,
      "timestamp": "2026-11-22T12:00:00.000Z",
      "database": {
        "status": "connected",
        "connected": true
      },
      "environment": "development"
    }
  }
  ```
- **Error Responses:**
  - `503 Service Unavailable`: Returned when `mongoose.connection.readyState !== 1` (database is disconnected).

---

## 3. Authentication & User Management

### `POST /api/v1/auth/register`
- **Authentication Required:** No (Public)
- **Allowed Roles:** All (Unauthenticated)
- **Request Body Schema:**
  - `name` (String, required, min 2, max 50)
  - `email` (String, required, valid email, trimmed, lowercase)
  - `password` (String, required, min 8, max 100, regex `^(?=.*[a-zA-Z])(?=.*[0-9])`)
  - `role` (String, optional, enum `['customer', 'seller', 'admin']`, default: `'customer'`)
  *Example:*
  ```json
  {
    "name": "Jane Customer",
    "email": "customer@example.com",
    "password": "Password123!",
    "role": "customer"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "_id": "6740c0000000000000000001",
        "name": "Jane Customer",
        "email": "customer@example.com",
        "role": "customer",
        "isActive": true,
        "createdAt": "2026-11-22T10:00:00.000Z"
      },
      "tokens": {
        "accessToken": "eyJhbGciOiJIUzI1NiIs...",
        "refreshToken": "7a8b9c0d1e2f...",
        "expiresIn": "15m"
      }
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (weak password, invalid email format, or attempting `role: "admin"`).
  - `403 Forbidden`: Admin self-registration is forbidden (attempting to register with role `"admin"` is rejected by `ApiError.forbidden`).
  - `409 Conflict`: Email address already registered.

---

### `POST /api/v1/auth/login`
- **Authentication Required:** No (Public, rate limited to 10 attempts per 15 min per IP)
- **Allowed Roles:** All (Unauthenticated)
- **Request Body Schema:**
  - `email` (String, required, valid email)
  - `password` (String, required)
  *Example:*
  ```json
  {
    "email": "customer@example.com",
    "password": "CustomerPass123!"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "_id": "6740c0000000000000000002",
        "name": "Jane Customer",
        "email": "customer@example.com",
        "role": "customer",
        "isActive": true
      },
      "tokens": {
        "accessToken": "eyJhbGciOiJIUzI1NiIs...",
        "refreshToken": "e4f5a6b7c8d9...",
        "expiresIn": "15m"
      }
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing email or password.
  - `401 Unauthorized`: Generic `"Invalid email or password"` message to prevent account enumeration.
  - `403 Forbidden`: Account deactivated by administrator (`isActive: false`).
  - `429 Too Many Requests`: IP rate limit exceeded (10 attempts per 15 minutes).

---

### `POST /api/v1/auth/refresh`
- **Authentication Required:** No (Uses Refresh Token payload)
- **Allowed Roles:** All
- **Request Body Schema:**
  - `refreshToken` (String, required)
  *Example:*
  ```json
  {
    "refreshToken": "e4f5a6b7c8d9..."
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Tokens refreshed successfully",
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "1a2b3c4d5e6f...",
      "expiresIn": "15m"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing refresh token in payload.
  - `401 Unauthorized`: Token expired, not found, or **Replay Attack Detected** (if an already revoked token is used, all user sessions are terminated).

---

### `POST /api/v1/auth/logout`
- **Authentication Required:** No
- **Allowed Roles:** All
- **Request Body Schema:**
  - `refreshToken` (String, required)
  *Example:*
  ```json
  {
    "refreshToken": "1a2b3c4d5e6f..."
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Logged out successfully",
    "data": null
  }
  ```

---

### `GET /api/v1/users/me`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `customer`, `seller`, `admin`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Profile fetched successfully",
    "data": {
      "_id": "6740c0000000000000000002",
      "name": "Jane Customer",
      "email": "customer@example.com",
      "role": "customer",
      "isActive": true,
      "createdAt": "2026-11-22T10:00:00.000Z"
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Token missing, invalid, or expired.

---

### `PATCH /api/v1/users/me`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `customer`, `seller`, `admin`
- **Request Body Schema:**
  - `name` (String, optional, min 2, max 50)
  - `currentPassword` (String, required if changing password)
  - `password` (String, optional, min 8, regex with letter and number)
  *Example:*
  ```json
  {
    "name": "Johnathan Customer"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Profile updated successfully",
    "data": {
      "_id": "6740c0000000000000000002",
      "name": "Johnathan Customer",
      "email": "customer@example.com",
      "role": "customer"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Current password incorrect or missing when changing password.
  - `401 Unauthorized`: Authentication required.

---

### `GET /api/v1/users`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `admin` only
- **Query Parameters:**
  - `page` (Integer, optional, min 1, default 1)
  - `limit` (Integer, optional, min 1, max 50, default 10)
  - `role` (String, optional, enum `['customer', 'seller', 'admin']`)
  - `isActive` (Boolean, optional)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Users fetched successfully",
    "data": {
      "users": [
        {
          "_id": "6740c0000000000000000003",
          "name": "Seller One",
          "email": "seller@example.com",
          "role": "seller",
          "isActive": true
        }
      ],
      "pagination": { "total": 1, "page": 1, "limit": 10, "pages": 1 }
    }
  }
  ```
- **Error Responses:**
  - `403 Forbidden`: Authenticated user is not an administrator.

---

### `PATCH /api/v1/users/:id/status`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `admin` only
- **Path Parameters:**
  - `id` (24-char hex MongoDB ObjectId)
- **Request Body Schema:**
  - `isActive` (Boolean, required)
  *Example:* `{ "isActive": false }`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User status updated successfully",
    "data": { "_id": "6740c0000000000000000003", "isActive": false }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Admin attempting to deactivate their own account.
  - `404 Not Found`: Target user ID does not exist.

---

## 4. Product Categories

### `GET /api/v1/categories`
- **Authentication Required:** No (Public)
- **Allowed Roles:** All
- **Success Response (200 OK):** Returns array of active category objects (`_id`, `name`, `slug`, `description`).

### `GET /api/v1/categories/:id`
- **Authentication Required:** No (Public)
- **Path Parameters:** `id` (ObjectId)
- **Success Response (200 OK):** Returns single category details.
- **Error Responses:** `404 Not Found`.

### `POST /api/v1/categories`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `admin` only
- **Request Body Schema:**
  - `name` (String, required, min 2, max 50)
  - `description` (String, optional, max 500)
  *Example:*
  ```json
  {
    "name": "Audio Gear",
    "description": "Headphones, DACs, and studio monitors"
  }
  ```
- **Success Response (201 Created):** Returns created category with auto-generated slug (e.g. `"slug": "audio-gear"`).
- **Error Responses:**
  - `400 Bad Request`: Validation failure.
  - `403 Forbidden`: Non-admin caller.
  - `409 Conflict`: Category name or slug already exists.

### `PATCH /api/v1/categories/:id`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `admin` only
- **Path Parameters:** `id` (ObjectId)
- **Request Body Schema:** `name` (optional), `description` (optional), `isActive` (optional).
- **Success Response (200 OK):** Returns updated category.

### `DELETE /api/v1/categories/:id`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `admin` only
- **Path Parameters:** `id` (ObjectId)
- **Success Response (200 OK):** Returns success confirmation.
- **Error Responses:**
  - `409 Conflict`: Blocked if any products in the catalog reference this category (`Product.countDocuments({ category: id }) > 0`).

---

## 5. Product Catalog

### `GET /api/v1/products`
- **Authentication Required:** No (Public)
- **Query Parameters:**
  - `search` (String, optional): Matches product name and description via MongoDB text index.
  - `category` (ObjectId string, optional): Filter by category ID.
  - `seller` (ObjectId string, optional): Filter by seller ID.
  - `minPrice` (Number, optional, min 0): Minimum price.
  - `maxPrice` (Number, optional, min 0): Maximum price.
  - `inStock` (Boolean, optional): When `true`, filters items with `stock > 0`.
  - `sort` (String, optional, whitelist: `price`, `-price`, `createdAt`, `-createdAt`, `name`, `-name`, default `-createdAt`).
  - `page` (Integer, optional, min 1, default 1).
  - `limit` (Integer, optional, min 1, max 50, default 10).
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Products fetched successfully",
    "data": {
      "products": [
        {
          "_id": "6740c0000000000000000010",
          "name": "Wireless Studio Headphones",
          "description": "Active noise cancelling with 40-hour battery life",
          "price": 199.99,
          "category": { "_id": "...", "name": "Audio Gear", "slug": "audio-gear" },
          "seller": { "_id": "...", "name": "Seller One" },
          "stock": 24,
          "lowStockThreshold": 5,
          "images": ["https://..."],
          "isActive": true
        }
      ],
      "pagination": { "total": 1, "page": 1, "limit": 10, "pages": 1 }
    }
  }
  ```

### `GET /api/v1/products/mine`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `seller` only
- **Description:** Returns all products owned by the authenticated seller (including inactive/soft-deleted items).

### `GET /api/v1/products/:id`
- **Authentication Required:** No (Public)
- **Path Parameters:** `id` (ObjectId)
- **Success Response (200 OK):** Populated product document.
- **Error Responses:** `404 Not Found`.

### `POST /api/v1/products`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `seller`, `admin`
- **Request Body Schema:**
  - `name` (String, required, min 2, max 120)
  - `description` (String, required, min 5, max 2000)
  - `price` (Number, required, min 0)
  - `category` (ObjectId, required)
  - `seller` (ObjectId, optional for admin; strictly overridden to `req.user._id` for sellers)
  - `stock` (Integer, required, min 0)
  - `lowStockThreshold` (Integer, optional, min 0, default 5)
  - `images` (Array of URI strings, optional)
- **Success Response (201 Created):** Returns newly created product.

### `PATCH /api/v1/products/:id`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `seller` (owner only), `admin`
- **Rules:** If a seller attempts to edit another vendor's product, returns `403 Forbidden`.
- **Success Response (200 OK):** Returns updated product.

### `DELETE /api/v1/products/:id`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `seller` (owner only), `admin`
- **Behavior:** Executes a **soft delete** by updating `isActive: false` to protect historical order records and aggregation reports.
- **Success Response (200 OK):** Returns deletion confirmation.

---

## 6. Shopping Cart

*(All cart endpoints require `customer` role. Admin and Seller access is rejected with `403 Forbidden`. Cart is identified strictly by `req.user._id`)*

### `GET /api/v1/cart`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `customer` only
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Cart fetched successfully",
    "data": {
      "items": [
        {
          "product": {
            "_id": "6740c0000000000000000010",
            "name": "Wireless Studio Headphones",
            "price": 199.99,
            "images": ["https://..."]
          },
          "quantity": 2,
          "lineTotal": 399.98,
          "availableStock": 24,
          "available": true,
          "issue": null
        }
      ],
      "subtotal": 399.98,
      "total": 399.98,
      "itemCount": 2,
      "hasIssues": false
    }
  }
  ```

### `POST /api/v1/cart/items`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `customer` only
- **Request Body Schema:**
  - `productId` (ObjectId, required)
  - `quantity` (Integer, required, min 1, max 99)
  *(Notice: `price`, `total`, and `user` are strictly forbidden; submitting them returns 400 Bad Request)*
- **Rules:** Revalidates live product stock. If requested quantity exceeds stock, returns `409 Conflict`. Max 50 distinct items per cart.
- **Success Response (200 OK):** Returns updated dynamic cart.

### `PATCH /api/v1/cart/items/:productId`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `customer` only
- **Path Parameters:** `productId` (ObjectId)
- **Request Body Schema:** `{ "quantity": Integer (1-99) }`
- **Success Response (200 OK):** Returns updated dynamic cart.

### `DELETE /api/v1/cart/items/:productId`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `customer` only
- **Success Response (200 OK):** Removes line item and recalculates subtotal.

### `DELETE /api/v1/cart`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `customer` only
- **Success Response (200 OK):** Empties all items from the customer cart.

---

## 7. Orders & Checkout

### `POST /api/v1/orders` (Checkout)
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `customer` only
- **Request Body Schema:**
  ```json
  {
    "deliveryAddress": {
      "street": "100 Innovation Boulevard",
      "city": "Bengaluru",
      "state": "Karnataka",
      "postalCode": "560001",
      "country": "India"
    }
  }
  ```
- **Execution Lifecycle:**
  1. Validates cart items via `validateCartForCheckout(userId)`.
  2. Opens MongoDB replica set transaction (`session.withTransaction`).
  3. Atomically decrements product stock: `Product.updateOne({ _id, stock: { $gte: qty }, isActive: true }, { $inc: { stock: -qty } })`.
  4. Stores frozen price snapshot in order document with simulated payment.
  5. Clears customer cart.
  6. Outside transaction, fires `order:placed` and `stock:low` domain events.
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Order placed successfully",
    "data": {
      "_id": "6740c0000000000000000099",
      "customer": { "name": "Jane Customer", "email": "customer@example.com" },
      "items": [
        {
          "name": "Wireless Studio Headphones",
          "priceSnapshot": 199.99,
          "quantity": 1,
          "seller": "..."
        }
      ],
      "total": 199.99,
      "status": "pending",
      "payment": {
        "method": "SIMULATED",
        "status": "COMPLETED",
        "transactionId": "sim_1732276800000_abc"
      },
      "createdAt": "2026-11-22T12:00:00.000Z"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Empty cart or missing delivery address.
  - `409 Conflict`: Item unavailable or insufficient inventory during atomic decrement.

---

### `GET /api/v1/orders`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** All authenticated roles
- **Role Scoping:**
  - `customer`: Sees only their own orders.
  - `seller`: Sees orders containing products they sell.
  - `admin`: Sees all platform orders.
- **Query Parameters:** `status`, `page`, `limit` (max 50).
- **Success Response (200 OK):** Paginated orders list.

---

### `GET /api/v1/orders/:id`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** Owner customer, relevant seller, or admin.
- **Error Responses:** `403 Forbidden` if unauthorized.

---

### `PATCH /api/v1/orders/:id/status`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `seller` (who owns items in the order), `admin`
- **Request Body Schema:**
  - `status` (String, required, enum `['confirmed', 'shipped', 'delivered', 'cancelled']`)
  - `note` (String, optional, max 500)
- **State Machine Transitions:**
  - `pending` $\rightarrow$ `confirmed`, `cancelled`
  - `confirmed` $\rightarrow$ `shipped`, `cancelled`
  - `shipped` $\rightarrow$ `delivered`
- **Success Response (200 OK):** Returns updated order.
- **Error Responses:**
  - `400 Bad Request`: Invalid transition (e.g. `pending` directly to `shipped`, or modifying a terminal `cancelled` order).
  - `403 Forbidden`: Unauthorized user or seller updating order without their products.

---

### `POST /api/v1/orders/:id/cancel`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** Owner customer, relevant seller, or admin
- **Request Body Schema:**
  - `reason` (String, optional, max 500)
- **Rules:** Permitted **only** when order is in `pending` or `confirmed` status. Cancelling restores product stock via atomic `$inc` inside a transaction. Cannot cancel twice.
- **Success Response (200 OK):** Returns cancelled order.
- **Error Responses:**
  - `400 Bad Request`: Order is in `shipped` or `delivered` state, or already cancelled.

---

## 8. Order State Machine Matrix

The following table summarizes all valid order status transitions and authorization constraints:

| Current Status | Target Status | Allowed Actor | Inventory Impact | Error on Disallowed Attempt |
|---|---|---|---|---|
| `pending` | `confirmed` | Seller (with items) / Admin | None (already decremented at checkout) | `400 Bad Request` |
| `pending` | `cancelled` | Customer (owner) / Seller / Admin | **Atomically Restored** (`+$inc`) in ACID transaction | `400 Bad Request` |
| `confirmed` | `shipped` | Seller (with items) / Admin | None | `400 Bad Request` |
| `confirmed` | `cancelled` | Customer (owner) / Seller / Admin | **Atomically Restored** (`+$inc`) in ACID transaction | `400 Bad Request` |
| `shipped` | `delivered` | Seller (with items) / Admin | None (Fulfillment complete) | `400 Bad Request` |
| `shipped` | `cancelled` | *Disallowed* | N/A | `400 Bad Request`: *"Invalid transition from shipped to cancelled"* |
| `delivered` | *Any* | *Terminal state* | N/A | `400 Bad Request`: *"Status 'delivered' is a terminal state"* |
| `cancelled` | *Any* | *Terminal state* | N/A | `400 Bad Request`: *"Status 'cancelled' is a terminal state"* |

---

## 9. Aggregation Reports (Business Intelligence)

### `GET /api/v1/reports/sales`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `seller`, `admin`
- **Query Parameters:**
  - `from` (ISO date string, optional)
  - `to` (ISO date string, optional)
- **Pipeline Breakdown:**
  1. `$match`: Filters non-cancelled orders (`status !== 'cancelled'`) within the date range if provided.
  2. `$unwind` (Seller only): Flattens `items` array and filters by `items.seller === currentUser._id`.
  3. `$group`: Groups by day (`$dateToString: { format: "%Y-%m-%d", date: "$createdAt" }`).
     - For Sellers: computes `dailyRevenue` (`$sum: { $multiply: ["$items.priceSnapshot", "$items.quantity"] }`), `itemsSold` (`$sum: "$items.quantity"`), and tracks distinct orders using `distinctOrders: { $addToSet: "$_id" }`.
     - For Admins: computes `revenue` (`$sum: "$total"`), `ordersCount` (`$sum: 1`), and `itemsSold` (`$sum: { $sum: "$items.quantity" }`).
  4. `$project`: Projects `date`, `revenue`, `ordersCount` (for sellers, derived from `$size: "$distinctOrders"`), and `itemsSold`.
  5. `$sort`: Ascending sort by date (`{ date: 1 }`).
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Sales summary report generated successfully",
    "data": {
      "summary": {
        "totalRevenue": 3698.50,
        "totalOrders": 13,
        "totalItemsSold": 25
      },
      "dailyBreakdown": [
        { "date": "2026-11-20", "revenue": 1499.50, "ordersCount": 5, "itemsSold": 10 },
        { "date": "2026-11-21", "revenue": 2199.00, "ordersCount": 8, "itemsSold": 15 }
      ]
    }
  }
  ```

### `GET /api/v1/reports/best-sellers`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `seller`, `admin`
- **Query Parameters:** `limit` (Integer, min 1, max 50, default 10).
- **Pipeline Breakdown:**
  1. `$match`: Excludes cancelled orders (`status !== 'cancelled'`).
  2. `$unwind: "$items"`: Flattens order line items.
  3. `$match` (Seller only): Filters items by `items.seller === currentUser._id`.
  4. `$group`: Groups by `items.product`, preserving `name: { $first: "$items.name" }`, summing `totalUnitsSold: { $sum: "$items.quantity" }` and `totalRevenue: { $sum: { $multiply: ["$items.priceSnapshot", "$items.quantity"] } }`.
  5. `$sort: { totalUnitsSold: -1 }`: Sorts descending by total units sold.
  6. `$limit`: Limits results to requested count.
  7. `$lookup`: Joins from `products` collection to retrieve live `stock` and `isActive`.
  8. `$project`: Projects `productId`, `name`, `totalUnitsSold`, `totalRevenue`, `currentStock`, and `isActive`.
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Best sellers report generated successfully",
    "data": [
      {
        "productId": "6b02f88c61fe6efd4e1eb860",
        "name": "Classic Vintage Denim Jacket",
        "totalUnitsSold": 24,
        "totalRevenue": 1679.76,
        "currentStock": 16,
        "isActive": true
      }
    ]
  }
  ```

### `GET /api/v1/reports/inventory`
- **Authentication Required:** Yes (`Bearer <accessToken>`)
- **Allowed Roles:** `seller`, `admin`
- **Pipeline Breakdown:**
  1. `$match`: Filters active products (`isActive: true`) scoped to `seller` if called by a seller.
  2. `$group`: Groups by `category`, calculating `totalProducts: { $sum: 1 }`, `totalStock: { $sum: "$stock" }`, `totalStockValue: { $sum: { $multiply: ["$price", "$stock"] } }`, and `lowStockProductsCount: { $sum: { $cond: [{ $lte: ["$stock", "$lowStockThreshold"] }, 1, 0] } }`.
  3. `$lookup`: Joins category name from `categories` collection.
  4. `$project`: Projects `categoryId`, `categoryName`, `totalProducts`, `totalStock`, `totalStockValue`, and `lowStockProductsCount`.
  5. `$sort: { totalStockValue: -1 }`: Ranks highest total stock value first.
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Inventory summary report generated successfully",
    "data": [
      {
        "categoryId": "6afd25368132133b43b80792",
        "categoryName": "Clothing & Apparel",
        "totalProducts": 3,
        "totalStock": 73,
        "totalStockValue": 5329.85,
        "lowStockProductsCount": 0
      }
    ]
  }
  ```

---

## 10. Real-Time WebSockets (Socket.IO Specification)

### Connection & Handshake Authentication
- **Transport:** WebSocket with long-polling fallback.
- **Connection URL:** `ws://localhost:5000` (or `http://localhost:5000`)
- **Handshake Authentication:** The client must provide a valid JWT access token using one of three supported methods:
  1. `socket.handshake.auth.token` (Recommended)
  2. `socket.handshake.headers.authorization` (`Bearer <token>`)
  3. `socket.handshake.query.token`
- **Client Connection Example:**
  ```javascript
  import { io } from "/socket.io/socket.io.js";

  const socket = io("http://localhost:5000", {
    auth: { token: sessionStorage.getItem("accessToken") }
  });
  ```

### Automatic Room Assignments
Upon successful handshake verification, the server automatically assigns the socket to private channels:
1. `user:<userId>`: Joined by all authenticated sockets. Used for private user updates.
2. `role:admin`: Joined automatically if the authenticated user's role is `admin`. Used for platform-wide alerts.

### Live Server-to-Client Event Catalog

| Event Name | Recipient Room | Domain Trigger | Direction | Payload Schema |
|---|---|---|---|---|
| `order:new` | `user:<sellerId>` | Customer checks out an order containing seller's items | Server $\rightarrow$ Client | `{ orderId: String, status: "pending", total: Number, itemsCount: Number, message: String, timestamp: ISOString }` |
| `order:status` | `user:<customerId>` | Order status progressed or cancelled | Server $\rightarrow$ Client | `{ orderId: String, status: String, message: String, timestamp: ISOString }` |
| `stock:low` | `user:<sellerId>` and `role:admin` | Product inventory falls at or below `lowStockThreshold` | Server $\rightarrow$ Client | `{ productId: String, productName: String, stock: Number, threshold: Number, message: String, timestamp: ISOString }` |

> [!NOTE]
> All real-time broadcasts are decoupled from HTTP controllers. Services emit to the internal Node.js `EventEmitter`, which is consumed by `orderEvents.js` and pushed through Socket.IO.
