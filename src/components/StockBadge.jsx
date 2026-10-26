export default function StockBadge({ quantity }) {
  if (quantity <= 0) return <span className="stock-badge out">Out of stock</span>
  if (quantity < 5) return <span className="stock-badge low">Low stock · {quantity} left</span>
  return <span className="stock-badge in">{quantity} available</span>
}
