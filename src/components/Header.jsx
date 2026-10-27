import { useState } from 'react'
import Brand from './Brand'

const navItems = [
  ['home', 'Home'], ['categories', 'Categories'], ['deals', 'Deals'],
  ['saved', 'Saved items'], ['products', 'My products'],
]

function CartButton({ cartCount, navigate, isActive }) {
  return <button className={`cart-nav-button ${isActive ? 'active' : ''}`} type="button" aria-label={`Cart, ${cartCount} items`} title="Cart" onClick={() => navigate('cart')}>
    <svg className="nav-cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
    <span className="cart-pill">{cartCount > 99 ? '99+' : cartCount}</span>
  </button>
}

export default function Header({ route, query, setQuery, category, setCategory, categories, cartCount, navigate, user, onLogin, onLogout }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const accountLinks = user
    ? [['account', 'My account'], ['purchases', 'My purchases'], ['products', 'My products'], ['logout', 'Log out']]
    : [['login', 'Log in'], ['register', 'Create Account']]

  return (
    <>
      <header className="site-header"><div className="container header-main">
        <Brand navigate={navigate} />
        <form className="search-bar" onSubmit={(event) => { event.preventDefault(); navigate('home') }}>
          <label className="sr-only" htmlFor="site-search">Search products</label>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input id="site-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for anything" />
          <label className="sr-only" htmlFor="search-category">Choose a category</label>
          <select id="search-category" value={category} onChange={(event) => { setCategory(event.target.value); navigate('home') }}><option value="All">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <button className="search-submit" type="submit">Search</button>
        </form>
        <div className="header-actions">
        <CartButton cartCount={cartCount} navigate={navigate} isActive={route.page === 'cart'} />
        <div className="account-menu">
          <button className="account-trigger" type="button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>
            {user?.profileImageUrl ? <img className="account-avatar account-avatar-photo" src={user.profileImageUrl} alt="" /> : <svg className="account-avatar" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.6 3.2-5.5 7-5.5s6.3 1.9 7 5.5"/></svg>}
            <span>{user?.fullName || 'My account'}</span>
          </button>
          {accountOpen && <div className="account-dropdown" role="menu" aria-label="Account menu">
            <p className="account-heading">Your account</p>
            {accountLinks.map(([page, label]) => <button key={page} type="button" role="menuitem" onClick={() => {
              setAccountOpen(false)
              if (page === 'login' || page === 'register') onLogin(page)
              else if (page === 'logout') onLogout()
              else navigate(page)
            }}>{label}</button>)}
          </div>}
        </div>
        </div>
      </div>
      <nav className="main-nav container" aria-label="Main navigation">{navItems.map(([key, label]) => <button key={key} className={route.page === key ? 'active' : ''} onClick={() => navigate(key)}>{label}</button>)}</nav>
      </header>
    </>
  )
}
