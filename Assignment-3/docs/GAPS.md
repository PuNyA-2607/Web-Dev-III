# System Compliance Audit, Gaps & Architectural Limitations (GAPS.md)

This document provides a comprehensive, transparent audit comparing the system's actual implementation in `src/` and `public/` against the project specifications, industry security standards, and production readiness requirements.

---

## 1. Compliance Matrix

| Module / Feature | Required Behavior | Actual Behavior in Code | Status | Proof (File) | Needed Fix (if any) |
|---|---|---|---|---|---|
| **Auth: Token Rotation** | Rotate refresh token on `/auth/refresh`, issue new token pair, invalidate old token. | Generates new token pair, saves new SHA-256 hash, marks old record revoked with `replacedBy`. | **Met** | `src/services/auth.service.js` | None. |
| **Auth: Replay Attack Detection** | If a revoked token is used, invalidate all sessions for that user immediately. | Checks `tokenRecord.revokedAt`. If truthy, calls `RefreshToken.deleteMany({ user: tokenRecord.user })` and throws 401. | **Met** | `src/services/auth.service.js` | None. |
| **Auth: Token Security** | Store refresh tokens as cryptographic hashes, not plaintext. | Hashes incoming token with `crypto.createHash('sha256')` before MongoDB query and save. | **Met** | `src/services/auth.service.js` | None. |
| **Auth: Role Restriction** | Self-registration limited to `customer` and `seller`. Admin registration blocked. | Register schema passes role to service layer which strictly rejects `admin` self-registration with 403 Forbidden (`ApiError.forbidden`). | **Met** | `src/validations/auth.validation.js` | None. |
| **Categories: Unique Slugs** | Auto-generate unique slug on category creation. | Custom `slugify` utility converts name to lowercase kebab-case and persists to indexed unique field. | **Met** | `src/services/category.service.js` | None. |
| **Categories: Cascade Delete Prevention** | Block deletion of category containing products (409 Conflict). | Checks `Product.countDocuments({ category: id })`. If `> 0`, throws `ApiError.conflict(409)`. | **Met** | `src/services/category.service.js` | None. |
| **Products: Text Search & Filter** | Text search on name+desc, compound category+price, seller index, whitelisted sorting. | MongoDB text index on `{ name: "text", description: "text" }`, compound `{ category: 1, price: 1 }`, `{ seller: 1 }`. Whitelist validation in Joi. | **Met** | `src/models/Product.js` & `src/services/product.service.js` | None. |
| **Products: Cross-Tenant Ownership** | Sellers can only edit or delete their own products. Admin can edit all. | In `updateProduct` & `deleteProduct`, checks `product.seller.toString() === currentUser._id.toString() \|\| currentUser.role === 'admin'`. Throws 403 if unauthorized. | **Met** | `src/services/product.service.js` | None. |
| **Products: Soft Deletion** | Deleting product marks `isActive: false` instead of hard deleting from database. | `deleteProduct` sets `product.isActive = false` and saves. Catalog queries filter by `isActive: true`. | **Met** | `src/services/product.service.js` | None. |
| **Cart: Tenant Isolation** | Cart looked up strictly by authenticated user ID; no client-provided cart ID. | Looked up via `req.user._id` from validated JWT; route does not accept `:cartId` parameter. | **Met** | `src/controllers/cart.controller.js` | None. |
| **Cart: Dynamic Server Pricing** | Cart stores no prices or totals; calculates dynamically from catalog. Forbids client-sent prices. | Cart schema stores only `{ product, quantity }`. `POST /cart/items` forbids `price`, `subtotal`. Totals computed during `getCart`. | **Met** | `src/models/Cart.js` & `src/services/cart.service.js` | None. |
| **Cart: Stock & Availability Flags** | Flag inactive or insufficient stock items with `available: false` and `issue` without removing. | Computes `available` and `issue` (`PRODUCT_UNAVAILABLE` or `INSUFFICIENT_STOCK`) per line item. | **Met** | `src/services/cart.service.js` | None. |
| **Orders: Atomic Concurrency Decrement** | Enforce atomic inventory decrement preventing negative stock under concurrent checkouts. | Executes `Product.updateOne({ _id: item.product, stock: { $gte: item.quantity }, isActive: true }, { $inc: { stock: -item.quantity } }, { session })`. | **Met** | `src/services/order.service.js` | None. |
| **Orders: Multi-Document ACID Transaction** | Checkout executes in replica set transaction; rolls back completely if any item fails. | Uses `await session.withTransaction(...)` in Mongoose; aborts automatically if insufficient stock or error occurs. | **Met** | `src/services/order.service.js` | None. |
| **Orders: State Machine Validation** | Strict transition enforcement (`pending -> confirmed -> shipped -> delivered`). | `validateTransition(current, target)` throws 400 Bad Request if transition is invalid or already terminal. | **Met** | `src/utils/orderStateMachine.js` | None. |
| **Orders: Status Progression by Role** | Sellers (with items in order) and Admins can update order status per state machine rules. | In `order.service.js`, validates caller is a seller owning items in the order or an admin, then enforces state transition. | **Met** | `src/services/order.service.js` | None. Spec allows both sellers and admins to update status per defined state machine rules. |
| **Orders: Cancellation Restock** | Cancelling order in `pending` or `confirmed` restores product inventory in transaction. | Inside `session.withTransaction`, performs `$inc: { stock: item.quantity }` for each order line item. | **Met** | `src/services/order.service.js` | None. |
| **Reports: Multi-Stage Aggregation** | 3 pipelines: Sales by date range, Best Sellers, Inventory valuation by category. | Implements all three aggregation pipelines using `$match`, `$unwind`, `$group`, `$sort`, `$limit`, and `$lookup`. | **Met** | `src/services/report.service.js` | None. |
| **Events: Decoupled Architecture** | Services emit to Node.js `EventEmitter`; WebSocket server listens to events. | Services emit `order:placed`, `order:statusChanged`, `stock:low` to singleton `eventEmitter`. WebSocket module registers listeners in `orderEvents.js`. | **Met** | `src/events/eventEmitter.js` & `src/events/orderEvents.js` | None. |
| **Socket.IO: Authenticated Rooms** | JWT handshake authentication; users join `user:<id>`, admins join `role:admin`. | Socket middleware verifies JWT in `socket.handshake.auth.token` or `headers.authorization`. Automatically joins `user:<userId>` and `role:admin`. | **Met** | `src/socket/socketServer.js` | None. |
| **Health Check** | Diagnostics endpoint returning database status and uptime; 503 if DB down. | `GET /api/v1/health` checks `mongoose.connection.readyState === 1`. Returns 200 with stats or 503 Service Unavailable. | **Met** | `src/routes/health.routes.js` | None. |
| **Testing: In-Code Test Runner** | Automated unit/integration test suite executable via `npm test`. | Testing is provided via Postman v2.1 collection runner / Newman; no in-code Jest / Supertest runner configured in `package.json`. | **Partially Met / Limitation** | `package.json` | Configure `jest` or `vitest` with `supertest` in `package.json` scripts. |
| **Security: Token Storage in Browser** | Store tokens in secure, `httpOnly`, `sameSite` cookies to mitigate XSS risks. | Frontend persists both access token and refresh token in browser `sessionStorage` (and attaches them in Authorization headers / request bodies). | **Limitation** | `public/js/auth.js` | Transition token transport to `httpOnly`, secure, `SameSite=Strict` cookies with CSRF tokens. |
| **Security: Content Security Policy (CSP)** | Strict CSP policy preventing arbitrary inline script/style execution. | Helmet CSP allows `'unsafe-inline'` for styles and scripts to support dynamic theme rendering and Socket.IO. | **Limitation** | `src/app.js` | Refactor CSP to utilize cryptographic nonces (`'nonce-...'`) or SHA-256 hashes instead of `'unsafe-inline'`. |
| **Security: Hardcoded Demo Credentials** | Demo credentials should not be exposed in source control or UI helper buttons. | Default demo credentials (`admin@example.com`, `seller@example.com`, `customer@example.com` with passwords) are documented in `.env.example`, README, seed scripts, and login helper pills. | **Limitation** | `src/seed/seed.js` & `public/login.html` | Remove UI demo pills; generate randomized secrets via environment variables for staging/production deployments. |
| **Orders: Multi-Seller Order Cancellation** | Granular line-item or per-vendor cancellation in multi-seller shopping baskets. | Orders operate with a single root-level state machine. When an order is cancelled, all items from all sellers are cancelled and restocked together. | **Partially Met / Limitation** | `src/services/order.service.js` | Introduce per-item fulfillment status (`items[i].status`) allowing individual item or vendor cancellation. |

