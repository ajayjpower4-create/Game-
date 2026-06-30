const state = {
  menu: null,
  cart: [],
  activeCategory: null,
  orders: [],
  sourceLabels: {},
  nextAutoOrderAt: null,
  knownOrderIds: null,
  sourceQueue: [],
  activeSourceOrderId: null,
  activePayOrderId: null,
  payMethod: 'cash',
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => `$${Number(n).toFixed(2)}`;

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    /* audio not available, ignore */
  }
}

// ---------- Clock ----------
function tickClock() {
  $('clock').textContent = new Date().toLocaleTimeString();
  if (state.nextAutoOrderAt) {
    const remaining = Math.max(0, state.nextAutoOrderAt - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    $('statNextOrder').textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  }
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Menu ----------
async function loadMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  state.menu = data;
  state.activeCategory = data.categories[0].id;
  $('tagline').textContent = data.restaurant.tagline;
  $('contact').textContent = `${data.restaurant.address} · ${data.restaurant.phone}`;
  renderCategoryTabs();
  renderMenuItems();
}

function renderCategoryTabs() {
  const wrap = $('categoryTabs');
  wrap.innerHTML = '';
  state.menu.categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'category-tab' + (cat.id === state.activeCategory ? ' active' : '');
    btn.textContent = cat.name;
    btn.onclick = () => {
      state.activeCategory = cat.id;
      renderCategoryTabs();
      renderMenuItems();
    };
    wrap.appendChild(btn);
  });
}

function renderMenuItems() {
  const wrap = $('menuItems');
  wrap.innerHTML = '';
  const category = state.menu.categories.find((c) => c.id === state.activeCategory);
  category.items.forEach((item) => {
    const card = document.createElement('button');
    card.className = 'menu-item';
    card.innerHTML = `
      <span class="menu-item-name">${item.name}</span>
      ${item.description ? `<span class="menu-item-desc">${item.description}</span>` : ''}
      <span class="menu-item-price">${fmt(item.price)}</span>
    `;
    card.onclick = () => {
      if (item.customizable) {
        openByoModal(item);
      } else {
        addToCart({ itemId: item.id, name: item.name, unitPrice: item.price, qty: 1 });
      }
    };
    wrap.appendChild(card);
  });
}

// ---------- Cart ----------
function addToCart(line) {
  if (!line.toppings) {
    const existing = state.cart.find((l) => l.itemId === line.itemId && !l.toppings);
    if (existing) {
      existing.qty += 1;
      renderCart();
      return;
    }
  }
  state.cart.push({ ...line, toppings: line.toppings || undefined });
  renderCart();
}

function renderCart() {
  const list = $('cartList');
  list.innerHTML = '';
  if (state.cart.length === 0) {
    list.innerHTML = '<li class="cart-empty">No items yet. Tap a menu item to add it.</li>';
  }
  let subtotal = 0;
  state.cart.forEach((line, idx) => {
    const lineTotal = line.unitPrice * line.qty;
    subtotal += lineTotal;
    const li = document.createElement('li');
    li.className = 'cart-list-item';
    li.innerHTML = `
      <span>
        <span class="cart-list-item-name">${line.qty}× ${line.name}</span>
        ${line.toppings && line.toppings.length ? `<br><span class="cart-list-item-sub">+ ${line.toppings.join(', ')}</span>` : ''}
      </span>
      <span>
        ${fmt(lineTotal)}
        <button class="cart-list-item-remove" title="Remove">×</button>
      </span>
    `;
    li.querySelector('.cart-list-item-remove').onclick = () => {
      state.cart.splice(idx, 1);
      renderCart();
    };
    list.appendChild(li);
  });
  const tax = subtotal * (state.menu ? state.menu.taxRate : 0);
  const total = subtotal + tax;
  $('cartSubtotal').textContent = fmt(subtotal);
  $('cartTax').textContent = fmt(tax);
  $('cartTotalRow').textContent = fmt(total);
  const itemCount = state.cart.reduce((s, l) => s + l.qty, 0);
  $('cartCount').textContent = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
  $('cartTotal').textContent = fmt(total);
}

$('clearCartBtn').onclick = () => {
  state.cart = [];
  renderCart();
};

$('sendOrderBtn').onclick = async () => {
  if (state.cart.length === 0) {
    toast('Add items before sending the order.');
    return;
  }
  const items = state.cart.map((l) => ({ itemId: l.itemId, qty: l.qty, toppings: l.toppings }));
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    toast(err.error || 'Could not send order.');
    return;
  }
  state.cart = [];
  renderCart();
  toast('Order sent to the queue!');
  fetchOrders();
};

