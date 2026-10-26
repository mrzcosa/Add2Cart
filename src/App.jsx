import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import ProductGrid from './components/ProductGrid'
import ProductForm from './components/ProductForm'
import CartView from './components/CartView'
import Brand from './components/Brand'
import QuantitySelector from './components/QuantitySelector'
import StockBadge from './components/StockBadge'
import CategoryIcon from './components/CategoryIcon'
import djiHeroImage from './assets/Hero Banner/DJI Osmo Action 6.png'
import iphoneHeroImage from './assets/Hero Banner/Iphone 17 Pro.png'
import clnHeroImage from './assets/Hero Banner/CLN.png'
import { categories as seedCategories, initialProducts } from './data/initialProducts'
import { imageFallback, money, readStorage, writeStorage } from './utils/marketplace'

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
  return <section className="category-strip container"><div className="category-strip-top"><div><p className="eyebrow">A world of good finds</p><h2>Shop what speaks to you</h2></div><span>Browse all {categories.length} categories <span aria-hidden="true">→</span></span></div><div className="category-scroller">{categories.map((category, index) => <button key={category} className={`category-tile tint-${index} ${selectedCategory === category ? 'selected' : ''}`} onClick={() => onSelect(category)}><span className="category-icon"><CategoryIcon category={category} /></span><strong>{category}</strong></button>)}</div></section>
}

function ProductDetails({ product, products, quantity, setQuantity, addToCart, openProduct, setCategory }) {
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4)
  return <main className="container page-main details-page"><div className="breadcrumbs"><button onClick={() => { window.location.hash = '#home' }}>Home</button><span>/</span><button onClick={() => setCategory(product.category)}>{product.category}</button><span>/</span><span>{product.name}</span></div><section className="details-layout"><div className={`details-photo ${product.id === 'p-011' ? 'lego-product-photo' : ''} ${product.id === 'p-007' ? 'aquaflask-product-photo' : ''} ${product.id === 'p-002' ? 'cln-bag-product-photo' : ''} ${product.id === 'p-010' ? 'desk-lamp-product-photo' : ''}`}><img src={product.image} alt={product.name} onError={(event) => { event.currentTarget.src = imageFallback }} /></div><div className="details-copy"><p className="eyebrow">{product.category} <span className="seller-dot">·</span> Add2Cart marketplace</p><h1>{product.name}</h1><div className="rating-line detail-rating"><span className="stars">★★★★★</span> {product.rating.toFixed(1)} <span className="review-count">({product.reviewCount} shopper reviews)</span></div><div className="detail-price">{money(product.price)}</div><p className="detail-description">{product.description}</p><StockBadge quantity={product.quantity} /><div className="detail-buy-row"><span>Quantity</span><QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, product.quantity)} /><span className="detail-subtotal">Subtotal <strong>{money(product.price * quantity)}</strong></span></div><button className="button primary detail-add" onClick={() => addToCart(product, quantity)} disabled={product.quantity <= 0}>Add to cart <span aria-hidden="true">→</span></button><div className="shipping-promise"><span>✓</span><div><strong>A little peace of mind</strong><p>Secure checkout · Free shipping on select finds</p></div></div><div className="specification-box"><h2>Details worth knowing</h2><ul>{product.specifications.split('\n').filter(Boolean).map((specification) => <li key={specification}>{specification}</li>)}</ul></div></div></section>{related.length > 0 && <ProductGrid title="More finds you might love" subtitle={`From ${product.category}`} products={related} selectedQuantities={{}} setSelectedQuantity={() => {}} addToCart={addToCart} toggleSaved={() => {}} savedItems={[]} openProduct={openProduct} />}</main>
}

