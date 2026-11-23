# E-Commerce & Real-Time Inventory Management System

A full-stack e-commerce and real-time inventory management platform engineered with **Node.js, Express.js, MongoDB (Mongoose), Socket.IO, and native Node.js EventEmitter**. The architecture follows a clean MVC with a service layer pattern using modern native ES Modules, paired with an editorial retail storefront built with vanilla HTML5, CSS3, and modern JavaScript (ES Modules).

All API endpoints are mounted under the `/api/v1` prefix. Financial transactions are conducted via an internal simulated payment engine (`SIMULATED` provider), ensuring complete transactional realism without third-party sandbox dependencies.

---

## 🚀 Key Features

- **Role-Based Access Control (RBAC):** Three distinct personas (`customer`, `seller`, `admin`) with route-level middleware guards and ownership verification.
- **Dual-Token JWT Security with Replay Detection:** Short-lived access tokens (15m) + rotating refresh tokens (7d) stored as one-way SHA-256 hashes in MongoDB with automatic TTL eviction. Replay attacks trigger immediate termination of all active sessions for the compromised user.
- **Product Catalog & Advanced Search:** MongoDB text search on product name and description, compound indexes for category filtering and price sorting (`{ category: 1, price: 1 }`), seller inventory indexing, and soft deletion (`isActive: false`).
- **Dynamic Shopping Cart:** Enforces a single cart per customer via a MongoDB unique index (`{ user: 1 }`). Prices and totals are **never stored** in the cart; subtotals are computed dynamically from live catalog data to prevent client-side price tampering. Stale/insufficient stock items are flagged non-destructively (`PRODUCT_UNAVAILABLE`, `INSUFFICIENT_STOCK`).
- **Atomic Concurrency Control & ACID Transactions:** Multi-document MongoDB transactions (`session.withTransaction`) execute conditional atomic decrements (`{ stock: { $gte: quantity } }, { $inc: { stock: -quantity } }`), designed to prevent race conditions and overselling even when multiple buyers check out the last remaining unit simultaneously.
- **Finite State Machine:** Order progression follows strict validation rules (`pending -> confirmed -> shipped -> delivered`). Cancellations from `pending` or `confirmed` states atomically restore stock to the catalog inside a transaction.
- **Decoupled Real-Time Architecture:** Core business services emit Node.js domain events (`order:placed`, `order:statusChanged`, `stock:low`) into an `EventEmitter` singleton. A separate event handler bridge translates these events into targeted `Socket.IO` broadcasts to authenticated rooms (`role:admin`, `user:<id>`).
- **MongoDB Aggregation Pipelines:** Native analytical pipelines for daily sales trends, best-selling product velocity, and category-level inventory valuations.
- **Defensive Production Hardening:** Rate-limited authentication (`express-rate-limit`), Helmet security headers, CORS origin controls, Joi schema validation, centralized operational error handling (`ApiError`), and fail-fast startup checks.

---

## 🛠️ Tech Stack & Architecture Rationale

| Technology | Role | Architecture Rationale |
|---|---|---|
| **Node.js (v18+ / v20+)** | Runtime | Event-driven, non-blocking I/O model ideal for concurrent I/O operations and native ES Modules. |
| **Express.js (v4)** | HTTP Framework | Minimalist, unopinionated foundation providing robust middleware chaining, route modularity, and error trapping. |
| **MongoDB & Mongoose (v8)** | Database & ODM | Schema flexibility for nested order snapshots and product documents; paired with a **Replica Set** to enable multi-document ACID transactions. |
| **Joi** | Boundary Validation | Strict schema enforcement on incoming HTTP `body`, `params`, and `query`. Forbids parameter pollution and client price tampering before hitting controllers. |
| **JWT (jsonwebtoken)** | Authentication | Stateless authentication for horizontal scalability, coupled with stateful database refresh token rotation for instantaneous revocation capabilities. |
| **Socket.IO** | Real-Time Transport | Bi-directional WebSocket communication with room-based multiplexing (`user:<id>`, `role:admin`) and automatic reconnection fallback. |
| **Node.js EventEmitter** | Domain Event Bus | Completely decouples core business services from network transport layers. Services remain testable without mocking WebSockets. |
| **Vanilla HTML/CSS/JS (ESM)** | Frontend UI | Zero build step, zero framework overhead, fast rendering, and clean separation of concerns using native ES module imports and Fetch API. |

