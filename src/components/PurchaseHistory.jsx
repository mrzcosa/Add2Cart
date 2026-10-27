import { useState } from 'react'
import { imageFallback, money } from '../utils/marketplace'

const tabs = ['All', 'To Pay', 'To Ship', 'To Receive', 'Completed', 'Cancelled', 'Return/Refund']

function dateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}

export default function PurchaseHistory({ orders, onUpdateStatus, navigate }) {
  const [activeTab, setActiveTab] = useState('All')
  const visibleOrders = activeTab === 'All' ? orders : orders.filter((order) => order.status === activeTab)

  return (
    <main className="container page-main purchases-page">
      <div className="page-title-row purchases-title-row">
        <div><p className="eyebrow">Your account</p><h1>My Purchases</h1><p className="page-subtitle">Keep track of your orders and their status.</p></div>
      </div>

      <div className="purchase-tabs" role="tablist" aria-label="Filter purchases by status">
        {tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>

      <section className="purchase-list" role="tabpanel" aria-label={`${activeTab} purchases`}>
        {visibleOrders.length ? visibleOrders.map((order) => (
          <article className="purchase-card" key={order.id}>
            <header className="purchase-card-header">
              <div><span className="purchase-order-label">Order {order.orderNumber || order.id}</span><span className="purchase-date">Placed {dateLabel(order.createdAt)}</span></div>
              <span className={`purchase-status status-${order.status.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{order.status}</span>
            </header>
            <div className="purchase-address"><span>Deliver to</span><strong>{order.address.fullName} · {order.address.label}</strong><small>{order.address.street}, {order.address.region}, {order.address.postalCode} · {order.address.phone}</small></div>
            <div className="purchase-items">
              {order.items.map((item) => (
                <div className="purchase-item" key={item.product.id}>
                  <img src={item.product.image} alt="" onError={(event) => { event.currentTarget.src = imageFallback }} />
                  <div className="purchase-item-copy"><strong>{item.product.name}</strong><span>{item.product.category} · Qty {item.quantity}</span></div>
                  <strong className="purchase-item-price">{money(item.unitPrice * item.quantity)}</strong>
                </div>
              ))}
            </div>
            <footer className="purchase-card-footer">
              <div className="purchase-payment"><span>{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'E-wallet'}</span><small>{order.status === 'Cancelled' ? 'Cancelled' : order.paymentMethod === 'ewallet' ? (order.paymentStatus === 'paid' ? 'Paid' : 'Payment pending') : order.status === 'Completed' ? 'Paid on delivery' : 'Pay on delivery'}</small></div>
              <div className="purchase-total"><span>Order total</span><strong>{money(order.total)}</strong></div>
            </footer>
            {order.status === 'To Pay' && <p className="purchase-status-note">E-wallet payment is pending. A payment provider must be configured to complete payment.</p>}
            <div className="purchase-actions">
              {['To Pay', 'To Ship'].includes(order.status) && <button className="button outline small" type="button" onClick={() => onUpdateStatus(order.id, 'Cancelled')}>Cancel order</button>}
              {order.status === 'To Receive' && <button className="button primary small" type="button" onClick={() => onUpdateStatus(order.id, 'Completed')}>Order received</button>}
            </div>
          </article>
        )) : (
          <div className="empty-state purchases-empty">
            <h2>{orders.length ? `No ${activeTab.toLowerCase()} purchases` : 'No purchases yet'}</h2>
            <p>{orders.length ? 'Orders with this status will appear here.' : 'Your confirmed checkout orders will appear here.'}</p>
            <button className="button primary" type="button" onClick={() => navigate('home')}>Explore products</button>
          </div>
        )}
      </section>
      <p className="purchase-local-note">Orders are linked to your account in the application database. E-wallet payment and shipment tracking require provider integrations.</p>
    </main>
  )
}
