/**
 * ShopVerse Modern Shared Navigation Bar & Notification System
 */

import { getUser, getAccessToken, initAuth, logout } from './auth.js';
import { api } from './api.js';
import { getNotifications, getUnreadCount, clearUnreadCount } from './socket.js';
import { escapeHtml, formatDate } from './utils.js';

export async function renderNavbar(activePage = '') {
  const header = document.getElementById('app-header');
  if (!header) return;

  // Ensure user session is verified and restored on every page
  const auth = await initAuth();
  const user = getUser();
  const loggedIn = Boolean(auth?.accessToken && user);

  const nav = document.createElement('nav');
  nav.className = 'navbar';

  const container = document.createElement('div');
  container.className = 'container';

  // Brand logo
  const brand = document.createElement('a');
  brand.href = '/index.html';
  brand.className = 'nav-brand';
  brand.innerHTML = `<span>ShopVerse <span style="font-weight: 500; font-size: 10.5px; color: #A5B4FC; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); padding: 1px 7px; border-radius: 9999px; margin-left: 2px; vertical-align: middle; letter-spacing: 0.06em;">STUDIO</span></span>`;

  // Navigation Links
  const menu = document.createElement('ul');
  menu.className = 'nav-menu';

  // 1. Products (Public link)
  const productsLi = document.createElement('li');
  const productsA = document.createElement('a');
  productsA.href = '/index.html';
  productsA.className = `nav-link ${activePage === 'products' ? 'active' : ''}`;
  productsA.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="7" height="7" x="3" y="3" rx="1"/>
      <rect width="7" height="7" x="14" y="3" rx="1"/>
      <rect width="7" height="7" x="14" y="14" rx="1"/>
      <rect width="7" height="7" x="3" y="14" rx="1"/>
    </svg>
    <span>Catalog</span>
  `;
  productsLi.appendChild(productsA);
  menu.appendChild(productsLi);

  // 2. Role-specific links
  if (loggedIn) {
    if (user.role === 'customer') {
      // Cart
      const cartLi = document.createElement('li');
      const cartA = document.createElement('a');
      cartA.href = '/cart.html';
      cartA.className = `nav-link ${activePage === 'cart' ? 'active' : ''}`;
      cartA.id = 'nav-cart-link';
      cartA.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="21" r="1"/>
          <circle cx="19" cy="21" r="1"/>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
        </svg>
        <span>Bag</span>
      `;
      cartLi.appendChild(cartA);
      menu.appendChild(cartLi);

      // Orders
      const ordersLi = document.createElement('li');
      const ordersA = document.createElement('a');
      ordersA.href = '/orders.html';
      ordersA.className = `nav-link ${activePage === 'orders' ? 'active' : ''}`;
      ordersA.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 16h6"/>
          <path d="M19 13v6"/>
          <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/>
          <path d="m7.5 4.27 9 5.15"/>
          <polyline points="3.29 7 12 12 20.71 7"/>
          <line x1="12" x2="12" y1="22" y2="12"/>
        </svg>
        <span>My Orders</span>
      `;
      ordersLi.appendChild(ordersA);
      menu.appendChild(ordersLi);

      // Load initial cart count in background
      loadCartBadge();
    } else if (user.role === 'seller') {
      const sellerLi = document.createElement('li');
      const sellerA = document.createElement('a');
      sellerA.href = '/seller.html';
      sellerA.className = `nav-link ${activePage === 'seller' ? 'active' : ''}`;
      sellerA.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
          <path d="M2 7h20"/>
        </svg>
        <span>Seller Portal</span>
      `;
      sellerLi.appendChild(sellerA);
      menu.appendChild(sellerLi);
    } else if (user.role === 'admin') {
      const adminLi = document.createElement('li');
      const adminA = document.createElement('a');
      adminA.href = '/admin.html';
      adminA.className = `nav-link ${activePage === 'admin' ? 'active' : ''}`;
      adminA.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
        </svg>
        <span>Admin Console</span>
      `;
      adminLi.appendChild(adminA);
      menu.appendChild(adminLi);
    }
  }

  // Right-hand side (Auth / Notifications / Logout)
  const navRight = document.createElement('div');
  navRight.className = 'nav-right';

  if (loggedIn) {
    // Notification Bell
    const bellBtn = document.createElement('button');
    bellBtn.className = 'notification-bell-btn';
    bellBtn.title = 'View Live Notifications';
    bellBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span class="notification-badge" id="nav-notification-badge" style="display: none;">0</span>
    `;
    bellBtn.onclick = () => openNotificationsModal();
    navRight.appendChild(bellBtn);

    // User details pill with avatar
    const userPill = document.createElement('div');
    userPill.className = 'user-pill';
    
    const initial = (user.name || 'U').charAt(0).toUpperCase();
    const avatar = document.createElement('div');
    avatar.style.width = '24px';
    avatar.style.height = '24px';
    avatar.style.borderRadius = '50%';
    avatar.style.background = 'linear-gradient(135deg, #6366F1, #A855F7)';
    avatar.style.color = '#FFFFFF';
    avatar.style.fontSize = '11px';
    avatar.style.fontWeight = '800';
    avatar.style.display = 'inline-flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.boxShadow = '0 0 8px rgba(99, 102, 241, 0.6)';
    avatar.textContent = initial;

    const userNameSpan = document.createElement('span');
    userNameSpan.textContent = user.name;
    
    const roleTag = document.createElement('span');
    roleTag.className = `user-role-tag ${user.role}`;
    roleTag.textContent = user.role;

    userPill.appendChild(avatar);
    userPill.appendChild(userNameSpan);
    userPill.appendChild(roleTag);
    navRight.appendChild(userPill);

    // Logout button
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-secondary btn-sm';
    logoutBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" x2="9" y1="12" y2="12"/>
      </svg>
      <span>Logout</span>
    `;
    logoutBtn.onclick = () => logout();
    navRight.appendChild(logoutBtn);
  } else {
    // Guest links
    const loginBtn = document.createElement('a');
    loginBtn.href = '/login.html';
    loginBtn.className = 'btn btn-secondary btn-sm';
    loginBtn.textContent = 'Sign In';

    const registerBtn = document.createElement('a');
    registerBtn.href = '/register.html';
    registerBtn.className = 'btn btn-primary btn-sm';
    registerBtn.textContent = 'Register';

    navRight.appendChild(loginBtn);
    navRight.appendChild(registerBtn);
  }

  container.appendChild(brand);
  container.appendChild(menu);
  container.appendChild(navRight);
  header.innerHTML = '';
  header.appendChild(container);

  // Setup badge listener
  window.addEventListener('shopverse:notification-count', (e) => {
    updateNotificationBadgeUI(e.detail.count);
  });

  // Check initial count
  updateNotificationBadgeUI(getUnreadCount());
}

function updateNotificationBadgeUI(count) {
  const badge = document.getElementById('nav-notification-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function loadCartBadge() {
  try {
    const res = await api('cart', { skipAuthRedirect: true });
    if (res && res.data) {
      updateCartBadgeUI(res.data.itemCount || 0);
    }
  } catch {
    // Ignore cart badge load failure if unauthenticated or error
  }
}

export function updateCartBadgeUI(count) {
  const cartLink = document.getElementById('nav-cart-link');
  if (!cartLink) return;
  const existing = cartLink.querySelector('.cart-count-badge');
  if (existing) existing.remove();

  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'cart-count-badge';
    badge.textContent = String(count);
    cartLink.appendChild(badge);
  }
}

/**
 * Open modal dialog showing recent real-time notifications
 */
function openNotificationsModal() {
  clearUnreadCount();

  let modal = document.getElementById('notifications-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'notifications-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const list = getNotifications();

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(99, 102, 241, 0.2); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.35); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(99, 102, 241, 0.3);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div>
            <h3 style="font-size: 1.2rem; margin: 0; color: #FFFFFF;">Live Notifications</h3>
            <span style="font-size: 12px; color: var(--text-muted);">Real-time domain events via WebSocket</span>
          </div>
        </div>
        <button class="modal-close-btn" id="close-notifications-btn" title="Close dialog">&times;</button>
      </div>

      <div id="notifications-list" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
        ${
          list.length === 0
            ? `
              <div style="text-align: center; padding: 3.5rem 1rem;">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(255, 255, 255, 0.05); color: #64748B; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center;">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </div>
                <h4 style="font-size: 1rem; color: #FFFFFF; margin-bottom: 4px;">No notifications yet</h4>
                <p style="font-size: 13px; color: var(--text-muted);">New orders, status changes, and stock warnings will appear here in real time.</p>
              </div>
            `
            : list
                .map((n) => {
                  const isOrderNew = n.type === 'order:new';
                  const isStatus = n.type === 'order:status';
                  const isStock = n.type === 'stock:low';

                  const badgeColor = isOrderNew
                    ? '#34D399'
                    : isStatus
                    ? '#38BDF8'
                    : '#FBBF24';

                  const bgTint = isOrderNew
                    ? 'rgba(16, 185, 129, 0.18)'
                    : isStatus
                    ? 'rgba(56, 189, 248, 0.18)'
                    : 'rgba(245, 158, 11, 0.18)';

                  return `
                    <div style="padding: 14px 16px; border: 1px solid var(--border-dark); border-radius: var(--radius); background: rgba(11, 15, 25, 0.7); display: flex; gap: 14px; align-items: flex-start; transition: var(--transition-fast);">
                      <div style="width: 32px; height: 32px; border-radius: var(--radius-sm); background: ${bgTint}; color: ${badgeColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800; font-size: 13px;">
                        ${isOrderNew ? '🛒' : isStatus ? '📦' : '⚠'}
                      </div>
                      <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px;">
                          <strong style="font-size: 13.5px; color: #FFFFFF;">${escapeHtml(n.title)}</strong>
                          <span style="font-size: 11px; color: var(--text-muted);">${formatDate(n.date)}</span>
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                          ${
                            isOrderNew
                              ? `Order <strong>#${escapeHtml(String(n.data.orderId).slice(-6))}</strong> received (${n.data.itemsCount} items &bull; $${Number(n.data.total || 0).toFixed(2)})`
                              : isStatus
                              ? `Order <strong>#${escapeHtml(String(n.data.orderId).slice(-6))}</strong> transitioned to <span class="badge badge-${escapeHtml(n.data.status)}" style="padding: 2px 8px; font-size: 10.5px;">${escapeHtml(n.data.status)}</span>`
                              : `Product "${escapeHtml(n.data.productName)}" stock low (${n.data.currentStock} units remaining)`
                          }
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join('')
        }
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid var(--border-light);">
        <button class="btn btn-secondary btn-sm" id="dismiss-notifications-btn">Dismiss</button>
      </div>
    </div>
  `;

  modal.classList.add('open');

  const closeBtn = document.getElementById('close-notifications-btn');
  const dismissBtn = document.getElementById('dismiss-notifications-btn');
  const closeModal = () => modal.classList.remove('open');
  if (closeBtn) closeBtn.onclick = closeModal;
  if (dismissBtn) dismissBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}
