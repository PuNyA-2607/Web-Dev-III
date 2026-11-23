/**
 * ShopVerse Customer Orders Controller (orders.html)
 */

import { api } from './api.js';
import { guardPage } from './auth.js';
import { renderNavbar } from './navbar.js';
import { initSocket } from './socket.js';
import { escapeHtml, formatDate, formatPrice, showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  const allowed = await guardPage(['customer']);
  if (!allowed) return;

  await renderNavbar('orders');
  initSocket();

  await loadOrders();

  // Listen for real-time status changes pushed via WebSocket
  window.addEventListener('shopverse:order:status', async () => {
    await loadOrders();
  });
});

async function loadOrders() {
  const loadingEl = document.getElementById('orders-loading');
  const emptyEl = document.getElementById('orders-empty');
  const listEl = document.getElementById('orders-list');

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  listEl.innerHTML = '';

  try {
    const res = await api('orders');
    loadingEl.style.display = 'none';

    const orders = res.data?.orders || [];

    if (orders.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    renderOrders(orders);
  } catch (err) {
    loadingEl.style.display = 'none';
    showToast(err.message || 'Failed to load order history', 'danger');
  }
}

function renderOrders(orders) {
  const listEl = document.getElementById('orders-list');
  listEl.innerHTML = '';

  for (const order of orders) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '1.5rem';
    card.style.padding = '2rem';

    // Order Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.flexWrap = 'wrap';
    header.style.gap = '0.75rem';
    header.style.borderBottom = '1px solid var(--border-light)';
    header.style.paddingBottom = '1.25rem';

    const idDateDiv = document.createElement('div');
    idDateDiv.style.display = 'flex';
    idDateDiv.style.alignItems = 'center';
    idDateDiv.style.gap = '12px';
    idDateDiv.style.flexWrap = 'wrap';

    const idEl = document.createElement('h3');
    idEl.style.fontSize = '1.25rem';
    idEl.style.fontWeight = '800';
    idEl.style.margin = '0';
    idEl.style.color = '#FFFFFF';
    idEl.style.letterSpacing = '-0.02em';
    idEl.textContent = `Order #${String(order._id).slice(-8).toUpperCase()}`;

    const dateEl = document.createElement('span');
    dateEl.style.fontSize = '13px';
    dateEl.style.color = 'var(--text-muted)';
    dateEl.innerHTML = `&bull; Placed on ${formatDate(order.createdAt)}`;

    idDateDiv.appendChild(idEl);
    idDateDiv.appendChild(dateEl);

    const statusBadge = document.createElement('span');
    statusBadge.className = `badge badge-${order.status}`;
    statusBadge.textContent = order.status;

    header.appendChild(idDateDiv);
    header.appendChild(statusBadge);

    // Order Stepper Visual Progress
    const stepperContainer = createOrderStepper(order.status);

    // Items Table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-responsive';

    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Purchased Item</th>
          <th>Unit Price</th>
          <th style="text-align: center;">Quantity</th>
          <th style="text-align: right;">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${(order.items || [])
          .map(
            (item) => `
          <tr>
            <td>
              <strong style="color: #FFFFFF;">${escapeHtml(item.name)}</strong>
            </td>
            <td>${formatPrice(item.priceSnapshot)}</td>
            <td style="text-align: center; font-weight: 700; color: #FFFFFF;">${item.quantity}</td>
            <td style="text-align: right; font-weight: 750; color: #818CF8;">
              ${formatPrice((item.priceSnapshot || 0) * (item.quantity || 1))}
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    `;
    tableContainer.appendChild(table);

    // Order Footer / Meta info & Actions
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.flexWrap = 'wrap';
    footer.style.gap = '1.25rem';
    footer.style.paddingTop = '0.75rem';

    // Left info (Address + Payment)
    const metaInfo = document.createElement('div');
    metaInfo.style.fontSize = '13px';
    metaInfo.style.color = 'var(--text-muted)';
    metaInfo.style.display = 'flex';
    metaInfo.style.flexDirection = 'column';
    metaInfo.style.gap = '4px';

    const addr = order.deliveryAddress;
    const addrParts = addr
      ? [addr.street, addr.city, [addr.state, addr.postalCode].filter(Boolean).join(' '), addr.country].filter(Boolean)
      : [];
    const addrStr = addrParts.length > 0 ? addrParts.join(', ') : 'Address on file';

    metaInfo.innerHTML = `
      <div><strong style="color: #CBD5E1;">Delivery Destination:</strong> ${escapeHtml(addrStr)}</div>
      <div><strong style="color: #CBD5E1;">Payment Mode:</strong> ${escapeHtml(order.payment?.method || 'SIMULATED')} &bull; Status: <span style="font-weight: 700; color: #34D399;">${escapeHtml(order.payment?.status || 'completed')}</span></div>
    `;

    // Right info (Total + Cancel Button)
    const actionSide = document.createElement('div');
    actionSide.style.display = 'flex';
    actionSide.style.alignItems = 'center';
    actionSide.style.gap = '1.5rem';

    const totalEl = document.createElement('div');
    totalEl.style.fontSize = '1.35rem';
    totalEl.style.fontWeight = '850';
    totalEl.style.color = '#FFFFFF';
    totalEl.innerHTML = `Total: <span style="color: #818CF8;">${formatPrice(order.total)}</span>`;

    actionSide.appendChild(totalEl);

    // Cancel button available only if order status is pending or confirmed
    if (order.status === 'pending' || order.status === 'confirmed') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-danger btn-sm';
      cancelBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>Cancel Order</span>
      `;
      cancelBtn.onclick = () => handleCancelOrder(order._id);
      actionSide.appendChild(cancelBtn);
    }

    footer.appendChild(metaInfo);
    footer.appendChild(actionSide);

    card.appendChild(header);
    if (stepperContainer) {
      card.appendChild(stepperContainer);
    }
    card.appendChild(tableContainer);
    card.appendChild(footer);

    listEl.appendChild(card);
  }
}

function createOrderStepper(status) {
  const container = document.createElement('div');
  container.style.padding = '0.75rem 0.5rem 0.5rem';

  if (status === 'cancelled') {
    container.innerHTML = `
      <div style="background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.4); color: #FB7185; padding: 12px 16px; border-radius: 10px; font-size: 13.5px; display: flex; align-items: center; gap: 10px;">
        <span style="font-weight: 750;">Order Cancelled</span> &bull; Stock units were automatically restored to merchant catalog.
      </div>
    `;
    return container;
  }

  const steps = [
    { key: 'pending', label: 'Order Placed' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'shipped', label: 'Dispatched' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const statusRanks = {
    pending: 1,
    confirmed: 2,
    shipped: 3,
    delivered: 4,
  };

  const currentRank = statusRanks[status] || 1;

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; position: relative;">
      <!-- Background Connecting Line -->
      <div style="position: absolute; top: 15px; left: 24px; right: 24px; height: 3px; background: rgba(255, 255, 255, 0.1); z-index: 1;"></div>
      <!-- Active Filled Line -->
      <div style="position: absolute; top: 15px; left: 24px; width: ${((currentRank - 1) / (steps.length - 1)) * 100}%; max-width: calc(100% - 48px); height: 3px; background: linear-gradient(90deg, #6366F1, #A855F7); box-shadow: 0 0 12px rgba(99, 102, 241, 0.6); z-index: 2; transition: width 0.4s ease;"></div>

      ${steps
        .map((s, idx) => {
          const stepRank = idx + 1;
          const isDone = stepRank < currentRank;
          const isCurrent = stepRank === currentRank;

          const dotBg = isDone || isCurrent ? '#6366F1' : '#111827';
          const dotColor = isDone || isCurrent ? '#FFFFFF' : '#64748B';
          const dotBorder = isDone || isCurrent ? '2px solid #818CF8' : '2px solid rgba(255, 255, 255, 0.15)';
          const labelColor = isCurrent ? '#FFFFFF' : isDone ? '#CBD5E1' : '#64748B';
          const labelWeight = isCurrent ? '750' : isDone ? '600' : '500';

          return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 7px; position: relative; z-index: 3;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background: ${dotBg}; color: ${dotColor}; border: ${dotBorder}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 750; box-shadow: ${isDone || isCurrent ? '0 0 14px rgba(99, 102, 241, 0.6)' : 'none'};">
                ${isDone ? '✓' : stepRank}
              </div>
              <span style="font-size: 12px; color: ${labelColor}; font-weight: ${labelWeight}; white-space: nowrap;">
                ${s.label}
              </span>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  return container;
}

async function handleCancelOrder(orderId) {
  if (
    !confirm(
      'Are you sure you want to cancel this order? Stock will be atomically restored.'
    )
  ) {
    return;
  }

  try {
    await api(`orders/${orderId}/cancel`, {
      method: 'POST',
    });
    showToast('Order cancelled successfully. Stock restored.', 'info');
    await loadOrders();
  } catch (err) {
    showToast(err.message || 'Failed to cancel order', 'danger');
  }
}