---

## 📋 Prerequisites

- **Node.js:** `v18.x` or `v20.x` LTS
- **MongoDB:** `v6.x` or `v7.x` (Requires a **Replica Set** for multi-document ACID transactions)
- **Git**

---

## 🔧 MongoDB Replica Set Setup

Multi-document ACID transactions (`session.withTransaction`) require MongoDB to run as a replica set, even for local development. Choose either Option A (Local) or Option B (Cloud Atlas).

### Option A: Local MongoDB on Windows

1. **Locate your MongoDB configuration file:**  
   Default path: `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg`
2. **Add the replication section:**  
   Open `mongod.cfg` in an editor (Run as Administrator) and add:
   ```yaml
   replication:
     replSetName: "rs0"
   ```
3. **Restart the MongoDB Windows Service:**  
   Run PowerShell as Administrator:
   ```powershell
   Restart-Service -Name MongoDB
   ```
4. **Initiate the Replica Set:**  
   Open `mongosh` (or MongoDB Compass terminal) and run once:
   ```javascript
   rs.initiate()
   ```
5. **Update your `.env` connection string:**
   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/ecommerce_inventory?replicaSet=rs0
   ```

*Alternative quick start without Windows Service:*  
Start mongod from terminal on an isolated directory:
```powershell
mongod --dbpath C:\data\db --replSet rs0 --port 27017
# In a second terminal:
mongosh --eval "rs.initiate()"
```

### Option B: MongoDB Atlas (Cloud Alternative)

Every free MongoDB Atlas cluster automatically runs as a 3-node replica set out of the box with zero local configuration:
1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a database user and whitelist your IP (or `0.0.0.0/0` for development).
3. Copy the standard connection string and add it to your `.env`:
   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/ecommerce_inventory?retryWrites=true&w=majority
   ```

---

## ⚙️ Environment Variables

Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Optional | `development` | Runtime environment (`development`, `production`, `test`). |
| `PORT` | Optional | `5000` | HTTP port on which Express listens. |
| `MONGO_URI` | **Required** | *None* | MongoDB connection string (must include `replicaSet=rs0` for local or Atlas SRV). |
| `JWT_ACCESS_SECRET` | **Required** | *None* | Cryptographic secret for signing access tokens (min 32 characters). |
| `JWT_ACCESS_EXPIRES_IN` | Optional | `15m` | Lifetime of access tokens (e.g. `15m`, `1h`). |
| `JWT_REFRESH_SECRET` | **Required** | *None* | Cryptographic secret for signing refresh tokens (min 32 characters). |
| `JWT_REFRESH_EXPIRES_IN`| Optional | `7d` | Lifetime of refresh tokens (e.g. `7d`, `30d`). |
| `CLIENT_URL` | Optional | `http://localhost:3000` | Allowed CORS origin (public frontend is also served directly at `/`). |
| `ADMIN_NAME` | Optional | `System Administrator` | Default administrator name for database seed script. |
| `ADMIN_EMAIL` | Optional | `admin@example.com` | Default administrator email for database seed script. |
| `ADMIN_PASSWORD` | Optional | `AdminPass123!` | Default administrator password for database seed script. |

> [!IMPORTANT]
> The server implements a fail-fast configuration validator in `src/config/env.js`. If `MONGO_URI`, `JWT_ACCESS_SECRET`, or `JWT_REFRESH_SECRET` is missing at startup, the server terminates immediately with a clear diagnostic message.