| **Socket.IO: Account Status on Handshake** | Deactivated users should not be able to open or keep a socket | Handshake verifies the JWT signature and reads id and role from it, with no database lookup | Limitation | src/socket/socketServer.js | Load the user on connect and reject if isActive is false. |
| **Catalog: External Image Hosting** | Seeded product images hosted externally via Unsplash CDN URLs. | Product images are loaded from external Unsplash URLs and need an internet connection; offline, the UI shows the built-in fallback. | **Limitation** | `src/seed/seed.js` & `public/js/index.js` | Implement local static image uploads (e.g. Multer) or self-hosted media storage. |

---

## 2. In-Depth Analysis of System Weak Spots & Limitations

### 1. Absence of Standalone In-Code Automated Test Suite (`package.json`)
- **Status:** Partially Met / Limitation
- **Description:** Complete end-to-end regression testing is delivered via an automated Postman v2.1 collection (`docs/postman_collection.json`) containing 89 assertions across 69 requests in the Postman collection (automated test suite) executable via Newman CLI. However, the project lacks an embedded Node.js test harness (such as Jest, Vitest, or Mocha with Supertest) in `package.json` dependencies. A Newman run on 2026-11-22 against a seeded database executed 69 requests and 89 assertions with 0 failures.
- **Production Impact:** CI/CD pipelines must install and run Newman as an external CLI rather than running standard `npm test`.
- **Recommended Remedy:** Add `devDependencies: { "jest": "^29.x", "supertest": "^6.x" }` and write unit/integration test specifications under a `tests/` directory.

