import { categories as seedCategories, initialProducts } from '../data/initialProducts'
import { readStorage, writeStorage } from './marketplace'

const storageKey = 'add2cart-browser-store-v1'
const guestUser = () => ({ id: 'guest-shopper', username: 'guest_shopper', email: '', fullName: 'Guest shopper', isGuest: true, role: 'customer', sellerStatus: null })
const seedProducts = () => {
  const previous = readStorage('findly-products-v1', null)
  return Array.isArray(previous) && previous.length ? previous : initialProducts.map((product) => ({ ...product, soldCount: 0, sellerId: null, status: 'published' }))
}
const defaultState = () => ({
  user: guestUser(), products: seedProducts(), cart: readStorage('findly-cart-v1', []),
  wishlist: readStorage('findly-saved-v1', []), addresses: [], orders: [], sellerProfile: null,
})
function state() {
  const stored = readStorage(storageKey, null)
  if (stored && Array.isArray(stored.products)) return { ...defaultState(), ...stored }
  const initial = defaultState()
  writeStorage(storageKey, initial)
  return initial
}
const save = (data) => writeStorage(storageKey, data)
const clone = (value) => JSON.parse(JSON.stringify(value))
const fail = (message, status = 400) => Object.assign(new Error(message), { status })
const published = (data) => data.products.filter((product) => product.status !== 'archived' && (!product.sellerId || data.sellerProfile?.approvalStatus === 'approved'))
const catalog = (data) => published(data).map(({ id, price, quantity, soldCount = 0 }) => ({ id, price, quantity, soldCount }))
const cartResponse = (data) => data.cart.map((line) => {
  const product = data.products.find((item) => item.id === line.id)
  return product ? { ...line, price: product.price, available: product.quantity } : null
}).filter(Boolean)
const now = () => new Date().toISOString()
const id = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
const orderResponse = (data, order) => ({
  ...clone(order), items: order.items.map((item) => {
    const product = data.products.find((candidate) => candidate.id === item.productId)
    return { ...item, image: product?.image, category: product?.category || '', sellerId: product?.sellerId || null }
  }),
})
const publicProduct = (product) => ({ ...product, sellerId: product.sellerId || null, reviewCount: product.reviewCount || 0, soldCount: product.soldCount || 0 })

export class StoreError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'StoreError'; this.status = status }
}

