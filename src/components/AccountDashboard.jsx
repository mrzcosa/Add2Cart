import { useRef, useState } from 'react'
import { apiRequest } from '../utils/api'
import AddressManager from './AddressManager'
import PasswordManager from './PasswordManager'

const sections = [
  { id: 'profile', label: 'My Profile', icon: 'user' },
  { id: 'payments', label: 'Banks & Cards', icon: 'card' },
  { id: 'addresses', label: 'Addresses', icon: 'pin' },
  { id: 'password', label: 'Change Password', icon: 'lock' },
  { id: 'privacy', label: 'Privacy Settings', icon: 'shield' },
  { id: 'notifications-settings', label: 'Notification Settings', icon: 'bell' },
  { id: 'order-settings', label: 'Order Settings', icon: 'sliders' },
  { id: 'purchases', label: 'My Purchases', icon: 'bag', route: 'purchases' },
  { id: 'notifications', label: 'Notifications', icon: 'inbox' },
  { id: 'vouchers', label: 'My Vouchers', icon: 'ticket' },
  { id: 'saved', label: 'Wishlist / Saved Items', icon: 'heart', route: 'saved' },
]

const paths = {
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.6 3.2-5.5 7-5.5s6.3 1.9 7 5.5"/></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  sliders: <><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></>,
  bag: <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
  inbox: <><path d="M4 4h16v16H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>,
  ticket: <><path d="M4 7a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4h16v-4a2 2 0 0 1 0-4V5H4v2Z"/><path d="M13 7v2m0 3v2"/></>,
  heart: <><path d="M20.8 8.7c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z"/></>,
}

const unavailableCopy = {
  payments: ['Banks & Cards', 'No payment provider is configured. Add a supported payment gateway before managing saved payment methods.'],
  addresses: ['Addresses', 'Saved addresses are not yet available. Checkout collects delivery details for each order.'],
  password: ['Change Password', 'Password changes are not available in the current account interface.'],
  privacy: ['Privacy Settings', 'Privacy preferences are not connected to account storage or application behavior yet.'],
  'notifications-settings': ['Notification Settings', 'Notification preferences need account storage and a configured delivery service. This app does not send email or SMS.'],
  'order-settings': ['Order Settings', 'Order preferences are not available in the current account interface.'],
  notifications: ['Notifications', 'There is no user notification API or notification delivery service configured yet.'],
  vouchers: ['My Vouchers', 'Vouchers and coupon validation are not implemented in this project.'],
}

