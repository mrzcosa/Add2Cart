import { useState } from 'react'
import { money, imageFallback } from '../utils/marketplace'
import QuantitySelector from './QuantitySelector'
import StockBadge from './StockBadge'

export default function CartView({ cartItems, products, setCartQuantity, removeFromCart, clearCart, continueShopping, openProduct, savedItems = [], saveForLater, onRequestCheckout }) {
  const lines = cartItems
    .map((item) => ({ ...item, product: products.find((product) => product.id === item.id) }))
    .filter((item) => item.product)
  const [selectedIds, setSelectedIds] = useState(null)
  const selectedIdsValue = selectedIds ?? lines.map((item) => item.id)

  const selectedLines = lines.filter((item) => selectedIdsValue.includes(item.id))
  const allSelected = lines.length > 0 && selectedLines.length === lines.length
  const selectedItemCount = selectedLines.reduce((sum, item) => sum + item.quantity, 0)
  const selectedTotal = selectedLines.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  return (
    <main className="page-main container cart-page">
      <div className="page-title-row cart-title-row">
        <div>
          <p className="eyebrow">Your bag</p>
          <h1>Shopping cart</h1>
          <p className="page-subtitle">Review your items before checkout.</p>
        </div>
        {lines.length > 0 && <button className="text-button danger-text" onClick={clearCart}>Clear cart</button>}
      </div>

      {!lines.length ? (
        <div className="empty-state cart-empty">
          <span className="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
          </span>
          <h2>Your cart is empty</h2>
          <p>Find something useful, lovely, or just right for you.</p>
          <button className="button primary" onClick={continueShopping}>Explore finds</button>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="cart-panel" aria-label="Cart items">
            <div className="cart-table-header">
              <label className="cart-select-all"><input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? lines.map((item) => item.id) : [])} /><span>Product</span></label>
              <span>Unit price</span>
              <span>Quantity</span>
              <span>Subtotal</span>
              <span>Actions</span>
            </div>
            <div className="cart-list-heading">
              <label className="cart-mobile-select-all"><input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? lines.map((item) => item.id) : [])} /><span>Select all</span></label>
              <strong>Items in your cart</strong>
              <span>{lines.reduce((sum, item) => sum + item.quantity, 0)} items</span>
            </div>
            {lines.map(({ product, quantity }) => {
              const isSaved = savedItems.includes(product.id)
              return (
                <article className="cart-line" key={product.id}>
                  <div className="cart-product-cell">
                    <input className="cart-item-checkbox" type="checkbox" aria-label={`Select ${product.name}`} checked={selectedIdsValue.includes(product.id)} onChange={(event) => setSelectedIds((selected) => {
                      const current = selected ?? lines.map((item) => item.id)
                      return event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id)
                    })} />
                    <button className="cart-thumb" onClick={() => openProduct(product.id)} aria-label={`View ${product.name}`}>
                      <img src={product.image} alt="" onError={(event) => { event.currentTarget.src = imageFallback }} />
                    </button>
                    <div className="cart-product">
                      <button className="product-name" onClick={() => openProduct(product.id)}>{product.name}</button>
                      <span>{product.category}</span>
                      <StockBadge quantity={product.quantity} />
                    </div>
                  </div>
                  <div className="cart-unit-price"><span>Unit price</span><strong>{money(product.price)}</strong></div>
                  <QuantitySelector value={quantity} onChange={(next) => setCartQuantity(product, next)} max={Math.max(1, product.quantity)} label={`Quantity of ${product.name}`} />
                  <div className="line-subtotal"><span>Subtotal</span><strong>{money(product.price * quantity)}</strong></div>
                  <div className="cart-actions">
                    <button className="text-button remove-link" onClick={() => removeFromCart(product.id)}>Remove</button>
                    <button className="text-button save-later-link" onClick={() => saveForLater(product)} disabled={isSaved}>{isSaved ? 'Saved for later' : 'Save for later'}</button>
                  </div>
                </article>
              )
            })}
          </section>

          <aside className="cart-summary">
            <div className="cart-summary-heading"><h2>Order summary</h2><span>{selectedItemCount} selected</span></div>
            <div className="summary-row"><span>Subtotal</span><strong>{money(selectedTotal)}</strong></div>
            <div className="summary-row"><span>Shipping</span><strong className="free-text">Free</strong></div>
            <div className="summary-total"><span>Estimated total</span><strong>{money(selectedTotal)}</strong></div>
            <p className="demo-note">Demo marketplace. No payment will be collected.</p>
            <button className="button primary full" disabled={selectedItemCount === 0} onClick={() => onRequestCheckout(selectedLines, selectedTotal)}>Proceed to Checkout</button>
            <button className="text-button continue-link" onClick={continueShopping}>Continue shopping</button>
          </aside>
        </div>
      )}
    </main>
  )
}
