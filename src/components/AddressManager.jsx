import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../utils/api'

const emptyAddress = { fullName: '', phone: '', region: '', postalCode: '', street: '', label: 'Home' }

export default function AddressManager() {
  const [addresses, setAddresses] = useState([])
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [values, setValues] = useState(emptyAddress)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadAddresses = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiRequest('/api/addresses')
      setAddresses(result.addresses)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const task = window.setTimeout(loadAddresses, 0)
    return () => window.clearTimeout(task)
  }, [loadAddresses])

  function beginEdit(address) {
    setFormOpen(true)
    setEditing(address?.id || null)
    setValues(address ? { fullName: address.fullName, phone: address.phone, region: address.region, postalCode: address.postalCode, street: address.street, label: address.label } : emptyAddress)
    setError('')
  }

  async function save(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest(editing ? `/api/addresses/${encodeURIComponent(editing)}` : '/api/addresses', { method: editing ? 'PATCH' : 'POST', body: values })
      setAddresses(result.addresses)
      setEditing(null)
      setFormOpen(false)
      setValues(emptyAddress)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function updateAddress(url, options) {
    setError('')
    try {
      const result = await apiRequest(url, options)
      setAddresses(result.addresses)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return <div className="address-manager">
    {error && <p className="account-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading saved addresses…</p> : <>
      <div className="address-list">{addresses.map((address) => <article className="address-card" key={address.id}><div><strong>{address.fullName}</strong>{address.isDefault && <span className="account-setup-badge">Default</span>}<p>{address.label} · {address.phone}</p><p>{address.street}, {address.region}, {address.postalCode}</p></div><div className="seller-actions">{!address.isDefault && <button className="text-button" onClick={() => updateAddress(`/api/addresses/${encodeURIComponent(address.id)}/default`, { method: 'PATCH', body: {} })}>Set default</button>}<button className="text-button" onClick={() => beginEdit(address)}>Edit</button><button className="text-button danger-text" onClick={() => { if (window.confirm('Delete this saved address?')) updateAddress(`/api/addresses/${encodeURIComponent(address.id)}`, { method: 'DELETE' }) }}>Delete</button></div></article>)}</div>
      {!formOpen && <button className="button outline" type="button" onClick={() => beginEdit(null)}>Add an address</button>}
      {formOpen ? <form className="address-form" onSubmit={save}><div className="checkout-field-grid"><label className="checkout-field"><span>Recipient name</span><input autoComplete="name" required maxLength="100" value={values.fullName} onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))} /></label><label className="checkout-field"><span>Phone number</span><input autoComplete="tel" type="tel" required maxLength="24" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} /></label><label className="checkout-field full-width"><span>Region, province, city, barangay</span><input required maxLength="300" value={values.region} onChange={(event) => setValues((current) => ({ ...current, region: event.target.value }))} /></label><label className="checkout-field"><span>Postal code</span><input autoComplete="postal-code" required maxLength="30" value={values.postalCode} onChange={(event) => setValues((current) => ({ ...current, postalCode: event.target.value }))} /></label><label className="checkout-field"><span>Label</span><select value={values.label} onChange={(event) => setValues((current) => ({ ...current, label: event.target.value }))}><option>Home</option><option>Work</option><option>Other</option></select></label><label className="checkout-field full-width"><span>Street, building, house number</span><textarea autoComplete="street-address" required maxLength="300" rows="2" value={values.street} onChange={(event) => setValues((current) => ({ ...current, street: event.target.value }))} /></label></div><div className="seller-actions"><button className="button outline" type="button" onClick={() => { setFormOpen(false); setEditing(null); setValues(emptyAddress) }}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save address' : 'Add address'}</button></div></form> : null}
    </>}
  </div>
}