---

## 🚀 Step-by-Step Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create `.env` using the template above.

3. **Seed Database:**
   Populates roles, users, 5 product categories, and 17 products (including active, low-stock, and out-of-stock items):
   ```bash
   npm run seed
   ```
   > **Note:** npm run seed adds any missing seed data. It does NOT delete or reset existing data. To start from a clean state, drop the database first: mongosh "mongodb://127.0.0.1:27017/ecommerce_inventory" --eval "db.dropDatabase()" then run npm run seed.

4. **Start Application:**
   - **Development mode (with nodemon watching `src/`):**
     ```bash
     npm run dev
     ```
   - **Production mode:**
     ```bash
     npm start
     ```

5. **Verify Health Check:**
   Open [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health) to confirm the database reports `"connected": true`.

---

## 🌐 Using the Frontend Storefront

The frontend is served directly by the Express server via `express.static('public')`. Navigate to [http://localhost:5000/](http://localhost:5000/) in your web browser.

> **Note:** Product images are loaded from external Unsplash URLs and need an internet connection; offline, the UI shows the built-in fallback.

### Available Pages & URLs

| URL | Page | Description |
|---|---|---|
| `http://localhost:5000/` | **Catalog & Storefront** | Product listing with live search, category filter pills, price filtering, sorting, and pagination. |
| `http://localhost:5000/login.html` | **Sign In** | Unified login form for all roles with automatic redirection to role-specific dashboards. |
| `http://localhost:5000/register.html` | **Register** | Public registration for `customer` or `seller` roles. |
| `http://localhost:5000/cart.html` | **Cart & Checkout** | Shopping cart with live server-computed line totals, stock alerts, and delivery address checkout. |
| `http://localhost:5000/orders.html` | **Order History** | Role-based order tracking, finite state machine progress actions, and cancellation controls. |
| `http://localhost:5000/seller.html` | **Seller Portal** | Seller inventory management, stock threshold adjustments, and product listing creation. |
| `http://localhost:5000/admin.html` | **Admin Console** | Platform analytics (Sales, Best Sellers, Inventory Valuation), Category CRUD, and User status management. |
| `http://localhost:5000/socket-test.html` | **WebSocket Diagnostic** | Interactive real-time test console to inspect live Socket.IO events and room broadcasts. |

### Default Seed Accounts & Role Capabilities

| Role | Email | Password | Permissions & Actions |
|---|---|---|---|
| **Admin** | `admin@example.com` | `AdminPass123!` | Create/edit categories, deactivate user accounts, view all platform orders, progress orders, and view multi-stage aggregation BI reports. |
| **Seller A** | `seller@example.com` | `SellerPass123!` | Create and edit own products, view own inventory (`/products/mine`), view orders containing own items, progress order status to `confirmed` or `shipped`. |
| **Seller B** | `seller2@example.com` | `SellerPass123!` | Secondary seller account used to verify cross-tenant isolation and 403 authorization checks. |
| **Customer** | `customer@example.com` | `CustomerPass123!` | Browse catalog, add to cart, checkout with simulated payment, view own orders, and cancel orders in `pending`/`confirmed` states. |
| **Inactive User** | `inactive@example.com` | `CustomerPass123!` | Seeded inactive account used to verify that deactivated accounts are rejected on login with HTTP 403. |

---

## 🧪 Running the Automated Postman Test Collection

A complete, automated Postman v2.1 collection is located at [`docs/postman_collection.json`](docs/postman_collection.json).

### Running in Postman App:
1. Open Postman $\rightarrow$ Click **Import** $\rightarrow$ Select `docs/postman_collection.json`.
2. Inspect the Collection Variables: `baseUrl` is set to `http://localhost:5000/api/v1`.
3. Open the **Collection Runner** (Select the collection and click "Run").
4. Ensure the execution order is kept (`Auth` runs first so login tests populate `customerToken`, `sellerToken`, and `adminToken` variables).
5. Click **Run E-Commerce & Inventory Management API**.
6. All 69 requests and 89 assertions in `docs/postman_collection.json` will execute and verify status codes (200, 201, 400, 401, 403, 404, 409).

### Running via Newman CLI (Headless):
```bash
npx newman run docs/postman_collection.json --env-var "baseUrl=http://localhost:5000/api/v1"
```
The login rate limiter (10 attempts per 15 minutes per IP, in memory) can cause 429 on back-to-back runs. Restart the server before re-running the collection.

> **Note:** npm run seed adds any missing seed data. It does NOT delete or reset existing data. To start from a clean state, drop the database first: mongosh "mongodb://127.0.0.1:27017/ecommerce_inventory" --eval "db.dropDatabase()" then run npm run seed.

---

## 📂 Project Directory Structure

```text
├── docs/                         # Comprehensive project documentation & test artifacts
│   ├── API.md                    # Exhaustive REST API & WebSocket event specification
│   ├── DATABASE.md               # Data dictionary, ER diagram, index mappings & aggregations
│   ├── GAPS.md                   # Transparent compliance audit & requirement gap matrix
│   ├── REPORT.md                 # Formal Academic Capstone Report (IEEE/Academic format)
│   └── postman_collection.json   # Automated Postman v2.1 test suite
├── public/                       # Frontend web client (Vanilla HTML5, CSS3, ES Modules)
│   ├── css/
│   │   └── style.css             # Editorial retail design stylesheet
│   ├── js/
│   │   ├── admin.js              # Admin portal logic (categories, analytics charts, user status)
│   │   ├── api.js                # Centralized Fetch client with automatic token attachment
│   │   ├── auth.js               # Dual-token management & session restoration
│   │   ├── cart.js               # Cart rendering, quantity mutation & simulated checkout
│   │   ├── index.js              # Storefront catalog, filtering, search, and pagination
│   │   ├── login.js              # Authentication form & role-based routing
│   │   ├── navbar.js             # Dynamic role-aware navigation bar
│   │   ├── orders.js             # Order tracking & state machine action handlers
│   │   ├── register.js           # Self-service account registration
│   │   ├── seller.js             # Seller inventory CRUD & stock management
│   │   ├── socket.js             # Client-side Socket.IO real-time toast notification engine
│   │   └── utils.js              # Currency formatters, debounce & image fallback helpers
│   ├── admin.html
│   ├── cart.html
│   ├── index.html
│   ├── login.html
│   ├── orders.html
│   ├── register.html
│   ├── seller.html
│   └── socket-test.html
├── src/                          # Backend source code (Node.js ES Modules)
│   ├── config/                   # Database connection and environment validation
│   ├── controllers/              # Thin Express controllers (delegate to services)
│   ├── events/                   # Decoupled EventEmitter singleton & domain event handlers
│   ├── middleware/               # Auth, RBAC, Joi validation, rate limiting & error handling
│   ├── models/                   # Mongoose schemas, indexes, and constraints
│   ├── routes/                   # Modular route declarations mounted under /api/v1
│   ├── seed/                     # Database seeder with sample data
│   ├── services/                 # Core business logic, ACID transactions & aggregation pipelines
│   ├── socket/                   # Socket.IO server initialization & handshake auth
│   ├── utils/                    # ApiError, ApiResponse, asyncHandler, state machine & logger
│   ├── validations/              # Joi request validation schemas
│   ├── app.js                    # Express app configuration & middleware pipeline
│   └── server.js                 # HTTP + Socket.IO server bootstrap & graceful shutdown listeners
├── .env.example                  # Environment configuration template
├── nodemon.json                  # Nodemon watch configuration (restricts watching to src/)
├── package.json                  # Dependencies and execution scripts
└── README.md                     # Project documentation root
```