export default function App() {
  const [products, setProducts] = useState(safeProducts)
  const [cartItems, setCartItems] = useState(safeCart)
  const [savedItems, setSavedItems] = useState(() => { const saved = readStorage('findly-saved-v1', []); return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [] })
  const [selectedQuantities, setSelectedQuantities] = useState({})
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [route, setRoute] = useState(getRoute)
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [detailQuantity, setDetailQuantity] = useState(1)

  useEffect(() => { writeStorage('findly-products-v1', products) }, [products])
  useEffect(() => { writeStorage('findly-cart-v1', cartItems) }, [cartItems])
  useEffect(() => { writeStorage('findly-saved-v1', savedItems) }, [savedItems])
  useEffect(() => { const sync = () => { setRoute(getRoute()); window.scrollTo({ top: 0, behavior: 'smooth' }) }; window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync) }, [])

  const categories = useMemo(() => [...new Set([...seedCategories, ...products.map((product) => product.category).filter(Boolean)])], [products])
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)
  const overallTotal = cartItems.reduce((total, item) => { const product = products.find((candidate) => candidate.id === item.id); return total + (product ? product.price * item.quantity : 0) }, 0)
  const searchedProducts = useMemo(() => products.filter((product) => {
    const text = `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase()
    return (selectedCategory === 'All' || product.category === selectedCategory) && (!query.trim() || text.includes(query.trim().toLocaleLowerCase()))
  }), [products, query, selectedCategory])
  const detailProduct = products.find((product) => product.id === route.id)
  const sellerProducts = products.filter((product) => !initialProducts.some((seed) => seed.id === product.id))

  function navigate(page) { window.location.hash = `#${page}` }
  function openProduct(id) { setDetailQuantity(1); window.location.hash = `#product/${id}` }
  function chooseCategory(category) { setSelectedCategory(category); setQuery(''); navigate('categories') }
  function setSelectedQuantity(id, quantity) { setSelectedQuantities((current) => ({ ...current, [id]: quantity })) }
  function flash(message) { setNotice(message); window.setTimeout(() => setNotice(''), 3400) }

  function addToCart(product, quantity = 1) {
    if (product.quantity < 1) { flash('This find is currently out of stock.'); return }
    const amount = Math.min(Math.max(1, quantity), product.quantity)
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity - amount } : item))
    setCartItems((current) => { const found = current.find((item) => item.id === product.id); return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + amount } : item) : [...current, { id: product.id, quantity: amount }] })
    setSelectedQuantity(product.id, 1)
    flash(`${product.name} added to your cart.`)
  }

  function setCartQuantity(product, next) {
    const existing = cartItems.find((item) => item.id === product.id)
    if (!existing) return
    const quantity = Math.max(1, Math.min(next, existing.quantity + product.quantity))
    if (quantity === existing.quantity) return
    const difference = quantity - existing.quantity
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity - difference } : item))
    setCartItems((current) => current.map((item) => item.id === product.id ? { ...item, quantity } : item))
  }

  function removeFromCart(id) {
    const item = cartItems.find((candidate) => candidate.id === id)
    if (!item) return
    setProducts((current) => current.map((product) => product.id === id ? { ...product, quantity: product.quantity + item.quantity } : product))
    setCartItems((current) => current.filter((candidate) => candidate.id !== id))
  }

  function clearCart() {
    if (!window.confirm('Clear all items from your cart?')) return
    setProducts((current) => current.map((product) => { const reserved = cartItems.find((item) => item.id === product.id)?.quantity || 0; return reserved ? { ...product, quantity: product.quantity + reserved } : product }))
    setCartItems([])
  }

  function toggleSaved(id) { setSavedItems((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }

  function saveProduct(values) {
    if (editingId) { setProducts((current) => current.map((product) => product.id === editingId ? { ...product, ...values } : product)); setEditingId(null); flash('Your listing has been updated.') }
    else { const product = { ...values, id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, reviewCount: 0, createdAt: new Date().toISOString().slice(0, 10) }; setProducts((current) => [product, ...current]); flash('Your new listing is live.') }
  }

  function deleteProduct(product) {
    if (!window.confirm(`Delete “${product.name}” from your listings?`)) return
    const reserved = cartItems.find((item) => item.id === product.id)?.quantity || 0
    setProducts((current) => current.filter((item) => item.id !== product.id))
    setCartItems((current) => current.filter((item) => item.id !== product.id))
    setSavedItems((current) => current.filter((id) => id !== product.id))
    setEditingId(null)
    if (reserved) flash('Listing deleted and its cart reservation removed.')
  }

  function productGrid(productsToShow, title, subtitle) { return <ProductGrid products={productsToShow} title={title} subtitle={subtitle} selectedQuantities={selectedQuantities} setSelectedQuantity={setSelectedQuantity} addToCart={addToCart} toggleSaved={toggleSaved} savedItems={savedItems} openProduct={openProduct} /> }

  return <div className="app-shell"><Header route={route} query={query} setQuery={setQuery} category={selectedCategory} setCategory={setSelectedCategory} categories={categories} cartCount={cartCount} navigate={navigate} />
    {notice && <div className="toast" role="status">✓ <span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
    {route.page === 'product' && detailProduct && <ProductDetails product={detailProduct} products={products} quantity={detailQuantity} setQuantity={setDetailQuantity} addToCart={addToCart} openProduct={openProduct} setCategory={chooseCategory} />}
    {route.page === 'product' && !detailProduct && <main className="container page-main"><div className="empty-state"><h2>That listing has moved on</h2><p>Try another find from the collection.</p><button className="button primary" onClick={() => navigate('home')}>Back to home</button></div></main>}
    {route.page === 'cart' && <CartView cartItems={cartItems} products={products} overallTotal={overallTotal} setCartQuantity={setCartQuantity} removeFromCart={removeFromCart} clearCart={clearCart} continueShopping={() => navigate('home')} openProduct={openProduct} />}
    {route.page === 'home' && <><Hero /><CategoryStrip categories={categories} selectedCategory={selectedCategory} onSelect={chooseCategory} /><main className="container home-catalog"><div className="catalog-toolbar"><div><p className="eyebrow">Find something lovely</p><h2>{query || selectedCategory !== 'All' ? 'Your search results' : 'A few things to get you started'}</h2></div><label className="sort-select">Sort by <select onChange={(event) => { const mode = event.target.value; setProducts((current) => [...current].sort((a, b) => mode === 'price-low' ? a.price - b.price : mode === 'price-high' ? b.price - a.price : a.name.localeCompare(b.name))) }}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></label></div>{productGrid(searchedProducts, null)}{!query && selectedCategory === 'All' && <div className="home-extra">{productGrid(products.filter((product) => product.quantity > 0 && product.quantity < 5), 'The last few, loved all the same', 'Almost gone')}{productGrid([...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4), 'Just found their way here', 'New arrivals')}</div>}</main><section className="seller-promo"><div className="container seller-promo-inner"><div><p className="eyebrow">A good thing starts somewhere</p><h2>Have something lovely to share?</h2><p>Give your pre-loved treasures or small-batch finds a place to be discovered.</p></div><button className="button dark" onClick={() => navigate('products')}>Open your little shop <span aria-hidden="true">→</span></button></div></section></>}
    {route.page === 'categories' && <main className="container page-main"><div className="page-title-row"><div><p className="eyebrow">Explore the collection</p><h1>{selectedCategory === 'All' ? 'Shop by category' : selectedCategory}</h1><p className="page-subtitle">Find everyday favorites, thoughtful details and a few happy surprises.</p></div><label className="sort-select">Category <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="All">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><div className="category-chip-row"><button className={selectedCategory === 'All' ? 'selected' : ''} onClick={() => setSelectedCategory('All')}>All categories</button>{categories.map((category) => <button className={selectedCategory === category ? 'selected' : ''} key={category} onClick={() => setSelectedCategory(category)}>{category}</button>)}</div>{productGrid(searchedProducts, null)}</main>}
    {route.page === 'deals' && <main className="container page-main"><div className="page-title-row"><div><p className="eyebrow">Worth a second look</p><h1>Today’s good deals</h1><p className="page-subtitle">Lovely finds at friendly prices, picked just for you.</p></div><span className="deal-count">✦ {products.filter((product) => product.price < 2000).length} picks under ₱2,000</span></div>{productGrid(searchedProducts.filter((product) => product.price < 2000), null)}</main>}
    {route.page === 'saved' && <main className="container page-main"><div className="page-title-row"><div><p className="eyebrow">Keep a little list</p><h1>Saved items</h1><p className="page-subtitle">Your lovely finds, all in one spot.</p></div></div>{productGrid(products.filter((product) => savedItems.includes(product.id)), null, 'Saved for later')}</main>}
    {route.page === 'products' && <main className="container page-main seller-page"><div className="page-title-row"><div><p className="eyebrow">Your corner of Findly</p><h1>My products</h1><p className="page-subtitle">Manage your listings and welcome something new.</p></div><span className="seller-count">{sellerProducts.length} {sellerProducts.length === 1 ? 'listing' : 'listings'} live</span></div><ProductForm key={editingId || 'new-listing'} onSave={saveProduct} editingProduct={products.find((product) => product.id === editingId)} onCancelEdit={() => setEditingId(null)} allCategories={categories} />{sellerProducts.length > 0 && <section className="seller-list"><div className="section-heading"><div><p className="eyebrow">Your listings</p><h2>Looking good so far</h2></div></div><div className="seller-table">{sellerProducts.map((product) => <article key={product.id} className="seller-row"><button className="seller-thumb" onClick={() => openProduct(product.id)}><img src={product.image} alt="" onError={(event) => { event.currentTarget.src = imageFallback }} /></button><div className="seller-name"><button className="product-name" onClick={() => openProduct(product.id)}>{product.name}</button><span>{product.category} · {money(product.price)}</span></div><StockBadge quantity={product.quantity} /><div className="seller-actions"><button className="button outline small" onClick={() => { setEditingId(product.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button><button className="button delete small" onClick={() => deleteProduct(product)}>Delete</button></div></article>)}</div></section>}</main>}
    {!['home', 'categories', 'deals', 'saved', 'products', 'cart', 'product'].includes(route.page) && <main className="container page-main"><div className="empty-state"><span className="empty-icon">✦</span><h2>There’s more to discover</h2><p>Let’s head back to all the good finds.</p><button className="button primary" onClick={() => navigate('home')}>Explore the marketplace</button></div></main>}
    <footer className="site-footer"><div className="container footer-main"><div className="footer-brand"><Brand navigate={navigate} /><p>A little marketplace for the<br />things you love.</p></div><div><h3>Discover</h3><button onClick={() => navigate('categories')}>Shop categories</button><button onClick={() => navigate('deals')}>Today’s deals</button></div><div><h3>Your Add2Cart</h3><button onClick={() => navigate('saved')}>Saved items</button><button onClick={() => navigate('products')}>My products</button></div><div className="footer-note"><span>Made for good finds</span><p>Add2Cart is a student marketplace demo.<br />Sample products and reviews are illustrative.</p></div></div><div className="container footer-bottom"><span>© 2026 Add2Cart marketplace demo</span><span>Made with care in the Philippines · ₱ PHP</span></div></footer>
  </div>
}
