import { useCallback, useEffect, useState } from 'react'
import ProductForm from './ProductForm'
import { categories } from '../data/initialProducts'
import { localStoreOperation } from '../utils/localStore'
import { imageFallback, money } from '../utils/marketplace'

export default function SellerDashboard({ user, onProductsChange }) {
  const [profile, setProfile] = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(Boolean(user))
  const [error, setError] = useState('')
  const [storeName, setStoreName] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const loadSellerData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const { profile: sellerProfile } = await localStoreOperation('/seller/profile')
      setProfile(sellerProfile)
      if (sellerProfile?.approvalStatus === 'approved') {
        const [productResponse, orderResponse, stats] = await Promise.all([
          localStoreOperation('/seller/products'), localStoreOperation('/seller/orders'), localStoreOperation('/seller/analytics'),
        ])
        setProducts(productResponse.products)
        setOrders(orderResponse.orders)
        setAnalytics(stats)
        onProductsChange(productResponse.products)
      } else {
        setProducts([])
        setOrders([])
        setAnalytics(null)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [user, onProductsChange])

  useEffect(() => {
    const task = window.setTimeout(loadSellerData, 0)
    return () => window.clearTimeout(task)
  }, [loadSellerData])

  async function applyForSeller(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const result = await localStoreOperation('/seller/profile', { method: 'POST', body: { storeName, description: storeDescription } })
      setProfile(result.profile)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function resubmitApplication() {
    setSubmitting(true)
    setError('')
    try {
      const result = await localStoreOperation('/seller/profile', { method: 'PATCH', body: { storeName: profile.storeName, description: profile.description, resubmit: true } })
      setProfile(result.profile)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function saveProduct(values) {
    const result = editingProduct
      ? await localStoreOperation(`/products/${encodeURIComponent(editingProduct.id)}`, { method: 'PATCH', body: values })
      : await localStoreOperation('/products', { method: 'POST', body: values })
    setProducts((current) => editingProduct ? current.map((item) => item.id === result.product.id ? result.product : item) : [result.product, ...current])
    onProductsChange([result.product])
    setEditingProduct(null)
    return result.product
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Remove “${product.name}” from your store?`)) return
    try {
      await localStoreOperation(`/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' })
      setProducts((current) => current.filter((item) => item.id !== product.id))
      onProductsChange([], product.id)
      setEditingProduct(null)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function shipOrder(order) {
    try {
      const result = await localStoreOperation(`/seller/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: { action: 'ship' } })
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...result.order } : item))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return <main className="container page-main seller-page">
    <div className="page-title-row"><div><p className="eyebrow">Your corner of Add2Cart</p><h1>My products</h1><p className="page-subtitle">Manage your store, listings, inventory, and orders.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!user ? <div className="empty-state"><h2>Guest store unavailable</h2><p>Your local shopper profile could not be loaded.</p></div> : loading ? <p role="status">Loading your seller dashboard…</p> : !profile ? <section className="account-content seller-application"><p className="eyebrow">Start selling</p><h2>Open a store</h2><p className="page-subtitle">Your demo store and listings are saved in this browser.</p><form className="product-form" onSubmit={applyForSeller}><div className="form-grid"><label className="form-field"><span>Store name *</span><input value={storeName} onChange={(event) => setStoreName(event.target.value)} required minLength="2" maxLength="100" /></label><label className="form-field wide"><span>Store description</span><textarea rows="3" value={storeDescription} onChange={(event) => setStoreDescription(event.target.value)} maxLength="1000" /></label></div><div className="form-bottom"><p>Your listings will appear in the marketplace immediately.</p><button className="button primary" disabled={submitting}>{submitting ? 'Saving…' : 'Open store'}</button></div></form></section> : profile.approvalStatus !== 'approved' ? <section className="account-content seller-application"><p className="eyebrow">Seller application</p><h2>{profile.storeName}</h2><p className="page-subtitle">Status: <strong>{profile.approvalStatus}</strong></p><p>{profile.approvalStatus === 'pending' ? 'Your application is waiting for review.' : 'Your application was not approved.'}</p>{profile.approvalStatus === 'rejected' && <button className="button primary" onClick={resubmitApplication} disabled={submitting}>{submitting ? 'Saving…' : 'Resubmit application'}</button>}</section> : <>
      <section className="seller-metrics" aria-label="Store metrics">{[['Published products', analytics?.products ?? 0], ['Units sold', analytics?.unitsSold ?? 0], ['Orders', analytics?.orderCount ?? 0], ['Gross sales', money(analytics?.grossSales ?? 0)]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <ProductForm key={editingProduct?.id || 'new-listing'} onSave={saveProduct} editingProduct={editingProduct} onCancelEdit={() => setEditingProduct(null)} allCategories={categories} />
      <section className="seller-list"><div className="section-heading"><div><p className="eyebrow">Your listings</p><h2>Store products</h2></div><span className="seller-count">{products.length} listings</span></div>{products.length ? <div className="seller-table">{products.map((product) => <article key={product.id} className="seller-row"><span className="seller-thumb"><img src={product.image || imageFallback} alt="" onError={(event) => { event.currentTarget.src = imageFallback }} /></span><div className="seller-name"><strong>{product.name}</strong><span>{product.category} · {money(product.price)}</span></div><span className="seller-count">{product.quantity} in stock</span><div className="seller-actions"><button className="button outline small" onClick={() => { setEditingProduct(product); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button><button className="button delete small" onClick={() => deleteProduct(product)}>Archive</button></div></article>)}</div> : <p className="empty-state">Your store has no published listings yet.</p>}</section>
      <section className="seller-list"><div className="section-heading"><div><p className="eyebrow">Fulfillment</p><h2>Customer orders</h2></div></div>{orders.length ? <div className="seller-table">{orders.map((order) => <article className="purchase-card" key={order.id}><header className="purchase-card-header"><span className="purchase-order-label">Order {order.orderNumber}</span><span className="purchase-status">{order.status}</span></header><p>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</p><p>Deliver to {order.address.fullName} · {order.address.street}, {order.address.region}</p><div className="seller-actions"><strong>{money(order.total)}</strong>{order.items.some((item) => item.fulfillmentStatus === 'To Ship') && order.status === 'To Ship' && <button className="button primary small" onClick={() => shipOrder(order)}>Mark shipped</button>}</div></article>)}</div> : <p className="empty-state">Orders for your products will appear here.</p>}</section>
    </>}
  </main>
}
