import { useState } from 'react'
import { apiRequest } from '../utils/api'

export default function PasswordManager() {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')
    if (values.newPassword !== values.confirmPassword) { setError('Your new passwords do not match.'); return }
    setBusy(true)
    try {
      await apiRequest('/api/auth/password', { method: 'POST', body: { currentPassword: values.currentPassword, newPassword: values.newPassword } })
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setNotice('Your password was changed. Other signed-in sessions have been ended.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <>
    {notice && <p className="account-success" role="status">{notice}</p>}{error && <p className="account-error" role="alert">{error}</p>}
    <form className="account-profile-form" onSubmit={submit}>
      <label>Current password<input type="password" autoComplete="current-password" required value={values.currentPassword} onChange={(event) => setValues((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
      <label>New password<input type="password" autoComplete="new-password" minLength="12" maxLength="128" required value={values.newPassword} onChange={(event) => setValues((current) => ({ ...current, newPassword: event.target.value }))} /><small>Use at least 12 characters.</small></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength="12" maxLength="128" required value={values.confirmPassword} onChange={(event) => setValues((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
      <button className="button primary" disabled={busy}>{busy ? 'Updating…' : 'Change Password'}</button>
    </form>
  </>
}
