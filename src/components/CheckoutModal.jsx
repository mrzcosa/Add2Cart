import { useEffect, useRef, useState } from 'react'
import { money, imageFallback } from '../utils/marketplace'
import { apiRequest, newIdempotencyKey } from '../utils/api'

const steps = ['Delivery address', 'Payment method', 'Review order']

export default function CheckoutModal({ items, total, onClose, onConfirm, directCheckout = false }) {
  const [step, setStep] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [address, setAddress] = useState({ fullName: '', phone: '', region: '', postalCode: '', street: '', label: 'Home' })
  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [complete, setComplete] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const closeButtonRef = useRef(null)
  const orderRequestKey = useRef(newIdempotencyKey())

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    apiRequest('/api/addresses').then(({ addresses }) => {
      setSavedAddresses(addresses)
      const defaultAddress = addresses.find((item) => item.isDefault)
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id)
        setAddress({ fullName: defaultAddress.fullName, phone: defaultAddress.phone, region: defaultAddress.region, postalCode: defaultAddress.postalCode, street: defaultAddress.street, label: defaultAddress.label })
      }
    }).catch(() => {})
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const updateAddress = (event) => setAddress((current) => ({ ...current, [event.target.name]: event.target.value }))
  const chooseAddress = (event) => {
    const id = event.target.value
    setSelectedAddressId(id)
    const saved = savedAddresses.find((item) => item.id === id)
    if (saved) setAddress({ fullName: saved.fullName, phone: saved.phone, region: saved.region, postalCode: saved.postalCode, street: saved.street, label: saved.label })
    else setAddress({ fullName: '', phone: '', region: '', postalCode: '', street: '', label: 'Home' })
  }
  async function continueWithAddress(event) {
    event.preventDefault()
    if (savingAddress) return
    setSavingAddress(true)
    setCheckoutError('')
    try {
      const payload = { ...address, isDefault: true }
      let result
      if (selectedAddressId) {
        result = await apiRequest(`/api/addresses/${encodeURIComponent(selectedAddressId)}`, { method: 'PATCH', body: payload })
      } else {
        const normalized = (value) => String(value || '').trim().toLowerCase()
        const duplicate = savedAddresses.find((saved) => ['fullName', 'phone', 'region', 'postalCode', 'street', 'label'].every((field) => normalized(saved[field]) === normalized(address[field])))
        if (duplicate) {
          result = await apiRequest(`/api/addresses/${encodeURIComponent(duplicate.id)}/default`, { method: 'PATCH', body: {} })
          setSelectedAddressId(duplicate.id)
        } else {
          result = await apiRequest('/api/addresses', { method: 'POST', body: payload })
        }
      }
      setSavedAddresses(result.addresses || [])
      const current = (result.addresses || []).find((saved) => saved.isDefault) || (result.addresses || []).find((saved) => saved.id === selectedAddressId)
      if (current) {
        setSelectedAddressId(current.id)
        setAddress({ fullName: current.fullName, phone: current.phone, region: current.region, postalCode: current.postalCode, street: current.street, label: current.label })
      }
      setStep(1)
    } catch (error) {
      setCheckoutError(error.message || 'We could not save this delivery address. Please try again.')
    } finally {
      setSavingAddress(false)
    }
  }
  const paymentLabel = paymentMethod === 'cod' ? 'Cash on delivery' : 'E-wallet'

  async function confirmOrder() {
    if (confirming) return
    setConfirming(true)
    setCheckoutError('')
    try {
      await onConfirm({ items, total, address, paymentMethod, direct: directCheckout, idempotencyKey: orderRequestKey.current })
      setComplete(true)
    } catch (error) {
      setCheckoutError(error.message || 'We could not place your order. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="checkout-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <header className="checkout-modal-header">
          <div>
            <p className="eyebrow">Add2Cart checkout</p>
            <h2 id="checkout-title">{complete ? 'Checkout confirmed' : steps[step]}</h2>
          </div>
          <button ref={closeButtonRef} className="checkout-close" type="button" onClick={onClose} aria-label="Close checkout">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        {!complete && <div className="checkout-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((label, index) => <div className={`checkout-progress-step ${index <= step ? 'current' : ''}`} key={label}><span>{index + 1}</span><small>{label}</small></div>)}
        </div>}

        {complete ? (
          <div className="checkout-complete" role="status">
            <span className="checkout-success-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></span>
            <h3>Your order has been placed</h3>
            <p>View the order and its latest status under My Purchases.</p>
            <button className="button primary" type="button" onClick={onClose}>Continue</button>
          </div>
        ) : step === 0 ? (
          <form className="checkout-form" onSubmit={continueWithAddress}>
            <p className="checkout-intro">Add the delivery details for your selected items.</p>
            <div className="checkout-field-grid">
              {savedAddresses.length > 0 && <label className="checkout-field full-width"><span>Saved delivery address</span><select value={selectedAddressId} onChange={chooseAddress}><option value="">Enter a new address</option>{savedAddresses.map((saved) => <option key={saved.id} value={saved.id}>{saved.label} — {saved.fullName}, {saved.region}</option>)}</select></label>}
              <label className="checkout-field"><span>Full name</span><input autoComplete="name" name="fullName" value={address.fullName} onChange={updateAddress} placeholder="Full name" required /></label>
              <label className="checkout-field"><span>Phone number</span><input autoComplete="tel" name="phone" type="tel" value={address.phone} onChange={updateAddress} placeholder="09XX XXX XXXX" required /></label>
              <label className="checkout-field full-width"><span>Region, province, city, barangay</span><input autoComplete="address-level1" name="region" value={address.region} onChange={updateAddress} placeholder="Region, Province, City, Barangay" required /></label>
              <label className="checkout-field"><span>Postal code</span><input autoComplete="postal-code" name="postalCode" value={address.postalCode} onChange={updateAddress} placeholder="Postal code" required /></label>
              <label className="checkout-field"><span>Address label</span><select name="label" value={address.label} onChange={updateAddress}><option>Home</option><option>Work</option></select></label>
              <label className="checkout-field full-width"><span>Street, building, house number</span><textarea autoComplete="street-address" name="street" value={address.street} onChange={updateAddress} placeholder="Street name, building, house number" rows="2" required /></label>
            </div>
            {checkoutError && <p className="auth-error" role="alert">{checkoutError}</p>}
            <div className="checkout-modal-actions"><button className="text-button" type="button" onClick={onClose} disabled={savingAddress}>Cancel</button><button className="button primary" type="submit" disabled={savingAddress}>{savingAddress ? 'Saving…' : 'Continue'}</button></div>
          </form>
        ) : step === 1 ? (
          <div className="checkout-step-content">
            <p className="checkout-intro">Choose how you want to pay for your order.</p>
            <div className="payment-options" role="radiogroup" aria-label="Payment method">
              <label className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`}><input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} /><span><strong>Cash on delivery</strong><small>Pay when the delivery arrives.</small></span></label>
              <label className={`payment-option ${paymentMethod === 'ewallet' ? 'selected' : ''}`}><input type="radio" name="payment" value="ewallet" checked={paymentMethod === 'ewallet'} onChange={() => setPaymentMethod('ewallet')} /><span><strong>E-wallet</strong><small>No wallet details are needed; payment is not collected here.</small></span></label>
            </div>
            <div className="checkout-modal-actions"><button className="text-button" type="button" onClick={() => setStep(0)}>Back</button><button className="button primary" type="button" disabled={!paymentMethod} onClick={() => setStep(2)}>Review order</button></div>
          </div>
        ) : (
          <div className="checkout-step-content">
            <div className="checkout-review-card"><div className="checkout-review-heading"><h3>Deliver to</h3><button className="text-button" type="button" onClick={() => setStep(0)}>Edit</button></div><strong>{address.fullName} <span className="address-label">{address.label}</span></strong><p>{address.phone}</p><p>{address.street}, {address.region}, {address.postalCode}</p></div>
            <div className="checkout-review-card"><div className="checkout-review-heading"><h3>Payment</h3><button className="text-button" type="button" onClick={() => setStep(1)}>Edit</button></div><p>{paymentLabel}</p></div>
            <div className="checkout-review-items"><h3>Selected items</h3>{items.map(({ product, quantity }) => <div className="checkout-review-item" key={product.id}><img src={product.image} alt="" onError={(event) => { event.currentTarget.src = imageFallback }} /><span>{product.name} <small>× {quantity}</small></span><strong>{money(product.price * quantity)}</strong></div>)}</div>
            <div className="checkout-review-total"><span>Shipping</span><strong>Free</strong><span>Total</span><strong>{money(total)}</strong></div>
            <p className="demo-note checkout-demo-note">E-wallet payment is not processed in this app. E-wallet orders will remain under To Pay.</p>
            {checkoutError && <p className="auth-error" role="alert">{checkoutError}</p>}
            <div className="checkout-modal-actions"><button className="text-button" type="button" onClick={() => setStep(1)} disabled={confirming}>Back</button><button className="button primary" type="button" disabled={confirming} onClick={confirmOrder}>{confirming ? 'Placing order…' : 'Confirm checkout'}</button></div>
          </div>
        )}
      </section>
    </div>
  )
}
