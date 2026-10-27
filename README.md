# Add2Cart

Add2Cart is a React/Vite marketplace with a small Node.js API for accounts, carts, and orders. Node.js 22.13 or later is required because the API uses the built-in SQLite module.

## Run locally

```sh
npm install
Copy-Item .env.example .env
npm run dev
```

The Vite UI runs at `http://127.0.0.1:5173` and proxies `/api` to the API at `http://127.0.0.1:4179`. `.env.example` lists the explicit local origins allowed to call the API. Set `APP_ORIGINS` to a comma-separated list of exact trusted frontend origins if the UI runs elsewhere. Set `ADMIN_EMAILS` to the email address(es) that should have seller-approval administration rights; registration still cannot assign roles. The API creates `server/data/add2cart.sqlite` on first run. Keep this database on persistent storage; it contains accounts, seller applications, products, saved addresses, carts, sessions (token hashes only), and orders.

## Deploy on Vercel with persistent data

The frontend deploys to Vercel. The API runs as a regular Node service with a persistent disk so the existing SQLite database and profile photos survive restarts. Vercel's `/api/*` function proxies API requests to that service, keeping browser requests same-origin so the existing HttpOnly login cookie works.

1. Push this repository to GitHub and import it into Vercel. Set the Vercel project root to `Add2Cart` if the repository contains the outer workspace folder; otherwise leave the root at `.`. `vercel.json` configures the Vite build and SPA routes.
2. Create a Render web service from this repository using `render.yaml`. Attach the persistent disk at `/var/data`; the blueprint configures this path as `DATA_DIR`. The service needs a paid Render instance plan that supports persistent disks.
3. In Render, set `APP_ORIGINS` to the exact Vercel production origin (for example `https://your-project.vercel.app`) and any custom production domain. Set `ADMIN_EMAILS` to the administrator email addresses. Do not include a trailing slash in origins.
4. In Vercel Project Settings → Environment Variables, set `ADD2CART_API_ORIGIN` to the Render service URL (for example `https://add2cart-api.onrender.com`) for Production. Add it to Preview only if preview deployments should connect to this same API; add the preview origins to Render's `APP_ORIGINS` as needed.
5. Redeploy the Vercel project after setting environment variables. The frontend uses relative `/api` requests through the Vercel function proxy.

The first API start creates and seeds the SQLite database on the mounted disk. Back up that disk before making infrastructure changes. To move to serverless functions and a managed PostgreSQL database later, the API's SQLite-specific data layer and filesystem image storage must be migrated; this setup keeps the current backend and its features intact.

## Authentication and shopping API

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/profile`, `POST /api/auth/password`
- `GET /api/products`, `GET /api/products/:id`, `GET /api/products/search`, `GET /api/categories`
- `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id` (approved seller-owned listings; archive on delete)
- `GET /api/seller/profile`, `POST /api/seller/profile`, `PATCH /api/seller/profile`
- `GET /api/seller/products`, `GET /api/seller/orders`, `PATCH /api/seller/orders/:id`, `GET /api/seller/analytics`
- `GET /api/admin/sellers`, `PATCH /api/admin/sellers/:userId/approval` (configured administrator email only)
- `GET /api/catalog` (inventory summary)
- `GET /api/addresses`, `POST /api/addresses`, `PATCH /api/addresses/:id`, `DELETE /api/addresses/:id`, `PATCH /api/addresses/:id/default`
- `GET /api/wishlist`, `POST /api/wishlist/items`, `DELETE /api/wishlist/items/:productId`
- `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`, `DELETE /api/cart`, `POST /api/cart/migrate`
- `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders`, `PATCH /api/orders/:id` (cancellation and received confirmation)
- `GET /api/health`

Guests can browse and search the database-backed catalog. Cart and order endpoints require the signed-in user's HttpOnly session cookie. Passwords are scrypt-hashed; product price, stock, order totals, and order ownership are checked by the API. Public registration always assigns the customer role. Seller applications remain pending until an allowlisted admin approves them. Product mutations verify seller ownership, and seller fulfillment routes return only that seller's order items. Product, cart, and order creation accept idempotency keys to safely retry requests. Exact-origin CORS and mutation-origin checks allow the configured frontend URLs only.

Checkout supports cash on delivery and an e-wallet *pending payment* record. E-wallet orders cannot be shipped until a payment provider confirms payment. No payment gateway, email delivery/password recovery, profile-image storage, or shipping carrier integration is configured. Store images are validated HTTP/HTTPS references; uploads are not configured.

SQLite tables are created and upgraded by idempotent startup migrations tracked in `schema_migrations`. Back up the database file and its SQLite WAL state using a SQLite-aware backup procedure. Seller approval can be managed with the admin API after signing in with an address listed in `ADMIN_EMAILS`.

## Verification

```sh
npm run lint
npm run build
npm run test:auth
```

The auth smoke test starts an isolated API and temporary SQLite database, exercises guest rejection and account/cart/order flows, and removes its temporary data after completion.