// ---------- Build Your Own Pizza modal ----------
let byoItem = null;
function openByoModal(item) {
  byoItem = item;
  const grid = $('toppingsGrid');
  grid.innerHTML = '';
  state.menu.toppings.forEach((t) => {
    const id = `top-${t.replace(/\s+/g, '-')}`;
    const label = document.createElement('label');
    label.className = 'topping-option';
    label.innerHTML = `<input type="checkbox" value="${t}" id="${id}"> ${t}`;
    grid.appendChild(label);
  });
  $('byoModal').classList.remove('hidden');
}

$('byoCancelBtn').onclick = () => $('byoModal').classList.add('hidden');

$('byoAddBtn').onclick = () => {
  const toppings = Array.from($('toppingsGrid').querySelectorAll('input:checked')).map((i) => i.value);
  const unitPrice = byoItem.price + toppings.length * state.menu.toppingPrice;
  addToCart({ itemId: byoItem.id, name: byoItem.name, unitPrice, qty: 1, toppings });
  $('byoModal').classList.add('hidden');
};

// ---------- Orders queue ----------
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    const data = await res.json();
    state.sourceLabels = data.sourceLabels;
    state.nextAutoOrderAt = data.nextAutoOrderAt;

    if (state.knownOrderIds === null) {
      state.knownOrderIds = new Set(data.orders.map((o) => o.id));
    } else {
      const fresh = data.orders.filter((o) => !state.knownOrderIds.has(o.id));
      if (fresh.length) {
        fresh.forEach((o) => state.knownOrderIds.add(o.id));
        beep();
        toast(`New order arrived: ${fresh[0].label}`);
        fresh.filter((o) => o.status === 'new').forEach((o) => state.sourceQueue.push(o.id));
      }
    }

    state.orders = data.orders;
    renderStats(data.stats);
    renderQueue();
    maybeShowSourceModal();
  } catch (e) {
    /* network hiccup, ignore until next poll */
  }
}

function renderStats(stats) {
  $('statSales').textContent = fmt(stats.totalSales);
  $('statCount').textContent = stats.orderCount;
  $('statCash').textContent = fmt(stats.cashTotal);
  $('statCard').textContent = fmt(stats.cardTotal);
}

const STATUS_LABEL = { new: 'New', pending: 'Pending', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };
const NEXT_STATUS_LABEL = { pending: 'Start Preparing', preparing: 'Mark Ready', ready: 'Complete Order' };

function renderQueue() {
  const wrap = $('queueList');
  const active = state.orders.filter((o) => o.status !== 'cancelled');
  if (active.length === 0) {
    wrap.innerHTML = '<p class="empty-state">No orders yet. Orders will appear here.</p>';
    return;
  }
  wrap.innerHTML = '';
  active.forEach((order) => {
    const sourceKey = order.source || 'unassigned';
    const sourceLabel = order.source ? state.sourceLabels[order.source] : 'Needs Source';
    const card = document.createElement('div');
    card.className = 'order-card' + (order.status === 'new' ? ' is-new' : '');
    const itemsHtml = order.items
      .map(
        (l) => `<div><span>${l.qty}× ${l.name}${l.toppings && l.toppings.length ? ` <span class="item-sub">(+${l.toppings.join(', ')})</span>` : ''}</span><span>${fmt(l.lineTotal)}</span></div>`
      )
      .join('');

    const actions = [];
    if (order.status === 'new') {
      actions.push(`<button class="btn btn-source btn-small" data-action="source">Select Source</button>`);
    } else {
      if (NEXT_STATUS_LABEL[order.status]) {
        actions.push(`<button class="btn btn-ghost btn-small" data-action="advance">${NEXT_STATUS_LABEL[order.status]}</button>`);
      }
      if (!order.payment.paid) {
        actions.push(`<button class="btn btn-primary btn-small" data-action="pay">Pay</button>`);
      }
      if (!order.payment.paid && order.status !== 'completed') {
        actions.push(`<button class="btn btn-ghost btn-small" data-action="cancel">Cancel</button>`);
      }
    }

    card.innerHTML = `
      <div class="order-card-header">
        <div>
          <div class="order-label">${order.label}</div>
          <div class="order-time">${new Date(order.createdAt).toLocaleTimeString()}</div>
        </div>
        <div class="order-badges">
          <span class="badge badge-source-${sourceKey}">${sourceLabel}</span>
          <span class="badge badge-status-${order.status}">${STATUS_LABEL[order.status]}</span>
          <span class="badge ${order.payment.paid ? 'badge-paid' : 'badge-unpaid'}">${order.payment.paid ? 'Paid' : 'Unpaid'}</span>
        </div>
      </div>
      <div class="order-items">${itemsHtml}</div>
      <div class="order-footer">
        <span class="order-total">${fmt(order.total)}</span>
        <div class="order-actions">${actions.join('')}</div>
      </div>
    `;

    card.querySelector('[data-action="source"]')?.addEventListener('click', () => openSourceModalForOrder(order.id));
    card.querySelector('[data-action="advance"]')?.addEventListener('click', () => advanceOrder(order.id));
    card.querySelector('[data-action="pay"]')?.addEventListener('click', () => openPayModal(order.id));
    card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => cancelOrder(order.id));

    wrap.appendChild(card);
  });
}

