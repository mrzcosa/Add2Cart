import { useState } from 'react'
import { categories as defaultCategories } from '../data/initialProducts'

const blank = { image: '', name: '', category: '', description: '', specifications: '', rating: '', price: '', quantity: '' }
const fields = [
  ['image', 'Feature image URL', 'url', 'https://example.com/product.jpg'],
  ['name', 'Product name', 'text', 'e.g. Everyday crossbody bag'],
  ['category', 'Category', 'text', 'Choose or add a category'],
  ['description', 'Description', 'textarea', 'Tell shoppers what makes this item useful.'],
  ['specifications', 'Specifications', 'textarea', 'One specification per line'],
  ['rating', 'Rating (1–5)', 'number', '4.5'],
  ['price', 'Price (PHP)', 'number', '1290'],
  ['quantity', 'Available quantity', 'number', '10'],
]

function validate(values) {
  const errors = {}
  if (!values.image.trim()) errors.image = 'Add a product image URL.'
  else { try { const url = new URL(values.image); if (!['http:', 'https:'].includes(url.protocol)) errors.image = 'Use an http or https image URL.' } catch { errors.image = 'Enter a valid image URL.' } }
  if (!values.name.trim()) errors.name = 'Enter a product name.'
  if (!values.category.trim()) errors.category = 'Enter or choose a category.'
  if (!values.description.trim()) errors.description = 'Add a product description.'
  if (!values.specifications.trim()) errors.specifications = 'Add at least one specification.'
  const rating = Number(values.rating)
  if (values.rating === '' || !Number.isFinite(rating) || rating < 1 || rating > 5) errors.rating = 'Rating must be from 1 to 5.'
  const price = Number(values.price)
  if (values.price === '' || !Number.isFinite(price) || price <= 0) errors.price = 'Price must be greater than ₱0.'
  const quantity = Number(values.quantity)
  if (values.quantity === '' || !Number.isInteger(quantity) || quantity < 0) errors.quantity = 'Quantity must be a whole number of 0 or more.'
  return errors
}

export default function ProductForm({ onSave, editingProduct, onCancelEdit, allCategories }) {
  const [values, setValues] = useState(() => editingProduct ? Object.fromEntries(Object.keys(blank).map((key) => [key, String(editingProduct[key] ?? '')])) : blank)
  const [errors, setErrors] = useState({})

  function submit(event) {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSave({ ...values, rating: Number(values.rating), price: Number(values.price), quantity: Number(values.quantity) })
    if (!editingProduct) { setValues(blank); setErrors({}) }
  }

  return (
    <form className="product-form" onSubmit={submit} noValidate>
      <div className="form-heading"><div><p className="eyebrow">Your shop</p><h2>{editingProduct ? 'Edit your listing' : 'Add a new listing'}</h2><p>Share the details shoppers need to make a good choice.</p></div>{editingProduct && <button type="button" className="button outline small" onClick={onCancelEdit}>Cancel edit</button>}</div>
      <div className="form-grid">{fields.map(([key, label, type, placeholder]) => <label className={`form-field ${type === 'textarea' ? 'wide' : ''}`} key={key}>
        <span>{label}<i aria-hidden="true"> *</i></span>
        {key === 'category' ? <><input list="product-categories" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} placeholder={placeholder} aria-invalid={Boolean(errors[key])} /><datalist id="product-categories">{[...new Set([...defaultCategories, ...allCategories])].map((category) => <option key={category} value={category} />)}</datalist></> : type === 'textarea' ? <textarea rows={key === 'description' ? 3 : 2} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} placeholder={placeholder} aria-invalid={Boolean(errors[key])} /> : <input type={type} min={key === 'rating' ? '1' : key === 'quantity' ? '0' : key === 'price' ? '0.01' : undefined} max={key === 'rating' ? '5' : undefined} step={key === 'rating' || key === 'price' ? '0.01' : key === 'quantity' ? '1' : undefined} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} placeholder={placeholder} aria-invalid={Boolean(errors[key])} />}
        {errors[key] && <small className="field-error" role="alert">{errors[key]}</small>}
      </label>)}</div>
      <div className="form-bottom"><p>* All listing details are required. Ratings range from 1 to 5.</p><button className="button primary" type="submit">{editingProduct ? 'Save changes' : 'Publish listing'} <span aria-hidden="true">→</span></button></div>
    </form>
  )
}
