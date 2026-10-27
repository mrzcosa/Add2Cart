import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdirSync } from 'node:fs'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { catalog, catalogContent } from './catalog.js'

const scrypt = promisify(scryptCallback)
const here = fileURLToPath(new URL('.', import.meta.url))
const dataDirectory = process.env.DATA_DIR || join(here, 'data')
mkdirSync(dataDirectory, { recursive: true })
const profilePhotoDirectory = join(dataDirectory, 'profile-photos')
mkdirSync(profilePhotoDirectory, { recursive: true })
const databasePath = process.env.DATABASE_PATH || join(dataDirectory, 'add2cart.sqlite')
const db = new DatabaseSync(databasePath)
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', specifications TEXT NOT NULL DEFAULT '',
    image TEXT, rating REAL, review_count INTEGER NOT NULL DEFAULT 0, price REAL NOT NULL CHECK(price >= 0), stock INTEGER NOT NULL CHECK(stock >= 0),
    sold_count INTEGER NOT NULL DEFAULT 0, seller_user_id TEXT REFERENCES users(id), status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer' CHECK(role = 'customer'), profile_image_url TEXT, gender TEXT, date_of_birth TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS seller_profiles (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', logo_url TEXT, banner_url TEXT,
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL, phone TEXT NOT NULL, region TEXT NOT NULL, postal_code TEXT NOT NULL,
    street TEXT NOT NULL, label TEXT NOT NULL DEFAULT 'Home', is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses(user_id, is_default DESC, created_at DESC);
  CREATE TABLE IF NOT EXISTS wishlist_items (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id), created_at TEXT NOT NULL,
    PRIMARY KEY(user_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS cart_items (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity > 0),
    updated_at TEXT NOT NULL, PRIMARY KEY(user_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT NOT NULL,
    address_json TEXT NOT NULL, total INTEGER NOT NULL CHECK(total >= 0), created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
    seller_user_id TEXT REFERENCES users(id), fulfillment_status TEXT NOT NULL DEFAULT 'To Ship', PRIMARY KEY(order_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS idempotency_keys (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL,
    response_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id, key)
  );
`)
if (!db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'profile_image_url')) db.exec('ALTER TABLE users ADD COLUMN profile_image_url TEXT')
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name)
if (!userColumns.includes('gender')) db.exec('ALTER TABLE users ADD COLUMN gender TEXT')
if (!userColumns.includes('date_of_birth')) db.exec('ALTER TABLE users ADD COLUMN date_of_birth TEXT')
const productColumns = db.prepare('PRAGMA table_info(products)').all().map((column) => column.name)
const addMissingColumn = (table, columns, name, declaration) => { if (!columns.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${declaration}`) }
addMissingColumn('products', productColumns, 'name', "TEXT NOT NULL DEFAULT ''")
for (const [name, declaration] of Object.entries({ category: "TEXT NOT NULL DEFAULT ''", description: "TEXT NOT NULL DEFAULT ''", specifications: "TEXT NOT NULL DEFAULT ''", image: 'TEXT', rating: 'REAL', review_count: 'INTEGER NOT NULL DEFAULT 0', seller_user_id: 'TEXT REFERENCES users(id)', status: "TEXT NOT NULL DEFAULT 'published'", created_at: "TEXT NOT NULL DEFAULT ''", updated_at: "TEXT NOT NULL DEFAULT ''" })) addMissingColumn('products', productColumns, name, declaration)
const orderItemColumns = db.prepare('PRAGMA table_info(order_items)').all().map((column) => column.name)
addMissingColumn('order_items', orderItemColumns, 'seller_user_id', 'TEXT REFERENCES users(id)')
addMissingColumn('order_items', orderItemColumns, 'fulfillment_status', "TEXT NOT NULL DEFAULT 'To Ship'")
const addProduct = db.prepare("INSERT OR IGNORE INTO products (id, name, category, description, specifications, rating, review_count, price, stock, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)")
const updateProductName = db.prepare("UPDATE products SET name = ? WHERE id = ? AND name = ''")
const updateProductMetadata = db.prepare("UPDATE products SET category = ?, description = ?, specifications = ?, rating = ?, review_count = ?, created_at = ?, updated_at = ? WHERE id = ? AND seller_user_id IS NULL AND (description = '' OR description = name)")
for (const [id, name, price, stock] of catalog) {
  const now = new Date().toISOString()
  const content = catalogContent[id]
  addProduct.run(id, name, content.category, content.description, content.specifications, content.rating, content.reviewCount, price, stock, now, now)
  updateProductName.run(name, id)
  updateProductMetadata.run(content.category, content.description, content.specifications, content.rating, content.reviewCount, now, now, id)
}
const migrationInsert = db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)')
migrationInsert.run(1, new Date().toISOString())
migrationInsert.run(2, new Date().toISOString())
migrationInsert.run(3, new Date().toISOString())
migrationInsert.run(4, new Date().toISOString())

const sessionDurationSeconds = 60 * 60 * 24 * 7
const loginAttempts = new Map()
const rateLimitWindow = 15 * 60 * 1000
const rateLimitMax = 8
const sessionCookie = 'add2cart_session'
const configuredOrigins = new Set([process.env.APP_ORIGIN, ...(process.env.APP_ORIGINS || '').split(',')].map((origin) => origin?.trim()).filter(Boolean))
const dummySalt = 'c2VjdXJlLWFkZDJjYXJ0LWR1bW15LXNhbHQ'
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' }

const digest = (value) => createHash('sha256').update(value).digest('hex')
const passwordDigest = async (password, salt = randomBytes(16).toString('base64url')) => {
  const derived = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  return `${salt}:${derived.toString('base64url')}`
}
const adminEmails = new Set((process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
const bootstrapAdminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase()
if (bootstrapAdminEmail && process.env.BOOTSTRAP_ADMIN_PASSWORD) adminEmails.add(bootstrapAdminEmail)
const safeUser = (user) => {
  if (!user) return null
  const seller = db.prepare('SELECT approval_status FROM seller_profiles WHERE user_id = ?').get(user.id)
  const role = adminEmails.has(user.email.toLowerCase()) ? 'admin' : seller?.approval_status === 'approved' ? 'seller' : 'customer'
  return { id: user.id, username: user.username, email: user.email, fullName: user.full_name, profileImageUrl: user.profile_image_url || null, gender: user.gender || null, dateOfBirth: user.date_of_birth || null, role, sellerStatus: seller?.approval_status || null }
}
const json = (res, status, value, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', ...headers })
  res.end(JSON.stringify(value))
}
const fail = (status, message) => Object.assign(new Error(message), { status })

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim().split(/=(.*)/s)).filter(([key, value]) => key && value !== undefined).map(([key, value]) => [key, decodeURIComponent(value)]))
}

