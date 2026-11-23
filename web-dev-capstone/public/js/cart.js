/**
 * ShopVerse Shopping Cart & Checkout Controller (cart.html)
 */

import { api } from './api.js';
import { guardPage } from './auth.js';
import { renderNavbar, updateCartBadgeUI } from './navbar.js';
import { initSocket } from './socket.js';
import { clearFormErrors, escapeHtml, formatPrice, showFormErrors, showToast } from './utils.js';

let activeCart = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce customer-only access
  const allowed = await guardPage(['customer']);
  if (!allowed) return;

  await renderNavbar('cart');
  initSocket();

  await loadCart();

  // Setup Clear Cart Button
  const clearBtn = document.getElementById('clear-cart-btn');
  clearBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to empty your entire cart?')) return;
    try {
      await api('cart', { method: 'DELETE' });
      showToast('Shopping cart cleared', 'info');
      await loadCart();
    } catch (err) {
      showToast(err.message || 'Failed to clear cart', 'danger');
    }
  });

  // Setup Checkout Form Submission
  const checkoutForm = document.getElementById('checkout-form');
  const checkoutAlert = document.getElementById('checkout-alert');
  const checkoutBtn = document.getElementById('checkout-btn');

  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(checkoutForm, checkoutAlert);

    // Guard: check if any item in cart has an issue
    const hasIssues = activeCart?.items?.some((i) => i.issue);
    if (hasIssues) {
      checkoutAlert.textContent = 'Please update or remove items with stock/availability issues before checking out.';
      checkoutAlert.style.display = 'block';
      return;
    }

    const street = document.getElementById('addr-street').value.trim();
    const city = document.getElementById('addr-city').value.trim();
    const state = document.getElementById('addr-state').value.trim();
    const postalCode = document.getElementById('addr-postalCode').value.trim();
    const country = document.getElementById('addr-country').value.trim();

    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = `
      <span style="display: inline-block; width: 14px; height: 14px; border: 2px solid #FFF; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px;"></span>
      <span>Processing Transaction...</span>
    `;

    try {
      const response = await api('orders', {
        method: 'POST',
        body: JSON.stringify({
          deliveryAddress: { street, city, state, postalCode, country },
        }),
      });

      showToast('Order placed successfully! Transaction committed.', 'success');
      updateCartBadgeUI(0);

      // Redirect to orders history
      setTimeout(() => {
        window.location.href = '/orders.html';
      }, 900);
    } catch (err) {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>Complete Order</span>
      `;
      showFormErrors(checkoutForm, err.errors || [], checkoutAlert, err.message || 'Checkout failed');
    }
  });
});

async function loadCart() {
  const loadingEl = document.getElementById('cart-loading');
  const emptyEl = document.getElementById('cart-empty');
  const contentEl = document.getElementById('cart-content');
  const clearBtn = document.getElementById('clear-cart-btn');

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  contentEl.style.display = 'none';
  clearBtn.style.display = 'none';

  try {
    const res = await api('cart');
    loadingEl.style.display = 'none';

    activeCart = res.data;
    const items = activeCart?.items || [];

    updateCartBadgeUI(activeCart?.itemCount || 0);

    if (items.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    clearBtn.style.display = 'inline-flex';
    contentEl.style.display = 'grid';

    renderCartItems(items);
    renderOrderSummary(activeCart);
  } catch (err) {
    loadingEl.style.display = 'none';
    showToast(err.message || 'Failed to load shopping cart', 'danger');
  }
}

function renderCartItems(items) {
  const container = document.getElementById('cart-items-list');
  container.innerHTML = '';

  let blockingIssueFound = false;

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '1.25rem';
    card.style.padding = '1.75rem';

    // Top row with product thumbnail + details + delete action
    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.justifyContent = 'space-between';
    topRow.style.alignItems = 'flex-start';
    topRow.style.gap = '1.25rem';

    const leftCol = document.createElement('div');
    leftCol.style.display = 'flex';
    leftCol.style.gap = '1.15rem';
    leftCol.style.alignItems = 'center';

    const initial = escapeHtml((item.product?.name || 'P').charAt(0).toUpperCase());
    const thumb = document.createElement('div');
    thumb.style.width = '52px';
    thumb.style.height = '52px';
    thumb.style.borderRadius = '12px';
    thumb.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)';
    thumb.style.color = '#818CF8';
    thumb.style.border = '1px solid rgba(99, 102, 241, 0.4)';
    thumb.style.fontWeight = '850';
    thumb.style.fontSize = '1.35rem';
    thumb.style.display = 'flex';
    thumb.style.alignItems = 'center';
    thumb.style.justifyContent = 'center';
    thumb.style.flexShrink = '0';
    thumb.textContent = initial;

    const infoDiv = document.createElement('div');
    const title = document.createElement('h4');
    title.style.fontSize = '1.05rem';
    title.style.fontWeight = '750';
    title.style.color = '#FFFFFF';
    title.style.marginBottom = '0.25rem';
    title.textContent = item.product?.name || 'Product';

    const unitPrice = document.createElement('div');
    unitPrice.style.fontSize = '0.9rem';
    unitPrice.style.color = 'var(--text-muted)';
    unitPrice.textContent = `Unit Price: ${formatPrice(item.unitPrice)}`;

    infoDiv.appendChild(title);
    infoDiv.appendChild(unitPrice);

    leftCol.appendChild(thumb);
    leftCol.appendChild(infoDiv);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-secondary btn-sm';
    deleteBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      </svg>
      <span>Remove</span>
    `;
    deleteBtn.onclick = () => handleRemoveItem(item.product._id);

    topRow.appendChild(leftCol);
    topRow.appendChild(deleteBtn);

    // Quantity selector & line total
    const bottomRow = document.createElement('div');
    bottomRow.style.display = 'flex';
    bottomRow.style.justifyContent = 'space-between';
    bottomRow.style.alignItems = 'center';
    bottomRow.style.paddingTop = '1rem';
    bottomRow.style.borderTop = '1px solid var(--border-light)';

    const qtyControls = document.createElement('div');
    qtyControls.style.display = 'flex';
    qtyControls.style.alignItems = 'center';
    qtyControls.style.gap = '0.4rem';
    qtyControls.style.background = '#0B0F19';
    qtyControls.style.border = '1px solid var(--border-dark)';
    qtyControls.style.borderRadius = '8px';
    qtyControls.style.padding = '3px 6px';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'btn btn-secondary btn-sm';
    minusBtn.style.minHeight = '28px';
    minusBtn.style.padding = '0 8px';
    minusBtn.style.border = 'none';
    minusBtn.style.background = 'transparent';
    minusBtn.style.boxShadow = 'none';
    minusBtn.style.color = '#CBD5E1';
    minusBtn.textContent = '−';
    minusBtn.disabled = item.quantity <= 1;
    minusBtn.onclick = () => handleUpdateQuantity(item.product._id, item.quantity - 1);

    const qtySpan = document.createElement('span');
    qtySpan.style.minWidth = '2rem';
    qtySpan.style.textAlign = 'center';
    qtySpan.style.fontWeight = '750';
    qtySpan.style.fontSize = '14px';
    qtySpan.style.color = '#FFFFFF';
    qtySpan.textContent = String(item.quantity);

    const plusBtn = document.createElement('button');
    plusBtn.className = 'btn btn-secondary btn-sm';
    plusBtn.style.minHeight = '28px';
    plusBtn.style.padding = '0 8px';
    plusBtn.style.border = 'none';
    plusBtn.style.background = 'transparent';
    plusBtn.style.boxShadow = 'none';
    plusBtn.style.color = '#CBD5E1';
    plusBtn.textContent = '+';
    plusBtn.disabled = item.quantity >= 99 || item.quantity >= (item.availableStock || 99);
    plusBtn.onclick = () => handleUpdateQuantity(item.product._id, item.quantity + 1);

    qtyControls.appendChild(minusBtn);
    qtyControls.appendChild(qtySpan);
    qtyControls.appendChild(plusBtn);

    const lineTotal = document.createElement('div');
    lineTotal.style.fontSize = '1.25rem';
    lineTotal.style.fontWeight = '850';
    lineTotal.style.color = '#818CF8';
    lineTotal.textContent = formatPrice(item.lineTotal);

    bottomRow.appendChild(qtyControls);
    bottomRow.appendChild(lineTotal);

    card.appendChild(topRow);
    card.appendChild(bottomRow);

    // Non-destructive Issue Flagging
    if (item.issue === 'PRODUCT_UNAVAILABLE') {
      blockingIssueFound = true;
      const issueDiv = document.createElement('div');
      issueDiv.className = 'alert alert-danger';
      issueDiv.style.margin = '0';
      issueDiv.innerHTML = '<strong>Product Unavailable:</strong> This product has been deactivated or removed by the seller. Please remove it from your cart.';
      card.appendChild(issueDiv);
    } else if (item.issue === 'INSUFFICIENT_STOCK') {
      blockingIssueFound = true;
      const issueDiv = document.createElement('div');
      issueDiv.className = 'alert alert-warning';
      issueDiv.style.margin = '0';
      issueDiv.innerHTML = `<strong>Insufficient Stock:</strong> Only ${item.availableStock} unit(s) remain in stock. Please reduce your quantity to proceed.`;
      card.appendChild(issueDiv);
    }

    container.appendChild(card);
  }

  // Disable checkout button if blocking issues exist
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    if (blockingIssueFound) {
      checkoutBtn.disabled = true;
      checkoutBtn.title = 'Resolve availability or stock issues before proceeding';
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.title = '';
    }
  }
}

function renderOrderSummary(cart) {
  document.getElementById('summary-item-count').textContent = String(cart.itemCount || 0);
  document.getElementById('summary-subtotal').textContent = formatPrice(cart.subtotal || 0);
  document.getElementById('summary-total').textContent = formatPrice(cart.total || 0);
}

async function handleUpdateQuantity(productId, newQuantity) {
  if (newQuantity < 1) return;
  try {
    await api(`cart/items/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: newQuantity }),
    });
    await loadCart();
  } catch (err) {
    showToast(err.message || 'Failed to update quantity', 'danger');
  }
}

async function handleRemoveItem(productId) {
  try {
    await api(`cart/items/${productId}`, {
      method: 'DELETE',
    });
    showToast('Item removed from cart', 'info');
    await loadCart();
  } catch (err) {
    showToast(err.message || 'Failed to remove item', 'danger');
  }
}
