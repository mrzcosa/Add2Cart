import { money, imageFallback } from '../utils/marketplace'

export default function ProductCard({ product, openProduct }) {
  return (
    <article className="product-card" onClick={(event) => {
      if (event.target.closest('button, a, input, select, textarea, [role="button"]')) return
      openProduct(product.id)
    }}>
      <div className={`product-image-wrap ${product.id === 'p-011' ? 'lego-product-image-wrap' : ''} ${product.id === 'p-007' ? 'aquaflask-image-wrap' : ''} ${product.id === 'p-002' ? 'cln-bag-image-wrap' : ''} ${product.id === 'p-010' ? 'desk-lamp-image-wrap' : ''}`} onClick={() => openProduct(product.id)} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && openProduct(product.id)} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.src = imageFallback }} />
        {product.price < 1500 && <span className="image-tag">Good find</span>}
      </div>
      <div className="product-info">
        <button className="product-name" onClick={() => openProduct(product.id)}>{product.name}</button>
        <div className="rating-line"><svg className="stars rating-star-icon" viewBox="0 0 24 24" role="img" aria-label={`${product.rating} out of 5 stars`}><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z" /></svg> {product.rating.toFixed(1)} <span className="review-count">({product.reviewCount})</span></div>
        <div className="product-price">{money(product.price)}</div>
        <div className="product-stock-summary"><span>{product.quantity} available</span><span>{product.soldCount ?? 0} sold</span></div>
      </div>
    </article>
  )
}