function AccountIcon({ name }) {
  return <svg className="account-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function AccountDashboard({ navigate, user, onLogin, onUserUpdate }) {
  const photoInputRef = useRef(null)
  const [activeSection, setActiveSection] = useState('profile')
  const birthDateParts = (user?.dateOfBirth || '').split('-')
  const [profile, setProfile] = useState({ fullName: user?.fullName || '', username: user?.username || '', gender: user?.gender || '', birthYear: birthDateParts[0] || '', birthMonth: birthDateParts[1] || '', birthDay: birthDateParts[2] || '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [savingPhoto, setSavingPhoto] = useState(false)
  const selected = sections.find((section) => section.id === activeSection)
  const unavailable = unavailableCopy[activeSection]

  async function saveProfile(event) {
    event.preventDefault()
    if (savingProfile || !user) return
    setSavingProfile(true)
    setProfileError('')
    setProfileNotice('')
    try {
      const hasBirthPart = profile.birthYear || profile.birthMonth || profile.birthDay
      if (hasBirthPart && !(profile.birthYear && profile.birthMonth && profile.birthDay)) throw new Error('Select a month, day, and year for your date of birth, or clear all three.')
      const dateOfBirth = hasBirthPart ? `${profile.birthYear}-${profile.birthMonth}-${profile.birthDay}` : ''
      const result = await apiRequest('/api/auth/profile', { method: 'PATCH', body: { fullName: profile.fullName, username: profile.username, gender: profile.gender, dateOfBirth } })
      const savedBirthParts = (result.user.dateOfBirth || '').split('-')
      setProfile({ fullName: result.user.fullName, username: result.user.username, gender: result.user.gender || '', birthYear: savedBirthParts[0] || '', birthMonth: savedBirthParts[1] || '', birthDay: savedBirthParts[2] || '' })
      onUserUpdate(result.user)
      setProfileNotice('Profile changes saved.')
    } catch (error) {
      setProfileError(error.message)
    } finally {
      setSavingProfile(false)
    }
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0]
    setPhotoError('')
    setProfileNotice('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Choose an image that is 2 MB or smaller.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(String(reader.result || ''))
    reader.onerror = () => setPhotoError('We could not read that image. Please try another.')
    reader.readAsDataURL(file)
  }

  async function uploadPhoto() {
    if (!photoPreview || savingPhoto) return
    setSavingPhoto(true)
    setPhotoError('')
    setProfileNotice('')
    try {
      const result = await apiRequest('/api/auth/profile/photo', { method: 'POST', body: { image: photoPreview } })
      onUserUpdate(result.user)
      setPhotoPreview('')
      if (photoInputRef.current) photoInputRef.current.value = ''
      setProfileNotice('Profile photo updated.')
    } catch (error) {
      setPhotoError(error.message || 'We could not upload your photo. Please try again.')
    } finally {
      setSavingPhoto(false)
    }
  }

  function openSection(section) {
    if (section.route) return navigate(section.route)
    setActiveSection(section.id)
  }

  return <main className="container page-main account-page">
    <div className="page-title-row account-page-title"><div><h1>My Account</h1><p className="page-subtitle">Manage your profile and account preferences.</p></div></div>
    <div className="account-dashboard">
      <aside className="account-sidebar" aria-label="Account navigation">
        <div className="account-profile-summary">{user?.profileImageUrl ? <img className="account-profile-placeholder account-profile-photo" src={user.profileImageUrl} alt="" /> : <span className="account-profile-placeholder" aria-hidden="true"><AccountIcon name="user" /></span>}<div><strong>{user?.fullName || 'Guest shopper'}</strong><small>{user?.email || 'Not signed in'}</small></div><button type="button" onClick={() => user ? setActiveSection('profile') : onLogin()}>Edit Profile</button></div>
        <nav className="account-section-list">{sections.map((section) => <button key={section.id} type="button" className={activeSection === section.id ? 'selected' : ''} aria-current={activeSection === section.id ? 'page' : undefined} onClick={() => openSection(section)}><AccountIcon name={section.icon} /><span>{section.label}</span>{!section.route && !['profile', 'addresses', 'password'].includes(section.id) && <small>Setup needed</small>}</button>)}</nav>
      </aside>
      <section className="account-content" aria-labelledby="account-section-title">
        {activeSection === 'password' && user ? <>
          <div className="account-content-heading"><div><p className="eyebrow">Account security</p><h2 id="account-section-title">Change Password</h2></div></div>
          <PasswordManager />
        </> : activeSection === 'addresses' && user ? <>
          <div className="account-content-heading"><div><p className="eyebrow">Delivery details</p><h2 id="account-section-title">Addresses</h2></div></div>
          <AddressManager />
        </> : activeSection === 'profile' && user ? <>
          <div className="account-content-heading"><div><p className="eyebrow">Account details</p><h2 id="account-section-title">My Profile</h2></div></div>
          {profileNotice && <p className="account-success" role="status">{profileNotice}</p>}{profileError && <p className="account-error" role="alert">{profileError}</p>}
          <div className="profile-photo-panel">
            {photoPreview || user.profileImageUrl ? <img className="profile-photo-preview" src={photoPreview || user.profileImageUrl} alt="Profile photo preview" /> : <span className="profile-photo-placeholder" aria-hidden="true"><AccountIcon name="user" /></span>}
            <div className="profile-photo-copy"><strong>Profile photo</strong><span>Choose a JPG, PNG, or WebP image up to 2 MB.</span><div className="profile-photo-actions"><input ref={photoInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPhoto} aria-label="Choose profile photo" /><button className="button outline" type="button" onClick={() => photoInputRef.current?.click()} disabled={savingPhoto}>Choose photo</button>{photoPreview && <button className="button primary" type="button" onClick={uploadPhoto} disabled={savingPhoto}>{savingPhoto ? 'Uploading…' : 'Upload photo'}</button>}</div>{photoError && <span className="account-error profile-photo-error" role="alert">{photoError}</span>}</div>
          </div>
          <form className="account-profile-form" onSubmit={saveProfile}>
            <label>Full name<input autoComplete="name" value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} required minLength="2" maxLength="100" /></label>
            <label>Username<input autoComplete="username" value={profile.username} onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))} required minLength="3" maxLength="24" pattern="[A-Za-z0-9_]{3,24}" /></label>
            <label>Email address<input type="email" value={user.email} readOnly /></label>
            <fieldset className="profile-gender-field"><legend>Gender</legend><div className="profile-gender-options">{[['male', 'Male'], ['female', 'Female'], ['prefer_not_to_say', 'Prefer not to say']].map(([value, label]) => <label key={value}><input type="radio" name="gender" value={value} checked={profile.gender === value} onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value }))} /><span>{label}</span></label>)}</div></fieldset>
            <fieldset className="profile-birth-field"><legend>Date of birth</legend><div className="profile-birth-selects"><label><span className="sr-only">Birth month</span><select aria-label="Birth month" value={profile.birthMonth} onChange={(event) => setProfile((current) => ({ ...current, birthMonth: event.target.value }))}><option value="">Month</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, '0')}>{new Date(2000, index, 1).toLocaleString('en', { month: 'long' })}</option>)}</select></label><label><span className="sr-only">Birth day</span><select aria-label="Birth day" value={profile.birthDay} onChange={(event) => setProfile((current) => ({ ...current, birthDay: event.target.value }))}><option value="">Day</option>{Array.from({ length: profile.birthMonth && profile.birthYear ? new Date(Number(profile.birthYear), Number(profile.birthMonth), 0).getDate() : 31 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, '0')}>{index + 1}</option>)}</select></label><label><span className="sr-only">Birth year</span><select aria-label="Birth year" value={profile.birthYear} onChange={(event) => setProfile((current) => ({ ...current, birthYear: event.target.value }))}><option value="">Year</option>{Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) => String(new Date().getFullYear() - index)).map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div></fieldset>
            <button className="button primary" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save Changes'}</button>
          </form>
        </> : (activeSection === 'profile' || activeSection === 'addresses' || activeSection === 'password') && !user ? <>
          <div className="account-content-heading"><div><p className="eyebrow">Account details</p><h2 id="account-section-title">{selected?.label}</h2></div></div>
          <div className="account-unavailable" role="status"><span className="account-unavailable-icon"><AccountIcon name="lock" /></span><div><h3>Log in to continue</h3><p>Your account details are private. Log in or create an account to view and update them.</p><button className="button primary" type="button" onClick={onLogin}>Log In or Create Account</button></div></div>
        </> : <>
          <div className="account-content-heading"><div><p className="eyebrow">Account settings</p><h2 id="account-section-title">{unavailable?.[0] || selected?.label}</h2></div><span className="account-setup-badge">Setup needed</span></div>
          <div className="account-unavailable" role="status"><span className="account-unavailable-icon"><AccountIcon name={selected?.icon || 'user'} /></span><div><h3>This section isn’t available yet</h3><p>{unavailable?.[1] || 'This account feature is not configured.'}</p></div></div>
        </>}
      </section>
    </div>
  </main>
}
