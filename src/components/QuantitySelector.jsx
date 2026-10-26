export default function QuantitySelector({ value, onChange, max, label = 'Quantity' }) {
  return (
    <div className="quantity-control" aria-label={label}>
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}>−</button>
      <output>{value}</output>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  )
}
