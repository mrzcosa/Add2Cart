import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import ProductGrid from './components/ProductGrid'
import SellerDashboard from './components/SellerDashboard'
import CartView from './components/CartView'
import PurchaseHistory from './components/PurchaseHistory'
import AccountDashboard from './components/AccountDashboard'
import CheckoutModal from './components/CheckoutModal'
import Brand from './components/Brand'
import QuantitySelector from './components/QuantitySelector'
import StockBadge from './components/StockBadge'
import CategoryIcon from './components/CategoryIcon'
import djiHeroImage from './assets/Hero Banner/DJI Osmo Action 6.png'
import iphoneHeroImage from './assets/Hero Banner/Iphone 17 Pro.png'
import clnHeroImage from './assets/Hero Banner/CLN.png'
import { categories as seedCategories, initialProducts } from './data/initialProducts'
import { imageFallback, money, readStorage, writeStorage } from './utils/marketplace'
import { localStoreOperation } from './utils/localStore'

const getRoute = () => {
  const [page = 'home', id] = window.location.hash.replace(/^#/, '').split('/')
  return { page: page || 'home', id }
}
const safeProducts = () => {
  const stored = readStorage('findly-products-v1', null)
  const valid = Array.isArray(stored) && stored.length > 0 && stored.every((item) => item &&
    typeof item.id === 'string' && typeof item.name === 'string' && typeof item.category === 'string' &&
    typeof item.image === 'string' && typeof item.description === 'string' && typeof item.specifications === 'string' &&
    Number.isFinite(item.rating) && item.rating >= 1 && item.rating <= 5 && Number.isFinite(item.price) && item.price > 0 &&
    Number.isInteger(item.quantity) && item.quantity >= 0)
  return valid ? stored.map((item) => {
    const seed = initialProducts.find((product) => product.id === item.id)
    if (item.id === 'p-012' && seed) return { ...item, name: seed.name, image: seed.image, description: seed.description, specifications: seed.specifications, price: seed.price }
    if (item.id === 'p-005' && seed) return { ...item, name: seed.name, image: seed.image, description: seed.description, specifications: seed.specifications, price: seed.price }
    if (item.id === 'p-002' && seed) return { ...item, name: seed.name, image: seed.image, description: seed.description, specifications: seed.specifications, price: seed.price }
    if (item.id === 'p-001' && seed) return { ...item, name: seed.name, image: seed.image, description: seed.description, specifications: seed.specifications, price: seed.price }
    if (item.id === 'p-008' && seed) return { ...item, image: seed.image, description: seed.description, specifications: seed.specifications }
    if (item.id === 'p-006' && seed) return { ...item, name: seed.name, image: seed.image, description: seed.description, specifications: seed.specifications, price: seed.price }
    if (item.id === 'p-010' && seed) return { ...item, image: seed.image, description: seed.description, specifications: seed.specifications }
    if (item.id === 'p-007' && seed) return { ...item, name: seed.name, image: seed.image, description: seed.description, specifications: seed.specifications, price: seed.price }
    if (item.id === 'p-015' && seed) return { ...item, image: seed.image, description: seed.description, specifications: seed.specifications }
    if (item.id === 'p-014' && seed) return { ...item, image: seed.image, description: seed.description, specifications: seed.specifications }
    if (item.id === 'p-013' && seed) return { ...item, image: seed.image, description: seed.description, specifications: seed.specifications }
    if (item.id === 'p-003' && seed) return { ...item, image: seed.image, description: seed.description, specifications: seed.specifications }
    if (item.id === 'p-011' && seed) return { ...item, name: seed.name, image: seed.image, description: seed.description, specifications: seed.specifications }
    if (item.id === 'p-009' && seed) return { ...item, name: seed.name, image: seed.image, description: seed.description, specifications: seed.specifications, price: seed.price }
    return item.id === 'p-004' && seed ? { ...item, name: seed.name, image: seed.image, price: seed.price } : item
  }) : initialProducts
}
const safeCart = () => {
  const stored = readStorage('findly-cart-v1', [])
  return Array.isArray(stored) ? stored.filter((item) => item && typeof item.id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0) : []
}
function fromLocalProduct(product) {
  const seed = initialProducts.find((item) => item.id === product.id)
  const sellerProduct = Boolean(product.sellerId)
  return {
    ...seed,
    ...product,
    image: product.image || seed?.image || imageFallback,
    description: sellerProduct ? product.description : seed?.description || product.description,
    specifications: sellerProduct ? product.specifications : seed?.specifications || product.specifications,
    rating: sellerProduct ? product.rating : seed?.rating ?? product.rating ?? 0,
    reviewCount: sellerProduct ? product.reviewCount : seed?.reviewCount ?? product.reviewCount ?? 0,
  }
}
const heroSlides = [
  {
    image: djiHeroImage,
    imageAlt: 'DJI Osmo Action 6 camera',
  },
  {
    image: iphoneHeroImage,
    imageAlt: 'iPhone Pro in a warm orange finish',
  },
  {
    image: clnHeroImage,
    imageAlt: 'CLN promotional collection banner',
  },
  {
    eyebrow: "TODAY'S GOOD DEALS",
    title: 'Good finds,',
    highlight: 'better prices.',
    description: 'A fresh edit of marketplace favorites priced under ₱2,000.',
    action: 'Shop today’s deals',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1050&q=90',
    imageAlt: 'A bright boutique with clothing and accessories on display',
    caption: 'Little joys, friendly prices',
    stickerTop: 'TODAY’S',
    stickerMain: <>good<br />things</>,
    stickerBottom: 'UNDER ₱2K',
    destination: 'deals',
  },
  {
    eyebrow: 'JUST ADDED',
    title: 'Meet your',
    highlight: 'new favorites.',
    description: 'Discover fresh finds across tech, home, style and more.',
    action: 'Explore new finds',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1050&q=90',
    imageAlt: 'Wireless headphones ready for a new listening favorite',
    caption: 'A new favorite is waiting',
    stickerTop: 'FRESH',
    stickerMain: <>new<br />finds</>,
    stickerBottom: 'JUST IN ✦',
    destination: 'categories',
  },
  {
    eyebrow: 'HOME & GARDEN',
    title: 'Make room for',
    highlight: 'little comforts.',
    description: 'Thoughtful home updates to make everyday moments feel special.',
    action: 'Shop home finds',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1050&q=90',
    imageAlt: 'A warm coffee setup for a cozy moment at home',
    caption: 'Make yourself at home',
    stickerTop: 'A LITTLE',
    stickerMain: <>more<br />cozy</>,
    stickerBottom: 'FOR HOME ✦',
    destination: 'Home & Garden',
  },
]

function Hero() {
  const [activeSlide, setActiveSlide] = useState(0)
  const slide = heroSlides[activeSlide]

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer
    const syncAutoplay = () => {
      window.clearInterval(timer)
      if (motionPreference.matches) return
      timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % heroSlides.length), 5000)
    }
    syncAutoplay()
    motionPreference.addEventListener?.('change', syncAutoplay)
    return () => {
      window.clearInterval(timer)
      motionPreference.removeEventListener?.('change', syncAutoplay)
    }
  }, [])

  return <section className="hero container" aria-label="Marketplace highlights" aria-roledescription="carousel">
    <div className={`hero-art ${activeSlide === 0 ? 'hero-art-dji' : ''}`}>
      <img key={`image-${activeSlide}`} src={slide.image} alt={slide.imageAlt} />
    </div>
  </section>
}
function CategoryStrip({ categories, selectedCategory, onSelect }) {
  return <section className="category-strip container"><div className="category-strip-top"><div><p className="eyebrow">A world of good finds</p><h2>Shop what speaks to you</h2></div></div><div className="category-scroller">{categories.map((category, index) => <button key={category} className={`category-tile tint-${index} ${selectedCategory === category ? 'selected' : ''}`} onClick={() => onSelect(category)}><span className="category-icon"><CategoryIcon category={category} /></span><strong>{category}</strong></button>)}</div></section>
}