export async function localStoreOperation(path, { method = 'GET', body = {}, signal } = {}) {
  if (signal?.aborted) throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
  const url = new URL(path, 'http://local.store')
  const route = url.pathname
  const verb = method.toUpperCase()
  const data = state()

  if (verb === 'GET' && route === '/profile') return { user: data.user || guestUser() }
  if (verb === 'PATCH' && route === '/profile') {
    data.user = { ...data.user, ...body, fullName: body.fullName || data.user.fullName }
    save(data); return { user: data.user }
  }
  if (verb === 'POST' && route === '/profile/photo') { data.user.profileImageUrl = body.image; save(data); return { user: data.user } }

  if (verb === 'GET' && route === '/catalog') return { products: catalog(data) }
  if (verb === 'GET' && route === '/categories') return { categories: [...new Set([...seedCategories, ...published(data).map((product) => product.category)])] }
  if (verb === 'GET' && route === '/products/search') {
    const query = (url.searchParams.get('q') || '').trim().toLowerCase()
    const category = url.searchParams.get('category') || 'All'
    const products = published(data).filter((product) => (category === 'All' || product.category === category) && `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(query))
    return { products: products.map(publicProduct) }
  }
  if (verb === 'GET' && route === '/products') return { products: published(data).map(publicProduct) }
  const productMatch = route.match(/^\/products\/([^/]+)$/)
  if (productMatch && verb === 'GET') {
    const product = published(data).find((item) => item.id === decodeURIComponent(productMatch[1]))
    if (!product) throw fail('Product not found.', 404)
    return { product: publicProduct(product) }
  }
  if (verb === 'POST' && route === '/products') {
    const product = { ...body, id: id(), quantity: Number(body.quantity), sellerId: data.user.id, soldCount: 0, status: 'published', createdAt: now(), rating: 0, reviewCount: 0 }
    data.products.unshift(product); save(data); return { product: publicProduct(product) }
  }
  if (productMatch && verb === 'PATCH') {
    const index = data.products.findIndex((item) => item.id === decodeURIComponent(productMatch[1]))
    if (index < 0) throw fail('Product not found.', 404)
    data.products[index] = { ...data.products[index], ...body, updatedAt: now() }; save(data)
    return { product: publicProduct(data.products[index]) }
  }
  if (productMatch && verb === 'DELETE') {
    const product = data.products.find((item) => item.id === decodeURIComponent(productMatch[1]))
    if (product) { product.status = 'archived'; product.quantity = 0; data.cart = data.cart.filter((item) => item.id !== product.id); save(data) }
    return { ok: true }
  }

  if (verb === 'GET' && route === '/cart') return { items: cartResponse(data) }
  if (verb === 'POST' && route === '/cart/items') {
    const product = published(data).find((item) => item.id === body.productId)
    if (!product) throw fail('Product is not available.', 404)
    const current = data.cart.find((item) => item.id === body.productId)
    const quantity = (current?.quantity || 0) + Number(body.quantity)
    if (!Number.isInteger(quantity) || quantity > product.quantity || quantity > 20) throw fail('There are not enough items available.', 409)
    if (current) current.quantity = quantity
    else data.cart.push({ id: body.productId, quantity })
    save(data); return { items: cartResponse(data) }
  }
  const cartItemMatch = route.match(/^\/cart\/items\/([^/]+)$/)
  if (cartItemMatch && verb === 'PATCH') {
    const cartLine = data.cart.find((item) => item.id === decodeURIComponent(cartItemMatch[1]))
    const product = data.products.find((item) => item.id === decodeURIComponent(cartItemMatch[1]))
    if (!cartLine || !product) throw fail('Cart item not found.', 404)
    if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > product.quantity || body.quantity > 20) throw fail('There are not enough items available.', 409)
    cartLine.quantity = body.quantity; save(data); return { items: cartResponse(data) }
  }
  if (cartItemMatch && verb === 'DELETE') {
    data.cart = data.cart.filter((item) => item.id !== decodeURIComponent(cartItemMatch[1])); save(data); return { items: cartResponse(data) }
  }
  if (verb === 'DELETE' && route === '/cart') { data.cart = []; save(data); return { items: [] } }

  if (verb === 'GET' && route === '/wishlist') return { items: [...data.wishlist] }
  if (verb === 'POST' && route === '/wishlist/items') {
    if (!published(data).some((item) => item.id === body.productId)) throw fail('Product not found.', 404)
    if (!data.wishlist.includes(body.productId)) data.wishlist.push(body.productId)
    save(data); return { items: [...data.wishlist] }
  }
  const wishlistMatch = route.match(/^\/wishlist\/items\/([^/]+)$/)
  if (wishlistMatch && verb === 'DELETE') {
    data.wishlist = data.wishlist.filter((item) => item !== decodeURIComponent(wishlistMatch[1])); save(data)
    return { items: [...data.wishlist] }
  }

  if (verb === 'GET' && route === '/orders') return { orders: data.orders.map((order) => orderResponse(data, order)) }
  if (verb === 'POST' && route === '/orders') {
    let lines
    if (body.source === 'direct') lines = body.items || []
    else if (body.source === 'cart') lines = data.cart.filter((item) => body.itemIds?.includes(item.id))
    else throw fail('Invalid checkout source.')
    if (!lines.length) throw fail('Select at least one item to checkout.')
    const normalized = lines.map((line) => {
      const productId = line.productId || line.id
      const product = published(data).find((item) => item.id === productId)
      const quantity = Number(line.quantity)
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > product.quantity) throw fail('This product or quantity is no longer available.', 409)
      return { productId, name: product.name, quantity, unitPrice: product.price, sellerId: product.sellerId || null, fulfillmentStatus: body.paymentMethod === 'ewallet' ? 'To Pay' : 'To Ship' }
    })
    const fields = ['fullName', 'phone', 'region', 'postalCode', 'street']
    if (!body.address || fields.some((field) => !String(body.address[field] || '').trim())) throw fail('Complete all required delivery address fields.')
    if (!['cod', 'ewallet'].includes(body.paymentMethod)) throw fail('Choose a supported payment method.')
    const order = { id: id(), orderNumber: `AC-${id().slice(0, 8).toUpperCase()}`, status: body.paymentMethod === 'ewallet' ? 'To Pay' : 'To Ship', paymentMethod: body.paymentMethod, paymentStatus: body.paymentMethod === 'ewallet' ? 'pending' : 'due on delivery', address: { ...body.address }, total: normalized.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), createdAt: now(), items: normalized }
    for (const line of normalized) {
      const product = data.products.find((item) => item.id === line.productId)
      product.quantity -= line.quantity; product.soldCount = (product.soldCount || 0) + line.quantity
      if (body.source === 'cart') data.cart = data.cart.filter((item) => item.id !== line.productId)
    }
    data.orders.unshift(order); save(data)
    return { order: orderResponse(data, order), cart: cartResponse(data), products: catalog(data) }
  }
  const orderMatch = route.match(/^\/orders\/([^/]+)$/)
  if (orderMatch && verb === 'PATCH') {
    const order = data.orders.find((item) => item.id === decodeURIComponent(orderMatch[1]))
    if (!order) throw fail('Order not found.', 404)
    if (body.action === 'cancel' && ['To Pay', 'To Ship'].includes(order.status)) {
      order.status = 'Cancelled'
      for (const line of order.items) { const product = data.products.find((item) => item.id === line.productId); if (product) { product.quantity += line.quantity; product.soldCount = Math.max(0, (product.soldCount || 0) - line.quantity) } }
    } else if (body.action === 'received' && order.status === 'To Receive') order.status = 'Completed'
    save(data); return { order: orderResponse(data, order), products: catalog(data) }
  }

  if (verb === 'GET' && route === '/addresses') return { addresses: clone(data.addresses) }
  if (verb === 'POST' && route === '/addresses') {
    const address = { ...body, id: id(), isDefault: body.isDefault ?? data.addresses.length === 0 }
    if (address.isDefault) data.addresses.forEach((item) => { item.isDefault = false })
    data.addresses.unshift(address); save(data); return { addresses: clone(data.addresses) }
  }
  const addressMatch = route.match(/^\/addresses\/([^/]+)(?:\/(default))?$/)
  if (addressMatch) {
    const addressId = decodeURIComponent(addressMatch[1])
    if (addressMatch[2] && verb === 'PATCH') {
      data.addresses.forEach((item) => { item.isDefault = item.id === addressId }); save(data)
      return { addresses: clone(data.addresses) }
    }
    const index = data.addresses.findIndex((item) => item.id === addressId)
    if (index < 0) throw fail('Address not found.', 404)
    if (verb === 'PATCH') {
      data.addresses[index] = { ...data.addresses[index], ...body }; save(data); return { addresses: clone(data.addresses) }
    }
    if (verb === 'DELETE') {
      data.addresses.splice(index, 1); if (!data.addresses.some((item) => item.isDefault) && data.addresses[0]) data.addresses[0].isDefault = true
      save(data); return { addresses: clone(data.addresses) }
    }
  }

  if (route === '/seller/profile' && verb === 'GET') return { profile: data.sellerProfile }
  if (route === '/seller/profile' && verb === 'POST') {
    if (data.sellerProfile) throw fail('A seller application already exists.')
    data.sellerProfile = { id: id(), userId: data.user.id, storeName: body.storeName, description: body.description || '', approvalStatus: 'approved', createdAt: now(), updatedAt: now() }
    data.user.sellerStatus = 'approved'; data.user.role = 'seller'; save(data); return { profile: data.sellerProfile }
  }
  if (route === '/seller/profile' && verb === 'PATCH') {
    if (!data.sellerProfile) throw fail('Create a seller application first.', 404)
    data.sellerProfile = { ...data.sellerProfile, storeName: body.storeName, description: body.description, updatedAt: now() }
    save(data); return { profile: data.sellerProfile }
  }
  if (route === '/seller/products' && verb === 'GET') return { products: data.products.filter((product) => product.sellerId === data.user.id && product.status !== 'archived').map(publicProduct) }
  if (route === '/seller/orders' && verb === 'GET') return { orders: data.orders.filter((order) => order.items.some((item) => item.sellerId === data.user.id)).map((order) => orderResponse(data, order)) }
  if (route === '/seller/analytics' && verb === 'GET') {
    const products = data.products.filter((item) => item.sellerId === data.user.id && item.status === 'published')
    const orders = data.orders.filter((order) => order.items.some((item) => item.sellerId === data.user.id) && order.status !== 'Cancelled')
    const items = orders.flatMap((order) => order.items.filter((item) => item.sellerId === data.user.id))
    return { products: products.length, unitsSold: products.reduce((sum, item) => sum + (item.soldCount || 0), 0), orderCount: orders.length, grossSales: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) }
  }
  const sellerOrderMatch = route.match(/^\/seller\/orders\/([^/]+)$/)
  if (sellerOrderMatch && verb === 'PATCH') {
    const order = data.orders.find((item) => item.id === decodeURIComponent(sellerOrderMatch[1]))
    if (!order || !order.items.some((item) => item.sellerId === data.user.id)) throw fail('Seller order not found.', 404)
    order.items.filter((item) => item.sellerId === data.user.id).forEach((item) => { item.fulfillmentStatus = 'To Receive' })
    if (order.items.every((item) => item.fulfillmentStatus === 'To Receive')) order.status = 'To Receive'
    save(data); return { order: orderResponse(data, order) }
  }

  throw new StoreError(`This local feature is not available yet (${verb} ${route}).`, 404)
}

