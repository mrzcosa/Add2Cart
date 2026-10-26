import { money, imageFallback } from '../utils/marketplace'
import QuantitySelector from './QuantitySelector'
import StockBadge from './StockBadge'

export default function CartView({ cartItems, products, overallTotal, setCartQuantity, removeFromCart, clearCart, continueShopping, openProduct }) {
  const lines = cartItems.map((item) => ({ ...item, product: products.find((product) => product.id === item.id) })).filter((item) => item.product)
  return (
    <main className="page-main container">
      <div className="page-title-row"><div><p className="eyebrow">Your bag</p><h1>Shopping cart</h1><p className="page-subtitle">A few good finds, ready when you are.</p></div>{lines.length > 0 && <button className="text-button danger-text" onClick={clearCart}>Clear cart</button>}</div>
      {!lines.length ? <div className="empty-state cart-empty"><span className="empty-icon">🛍</span><h2>Your cart is taking a little break</h2><p>Find something useful, lovely or just right for you.</p><button className="button primary" onClick={continueShopping}>Explore finds <span aria-hidden="true">→</span></button></div> : <div className="cart-layout"><section className="cart-lines" aria-label="Cart items">{lines.map(({ product, quantity }) => <article className="cart-line" key={product.id}>
        <button className="cart-thumb" onClick={() => openProduct(product.id)} aria-label={`View ${product.name}`}><img src={product.image} alt="" onError={(event) => { event.currentTarget.src = imageFallback }} /></button>
        <div className="cart-product"><button className="product-name" onClick={() => openProduct(product.id)}>{product.name}</button><span>{product.category}</span><StockBadge quantity={product.quantity} /><div className="cart-mobile-price">{money(product.price)} each</div></div>
        <QuantitySelector value={quantity} onChange={(next) => setCartQuantity(product, next)} max={Math.max(1, product.quantity + quantity)} label={`Quantity of ${product.name}`} />
        <div className="line-subtotal"><span>Subtotal</span><strong>{money(product.price * quantity)}</strong><button className="text-button remove-link" onClick={() => removeFromCart(product.id)}>Remove</button></div>
      </article>)}</section>
      <aside className="cart-summary"><h2>Order summary</h2><div className="summary-row"><span>Items ({lines.reduce((sum, item) => sum + item.quantity, 0)})</span><strong>{money(overallTotal)}</strong></div><div className="summary-row"><span>Shipping</span><strong className="free-text">Free</strong></div><div className="summary-total"><span>Estimated total</span><strong>{money(overallTotal)}</strong></div><p className="demo-note">Demo marketplace · no payment will be collected.</p><button className="button primary full" onClick={() => window.alert('Thanks for browsing! Checkout is a demo and no payment was collected.')}>Continue to checkout <span aria-hidden="true">→</span></button><button className="text-button continue-link" onClick={continueShopping}>← Continue shopping</button></aside></div>}
    </main>
  )
}
