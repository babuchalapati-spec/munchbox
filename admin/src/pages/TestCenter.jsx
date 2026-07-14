import { Link } from 'react-router-dom';

const STEPS = [
  {
    title: '1. Customer places an order',
    body: 'Log in with a phone number (any number works — dev OTP is shown on screen), pick a shop and item, and place the order.',
    link: '/customer-test',
    label: 'Open Customer test page',
  },
  {
    title: '2. Shop confirms and prepares it',
    body: "Log in with the shop's email/password. The new order appears — confirm it, mark it baking, then mark it ready, and assign a delivery partner.",
    link: '/shop-test',
    label: 'Open Shop owner test page',
  },
  {
    title: '3. Delivery partner delivers it',
    body: 'Log in with the delivery account. Claim the order, head to shop, enter the pickup code (shown on the Shop page order), push a location update, then enter the delivery code (shown on the Customer page order) to complete it.',
    link: '/delivery-test',
    label: 'Open Delivery partner test page',
  },
  {
    title: '4. Watch it end-to-end from Admin',
    body: 'The real Admin → Orders page shows every order and its live status, payment method/status, and assigned partner — refresh it after each step above.',
    link: '/admin/orders',
    label: 'Open Admin → Orders',
  },
];

// A hub for testing the whole app without installing the mobile app. Each linked page
// keeps its own login in local browser state (see ../api/testClient.js) instead of
// localStorage, specifically so Customer, Shop, Delivery and Admin can all be logged
// in at the same time in four separate tabs — open all four, follow the steps below,
// and watch one order move through every role.
export default function TestCenter() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>🧪 Test Center</h1>
      <p className="login-sub">
        Test the whole order lifecycle — customer, shop, delivery, and admin — without needing the mobile app.
        Open each link below in its own browser tab (right-click → open in new tab), then follow the steps in order.
        Because each test page keeps its own separate login, all four tabs can be signed in at once.
      </p>

      {STEPS.map((step) => (
        <div className="card" key={step.title} style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>{step.title}</h3>
          <p className="muted" style={{ marginBottom: 12 }}>{step.body}</p>
          <Link to={step.link} target="_blank" rel="noopener noreferrer">
            <button type="button">{step.label} ↗</button>
          </Link>
        </div>
      ))}

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>What to check while you go</h3>
        <ul style={{ marginTop: 0, lineHeight: 1.8 }}>
          <li>Does the order appear on the Shop page right after the customer places it?</li>
          <li>Does toggling an item to "Out of stock" on the Shop page correctly stop the customer from ordering it?</li>
          <li>After the shop marks it "ready" and assigns a partner, does it show up under the Delivery page's "My deliveries"?</li>
          <li>Does the pickup code (Shop page) match what the Delivery page asks for, and the delivery code (Customer page) match what completes it?</li>
          <li>Does the customer's tracking screen show live location once the order is out for delivery? (Push a location update from the Delivery page and check.)</li>
          <li>Does Admin → Payments show the order if you use online payment, or Admin → Ledger show the shop's commission charge either way?</li>
        </ul>
      </div>

      <p style={{ marginTop: 20 }}>
        <Link to="/login">← Back to admin login</Link>
      </p>
    </div>
  );
}
