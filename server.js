import express from 'express';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  RESTAURANT,
  CATEGORIES,
  TOPPINGS,
  TOPPING_PRICE,
  TAX_RATE,
  findMenuItem,
  allMenuItems,
} from './menu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const SOURCES = ['doordash', 'ubereats', 'online'];
const SOURCE_LABELS = {
  doordash: 'DoorDash',
  ubereats: 'Uber Eats',
  online: 'Online Order',
  'in-store': 'In-Store',
};
const STATUS_FLOW = ['pending', 'preparing', 'ready', 'completed'];

const orders = [];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function priceOfLineItem(line) {
  const menuItem = findMenuItem(line.itemId);
  if (!menuItem) return null;
  const toppings = Array.isArray(line.toppings) ? line.toppings.filter((t) => TOPPINGS.includes(t)) : [];
  const unitPrice = menuItem.price + (menuItem.customizable ? toppings.length * TOPPING_PRICE : 0);
  const qty = Math.max(1, Math.min(20, parseInt(line.qty, 10) || 1));
  return {
    itemId: menuItem.id,
    name: menuItem.name,
    unitPrice: round2(unitPrice),
    qty,
    toppings: menuItem.customizable ? toppings : undefined,
    lineTotal: round2(unitPrice * qty),
  };
}

function buildOrder({ items, source, label }) {
  const lines = items.map(priceOfLineItem).filter(Boolean);
  if (lines.length === 0) return null;
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + tax);
  const order = {
    id: randomUUID(),
    label: label || `Order #${orders.length + 1}`,
    source: source || null,
    status: source ? 'pending' : 'new',
    items: lines,
    subtotal,
    tax,
    total,
    payment: { paid: false, method: null, tendered: null, change: null },
    createdAt: new Date().toISOString(),
  };
  return order;
}

function randomAutoOrder() {
  const candidates = allMenuItems();
  const count = 1 + Math.floor(Math.random() * 4);
  const items = [];
  for (let i = 0; i < count; i++) {
    const item = candidates[Math.floor(Math.random() * candidates.length)];
    const qty = 1 + Math.floor(Math.random() * 2);
    const line = { itemId: item.id, qty };
    if (item.customizable) {
      const toppingCount = Math.floor(Math.random() * 4);
      const shuffled = [...TOPPINGS].sort(() => Math.random() - 0.5);
      line.toppings = shuffled.slice(0, toppingCount);
    }
    items.push(line);
  }
  return buildOrder({ items, source: null, label: `Order #${orders.length + 1}` });
}

const AUTO_ORDER_INTERVAL_MS = 10 * 60 * 1000;
const FIRST_AUTO_ORDER_DELAY_MS = 20 * 1000;
let nextAutoOrderAt = Date.now() + FIRST_AUTO_ORDER_DELAY_MS;

function scheduleAutoOrder(delay) {
  setTimeout(() => {
    const order = randomAutoOrder();
    if (order) orders.unshift(order);
    nextAutoOrderAt = Date.now() + AUTO_ORDER_INTERVAL_MS;
    scheduleAutoOrder(AUTO_ORDER_INTERVAL_MS);
  }, delay);
}
scheduleAutoOrder(FIRST_AUTO_ORDER_DELAY_MS);

app.get('/api/menu', (req, res) => {
  res.json({ restaurant: RESTAURANT, categories: CATEGORIES, toppings: TOPPINGS, toppingPrice: TOPPING_PRICE, taxRate: TAX_RATE });
});

app.get('/api/orders', (req, res) => {
  const stats = orders.reduce(
    (acc, o) => {
      if (o.payment.paid) {
        acc.totalSales = round2(acc.totalSales + o.total);
        acc.orderCount += 1;
        if (o.payment.method === 'cash') acc.cashTotal = round2(acc.cashTotal + o.total);
        if (o.payment.method === 'card') acc.cardTotal = round2(acc.cardTotal + o.total);
      }
      return acc;
    },
    { totalSales: 0, orderCount: 0, cashTotal: 0, cardTotal: 0 }
  );
  res.json({
    orders,
    stats,
    sourceLabels: SOURCE_LABELS,
    nextAutoOrderAt,
  });
});

app.post('/api/orders', (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item.' });
  }
  const order = buildOrder({ items, source: 'in-store' });
  if (!order) return res.status(400).json({ error: 'No valid items found for that order.' });
  orders.unshift(order);
  res.status(201).json({ order });
});

function findOrder(id, res) {
  const order = orders.find((o) => o.id === id);
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return null;
  }
  return order;
}

app.post('/api/orders/:id/source', (req, res) => {
  const order = findOrder(req.params.id, res);
  if (!order) return;
  const { source } = req.body || {};
  if (!SOURCES.includes(source)) {
    return res.status(400).json({ error: 'Invalid source. Must be doordash, ubereats, or online.' });
  }
  order.source = source;
  if (order.status === 'new') order.status = 'pending';
  res.json({ order });
});

app.post('/api/orders/:id/advance', (req, res) => {
  const order = findOrder(req.params.id, res);
  if (!order) return;
  const idx = STATUS_FLOW.indexOf(order.status);
  if (idx === -1 || idx >= STATUS_FLOW.length - 1) {
    return res.status(400).json({ error: 'Order cannot be advanced further.' });
  }
  order.status = STATUS_FLOW[idx + 1];
  res.json({ order });
});

app.post('/api/orders/:id/pay', (req, res) => {
  const order = findOrder(req.params.id, res);
  if (!order) return;
  if (order.payment.paid) {
    return res.status(400).json({ error: 'Order is already paid.' });
  }
  const { method, tendered } = req.body || {};
  if (!['cash', 'card'].includes(method)) {
    return res.status(400).json({ error: 'Payment method must be cash or card.' });
  }
  if (method === 'cash') {
    const tenderedAmt = round2(parseFloat(tendered));
    if (!Number.isFinite(tenderedAmt) || tenderedAmt < order.total) {
      return res.status(400).json({ error: 'Cash tendered must be a number greater than or equal to the total.' });
    }
    order.payment = { paid: true, method: 'cash', tendered: tenderedAmt, change: round2(tenderedAmt - order.total) };
  } else {
    order.payment = { paid: true, method: 'card', tendered: order.total, change: 0 };
  }
  res.json({ order });
});

app.post('/api/orders/:id/cancel', (req, res) => {
  const order = findOrder(req.params.id, res);
  if (!order) return;
  if (order.payment.paid) {
    return res.status(400).json({ error: 'Cannot cancel a paid order.' });
  }
  order.status = 'cancelled';
  res.json({ order });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pizza City register running at http://localhost:${PORT}`);
});