function ProductDetails({ product, products, quantity, setQuantity, addToCart, directCheckout, openProduct, setCategory }) {
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4)
  return <main className="container page-main details-page"><div className="breadcrumbs"><button onClick={() => { window.location.hash = '#home' }}>Home</button><span>/</span><button onClick={() => setCategory(product.category)}>{product.category}</button><span>/</span><span>{product.name}</span></div><section className="details-layout"><div className={`details-photo ${product.id === 'p-011' ? 'lego-product-photo' : ''} ${product.id === 'p-007' ? 'aquaflask-product-photo' : ''} ${product.id === 'p-002' ? 'cln-bag-product-photo' : ''} ${product.id === 'p-010' ? 'desk-lamp-product-photo' : ''}`}><img src={product.image} alt={product.name} onError={(event) => { event.currentTarget.src = imageFallback }} /></div><div className="details-copy"><p className="eyebrow">{product.category} <span className="seller-dot">·</span> Add2Cart marketplace</p><h1>{product.name}</h1><div className="rating-line detail-rating"><span className="stars">★★★★★</span> {product.rating.toFixed(1)} <span className="review-count">({product.reviewCount} shopper reviews)</span></div><div className="detail-price">{money(product.price)}</div><p className="detail-description">{product.description}</p><StockBadge quantity={product.quantity} /><div className="detail-buy-row"><span>Quantity</span><QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, product.quantity)} /><span className="detail-subtotal">Subtotal <strong>{money(product.price * quantity)}</strong></span></div><button className="button outline detail-add-to-cart" onClick={() => addToCart(product, quantity)} disabled={product.quantity <= 0}>Add to cart</button><button className="button primary detail-buy-now" onClick={() => directCheckout(product, quantity)} disabled={product.quantity <= 0}>Buy Now</button><div className="specification-box"><h2>Description</h2><ul>{product.specifications.split('\n').filter(Boolean).map((specification) => <li key={specification}>{specification}</li>)}</ul></div></div></section>{related.length > 0 && <ProductGrid title="More finds you might love" subtitle={`From ${product.category}`} products={related} selectedQuantities={{}} setSelectedQuantity={() => {}} addToCart={addToCart} toggleSaved={() => {}} savedItems={[]} openProduct={openProduct} />}</main>
}