### 2. Client-Side Token Storage in `sessionStorage`
- **Status:** Limitation
- **Description:** In `public/js/auth.js`, both the access token (`shopverse_access_token`) and refresh token (`shopverse_refresh_token`) are stored in the browser's `sessionStorage` (with user metadata in `shopverse_user`). While this persists authentication across intra-tab page navigations and clears when the tab is closed, any Cross-Site Scripting (XSS) vulnerability would expose both the access token and refresh token to malicious JavaScript access.
- **Production Impact:** Increased vulnerability surface to client-side script injection compared to `httpOnly` cookies.
- **Recommended Remedy:** Issue refresh tokens inside an `httpOnly`, `Secure`, `SameSite=Strict` cookie from Express, and use short-lived access tokens with secure transport, ensuring client JavaScript cannot read sensitive token values directly.

### 3. Loose Content Security Policy (CSP) Directives
- **Status:** Limitation
- **Description:** In `src/app.js`, the Helmet CSP configuration enables `'unsafe-inline'` for `script-src` and `style-src` to permit dynamically rendered inline styles and Socket.IO client scripts.
- **Production Impact:** Permitting `'unsafe-inline'` weakens browser-level defenses against DOM-based XSS attacks.
- **Recommended Remedy:** Implement per-request cryptographic nonces (`res.locals.nonce = crypto.randomBytes(16).toString('base64')`), pass nonces to `<script nonce="...">` tags, and remove `'unsafe-inline'` from CSP directives.

### 4. Hardcoded Demo Accounts and Credentials
- **Status:** Limitation
- **Description:** For academic demonstration and evaluation convenience, default accounts and passwords (`AdminPass123!`, `SellerPass123!`, `CustomerPass123!`) are documented in `.env.example`, `README.md`, `src/seed/seed.js`, and surfaced as autofill helper buttons on `public/login.html`.
- **Production Impact:** If deployed to a publicly accessible host without changing environment variables, malicious actors could instantly compromise platform administration.
- **Recommended Remedy:** Restrict demo autofill pills to `NODE_ENV === 'development'`. For production deployments, enforce random administrative password generation on initialization and mandate password changes on first login.

### 5. Whole-Order Cancellation for Multi-Seller Baskets
- **Status:** Partially Met / Limitation
- **Description:** The system allows a customer to checkout items from multiple distinct sellers in a single cart. However, the `Order` model enforces a single document-level status field (`order.status`). When a customer or seller cancels an order, the entire order is marked `cancelled` and all items across all sellers are restocked in bulk.
- **Production Impact:** In a high-volume marketplace, one seller being out of stock or cancelling an item forces the cancellation of other unrelated vendors' items in that order.
- **Recommended Remedy:** Refactor the order schema to maintain fulfillment statuses per line item (`order.items[i].status: 'pending' | 'shipped' | 'cancelled'`), enabling partial order fulfillment and individual item refunds.

---

### 6. Socket Handshake Does Not Check Account Active Status
- **Status:** Limitation
- **Description:** In `src/socket/socketServer.js`, the Socket.IO handshake authentication middleware verifies the incoming JWT signature and decodes user properties (`id` and `role`). However, it does not query MongoDB (`User.findById`) to verify whether `user.isActive` remains `true`. Consequently, if an administrator deactivates a user account, that user can continue opening and maintaining real-time WebSocket connections with an existing unexpired access token until the token reaches its 15-minute expiration.
- **Production Impact:** Deactivated users temporarily retain access to real-time order and inventory telemetry.
- **Recommended Remedy:** In the `io.use` handshake middleware, query the user collection (`await User.findById(decoded.id).select('isActive')`) and reject the handshake with `next(new Error('Account is deactivated'))` if `!user || !user.isActive`.

---

### 7. Product Images Depend on External Unsplash CDN
- **Status:** Limitation
- **Description:** Seeded product records store external image URLs pointing to Unsplash (`images.unsplash.com`). Product images are loaded from external Unsplash URLs and need an internet connection; offline, the UI shows the built-in fallback (`product-image-fallback`).
- **Production Impact:** Offline or air-gapped environments cannot render product photographs unless an internet connection is available.
- **Recommended Remedy:** Implement local media storage using `multer` to serve image assets directly from `public/uploads/` or an S3 bucket.

## 3. Summary of Compliance Score

- **Total Assessed Requirements & Architecture Areas:** 28
- **Fully Met:** 21
- **Partially Met / Limitation:** 7
- **Completely Missing:** 0

*Audit updated and verified against codebase on 2026-11-22.*
