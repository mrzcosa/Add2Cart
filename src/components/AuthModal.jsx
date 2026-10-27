import { useState } from 'react'
import add2CartLogo from '../assets/add2cart Logo/add2cart.png'

export default function AuthModal({ initialMode = 'login', reason, onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    const payload = mode === 'register'
      ? {
          fullName: String(form.get('fullName') || '').trim(),
          username: String(form.get('username') || '').trim(),
          email: String(form.get('email') || '').trim(),
          password,
          acceptTerms: form.get('acceptTerms') === 'on',
        }
      : { identifier: String(form.get('identifier') || '').trim(), password }

    if (mode === 'register' && password !== form.get('confirmPassword')) {
      setError('Your passwords do not match.')
      setBusy(false)
      return
    }

    try {
      await onSuccess(mode, payload)
    } catch (requestError) {
      setError(requestError.message || 'We could not sign you in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" aria-label="Close sign in" onClick={onClose} disabled={busy}>×</button>
        <p className="auth-brand"><img className="auth-brand-logo" src={add2CartLogo} alt="" />Add2Cart</p>
        <h2 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="auth-reason">{reason || 'Sign in or create an account to continue shopping.'}</p>
        <div className="auth-mode-switch" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Log In</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Create Account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && <>
            <label>Full name<input autoComplete="name" name="fullName" required minLength="2" maxLength="100" /></label>
            <label>Username<input autoComplete="username" name="username" required minLength="3" maxLength="24" pattern="[A-Za-z0-9_]{3,24}" title="Use 3–24 letters, numbers, or underscores." /></label>
            <label>Email address<input autoComplete="email" name="email" type="email" required maxLength="254" /></label>
          </>}
          {mode === 'login' && <label>Email or username<input autoComplete="username" name="identifier" required maxLength="254" /></label>}
          <label>Password<div className="auth-password-field"><input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} name="password" type={showPassword ? 'text' : 'password'} required minLength={mode === 'register' ? 12 : undefined} maxLength="128" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>{mode === 'register' && <small>Use at least 12 characters.</small>}</label>
          {mode === 'register' && <>
            <label>Confirm password<input autoComplete="new-password" name="confirmPassword" type={showPassword ? 'text' : 'password'} required minLength="12" maxLength="128" /></label>
            <label className="auth-terms"><input type="checkbox" name="acceptTerms" required /><span>I agree to the terms and privacy policy.</span></label>
          </>}
          {mode === 'login' && <p className="auth-recovery-note">Password recovery is not configured in this application.</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button primary auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}</button>
        </form>
        <p className="auth-security-note">Your password is protected by the Add2Cart account service.</p>
      </section>
    </div>
  )
}
