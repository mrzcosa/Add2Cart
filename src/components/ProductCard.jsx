import { money, imageFallback } from '../utils/marketplace'
import QuantitySelector from './QuantitySelector'
import StockBadge from './StockBadge'

export default function ProductCard({ product, selectedQty, setSelectedQty, addToCart, toggleSaved, saved, openProduct }) {
  const unavailable = product.quantity < 1
  return (
    <article className="product-card">
      <div className={`product-image-wrap ${product.id === 'p-011' ? 'lego-product-image-wrap' : ''} ${product.id === 'p-007' ? 'aquaflask-image-wrap' : ''} ${product.id === 'p-002' ? 'cln-bag-image-wrap' : ''} ${product.id === 'p-010' ? 'desk-lamp-image-wrap' : ''}`} onClick={() => openProduct(product.id)} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && openProduct(product.id)} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.src = imageFallback }} />
        <button className={`save-button ${saved ? 'is-saved' : ''}`} aria-label={saved ? 'Remove from saved items' : 'Save item'} onClick={(event) => { event.stopPropagation(); toggleSaved(product.id) }}>{saved ? '♥' : '♡'}</button>
        {product.price < 1500 && <span className="image-tag">Good find</span>}
      </div>
      <div className="product-info">
        <button className="text-link category-link" onClick={() => openProduct(product.id)}>{product.category}</button>
        <button className="product-name" onClick={() => openProduct(product.id)}>{product.name}</button>
        <div className="rating-line"><span className="stars" aria-label={`${product.rating} out of 5 stars`}>★</span> {product.rating.toFixed(1)} <span className="review-count">({product.reviewCount})</span></div>
        <button className="view-details-link" onClick={() => openProduct(product.id)}>View details <span aria-hidden="true">↗</span></button>
        <div className="product-price">{money(product.price)}</div>
        <StockBadge quantity={product.quantity} />
        <div className="subtotal-line"><span>Subtotal · {selectedQty} {selectedQty === 1 ? 'item' : 'items'}</span><strong>{money(product.price * selectedQty)}</strong></div>
        <div className="card-actions"><QuantitySelector value={selectedQty} onChange={setSelectedQty} max={Math.max(1, product.quantity)} /><button className="button primary compact" onClick={() => addToCart(product, selectedQty)} disabled={unavailable}>Add to cart</button></div>
      </div>
    </article>
  )
}
