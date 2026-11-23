/**
 * ShopVerse Socket.IO Real-Time Client Manager
 */

import { getAccessToken, getUser } from './auth.js';
import { showToast, escapeHtml } from './utils.js';

let socket = null;
let unreadCount = 0;
const notificationsList = [];

export function getNotifications() {
  return [...notificationsList];
}

export function getUnreadCount() {
  return unreadCount;
}

export function clearUnreadCount() {
  unreadCount = 0;
  dispatchBadgeUpdate();
}

function dispatchBadgeUpdate() {
  window.dispatchEvent(
    new CustomEvent('shopverse:notification-count', { detail: { count: unreadCount } })
  );
}

/**
 * Initialize Socket.IO connection with access token in handshake auth
 */
export function initSocket() {
  const token = getAccessToken();
  const user = getUser();

  if (!token || !user) {
    return null;
  }

  // Check if io client is loaded from /socket.io/socket.io.js
  if (typeof window.io === 'undefined') {
    console.warn('Socket.IO client library (/socket.io/socket.io.js) not loaded.');
    return null;
  }

  if (socket && socket.connected) {
    return socket;
  }

  socket = window.io({
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log(`[Socket.IO] Connected as ${user.email} (${user.role})`);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  // 1. order:new -> received by Sellers when a new order containing their items is placed
  socket.on('order:new', (data) => {
    unreadCount++;
    notificationsList.unshift({
      type: 'order:new',
      title: 'New Order Received',
      data,
      date: new Date(),
    });
    dispatchBadgeUpdate();
    showToast(
      `New order #${String(data.orderId).slice(-6)} received (${data.itemsCount} items, $${Number(data.total || 0).toFixed(2)})`,
      'info',
      6000
    );
    window.dispatchEvent(new CustomEvent('shopverse:order:new', { detail: data }));
  });

  // 2. order:status -> received by Customers when order transitions state
  socket.on('order:status', (data) => {
    unreadCount++;
    notificationsList.unshift({
      type: 'order:status',
      title: 'Order Status Updated',
      data,
      date: new Date(),
    });
    dispatchBadgeUpdate();
    showToast(
      `Order #${String(data.orderId).slice(-6)} updated to "${data.status}"`,
      'success',
      6000
    );
    window.dispatchEvent(new CustomEvent('shopverse:order:status', { detail: data }));
  });

  // 3. stock:low -> received by Sellers and Admins when stock hits lowStockThreshold
  socket.on('stock:low', (data) => {
    unreadCount++;
    notificationsList.unshift({
      type: 'stock:low',
      title: 'Low Stock Alert',
      data,
      date: new Date(),
    });
    dispatchBadgeUpdate();
    showToast(
      `Low stock warning: "${data.productName}" has ${data.currentStock} units remaining.`,
      'warning',
      7000
    );
    window.dispatchEvent(new CustomEvent('shopverse:stock:low', { detail: data }));
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Keep socket auth credentials in sync on token refresh & disconnect on logout
window.addEventListener('shopverse:token-updated', (e) => {
  if (socket && e.detail?.accessToken) {
    socket.auth = { token: e.detail.accessToken };
  }
});

window.addEventListener('shopverse:logout', () => {
  disconnectSocket();
});
