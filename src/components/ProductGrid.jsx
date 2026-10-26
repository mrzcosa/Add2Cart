import ProductCard from './ProductCard'

export default function ProductGrid({ products, title, subtitle, selectedQuantities, setSelectedQuantity, addToCart, toggleSaved, savedItems, openProduct, emptyText = 'Try adjusting your search or choosing another category.' }) {
  return (
    <section className="catalog-section">
      {title && <div className="section-heading"><div><p className="eyebrow">{subtitle || 'Picked for you'}</p><h2>{title}</h2></div><span className="result-count">{products.length} {products.length === 1 ? 'item' : 'items'}</span></div>}
      {products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} selectedQty={selectedQuantities[product.id] || 1} setSelectedQty={(quantity) => setSelectedQuantity(product.id, quantity)} addToCart={addToCart} toggleSaved={toggleSaved} saved={savedItems.includes(product.id)} openProduct={openProduct} />)}</div> : <div className="empty-state"><span className="empty-icon">⌕</span><h3>No items found</h3><p>{emptyText}</p></div>}
    </section>
  )
}