async function advanceOrder(id) {
  const res = await fetch(`/api/orders/${id}/advance`, { method: 'POST' });
  if (res.ok) fetchOrders();
}

async function cancelOrder(id) {
  if (!confirm('Cancel this order?')) return;
  const res = await fetch(`/api/orders/${id}/cancel`, { method: 'POST' });
  if (res.ok) fetchOrders();
}

$('refreshBtn').onclick = fetchOrders;

// ---------- Source assignment modal ----------
function maybeShowSourceModal() {
  if (state.activeSourceOrderId) return;
  const nextId = state.sourceQueue.find((id) => {
    const o = state.orders.find((ord) => ord.id === id);
    return o && o.status === 'new';
  });
  if (nextId) openSourceModalForOrder(nextId);
}

function openSourceModalForOrder(id) {
  const order = state.orders.find((o) => o.id === id);
  if (!order) return;
  state.activeSourceOrderId = id;
  const wrap = $('sourceOrderItems');
  wrap.innerHTML = `<div><strong>${order.label}</strong><span>${fmt(order.total)}</span></div>` +
    order.items.map((l) => `<div><span>${l.qty}× ${l.name}</span><span>${fmt(l.lineTotal)}</span></div>`).join('');
  $('sourceModal').classList.remove('hidden');
}

document.querySelectorAll('#sourceModal [data-source]').forEach((btn) => {
  btn.onclick = async () => {
    const id = state.activeSourceOrderId;
    if (!id) return;
    await fetch(`/api/orders/${id}/source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: btn.dataset.source }),
    });
    state.sourceQueue = state.sourceQueue.filter((qid) => qid !== id);
    state.activeSourceOrderId = null;
    $('sourceModal').classList.add('hidden');
    fetchOrders();
  };
});

// ---------- Payment modal ----------
function openPayModal(id) {
  const order = state.orders.find((o) => o.id === id);
  if (!order) return;
  state.activePayOrderId = id;
  state.payMethod = 'cash';
  $('payOrderLabel').textContent = order.label;
  $('payTotal').textContent = fmt(order.total);
  $('cardAmount').textContent = fmt(order.total);
  $('tenderedInput').value = '';
  $('changeDue').textContent = fmt(0);
  $('payError').textContent = '';
  document.querySelectorAll('.pay-method-btn').forEach((b) => b.classList.toggle('active', b.dataset.method === 'cash'));
  $('cashFields').classList.remove('hidden');
  $('cardFields').classList.add('hidden');

  const quick = $('quickCash');
  quick.innerHTML = '';
  const options = Array.from(new Set([order.total, Math.ceil(order.total / 5) * 5, 20, 50, 100].map((n) => Math.round(n * 100) / 100)))
    .filter((n) => n >= order.total)
    .sort((a, b) => a - b)
    .slice(0, 4);
  options.forEach((amt) => {
    const b = document.createElement('button');
    b.textContent = fmt(amt);
    b.onclick = () => {
      $('tenderedInput').value = amt.toFixed(2);
      updateChangeDue();
    };
    quick.appendChild(b);
  });

  $('payModal').classList.remove('hidden');
}

function updateChangeDue() {
  const order = state.orders.find((o) => o.id === state.activePayOrderId);
  if (!order) return;
  const tendered = parseFloat($('tenderedInput').value) || 0;
  const change = Math.max(0, tendered - order.total);
  $('changeDue').textContent = fmt(change);
}

$('tenderedInput').addEventListener('input', updateChangeDue);

document.querySelectorAll('.pay-method-btn').forEach((btn) => {
  btn.onclick = () => {
    state.payMethod = btn.dataset.method;
    document.querySelectorAll('.pay-method-btn').forEach((b) => b.classList.toggle('active', b === btn));
    $('cashFields').classList.toggle('hidden', state.payMethod !== 'cash');
    $('cardFields').classList.toggle('hidden', state.payMethod !== 'card');
  };
});

$('payCancelBtn').onclick = () => {
  state.activePayOrderId = null;
  $('payModal').classList.add('hidden');
};

$('payConfirmBtn').onclick = async () => {
  const id = state.activePayOrderId;
  const order = state.orders.find((o) => o.id === id);
  if (!order) return;
  const body = { method: state.payMethod };
  if (state.payMethod === 'cash') {
    body.tendered = parseFloat($('tenderedInput').value);
  }
  const res = await fetch(`/api/orders/${id}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    $('payError').textContent = data.error || 'Payment failed.';
    return;
  }
  $('payModal').classList.add('hidden');
  state.activePayOrderId = null;
  toast('Payment received!');
  fetchOrders();
};

// ---------- Init ----------
loadMenu();
fetchOrders();
setInterval(fetchOrders, 4000);