export default function App() {
  const [products, setProducts] = useState(safeProducts)
  const [cartItems, setCartItems] = useState(safeCart)
  const [purchases, setPurchases] = useState([])
  const [user, setUser] = useState({ id: 'guest-shopper', username: 'guest_shopper', fullName: 'Guest shopper', email: '', isGuest: true, role: 'customer' })
  const [cartCheckout, setCartCheckout] = useState(null)
  const [savedItems, setSavedItems] = useState(() => { const saved = readStorage('findly-saved-v1', []); return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [] })
  const [selectedQuantities, setSelectedQuantities] = useState({})
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [localCategories, setLocalCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [route, setRoute] = useState(getRoute)
  const [notice, setNotice] = useState('')
  const [detailQuantity, setDetailQuantity] = useState(1)
  const [directCheckoutItems, setDirectCheckoutItems] = useState(null)
  useEffect(() => { writeStorage('findly-saved-v1', savedItems) }, [savedItems])
  useEffect(() => { const sync = () => { setRoute(getRoute()); window.scrollTo({ top: 0, behavior: 'smooth' }) }; window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync) }, [])
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      if (!query.trim()) { setSearchResults(null); return }
      try {
        const params = new URLSearchParams({ q: query.trim(), category: selectedCategory, limit: '100' })
        const result = await localStoreOperation(`/products/search?${params}`, { signal: controller.signal })
        setSearchResults(result.products.map(fromLocalProduct))
      } catch (error) {
        if (error.name !== 'AbortError') setSearchResults(null)
      }
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, selectedCategory])

  const categories = useMemo(() => [...new Set([...seedCategories, ...localCategories, ...products.map((product) => product.category).filter(Boolean)])], [products, localCategories])
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)

  const searchedProducts = useMemo(() => (query.trim() && searchResults !== null ? searchResults : products).filter((product) => {
    const text = `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase()
    return (selectedCategory === 'All' || product.category === selectedCategory) && (!query.trim() || text.includes(query.trim().toLocaleLowerCase()))
  }), [products, query, selectedCategory, searchResults])
  const isSearching = query.trim().length > 0
  const detailProduct = products.find((product) => product.id === route.id)

  function navigate(page) { window.location.hash = `#${page}` }
  function openProduct(id) { setDetailQuantity(1); window.location.hash = `#product/${id}` }
  function chooseCategory(category) { setSelectedCategory(category); setQuery(''); navigate('categories') }
  function setSelectedQuantity(id, quantity) { setSelectedQuantities((current) => ({ ...current, [id]: quantity })) }
  function flash(message) { setNotice(message); window.setTimeout(() => setNotice(''), 3400) }

  function applyInventory(rows) {
    const inventory = new Map(rows.map((item) => [item.id, item]))
    setProducts((current) => current.map((product) => {
      const authoritative = inventory.get(product.id)
      return authoritative ? { ...product, price: authoritative.price, quantity: authoritative.quantity, soldCount: authoritative.soldCount } : product
    }))
  }

  const setCatalogProducts = useCallback((rows) => setProducts(rows.map(fromLocalProduct)), [])
  const applySellerProducts = useCallback((rows, removedId) => setProducts((current) => {
    const next = removedId ? current.filter((product) => product.id !== removedId) : [...current]
    for (const row of rows) {
      const product = fromLocalProduct(row)
      const index = next.findIndex((item) => item.id === product.id)
      if (index >= 0) next[index] = product
      else next.unshift(product)
    }
    return next
  }), [])

  function hydrateOrder(order) {
    return {
      ...order,
      items: order.items.map((item) => {
        const localProduct = products.find((product) => product.id === item.productId)
        return {
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          product: { id: item.productId, name: item.name, category: localProduct?.category || '', image: localProduct?.image || imageFallback },
        }
      }),
    }
  }

  async function refreshLocalData() {
    const [cart, catalogResponse, orderResponse, productResponse, wishlist] = await Promise.all([
      localStoreOperation('/cart'), localStoreOperation('/catalog'), localStoreOperation('/orders'), localStoreOperation('/products?limit=100'), localStoreOperation('/wishlist'),
    ])
    setCartItems(cart.items.map(({ id, quantity }) => ({ id, quantity })))
    setSavedItems(wishlist.items.map((item) => typeof item === 'string' ? item : item.id))
    setCatalogProducts(productResponse.products)
    applyInventory(catalogResponse.products)
    setPurchases(orderResponse.orders.map(hydrateOrder))
  }

  useEffect(() => {
    let active = true
    async function initializeLocalStore() {
      try {
        const [catalogResponse, productResponse, categoryResponse] = await Promise.all([localStoreOperation('/catalog'), localStoreOperation('/products?limit=100'), localStoreOperation('/categories')])
        if (active) { setCatalogProducts(productResponse.products); setLocalCategories(categoryResponse.categories); applyInventory(catalogResponse.products) }
      } catch { /* Seed products remain available if browser storage is unavailable. */ }
      try {
        const result = await localStoreOperation('/profile')
        if (active && result.user) {
          await refreshLocalData()
          if (active) setUser(result.user)
        }
      } catch {
        if (active) setUser({ id: 'guest-shopper', username: 'guest_shopper', fullName: 'Guest shopper', email: '', isGuest: true, role: 'customer' })
      }
    }
    initializeLocalStore()
    return () => { active = false }
  // Load browser-stored profile and marketplace state once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addToCartStored(productId, quantity) {
    const response = await localStoreOperation('/cart/items', {
      method: 'POST', body: { productId, quantity },
    })
    setCartItems(response.items.map(({ id, quantity: itemQuantity }) => ({ id, quantity: itemQuantity })))
    setSelectedQuantity(productId, 1)
    const product = products.find((item) => item.id === productId)
    flash(`${product?.name || 'Product'} added to your cart.`)
  }

  function addToCart(product, quantity = 1) {
    const productId = typeof product === 'string' ? product : product.id
    addToCartStored(productId, quantity).catch((error) => flash(error.message))
  }

  async function loadCartCheckout() {
    const cart = await localStoreOperation('/cart')
    const items = cart.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.id)
      return product ? { product: { ...product, price: item.price }, quantity: item.quantity } : null
    }).filter(Boolean)
    if (!items.length) { flash('Your cart is empty.'); navigate('cart'); return }
    setCartCheckout({ items, total: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) })
    if (route.page !== 'cart') navigate('cart')
  }

  async function requestCartCheckout(items) {
    try {
      const chosenIds = new Set(items.map(({ product }) => product.id))
      const cart = await localStoreOperation('/cart')
      const selectedItems = cart.items.filter((item) => chosenIds.has(item.id)).map((item) => {
        const product = products.find((candidate) => candidate.id === item.id)
        return product ? { product: { ...product, price: item.price }, quantity: item.quantity } : null
      }).filter(Boolean)
      if (!selectedItems.length) { flash('Select at least one available item to continue.'); return }
      setCartCheckout({ items: selectedItems, total: selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0) })
    } catch (error) { flash(error.message) }
  }

  function setCartQuantity(product, next) {
    localStoreOperation(`/cart/items/${encodeURIComponent(product.id)}`, { method: 'PATCH', body: { quantity: next } })
      .then((response) => setCartItems(response.items.map(({ id, quantity }) => ({ id, quantity }))))
      .catch((error) => flash(error.message))
  }

  function removeFromCart(id) {
    localStoreOperation(`/cart/items/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then((response) => setCartItems(response.items.map(({ id: itemId, quantity }) => ({ id: itemId, quantity }))))
      .catch((error) => flash(error.message))
  }

  function clearCart() {
    if (!window.confirm('Clear all items from your cart?')) return
    localStoreOperation('/cart', { method: 'DELETE', body: {} })
      .then(() => setCartItems([])).catch((error) => flash(error.message))
  }

  function beginDirectCheckout(product, quantity) {
    if (product.quantity < quantity || quantity < 1) {
      flash('There are not enough items available for this quantity.')
      return
    }
    setDirectCheckoutItems([{ product, quantity }])
  }

  async function confirmCheckout({ items, address, paymentMethod, direct = false }) {
    const body = direct
      ? { source: 'direct', items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })), address, paymentMethod }
      : { source: 'cart', itemIds: items.map(({ product }) => product.id), address, paymentMethod }
    const result = await localStoreOperation('/orders', { method: 'POST', body })
    setCartItems(result.cart.map(({ id, quantity }) => ({ id, quantity })))
    applyInventory(result.products)
    const order = hydrateOrder(result.order)
    setPurchases((current) => [order, ...current.filter((existing) => existing.id !== order.id)])
    flash(`Order ${order.orderNumber} was placed.`)
    return order
  }

  async function updatePurchaseStatus(orderId, status) {
    if (!['Cancelled', 'Completed'].includes(status)) return
    try {
      const action = status === 'Cancelled' ? 'cancel' : 'received'
      const result = await localStoreOperation(`/orders/${encodeURIComponent(orderId)}`, { method: 'PATCH', body: { action } })
      setPurchases((current) => current.map((order) => order.id === orderId ? hydrateOrder(result.order) : order))
      applyInventory(result.products)
    } catch (error) { flash(error.message) }
  }

  async function toggleSaved(id) {
    try {
      const result = savedItems.includes(id)
        ? await localStoreOperation(`/wishlist/items/${encodeURIComponent(id)}`, { method: 'DELETE' })
        : await localStoreOperation('/wishlist/items', { method: 'POST', body: { productId: id } })
      setSavedItems(result.items)
    } catch (error) { flash(error.message) }
  }
  async function saveForLater(product) {
    if (!savedItems.includes(product.id)) {
      try {
        const result = await localStoreOperation('/wishlist/items', { method: 'POST', body: { productId: product.id } })
        setSavedItems(result.items)
      } catch (error) { flash(error.message); return }
    }
    removeFromCart(product.id)
  }

  function productGrid(productsToShow, title, subtitle) { return <ProductGrid products={productsToShow} title={title} subtitle={subtitle} selectedQuantities={selectedQuantities} setSelectedQuantity={setSelectedQuantity} addToCart={addToCart} toggleSaved={toggleSaved} savedItems={savedItems} openProduct={openProduct} /> }

  return <div className="app-shell"><Header route={route} query={query} setQuery={setQuery} category={selectedCategory} setCategory={setSelectedCategory} categories={categories} cartCount={cartCount} navigate={navigate} user={user} />
    {notice && <div className="toast" role="status">✓ <span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
    {route.page === 'product' && detailProduct && <ProductDetails key={detailProduct.id} product={detailProduct} products={products} quantity={detailQuantity} setQuantity={setDetailQuantity} addToCart={addToCart} directCheckout={beginDirectCheckout} openProduct={openProduct} setCategory={chooseCategory} />}
    {route.page === 'product' && !detailProduct && <main className="container page-main"><div className="empty-state"><h2>That listing has moved on</h2><p>Try another find from the collection.</p><button className="button primary" onClick={() => navigate('home')}>Back to home</button></div></main>}
    {route.page === 'cart' && <CartView cartItems={cartItems} products={products} setCartQuantity={setCartQuantity} removeFromCart={removeFromCart} clearCart={clearCart} continueShopping={() => navigate('home')} openProduct={openProduct} savedItems={savedItems} saveForLater={saveForLater} onRequestCheckout={requestCartCheckout} />}
    {route.page === 'account' && <AccountDashboard key={user?.id || 'guest'} navigate={navigate} user={user} onUserUpdate={setUser} />}
    {route.page === 'purchases' && <PurchaseHistory orders={purchases} onUpdateStatus={updatePurchaseStatus} navigate={navigate} />}
    {route.page === 'checkout' && <main className="container page-main"><div className="empty-state"><h2>Continue to checkout</h2><p>Review the items in your browser cart.</p><button className="button primary" onClick={() => loadCartCheckout().catch((error) => flash(error.message))}>Continue to Checkout</button></div></main>}
    {cartCheckout && <CheckoutModal items={cartCheckout.items} total={cartCheckout.total} onClose={() => setCartCheckout(null)} onConfirm={confirmCheckout} />}
    {directCheckoutItems && <CheckoutModal items={directCheckoutItems} total={directCheckoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)} directCheckout onClose={() => setDirectCheckoutItems(null)} onConfirm={confirmCheckout} />}
    {route.page === 'home' && <>{!isSearching && <><Hero /><CategoryStrip categories={categories} selectedCategory={selectedCategory} onSelect={chooseCategory} /></>}<main className="container home-catalog"><div className="catalog-toolbar"><div>{!isSearching && <p className="eyebrow">Find something lovely</p>}<h2>{isSearching || selectedCategory !== 'All' ? 'Your search results' : 'A few things to get you started'}</h2></div></div>{productGrid(searchedProducts, null)}{!isSearching && selectedCategory === 'All' && <div className="home-extra">{productGrid(products.filter((product) => product.quantity > 0 && product.quantity < 5), 'The last few, loved all the same', 'Almost gone')}{productGrid([...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4), 'Just found their way here', 'New arrivals')}</div>}</main>{!isSearching && <section className="seller-promo"><div className="container seller-promo-inner"><div><p className="eyebrow">A good thing starts somewhere</p><h2>Have something lovely to share?</h2><p>Give your pre-loved treasures or small-batch finds a place to be discovered.</p></div><button className="button dark" onClick={() => navigate('products')}>Open your little shop</button></div></section>}</>}
    {route.page === 'categories' && <main className="container page-main"><div className="page-title-row"><div><p className="eyebrow">Explore the collection</p><h1>{selectedCategory === 'All' ? 'Shop by category' : selectedCategory}</h1><p className="page-subtitle">Find everyday favorites, thoughtful details and a few happy surprises.</p></div><label className="sort-select">Category <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="All">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><div className="category-chip-row"><button className={selectedCategory === 'All' ? 'selected' : ''} onClick={() => setSelectedCategory('All')}>All categories</button>{categories.map((category) => <button className={selectedCategory === category ? 'selected' : ''} key={category} onClick={() => setSelectedCategory(category)}>{category}</button>)}</div>{productGrid(searchedProducts, null)}</main>}
    {route.page === 'deals' && <main className="container page-main"><div className="page-title-row"><div><p className="eyebrow">Worth a second look</p><h1>Today’s good deals</h1><p className="page-subtitle">Lovely finds at friendly prices, picked just for you.</p></div><span className="deal-count">✦ {products.filter((product) => product.price < 2000).length} picks under ₱2,000</span></div>{productGrid(searchedProducts.filter((product) => product.price < 2000), null)}</main>}
    {route.page === 'saved' && <main className="container page-main"><div className="page-title-row"><div><p className="eyebrow">Keep a little list</p><h1>Saved items</h1><p className="page-subtitle">Your lovely finds, all in one spot.</p></div></div>{productGrid(products.filter((product) => savedItems.includes(product.id)), null, 'Saved for later')}</main>}
    {route.page === 'products' && <SellerDashboard user={user} onProductsChange={applySellerProducts} />}
    {!['home', 'categories', 'deals', 'saved', 'products', 'cart', 'account', 'purchases', 'product'].includes(route.page) && <main className="container page-main"><div className="empty-state"><span className="empty-icon">✦</span><h2>There’s more to discover</h2><p>Let’s head back to all the good finds.</p><button className="button primary" onClick={() => navigate('home')}>Explore the marketplace</button></div></main>}
    <footer className="site-footer"><div className="container footer-main"><div className="footer-brand"><Brand navigate={navigate} /><p>A little marketplace for the<br />things you love.</p></div><div><h3>Discover</h3><button onClick={() => navigate('categories')}>Shop categories</button><button onClick={() => navigate('deals')}>Today’s deals</button></div><div><h3>Your Add2Cart</h3><button onClick={() => navigate('saved')}>Saved items</button><button onClick={() => navigate('products')}>My products</button></div><div className="footer-note"><span>Made for good finds</span><p>Add2Cart is a student marketplace demo.<br />Sample products and reviews are illustrative.</p></div></div><div className="container footer-bottom"><span>© 2026 Add2Cart Marketplace. All rights reserved.</span><span>Developed by: Mark Russell Cosa</span></div></footer>
  </div>
}