function cookieHeader(value, req, maxAge = sessionDurationSeconds) {
  const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
  return `${sessionCookie}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`
}

function checkOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return
  if (!isAllowedOrigin(origin, req)) throw fail(403, 'Request origin is not allowed.')
}

function isAllowedOrigin(origin, req) {
  if (configuredOrigins.size) return configuredOrigins.has(origin)
  const scheme = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  const requestOrigin = `${scheme}://${req.headers.host}`
  if (origin === requestOrigin) return true
  return process.env.NODE_ENV !== 'production' && new Set([
    'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:5175', 'http://127.0.0.1:5175',
  ]).has(origin)
}

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 4 * 1024 * 1024) throw fail(413, 'Request body is too large.')
  }
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { throw fail(400, 'Invalid JSON request body.') }
}

async function hashPassword(password) {
  const encoded = await passwordDigest(password)
  return encoded
}

async function createBootstrapAdmin() {
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!password) return
  const email = bootstrapAdminEmail
  if (!email) throw new Error('BOOTSTRAP_ADMIN_EMAIL is required when BOOTSTRAP_ADMIN_PASSWORD is set.')
  if (password.length > 128) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be 128 characters or fewer.')

  const existing = db.prepare('SELECT id, email FROM users WHERE username = ?').get('admin')
  if (existing) {
    if (existing.email.toLowerCase() !== email) throw new Error('The username "admin" already belongs to a different account.')
    return
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL already belongs to another account.')

  const passwordHash = await hashPassword(password)
  db.prepare('INSERT INTO users (id, username, email, full_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), 'admin', email, 'Add2Cart Admin', passwordHash, 'customer', new Date().toISOString())
  console.log('Created the configured one-time bootstrap admin account.')
}

await createBootstrapAdmin()

async function verifyPassword(password, encoded) {
  const [salt, expected] = (encoded || '').split(':')
  if (!salt || !expected) return false
  const actual = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  const expectedBuffer = Buffer.from(expected, 'base64url')
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual)
}

function getUser(req) {
  const token = parseCookies(req.headers.cookie)[sessionCookie]
  if (!token) return null
  const tokenHash = digest(token)
  const row = db.prepare(`SELECT users.*, sessions.id AS session_id FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(tokenHash, Date.now())
  return row || null
}

function requireUser(req) {
  const user = getUser(req)
  if (!user) throw fail(401, 'Please log in to continue.')
  return user
}

function requireAdmin(req) {
  const user = requireUser(req)
  if (!adminEmails.has(user.email.toLowerCase())) throw fail(403, 'Administrator access is required.')
  return user
}

function requireApprovedSeller(req) {
  const user = requireUser(req)
  const profile = db.prepare('SELECT * FROM seller_profiles WHERE user_id = ?').get(user.id)
  if (!profile || profile.approval_status !== 'approved') throw fail(403, 'An approved seller account is required to manage products.')
  return { user, profile }
}

function checkRateLimit(req) {
  const now = Date.now()
  const ip = req.socket.remoteAddress || 'unknown'
  const previous = loginAttempts.get(ip)
  const entry = !previous || now - previous.start > rateLimitWindow ? { start: now, count: 0 } : previous
  entry.count += 1
  loginAttempts.set(ip, entry)
  if (entry.count > rateLimitMax) throw fail(429, 'Too many login or registration attempts. Try again later.')
}

function idempotent(req, user, work) {
  const providedKey = req.headers['idempotency-key']
  if (providedKey !== undefined && (typeof providedKey !== 'string' || providedKey.length > 100)) throw fail(400, 'Invalid idempotency key.')
  const key = providedKey || randomUUID()
  db.exec('BEGIN IMMEDIATE')
  try {
    const existing = providedKey ? db.prepare('SELECT method, path, response_json FROM idempotency_keys WHERE user_id = ? AND key = ?').get(user.id, key) : null
    if (existing) {
      if (existing.method !== req.method || existing.path !== new URL(req.url, 'http://local').pathname) throw fail(409, 'Idempotency key was already used for a different request.')
      db.exec('COMMIT')
      return JSON.parse(existing.response_json)
    }
    const result = work()
    if (providedKey) db.prepare('INSERT INTO idempotency_keys (user_id, key, method, path, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(user.id, key, req.method, new URL(req.url, 'http://local').pathname, JSON.stringify(result), new Date().toISOString())
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function catalogResponse() {
  return db.prepare('SELECT id, price, stock AS quantity, sold_count AS soldCount FROM products ORDER BY id').all()
}

function productFromRow(row) {
  return {
    id: row.id, name: row.name, category: row.category, description: row.description, specifications: row.specifications,
    image: row.image, rating: row.rating ?? 0, reviewCount: row.review_count ?? 0, price: row.price,
    quantity: row.stock, soldCount: row.sold_count, sellerId: row.seller_user_id,
    status: row.status, createdAt: row.created_at,
  }
}

function listProducts(url) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100))
  const search = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim().slice(0, 120)
  const category = (url.searchParams.get('category') || '').trim().slice(0, 80)
  const clauses = ["status = 'published'", "(seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved'))"]
  const parameters = []
  if (search) { clauses.push('(name LIKE ? OR description LIKE ? OR category LIKE ?)'); parameters.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  if (category && category !== 'All') { clauses.push('category = ?'); parameters.push(category) }
  const sort = url.searchParams.get('sort')
  const order = sort === 'price-asc' ? 'price ASC, id ASC' : sort === 'price-desc' ? 'price DESC, id ASC' : sort === 'name' ? 'name COLLATE NOCASE ASC' : 'created_at DESC, id ASC'
  const where = clauses.join(' AND ')
  const total = db.prepare(`SELECT COUNT(*) AS total FROM products WHERE ${where}`).get(...parameters).total
  const rows = db.prepare(`SELECT * FROM products WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...parameters, limit, (page - 1) * limit)
  return { products: rows.map(productFromRow), page, limit, total, pages: Math.ceil(total / limit) }
}

