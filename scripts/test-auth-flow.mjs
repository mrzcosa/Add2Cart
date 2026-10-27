import assert from 'node:assert/strict'
import { createServer as createProbe } from 'node:net'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'add2cart-auth-'))
const dbPath = join(temporaryDirectory, 'test.sqlite')
const probe = createProbe()
await new Promise((done) => probe.listen(0, '127.0.0.1', done))
const port = probe.address().port
await new Promise((done) => probe.close(done))
const baseUrl = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, [resolve(root, 'server/index.js')], {
  cwd: root,
  env: { ...process.env, API_PORT: String(port), DATABASE_PATH: dbPath, APP_ORIGINS: baseUrl, ADMIN_EMAILS: 'qa_admin@example.test' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverOutput = ''
server.stdout.on('data', (chunk) => { serverOutput += chunk })
server.stderr.on('data', (chunk) => { serverOutput += chunk })

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`API exited early: ${serverOutput}`)
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch { /* Keep waiting for startup. */ }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`API did not start: ${serverOutput}`)
}

let cookie = ''
async function request(path, { method = 'GET', body, useCookie = true, origin = baseUrl, headers = {} } = {}) {
  const requestHeaders = { Origin: origin, ...headers }
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
  if (useCookie && cookie) requestHeaders.Cookie = cookie
  const response = await fetch(`${baseUrl}${path}`, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  const setCookie = response.headers.get('set-cookie')
  if (setCookie?.startsWith('add2cart_session=')) cookie = setCookie.split(';', 1)[0]
  return { response, data, setCookie }
}

async function register(username) {
  return request('/api/auth/register', {
    method: 'POST',
    body: { fullName: 'QA Shopper', username, email: `${username}@example.test`, password: 'SecureMango!_2026A', acceptTerms: true, role: 'admin' },
  })
}

try {
  await waitForServer()

  let result = await request('/api/products?limit=2')
  assert.equal(result.response.status, 200, result.data.error)
  assert.equal(result.data.products.length, 2)
  result = await request('/api/products/search?q=coffee')
  assert.ok(result.data.products.some((product) => product.id === 'p-003'), 'public product search should find catalog products')
  result = await request('/api/categories')
  assert.ok(result.data.categories.includes('Electronics'))
  result = await request('/api/products/p-003')
  assert.equal(result.data.product.id, 'p-003')
  result = await request('/api/products/search', { origin: 'https://untrusted.example' })
  assert.equal(result.response.status, 403, 'unlisted origins must be rejected')
  result = await request('/api/products', { method: 'OPTIONS', origin: baseUrl, headers: { 'Access-Control-Request-Method': 'POST' } })
  assert.equal(result.response.status, 204, 'allowed preflight should be handled before route authorization')
  assert.equal(result.response.headers.get('access-control-allow-origin'), baseUrl)

  result = await request('/api/cart')
  assert.equal(result.response.status, 401, 'guest cart requests must be rejected')
  result = await request('/api/addresses')
  assert.equal(result.response.status, 401, 'guest address data must be rejected')
  result = await request('/api/wishlist')
  assert.equal(result.response.status, 401, 'guest wishlist data must be rejected')
  result = await request('/api/auth/password', { method: 'POST', body: { currentPassword: 'old-password', newPassword: 'SecureMango!_2026B' } })
  assert.equal(result.response.status, 401, 'guests cannot change passwords')
  result = await request('/api/cart/items', { method: 'POST', body: { productId: 'p-002', quantity: 1 } })
  assert.equal(result.response.status, 401, 'guest add-to-cart requests must be rejected')
  result = await request('/api/orders', { method: 'POST', body: { source: 'direct', items: [{ productId: 'p-002', quantity: 1 }], paymentMethod: 'cod', address: {} } })
  assert.equal(result.response.status, 401, 'guest direct checkout must be rejected')
  result = await request('/api/auth/login', { method: 'POST', body: { identifier: 'missing', password: 'SecureMango!_2026A' } })
  assert.equal(result.response.status, 401, 'invalid credentials must fail')

  result = await register('qa_shopper_one')
  assert.equal(result.response.status, 200, result.data.error)
  assert.equal(result.data.user.role, 'customer', 'registration must assign customer role regardless of client role')
  assert.match(result.setCookie, /HttpOnly/i)
  assert.match(result.setCookie, /SameSite=Strict/i)
  assert.equal(result.data.user.password, undefined)

  result = await request('/api/auth/me')
  assert.equal(result.data.user.username, 'qa_shopper_one')
  result = await request('/api/wishlist/items', { method: 'POST', body: { productId: 'p-001' } })
  assert.equal(result.response.status, 200)
  assert.ok(result.data.items.includes('p-001'))
  result = await request('/api/wishlist')
  assert.ok(result.data.items.some((item) => item.id === 'p-001'), 'saved products should persist in the account')
  result = await request('/api/auth/profile', { method: 'PATCH', body: { fullName: 'Updated QA Shopper', username: 'qa_shopper_edited' } })
  assert.equal(result.data.user.fullName, 'Updated QA Shopper', 'profile edits must persist to the account')
  assert.equal(result.data.user.email, 'qa_shopper_one@example.test', 'profile edits must not change the account email')
  result = await request('/api/auth/me')
  assert.equal(result.data.user.username, 'qa_shopper_edited', 'profile data must remain updated in the session')
  const addHeaders = { 'Idempotency-Key': 'qa-cart-add-once' }
  result = await request('/api/cart/items', { method: 'POST', body: { productId: 'p-002', quantity: 1 }, headers: addHeaders })
  assert.equal(result.response.status, 200, result.data.error)
  result = await request('/api/cart/items', { method: 'POST', body: { productId: 'p-002', quantity: 1 }, headers: addHeaders })
  assert.equal(result.data.items.find((item) => item.id === 'p-002').quantity, 1, 'retrying an add with its key must not double the quantity')

  const address = { fullName: 'QA Shopper', phone: '09171234567', region: 'NCR, Manila, Barangay 1', postalCode: '1000', street: '1 Test Street', label: 'Home' }
  result = await request('/api/addresses', { method: 'POST', body: address })
  assert.equal(result.response.status, 201, result.data.error)
  const firstAddressId = result.data.addresses[0].id
  assert.equal(result.data.addresses[0].isDefault, true, 'the first saved address should become the default')
  result = await request('/api/addresses', { method: 'POST', body: { ...address, label: 'Work', street: '2 Test Street', isDefault: true } })
  const secondAddressId = result.data.addresses.find((item) => item.label === 'Work').id
  assert.equal(result.data.addresses.find((item) => item.id === secondAddressId).isDefault, true)
  result = await request(`/api/addresses/${firstAddressId}/default`, { method: 'PATCH', body: {} })
  assert.equal(result.data.addresses.find((item) => item.id === firstAddressId).isDefault, true)
  result = await request(`/api/addresses/${secondAddressId}`, { method: 'DELETE' })
  assert.equal(result.data.addresses.length, 1)
  const orderHeaders = { 'Idempotency-Key': 'qa-order-once' }
  result = await request('/api/orders', { method: 'POST', body: { source: 'cart', itemIds: ['p-002'], total: 1, paymentMethod: 'cod', address }, headers: orderHeaders })
  assert.equal(result.response.status, 201, result.data.error)
  const firstOrderId = result.data.order.id
  assert.equal(result.data.order.total, 2499, 'server must calculate order total from its product prices')
  assert.equal(result.data.order.status, 'To Ship')
  result = await request('/api/orders', { method: 'POST', body: { source: 'cart', itemIds: ['p-002'], paymentMethod: 'cod', address }, headers: orderHeaders })
  assert.equal(result.data.order.id, firstOrderId, 'retrying checkout must return the original order')
  assert.equal(result.data.cart.length, 0)
  result = await request('/api/orders')
  assert.equal(result.data.orders.length, 1)

  const cookieForFirstUser = cookie
  result = await request('/api/seller/profile', { method: 'POST', body: { storeName: 'QA Finds', description: 'A small test shop.' } })
  assert.equal(result.response.status, 201, result.data.error)
  const sellerUserId = result.data.profile.userId
  assert.equal(result.data.profile.approvalStatus, 'pending')
  result = await request('/api/products', { method: 'POST', body: { name: 'Pending Listing', category: 'Home', description: 'Pending', specifications: 'Pending', price: 10, quantity: 2 } })
  assert.equal(result.response.status, 403, 'pending sellers must not publish products')

  result = await register('qa_admin')
  assert.equal(result.response.status, 200, result.data.error)
  assert.equal(result.data.user.role, 'admin', 'only the configured admin account should receive admin access')
  const cookieForAdmin = cookie
  result = await request(`/api/admin/sellers/${sellerUserId}/approval`, { method: 'PATCH', body: { status: 'approved' } })
  assert.equal(result.response.status, 200, result.data.error)
  cookie = cookieForFirstUser
  result = await request('/api/auth/me')
  assert.equal(result.data.user.role, 'seller')
  result = await request('/api/products', { method: 'POST', body: { name: 'QA Handmade Bowl', category: 'Home & Garden', description: 'A bowl for serving.', specifications: 'Ceramic\nHandmade', image: 'https://example.test/bowl.jpg', price: 1234, quantity: 5 }, headers: { 'Idempotency-Key': 'qa-product-create' } })
  assert.equal(result.response.status, 201, result.data.error)
  const sellerProductId = result.data.product.id
  result = await request('/api/products', { method: 'POST', body: { name: 'QA Handmade Bowl', category: 'Home & Garden', description: 'A bowl for serving.', specifications: 'Ceramic\nHandmade', image: 'https://example.test/bowl.jpg', price: 1234, quantity: 5 }, headers: { 'Idempotency-Key': 'qa-product-create' } })
  assert.equal(result.data.product.id, sellerProductId, 'retrying product creation with the same idempotency key must not duplicate the listing')
  result = await request(`/api/products/${sellerProductId}`)
  assert.equal(result.data.product.sellerId, sellerUserId)
  result = await request(`/api/products/${sellerProductId}`, { method: 'PATCH', body: { price: 1300, quantity: 4 } })
  assert.equal(result.data.product.price, 1300)
  result = await request('/api/cart/items', { method: 'POST', body: { productId: sellerProductId, quantity: 2 }, headers: { 'Idempotency-Key': 'qa-seller-cart-add' } })
  assert.equal(result.response.status, 200, result.data.error)
  const sellerOrder = await request('/api/orders', { method: 'POST', body: { source: 'cart', itemIds: [sellerProductId], paymentMethod: 'cod', address }, headers: { 'Idempotency-Key': 'qa-seller-order' } })
  assert.equal(sellerOrder.data.order.total, 2600)
  assert.equal(sellerOrder.data.order.status, 'To Ship')
  const sellerOrderId = sellerOrder.data.order.id
  result = await request('/api/seller/orders')
  assert.equal(result.data.orders[0].id, sellerOrderId)
  result = await request(`/api/seller/orders/${sellerOrderId}`, { method: 'PATCH', body: { action: 'ship' }, headers: { 'Idempotency-Key': 'qa-seller-ship' } })
  assert.equal(result.data.order.status, 'To Receive')
  result = await request(`/api/orders/${sellerOrderId}`)
  assert.equal(result.data.order.items[0].fulfillmentStatus, 'To Receive')
  result = await request(`/api/orders/${sellerOrderId}`, { method: 'PATCH', body: { action: 'received' } })
  assert.equal(result.data.order.status, 'Completed')
  result = await request('/api/seller/analytics')
  assert.equal(result.data.unitsSold, 2)

  cookie = cookieForAdmin
  result = await request(`/api/admin/sellers/${sellerUserId}/approval`, { method: 'PATCH', body: { status: 'rejected' } })
  assert.equal(result.response.status, 200)
  result = await request(`/api/products/${sellerProductId}`)
  assert.equal(result.response.status, 404, 'products from unapproved sellers must not remain public')
  cookie = cookieForFirstUser
  result = await request('/api/auth/me')
  assert.equal(result.data.user.role, 'customer', 'seller privileges must be removed when approval is revoked')
  result = await request('/api/cart/items', { method: 'POST', body: { productId: sellerProductId, quantity: 1 } })
  assert.equal(result.response.status, 404, 'unapproved seller products must not be added to carts')

  result = await register('qa_shopper_two')
  assert.equal(result.response.status, 200, result.data.error)
  result = await request('/api/orders')
  assert.equal(result.data.orders.length, 0, 'orders must be isolated to their owner')
  result = await request('/api/wishlist')
  assert.equal(result.data.items.length, 0, 'wishlists must be isolated to their owner')
  result = await request(`/api/products/${sellerProductId}`, { method: 'PATCH', body: { price: 1 } })
  assert.equal(result.response.status, 403, 'other accounts cannot edit a seller product')
  result = await request(`/api/addresses/${firstAddressId}/default`, { method: 'PATCH', body: {} })
  assert.equal(result.response.status, 404, 'customers cannot access another account’s saved addresses')
  result = await request(`/api/orders/${firstOrderId}`, { method: 'PATCH', body: { action: 'cancel' } })
  assert.equal(result.response.status, 404, 'users must not modify another account’s orders')

  result = await request('/api/orders', { method: 'POST', body: { source: 'direct', items: [{ productId: 'p-003', quantity: 2 }], paymentMethod: 'ewallet', address } })
  assert.equal(result.response.status, 201, result.data.error)
  assert.equal(result.data.order.total, 3700)
  assert.equal(result.data.order.status, 'To Pay')
  result = await request('/api/orders', { method: 'POST', body: { source: 'direct', items: [{ productId: 'p-003', quantity: 999 }], paymentMethod: 'cod', address } })
  assert.equal(result.response.status, 400, 'invalid client quantities must be rejected')

  cookie = cookieForFirstUser
  result = await request(`/api/orders/${firstOrderId}`, { method: 'PATCH', body: { action: 'cancel' } })
  assert.equal(result.response.status, 200, result.data.error)
  assert.equal(result.data.order.status, 'Cancelled')
  assert.equal(result.data.products.find((product) => product.id === 'p-002').quantity, 4, 'cancelling restores stock')

  result = await request('/api/auth/logout', { method: 'POST', body: {} })
  assert.equal(result.response.status, 200)
  result = await request('/api/cart')
  assert.equal(result.response.status, 401, 'logout must invalidate the session')

  result = await request('/api/auth/login', { method: 'POST', body: { identifier: 'qa_shopper_edited', password: 'SecureMango!_2026A' } })
  assert.equal(result.response.status, 200)
  result = await request('/api/auth/password', { method: 'POST', body: { currentPassword: 'SecureMango!_2026A', newPassword: 'SecureMango!_2026B' } })
  assert.equal(result.response.status, 200, result.data.error)
  result = await request('/api/auth/login', { method: 'POST', body: { identifier: 'qa_shopper_edited', password: 'SecureMango!_2026A' } })
  assert.equal(result.response.status, 401, 'the old password must stop working after a change')
  result = await request('/api/auth/login', { method: 'POST', body: { identifier: 'qa_shopper_edited', password: 'SecureMango!_2026B' } })
  assert.equal(result.response.status, 200, 'the new password must authenticate successfully')

  console.log('Add2Cart API integration flow passed: origin restrictions, product catalog/search, guest protection, account/profile/password/address flows, seller approval and product lifecycle, seller isolation, cart/orders, server pricing, fulfillment, inventory, and logout.')
} catch (error) {
  console.error(error)
  console.error(serverOutput)
  process.exitCode = 1
} finally {
  server.kill('SIGTERM')
  await new Promise((done) => server.once('exit', done).unref?.() || setTimeout(done, 500))
  await rm(temporaryDirectory, { recursive: true, force: true })
}