function productInput(body, { partial = false } = {}) {
  const result = {}
  const textFields = { name: 120, category: 80, description: 4000, specifications: 4000 }
  for (const [field, max] of Object.entries(textFields)) {
    if (partial && body[field] === undefined) continue
    const value = String(body[field] || '').trim()
    if (!value || value.length > max) throw fail(400, `${field} is required and must be no more than ${max} characters.`)
    result[field] = value
  }
  if (!partial || body.image !== undefined) {
    const image = String(body.image || '').trim()
    if (image.length > 2048) throw fail(400, 'Product image URL is too long.')
    if (image) {
      let parsed
      try { parsed = new URL(image) } catch { throw fail(400, 'Enter a valid product image URL.') }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw fail(400, 'Product images must use HTTP or HTTPS URLs.')
    }
    result.image = image || null
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price)
    if (!Number.isFinite(price) || price <= 0 || price > 100000000) throw fail(400, 'Enter a valid product price.')
    result.price = Math.round(price * 100) / 100
  }
  if (!partial || body.quantity !== undefined) {
    const quantity = Number(body.quantity)
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) throw fail(400, 'Enter a valid available quantity.')
    result.stock = quantity
  }
  return result
}

function cartResponse(userId) {
  return db.prepare(`SELECT cart_items.product_id AS id, cart_items.quantity, products.price, products.stock AS available
    FROM cart_items JOIN products ON products.id = cart_items.product_id WHERE cart_items.user_id = ? AND products.status = 'published'
    AND (products.seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved'))
    ORDER BY cart_items.updated_at DESC`).all(userId)
}

function getOrder(userId, id) {
  const order = db.prepare('SELECT * FROM orders WHERE user_id = ? AND (id = ? OR order_number = ?)').get(userId, id, id)
  if (!order) return null
  const items = db.prepare('SELECT product_id AS productId, product_name AS name, quantity, unit_price AS unitPrice, seller_user_id AS sellerId, fulfillment_status AS fulfillmentStatus FROM order_items WHERE order_id = ?').all(order.id)
  return { id: order.id, orderNumber: order.order_number, status: order.status, paymentMethod: order.payment_method, paymentStatus: order.payment_status, address: JSON.parse(order.address_json), total: order.total, createdAt: order.created_at, items }
}

function getSellerOrder(sellerId, orderId) {
  const order = db.prepare(`SELECT orders.* FROM orders JOIN order_items ON order_items.order_id = orders.id
    WHERE orders.id = ? AND order_items.seller_user_id = ?`).get(orderId, sellerId)
  if (!order) return null
  const items = db.prepare(`SELECT product_id AS productId, product_name AS name, quantity, unit_price AS unitPrice,
    seller_user_id AS sellerId, fulfillment_status AS fulfillmentStatus FROM order_items WHERE order_id = ? AND seller_user_id = ?`).all(order.id, sellerId)
  return { id: order.id, orderNumber: order.order_number, status: order.status, paymentMethod: order.payment_method, paymentStatus: order.payment_status, address: JSON.parse(order.address_json), total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), createdAt: order.created_at, items }
}

function validateAddress(address) {
  const fields = ['fullName', 'phone', 'region', 'postalCode', 'street']
  if (!address || fields.some((field) => typeof address[field] !== 'string' || !address[field].trim() || address[field].length > 300)) throw fail(400, 'Complete all required delivery address fields.')
  if (address.fullName.trim().length < 2 || !/^[+\d()\-\s]{7,24}$/.test(address.phone.trim())) throw fail(400, 'Enter a valid recipient name and phone number.')
  return Object.fromEntries([...fields, 'label'].map((field) => [field, String(address[field] || (field === 'label' ? 'Home' : '')).trim()]))
}

function listAddresses(userId) {
  return db.prepare(`SELECT id, full_name AS fullName, phone, region, postal_code AS postalCode, street, label,
    is_default AS isDefault FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`).all(userId).map((address) => ({ ...address, isDefault: Boolean(address.isDefault) }))
}

function makeOrder(user, body) {
  const paymentMethod = body.paymentMethod
  if (!['cod', 'ewallet'].includes(paymentMethod)) throw fail(400, 'Choose a supported payment method.')
  const address = validateAddress(body.address)
  let lines
  let removeFromCart = false
  if (body.source === 'cart') {
    if (!Array.isArray(body.itemIds) || !body.itemIds.length || body.itemIds.length > 50 || body.itemIds.some((id) => typeof id !== 'string')) throw fail(400, 'Select at least one cart item.')
    const uniqueIds = [...new Set(body.itemIds)]
    if (uniqueIds.length !== body.itemIds.length) throw fail(400, 'Duplicate cart item identifiers were provided.')
    const placeholders = uniqueIds.map(() => '?').join(',')
    lines = db.prepare(`SELECT p.id AS productId, p.price AS unitPrice, p.stock, p.seller_user_id AS sellerId, c.quantity FROM cart_items c JOIN products p ON p.id = c.product_id WHERE c.user_id = ? AND p.status = 'published' AND (p.seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = p.seller_user_id AND seller_profiles.approval_status = 'approved')) AND c.product_id IN (${placeholders})`).all(user.id, ...uniqueIds)
    if (lines.length !== uniqueIds.length) throw fail(400, 'One or more selected cart items are unavailable.')
    removeFromCart = true
  } else if (body.source === 'direct') {
    if (!Array.isArray(body.items) || body.items.length !== 1) throw fail(400, 'Direct checkout requires one product.')
    const [item] = body.items
    if (!item || typeof item.productId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw fail(400, 'Invalid product quantity.')
    const product = db.prepare("SELECT id AS productId, price AS unitPrice, stock, seller_user_id AS sellerId FROM products WHERE id = ? AND status = 'published' AND (seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved'))").get(item.productId)
    if (!product) throw fail(404, 'This product is not available for checkout.')
    lines = [{ ...product, quantity: item.quantity }]
  } else {
    throw fail(400, 'Invalid checkout source.')
  }

  let total = 0
  const snapshots = []
  for (const line of lines) {
    if (line.quantity > line.stock) throw fail(409, 'There is not enough stock to fulfill this order.')
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(line.productId)
    const name = product?.name || line.productId
    total += line.unitPrice * line.quantity
    snapshots.push({ ...line, name })
  }
  const id = randomUUID()
  const orderNumber = `AC-${randomBytes(5).toString('hex').toUpperCase()}`
  const status = paymentMethod === 'ewallet' ? 'To Pay' : 'To Ship'
  const paymentStatus = paymentMethod === 'ewallet' ? 'pending' : 'due on delivery'
  const createdAt = new Date().toISOString()
  db.prepare(`INSERT INTO orders (id, order_number, user_id, status, payment_method, payment_status, address_json, total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orderNumber, user.id, status, paymentMethod, paymentStatus, JSON.stringify(address), total, createdAt)
  const addLine = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, seller_user_id, fulfillment_status) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const updateProduct = db.prepare('UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ? AND stock >= ?')
  for (const line of snapshots) {
    addLine.run(id, line.productId, line.name, line.quantity, line.unitPrice, line.sellerId || null, paymentMethod === 'ewallet' ? 'To Pay' : 'To Ship')
    const updated = updateProduct.run(line.quantity, line.quantity, line.productId, line.quantity)
    if (updated.changes !== 1) throw fail(409, 'Stock changed before the order could be placed. Please review your cart.')
    if (removeFromCart) db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(user.id, line.productId)
  }
  return getOrder(user.id, id)
}

async function serveStatic(req, res) {
  const root = resolve(here, '..', 'dist')
  const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname)
  let file = normalize(resolve(root, `.${pathname}`))
  if (!file.startsWith(root + sep) && file !== join(root, 'index.html')) return json(res, 403, { error: 'Forbidden.' })
  if (pathname === '/' || !extname(pathname)) file = join(root, 'index.html')
  try {
    const { readFile } = await import('node:fs/promises')
    const bytes = await readFile(file)
    res.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' })
    res.end(bytes)
  } catch {
    json(res, 404, { error: 'Not found.' })
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local')
    const origin = req.headers.origin
    if (origin && !isAllowedOrigin(origin, req)) return json(res, 403, { error: 'Request origin is not allowed.' })
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Vary', 'Origin')
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')
      res.writeHead(204)
      return res.end()
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') checkOrigin(req)
    const photoMatch = url.pathname.match(/^\/api\/profile-photos\/([a-f0-9-]+\.(?:png|jpg|webp))$/)
    if (req.method === 'GET' && photoMatch) {
      try {
        const filePath = join(profilePhotoDirectory, photoMatch[1])
        const bytes = await readFile(filePath)
        const type = photoMatch[1].endsWith('.png') ? 'image/png' : photoMatch[1].endsWith('.webp') ? 'image/webp' : 'image/jpeg'
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' })
        return res.end(bytes)
      } catch { return json(res, 404, { error: 'Photo not found.' }) }
    }
    if (!url.pathname.startsWith('/api/')) {
      if (process.env.SERVE_FRONTEND === 'true' && (req.method === 'GET' || req.method === 'HEAD')) return await serveStatic(req, res)
      return json(res, 404, { error: 'Not found.' })
    }

    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true })
    if (req.method === 'GET' && url.pathname === '/api/catalog') return json(res, 200, { products: catalogResponse() })
    if (req.method === 'GET' && url.pathname === '/api/auth/me') return json(res, 200, { user: safeUser(getUser(req)) })

    if (req.method === 'GET' && (url.pathname === '/api/products' || url.pathname === '/api/products/search')) return json(res, 200, listProducts(url))
    if (req.method === 'GET' && url.pathname === '/api/categories') {
      const categories = db.prepare("SELECT DISTINCT category FROM products WHERE status = 'published' AND category <> '' AND (seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved')) ORDER BY category COLLATE NOCASE").all().map(({ category }) => category)
      return json(res, 200, { categories })
    }
    const publicProductMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/)
    if (req.method === 'GET' && publicProductMatch) {
      const product = db.prepare("SELECT * FROM products WHERE id = ? AND status = 'published' AND (seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved'))").get(decodeURIComponent(publicProductMatch[1]))
      if (!product) throw fail(404, 'Product not found.')
      return json(res, 200, { product: productFromRow(product) })
    }
    if (req.method === 'GET' && url.pathname === '/api/seller/profile') {
      const user = requireUser(req)
      return json(res, 200, { profile: db.prepare('SELECT id, user_id AS userId, store_name AS storeName, description, logo_url AS logoUrl, banner_url AS bannerUrl, approval_status AS approvalStatus, created_at AS createdAt, updated_at AS updatedAt FROM seller_profiles WHERE user_id = ?').get(user.id) || null })
    }
    if (req.method === 'POST' && url.pathname === '/api/seller/profile') {
      const user = requireUser(req)
      const body = await readJson(req)
      const storeName = String(body.storeName || '').trim()
      const description = String(body.description || '').trim()
      if (storeName.length < 2 || storeName.length > 100 || description.length > 1000) throw fail(400, 'Enter a store name and a description up to 1,000 characters.')
      if (db.prepare('SELECT id FROM seller_profiles WHERE user_id = ?').get(user.id)) throw fail(409, 'A seller application already exists for this account.')
      const now = new Date().toISOString()
      db.prepare("INSERT INTO seller_profiles (id, user_id, store_name, description, approval_status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)").run(randomUUID(), user.id, storeName, description, now, now)
      const profile = db.prepare('SELECT id, user_id AS userId, store_name AS storeName, description, logo_url AS logoUrl, banner_url AS bannerUrl, approval_status AS approvalStatus, created_at AS createdAt, updated_at AS updatedAt FROM seller_profiles WHERE user_id = ?').get(user.id)
      return json(res, 201, { profile })
    }
    if (req.method === 'PATCH' && url.pathname === '/api/seller/profile') {
      const user = requireUser(req)
      const body = await readJson(req)
      const current = db.prepare('SELECT * FROM seller_profiles WHERE user_id = ?').get(user.id)
      if (!current) throw fail(404, 'Create a seller application first.')
      const storeName = body.storeName === undefined ? current.store_name : String(body.storeName).trim()
      const description = body.description === undefined ? current.description : String(body.description).trim()
      if (storeName.length < 2 || storeName.length > 100 || description.length > 1000) throw fail(400, 'Enter a store name and a description up to 1,000 characters.')
      const now = new Date().toISOString()
      const approvalStatus = current.approval_status === 'rejected' && body.resubmit === true ? 'pending' : current.approval_status
      db.prepare('UPDATE seller_profiles SET store_name = ?, description = ?, approval_status = ?, updated_at = ? WHERE user_id = ?').run(storeName, description, approvalStatus, now, user.id)
      return json(res, 200, { profile: db.prepare('SELECT id, user_id AS userId, store_name AS storeName, description, logo_url AS logoUrl, banner_url AS bannerUrl, approval_status AS approvalStatus, created_at AS createdAt, updated_at AS updatedAt FROM seller_profiles WHERE user_id = ?').get(user.id) })
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/sellers') {
      requireAdmin(req)
      const sellers = db.prepare('SELECT seller_profiles.id, user_id AS userId, store_name AS storeName, description, approval_status AS approvalStatus, users.email, users.full_name AS fullName, seller_profiles.created_at AS createdAt FROM seller_profiles JOIN users ON users.id = seller_profiles.user_id ORDER BY seller_profiles.created_at DESC').all()
      return json(res, 200, { sellers })
    }
    const sellerApprovalMatch = url.pathname.match(/^\/api\/admin\/sellers\/([^/]+)\/approval$/)
    if (req.method === 'PATCH' && sellerApprovalMatch) {
      requireAdmin(req)
      const body = await readJson(req)
      if (!['approved', 'rejected', 'pending'].includes(body.status)) throw fail(400, 'Choose an allowed seller approval status.')
      const result = db.prepare('UPDATE seller_profiles SET approval_status = ?, updated_at = ? WHERE user_id = ?').run(body.status, new Date().toISOString(), decodeURIComponent(sellerApprovalMatch[1]))
      if (!result.changes) throw fail(404, 'Seller application not found.')
      return json(res, 200, { ok: true, status: body.status })
    }
    if (req.method === 'GET' && url.pathname === '/api/seller/products') {
      const { user } = requireApprovedSeller(req)
      return json(res, 200, { products: db.prepare('SELECT * FROM products WHERE seller_user_id = ? AND status <> ? ORDER BY created_at DESC').all(user.id, 'archived').map(productFromRow) })
    }
    if (req.method === 'GET' && url.pathname === '/api/seller/orders') {
      const { user } = requireApprovedSeller(req)
      const rows = db.prepare('SELECT DISTINCT order_id FROM order_items WHERE seller_user_id = ? ORDER BY order_id DESC').all(user.id)
      return json(res, 200, { orders: rows.map(({ order_id }) => getSellerOrder(user.id, order_id)).filter(Boolean) })
    }
    if (req.method === 'GET' && url.pathname === '/api/seller/analytics') {
      const { user } = requireApprovedSeller(req)
      const products = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(sold_count), 0) AS unitsSold FROM products WHERE seller_user_id = ? AND status = 'published'").get(user.id)
      const sales = db.prepare("SELECT COUNT(DISTINCT order_items.order_id) AS orderCount, COALESCE(SUM(order_items.quantity * order_items.unit_price), 0) AS grossSales FROM order_items JOIN orders ON orders.id = order_items.order_id WHERE order_items.seller_user_id = ? AND orders.status <> 'Cancelled'").get(user.id)
      return json(res, 200, { products: products.count, unitsSold: products.unitsSold, orderCount: sales.orderCount, grossSales: sales.grossSales })
    }
    const sellerOrderMatch = url.pathname.match(/^\/api\/seller\/orders\/([^/]+)$/)
    if (sellerOrderMatch && req.method === 'PATCH') {
      const { user } = requireApprovedSeller(req)
      const body = await readJson(req)
      if (body.action !== 'ship') throw fail(400, 'Unsupported seller order action.')
      const orderId = decodeURIComponent(sellerOrderMatch[1])
      const result = idempotent(req, user, () => {
        const order = getSellerOrder(user.id, orderId)
        if (!order) throw fail(404, 'Seller order not found.')
        if (order.paymentMethod === 'ewallet' && order.paymentStatus !== 'paid') throw fail(409, 'This e-wallet order cannot ship until payment is confirmed.')
        if (order.status !== 'To Ship') throw fail(409, 'This order is not ready to ship.')
        const changed = db.prepare("UPDATE order_items SET fulfillment_status = 'To Receive' WHERE order_id = ? AND seller_user_id = ? AND fulfillment_status = 'To Ship'").run(orderId, user.id)
        if (!changed.changes) throw fail(409, 'Your order items are already fulfilled.')
        const incomplete = db.prepare("SELECT COUNT(*) AS count FROM order_items WHERE order_id = ? AND fulfillment_status NOT IN ('To Receive','Completed')").get(orderId).count
        if (!incomplete) db.prepare("UPDATE orders SET status = 'To Receive' WHERE id = ?").run(orderId)
        return { order: getSellerOrder(user.id, orderId) }
      })
      return json(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/api/products') {
      const { user } = requireApprovedSeller(req)
      const input = productInput(await readJson(req))
      const result = idempotent(req, user, () => {
        const now = new Date().toISOString()
        const id = randomUUID()
        db.prepare("INSERT INTO products (id, name, category, description, specifications, image, review_count, price, stock, seller_user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'published', ?, ?)")
          .run(id, input.name, input.category, input.description, input.specifications, input.image, input.price, input.stock, user.id, now, now)
        return { product: productFromRow(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) }
      })
      return json(res, 201, result)
    }
    const manageProductMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/)
    if (manageProductMatch && req.method === 'PATCH') {
      const user = requireUser(req)
      const productId = decodeURIComponent(manageProductMatch[1])
      const current = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
      if (!current) throw fail(404, 'Product not found.')
      const isAdmin = adminEmails.has(user.email.toLowerCase())
      if (!isAdmin && (!current.seller_user_id || current.seller_user_id !== user.id || !db.prepare("SELECT 1 FROM seller_profiles WHERE user_id = ? AND approval_status = 'approved'").get(user.id))) throw fail(403, 'You do not have permission to update this product.')
      const input = productInput(await readJson(req), { partial: true })
      const columns = { name: 'name', category: 'category', description: 'description', specifications: 'specifications', image: 'image', price: 'price', stock: 'stock' }
      const entries = Object.entries(input)
      if (!entries.length) throw fail(400, 'Provide at least one product field to update.')
      const assignments = entries.map(([field]) => `${columns[field]} = ?`).join(', ')
      db.prepare(`UPDATE products SET ${assignments}, updated_at = ? WHERE id = ?`).run(...entries.map(([, value]) => value), new Date().toISOString(), productId)
      return json(res, 200, { product: productFromRow(db.prepare('SELECT * FROM products WHERE id = ?').get(productId)) })
    }
    if (manageProductMatch && req.method === 'DELETE') {
      const user = requireUser(req)
      const productId = decodeURIComponent(manageProductMatch[1])
      const current = db.prepare('SELECT seller_user_id FROM products WHERE id = ?').get(productId)
      if (!current) throw fail(404, 'Product not found.')
      const isAdmin = adminEmails.has(user.email.toLowerCase())
      if (!isAdmin && (!current.seller_user_id || current.seller_user_id !== user.id || !db.prepare("SELECT 1 FROM seller_profiles WHERE user_id = ? AND approval_status = 'approved'").get(user.id))) throw fail(403, 'You do not have permission to remove this product.')
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare("UPDATE products SET status = 'archived', stock = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), productId)
        db.prepare('DELETE FROM cart_items WHERE product_id = ?').run(productId)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return json(res, 200, { ok: true })
    }

    if (req.method === 'POST' && ['/api/auth/register', '/api/auth/login'].includes(url.pathname)) {
      checkRateLimit(req)
      const body = await readJson(req)
      const registering = url.pathname.endsWith('/register')
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      if (registering && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) throw fail(400, 'Enter a valid email address.')
      if ((registering && password.length < 12) || password.length > 128) throw fail(400, 'Password must be 12 to 128 characters when creating an account.')
      let user
      if (registering) {
        const fullName = String(body.fullName || '').trim()
        const username = String(body.username || '').trim().toLowerCase()
        if (fullName.length < 2 || fullName.length > 100) throw fail(400, 'Enter your full name.')
        if (!/^[a-z0-9_]{3,24}$/.test(username)) throw fail(400, 'Username must be 3–24 characters using letters, numbers, or underscores.')
        if (body.acceptTerms !== true) throw fail(400, 'Accept the terms to create an account.')
        const passwordHash = await hashPassword(password)
        try {
          db.prepare('INSERT INTO users (id, username, email, full_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(randomUUID(), username, email, fullName, passwordHash, 'customer', new Date().toISOString())
        } catch (error) {
          if (String(error.message).includes('UNIQUE')) throw fail(409, 'That email or username is already registered.')
          throw error
        }
        user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      } else {
        const identifier = String(body.identifier || '').trim().toLowerCase()
        user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(identifier, identifier)
        const encoded = user?.password_hash || `${dummySalt}:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
        const valid = await verifyPassword(password, encoded)
        if (!user || !valid) throw fail(401, 'Email/username or password is incorrect.')
      }
      const token = randomBytes(32).toString('base64url')
      const expiry = Date.now() + sessionDurationSeconds * 1000
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
      db.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), user.id, digest(token), expiry, new Date().toISOString())
      return json(res, 200, { user: safeUser(user) }, { 'Set-Cookie': cookieHeader(token, req) })
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/password') {
      const user = requireUser(req)
      checkRateLimit(req)
      const body = await readJson(req)
      const currentPassword = String(body.currentPassword || '')
      const newPassword = String(body.newPassword || '')
      if (newPassword.length < 12 || newPassword.length > 128) throw fail(400, 'New password must be 12 to 128 characters.')
      if (currentPassword === newPassword) throw fail(400, 'Choose a new password that differs from your current password.')
      if (!await verifyPassword(currentPassword, user.password_hash)) throw fail(401, 'Current password is incorrect.')
      const passwordHash = await hashPassword(newPassword)
      const token = randomBytes(32).toString('base64url')
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id)
        db.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').run(user.id, user.session_id)
        db.prepare('UPDATE sessions SET token_hash = ?, expires_at = ?, created_at = ? WHERE id = ?')
          .run(digest(token), Date.now() + sessionDurationSeconds * 1000, new Date().toISOString(), user.session_id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return json(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(token, req) })
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const user = getUser(req)
      if (user) db.prepare('DELETE FROM sessions WHERE id = ?').run(user.session_id)
      return json(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', req, 0) })
    }

    if (req.method === 'PATCH' && url.pathname === '/api/auth/profile') {
      const user = requireUser(req)
      const body = await readJson(req)
      const fullName = String(body.fullName || '').trim()
      const username = String(body.username || '').trim().toLowerCase()
      const gender = body.gender ? String(body.gender) : null
      const dateOfBirth = body.dateOfBirth ? String(body.dateOfBirth) : null
      if (fullName.length < 2 || fullName.length > 100) throw fail(400, 'Enter your full name.')
      if (gender && !['female', 'male', 'prefer_not_to_say'].includes(gender)) throw fail(400, 'Choose a valid gender option.')
      if (dateOfBirth) {
        const match = dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        const parsed = match && new Date(`${dateOfBirth}T00:00:00Z`)
        if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== dateOfBirth || parsed > new Date() || Number(match[1]) < 1900) throw fail(400, 'Enter a valid date of birth.')
      }
      if (!/^[a-z0-9_]{3,24}$/.test(username)) throw fail(400, 'Username must be 3–24 characters using letters, numbers, or underscores.')
      try {
        db.prepare('UPDATE users SET full_name = ?, username = ?, gender = ?, date_of_birth = ? WHERE id = ?').run(fullName, username, gender, dateOfBirth, user.id)
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) throw fail(409, 'That username is already in use.')
        throw error
      }
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
      return json(res, 200, { user: safeUser(updatedUser) })
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/profile/photo') {
      const user = requireUser(req)
      const body = await readJson(req)
      const match = typeof body.image === 'string' && body.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
      if (!match) throw fail(400, 'Choose a PNG, JPG, or WebP image.')
      const bytes = Buffer.from(match[2], 'base64')
      if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw fail(413, 'Profile photos must be 2 MB or smaller.')
      const extensions = { png: 'png', jpeg: 'jpg', webp: 'webp' }
      const extension = extensions[match[1]]
      const filename = `${randomUUID()}.${extension}`
      const signatureValid = extension === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : extension === 'jpg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9 : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
      if (!signatureValid) throw fail(400, 'The selected file does not match its image format.')
      await writeFile(join(profilePhotoDirectory, filename), bytes, { flag: 'wx' })
      const previous = user.profile_image_url
      const imageUrl = `/api/profile-photos/${filename}`
      db.prepare('UPDATE users SET profile_image_url = ? WHERE id = ?').run(imageUrl, user.id)
      if (previous && /^\/api\/profile-photos\/[a-f0-9-]+\.(?:png|jpg|webp)$/.test(previous)) unlink(join(profilePhotoDirectory, previous.split('/').at(-1))).catch(() => {})
      return json(res, 200, { user: safeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) })
    }

    if (req.method === 'GET' && url.pathname === '/api/addresses') {
      const user = requireUser(req)
      return json(res, 200, { addresses: listAddresses(user.id) })
    }
    if (req.method === 'POST' && url.pathname === '/api/addresses') {
      const user = requireUser(req)
      const body = await readJson(req)
      const address = validateAddress(body)
      const id = randomUUID()
      const now = new Date().toISOString()
      db.exec('BEGIN IMMEDIATE')
      try {
        const hasAddress = db.prepare('SELECT 1 FROM addresses WHERE user_id = ? LIMIT 1').get(user.id)
        const isDefault = Boolean(body.isDefault || !hasAddress)
        if (isDefault) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(user.id)
        db.prepare('INSERT INTO addresses (id, user_id, full_name, phone, region, postal_code, street, label, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, user.id, address.fullName, address.phone, address.region, address.postalCode, address.street, address.label, isDefault ? 1 : 0, now, now)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return json(res, 201, { addresses: listAddresses(user.id) })
    }
    const addressMatch = url.pathname.match(/^\/api\/addresses\/([^/]+)$/)
    const addressDefaultMatch = url.pathname.match(/^\/api\/addresses\/([^/]+)\/default$/)
    if (addressDefaultMatch && req.method === 'PATCH') {
      const user = requireUser(req)
      const addressId = decodeURIComponent(addressDefaultMatch[1])
      if (!db.prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?').get(addressId, user.id)) throw fail(404, 'Address not found.')
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(user.id)
        db.prepare('UPDATE addresses SET is_default = 1, updated_at = ? WHERE id = ? AND user_id = ?').run(new Date().toISOString(), addressId, user.id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return json(res, 200, { addresses: listAddresses(user.id) })
    }
    if (addressMatch && req.method === 'PATCH') {
      const user = requireUser(req)
      const addressId = decodeURIComponent(addressMatch[1])
      const body = await readJson(req)
      const address = validateAddress(body)
      if (!db.prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?').get(addressId, user.id)) throw fail(404, 'Address not found.')
      const now = new Date().toISOString()
      db.exec('BEGIN IMMEDIATE')
      try {
        if (body.isDefault) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(user.id)
        db.prepare('UPDATE addresses SET full_name = ?, phone = ?, region = ?, postal_code = ?, street = ?, label = ?, is_default = CASE WHEN ? THEN 1 ELSE is_default END, updated_at = ? WHERE id = ? AND user_id = ?')
          .run(address.fullName, address.phone, address.region, address.postalCode, address.street, address.label, body.isDefault ? 1 : 0, now, addressId, user.id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return json(res, 200, { addresses: listAddresses(user.id) })
    }
    if (addressMatch && req.method === 'DELETE') {
      const user = requireUser(req)
      const addressId = decodeURIComponent(addressMatch[1])
      const current = db.prepare('SELECT is_default FROM addresses WHERE id = ? AND user_id = ?').get(addressId, user.id)
      if (!current) throw fail(404, 'Address not found.')
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(addressId, user.id)
        if (current.is_default) {
          const next = db.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(user.id)
          if (next) db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(next.id)
        }
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return json(res, 200, { addresses: listAddresses(user.id) })
    }

    if (req.method === 'GET' && url.pathname === '/api/wishlist') {
      const user = requireUser(req)
      const items = db.prepare(`SELECT products.* FROM wishlist_items JOIN products ON products.id = wishlist_items.product_id
        WHERE wishlist_items.user_id = ? AND products.status = 'published'
        AND (products.seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved'))
        ORDER BY wishlist_items.created_at DESC`).all(user.id).map(productFromRow)
      return json(res, 200, { items })
    }
    if (req.method === 'POST' && url.pathname === '/api/wishlist/items') {
      const user = requireUser(req)
      const body = await readJson(req)
      if (typeof body.productId !== 'string') throw fail(400, 'Choose a product to save.')
      const product = db.prepare("SELECT id FROM products WHERE id = ? AND status = 'published' AND (seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved'))").get(body.productId)
      if (!product) throw fail(404, 'Product not found.')
      db.prepare('INSERT OR IGNORE INTO wishlist_items (user_id, product_id, created_at) VALUES (?, ?, ?)').run(user.id, product.id, new Date().toISOString())
      return json(res, 200, { items: db.prepare('SELECT product_id AS id FROM wishlist_items WHERE user_id = ? ORDER BY created_at DESC').all(user.id).map((item) => item.id) })
    }
    const wishlistMatch = url.pathname.match(/^\/api\/wishlist\/items\/([^/]+)$/)
    if (wishlistMatch && req.method === 'DELETE') {
      const user = requireUser(req)
      db.prepare('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?').run(user.id, decodeURIComponent(wishlistMatch[1]))
      return json(res, 200, { items: db.prepare('SELECT product_id AS id FROM wishlist_items WHERE user_id = ? ORDER BY created_at DESC').all(user.id).map((item) => item.id) })
    }

    if (req.method === 'GET' && url.pathname === '/api/cart') {
      const user = requireUser(req)
      return json(res, 200, { items: cartResponse(user.id) })
    }
    if (req.method === 'POST' && url.pathname === '/api/cart/migrate') {
      const user = requireUser(req)
      const body = await readJson(req)
      if (!Array.isArray(body.items) || body.items.length > 50) throw fail(400, 'Invalid legacy cart.')
      const result = idempotent(req, user, () => {
        const existing = new Map(cartResponse(user.id).map((item) => [item.id, item.quantity]))
        const upsert = db.prepare(`INSERT INTO cart_items (user_id, product_id, quantity, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at`)
        for (const item of body.items) {
          if (!item || typeof item.id !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) continue
          const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.id)
          if (!product) continue
          const quantity = Math.min(product.stock, (existing.get(item.id) || 0) + item.quantity)
          if (quantity > 0) upsert.run(user.id, item.id, quantity, new Date().toISOString())
        }
        return { items: cartResponse(user.id) }
      })
      return json(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/api/cart/items') {
      const user = requireUser(req)
      const body = await readJson(req)
      if (typeof body.productId !== 'string' || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 20) throw fail(400, 'Invalid product or quantity.')
      const result = idempotent(req, user, () => {
        const product = db.prepare("SELECT stock FROM products WHERE id = ? AND status = 'published' AND (seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved'))").get(body.productId)
        if (!product) throw fail(404, 'This product is not available in the marketplace catalog.')
        const current = db.prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?').get(user.id, body.productId)?.quantity || 0
        if (current + body.quantity > product.stock) throw fail(409, 'There are not enough items available.')
        db.prepare(`INSERT INTO cart_items (user_id, product_id, quantity, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at`)
          .run(user.id, body.productId, current + body.quantity, new Date().toISOString())
        return { items: cartResponse(user.id) }
      })
      return json(res, 200, result)
    }
    const cartMatch = url.pathname.match(/^\/api\/cart\/items\/([^/]+)$/)
    if (cartMatch && req.method === 'PATCH') {
      const user = requireUser(req)
      const body = await readJson(req)
      if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 20) throw fail(400, 'Quantity must be between 1 and 20.')
      const productId = decodeURIComponent(cartMatch[1])
      const product = db.prepare("SELECT stock FROM products WHERE id = ? AND status = 'published' AND (seller_user_id IS NULL OR EXISTS (SELECT 1 FROM seller_profiles WHERE seller_profiles.user_id = products.seller_user_id AND seller_profiles.approval_status = 'approved'))").get(productId)
      if (!product) throw fail(404, 'Product not found.')
      if (body.quantity > product.stock) throw fail(409, 'There are not enough items available.')
      const result = db.prepare('UPDATE cart_items SET quantity = ?, updated_at = ? WHERE user_id = ? AND product_id = ?').run(body.quantity, new Date().toISOString(), user.id, productId)
      if (!result.changes) throw fail(404, 'Cart item not found.')
      return json(res, 200, { items: cartResponse(user.id) })
    }
    if (cartMatch && req.method === 'DELETE') {
      const user = requireUser(req)
      db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(user.id, decodeURIComponent(cartMatch[1]))
      return json(res, 200, { items: cartResponse(user.id) })
    }
    if (req.method === 'DELETE' && url.pathname === '/api/cart') {
      const user = requireUser(req)
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(user.id)
      return json(res, 200, { items: [] })
    }

    if (req.method === 'GET' && url.pathname === '/api/orders') {
      const user = requireUser(req)
      const ids = db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id)
      return json(res, 200, { orders: ids.map(({ id }) => getOrder(user.id, id)) })
    }
    if (req.method === 'POST' && url.pathname === '/api/orders') {
      const user = requireUser(req)
      const body = await readJson(req)
      const order = idempotent(req, user, () => makeOrder(user, body))
      return json(res, 201, { order, cart: cartResponse(user.id), products: catalogResponse() })
    }
    const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/)
    if (orderMatch && req.method === 'GET') {
      const user = requireUser(req)
      const order = getOrder(user.id, decodeURIComponent(orderMatch[1]))
      if (!order) throw fail(404, 'Order not found.')
      return json(res, 200, { order })
    }
    if (orderMatch && req.method === 'PATCH') {
      const user = requireUser(req)
      const body = await readJson(req)
      const order = getOrder(user.id, decodeURIComponent(orderMatch[1]))
      if (!order) throw fail(404, 'Order not found.')
      if (body.action === 'received') {
        if (order.status !== 'To Receive') throw fail(409, 'This order is not ready to be completed.')
        db.exec('BEGIN IMMEDIATE')
        try {
          db.prepare("UPDATE order_items SET fulfillment_status = 'Completed' WHERE order_id = ?").run(order.id)
          db.prepare("UPDATE orders SET status = 'Completed' WHERE id = ? AND user_id = ?").run(order.id, user.id)
          db.exec('COMMIT')
        } catch (error) { db.exec('ROLLBACK'); throw error }
        return json(res, 200, { order: getOrder(user.id, order.id) })
      }
      if (body.action !== 'cancel') throw fail(400, 'Unsupported order action.')
      if (!['To Pay', 'To Ship'].includes(order.status)) throw fail(409, 'This order can no longer be cancelled.')
      db.exec('BEGIN IMMEDIATE')
      try {
        for (const item of order.items) db.prepare('UPDATE products SET stock = stock + ?, sold_count = MAX(0, sold_count - ?) WHERE id = ?').run(item.quantity, item.quantity, item.productId)
        db.prepare("UPDATE order_items SET fulfillment_status = 'Cancelled' WHERE order_id = ?").run(order.id)
        db.prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ? AND user_id = ?").run(order.id, user.id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return json(res, 200, { order: getOrder(user.id, order.id), products: catalogResponse() })
    }

    return json(res, 404, { error: 'API route not found.' })
  } catch (error) {
    const status = error.status || 500
    if (status >= 500) console.error('API request failed:', error.message)
    return json(res, status, { error: status >= 500 ? 'A server error occurred.' : error.message }, status === 429 ? { 'Retry-After': '900' } : {})
  }
})

const port = Number(process.env.PORT || process.env.API_PORT || 4179)
const host = process.env.API_HOST || '0.0.0.0'
server.listen(port, host, () => console.log(`Add2Cart API listening on http://${host}:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0) }))
