/**
 * ShopVerse Seller Portal Controller (seller.html)
 */

import { api } from './api.js';
import { guardPage } from './auth.js';
import { renderNavbar } from './navbar.js';
import { initSocket } from './socket.js';
import {
  clearFormErrors,
  escapeHtml,
  formatDate,
  formatPrice,
  showFormErrors,
  showToast,
} from './utils.js';

let myProducts = [];
let categoriesList = [];

document.addEventListener('DOMContentLoaded', async () => {
  const allowed = await guardPage(['seller']);
  if (!allowed) return;

  await renderNavbar('seller');
  initSocket();

  setupTabs();
  setupModal();

  await loadCategories();
  await loadMyProducts();
  await loadIncomingOrders();

  // Real-time event listeners
  window.addEventListener('shopverse:order:new', async () => {
    await loadIncomingOrders();
  });

  window.addEventListener('shopverse:stock:low', async () => {
    await loadMyProducts();
  });
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');
    });
  });
}

async function loadCategories() {
  const select = document.getElementById('prod-category');
  try {
    const res = await api('categories');
    categoriesList = res.data || [];
    select.innerHTML = '<option value="">Select Category</option>';
    for (const cat of categoriesList) {
      const opt = document.createElement('option');
      opt.value = cat._id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    }
  } catch (err) {
    console.warn('Failed to load categories:', err.message);
  }
}

async function loadMyProducts() {
  const tbody = document.getElementById('seller-products-body');
  try {
    const res = await api('products/mine');
    myProducts = res.data || [];

    if (myProducts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3.5rem; color: var(--text-muted);">
            No products in your catalog yet. Click "+ Add New Product" to create your first listing.
          </td>
        </tr>
      `;
      updateLowStockTable([]);
      return;
    }

    renderProductsTable(myProducts);
    updateLowStockTable(myProducts);
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--status-cancelled-text); padding: 2rem;">
          ${escapeHtml(err.message || 'Failed to load products')}
        </td>
      </tr>
    `;
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('seller-products-body');
  tbody.innerHTML = '';

  for (const prod of products) {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    const descText = prod.description ? `${escapeHtml(prod.description.slice(0, 65))}...` : '';
    tdName.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 40px; height: 40px; border-radius: 9px; background: rgba(99, 102, 241, 0.2); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.35); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0;">
          ${escapeHtml((prod.name || 'P').charAt(0).toUpperCase())}
        </div>
        <div>
          <strong style="color: #FFFFFF; font-size: 14px;">${escapeHtml(prod.name || 'Product')}</strong>
          ${descText ? `<br><small style="color: var(--text-muted);">${descText}</small>` : ''}
        </div>
      </div>
    `;

    const tdCategory = document.createElement('td');
    tdCategory.innerHTML = `<span style="font-weight: 600; color: #CBD5E1;">${escapeHtml(prod.category?.name || 'Uncategorized')}</span>`;

    const tdPrice = document.createElement('td');
    tdPrice.style.fontWeight = '750';
    tdPrice.style.color = '#FFFFFF';
    tdPrice.textContent = formatPrice(prod.price);

    // Stock with quick update button
    const tdStock = document.createElement('td');
    const isLow = prod.stock <= (prod.lowStockThreshold || 5);
    tdStock.innerHTML = `
      <span class="${isLow ? 'badge badge-low-stock' : 'badge badge-confirmed'}">${prod.stock} units</span>
      <button class="btn btn-secondary btn-sm" style="margin-left: 0.5rem; padding: 3px 10px; font-size: 11px; min-height: 26px;" title="Adjust stock count">Edit</button>
    `;
    tdStock.querySelector('button').onclick = () => promptStockUpdate(prod);

    const tdStatus = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge ${prod.isActive ? 'badge-active' : 'badge-inactive'}`;
    statusBadge.textContent = prod.isActive ? 'Active' : 'Inactive';
    tdStatus.appendChild(statusBadge);

    // Actions
    const tdActions = document.createElement('td');
    tdActions.style.textAlign = 'right';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary btn-sm';
    editBtn.textContent = 'Edit';
    editBtn.style.marginRight = '0.4rem';
    editBtn.onclick = () => openEditModal(prod);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = `btn btn-sm ${prod.isActive ? 'btn-danger' : 'btn-success'}`;
    toggleBtn.textContent = prod.isActive ? 'Deactivate' : 'Activate';
    toggleBtn.onclick = () => toggleProductActive(prod);

    tdActions.appendChild(editBtn);
    tdActions.appendChild(toggleBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdCategory);
    tr.appendChild(tdPrice);
    tr.appendChild(tdStock);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  }
}

function updateLowStockTable(products) {
  const lowItems = products.filter(
    (p) => p.stock <= (p.lowStockThreshold || 5) && p.isActive
  );
  const badge = document.getElementById('low-stock-count-badge');
  const tbody = document.getElementById('seller-low-stock-body');

  if (lowItems.length > 0) {
    badge.textContent = String(lowItems.length);
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }

  tbody.innerHTML = '';
  if (lowItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3.5rem; color: #34D399;">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">✓</div>
          <strong style="color: #FFFFFF; font-size: 15px;">Healthy Inventory Levels</strong>
          <p style="margin: 4px 0 0; font-size: 13px; color: var(--text-muted);">All active catalog items are maintained comfortably above minimum safety threshold.</p>
        </td>
      </tr>
    `;
    return;
  }

  for (const prod of lowItems) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color: #FFFFFF;">${escapeHtml(prod.name)}</strong></td>
      <td>${escapeHtml(prod.category?.name || 'General')}</td>
      <td><span class="badge ${prod.stock === 0 ? 'badge-out-of-stock' : 'badge-low-stock'}">${prod.stock} units</span></td>
      <td style="color: var(--text-muted);">${prod.lowStockThreshold || 5} units</td>
      <td style="text-align: right;">
        <button class="btn btn-primary btn-sm restock-btn">
          <span>+ Restock (+20)</span>
        </button>
      </td>
    `;
    tr.querySelector('.restock-btn').onclick = async () => {
      try {
        await api(`products/${prod._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ stock: prod.stock + 20 }),
        });
        showToast(`Restocked "${prod.name}" by 20 units!`, 'success');
        await loadMyProducts();
      } catch (err) {
        showToast(err.message || 'Restock failed', 'danger');
      }
    };
    tbody.appendChild(tr);
  }
}

async function loadIncomingOrders() {
  const tbody = document.getElementById('seller-orders-body');
  try {
    const res = await api('orders');
    const orders = res.data?.orders || [];

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3.5rem; color: var(--text-muted);">
            No customer orders received yet. New incoming transactions will appear here in real time.
          </td>
        </tr>
      `;
      return;
    }

    renderOrdersTable(orders);
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--status-cancelled-text); padding: 2rem;">
          ${escapeHtml(err.message || 'Failed to load orders')}
        </td>
      </tr>
    `;
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('seller-orders-body');
  tbody.innerHTML = '';

  for (const order of orders) {
    const tr = document.createElement('tr');

    const tdId = document.createElement('td');
    tdId.innerHTML = `<strong style="font-family: var(--font-mono); font-size: 13px; color: #818CF8;">#${String(order._id).slice(-8).toUpperCase()}</strong>`;

    const tdDate = document.createElement('td');
    tdDate.style.fontSize = '12.5px';
    tdDate.style.color = 'var(--text-muted)';
    tdDate.textContent = formatDate(order.createdAt);

    const tdItems = document.createElement('td');
    tdItems.innerHTML = (order.items || [])
      .map(
        (i) =>
          `<div style="font-size: 13px;">&bull; <strong style="color: #FFFFFF;">${escapeHtml(i.name)}</strong> &times; <strong>${i.quantity}</strong> <span style="color: var(--text-muted);">(${formatPrice(i.priceSnapshot)})</span></div>`
      )
      .join('');

    const tdCustomer = document.createElement('td');
    const addr = order.deliveryAddress;
    const cityCountry = [addr?.city, addr?.country].filter(Boolean).join(', ');
    tdCustomer.innerHTML = `
      <div><strong style="color: #FFFFFF;">${escapeHtml(cityCountry || 'Address on file')}</strong></div>
      ${addr?.street ? `<small style="color: var(--text-muted);">${escapeHtml(addr.street)}</small>` : ''}
    `;

    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge badge-${order.status}`;
    badge.textContent = order.status;
    tdStatus.appendChild(badge);

    const tdAction = document.createElement('td');
    tdAction.style.textAlign = 'right';

    // State machine progression: pending -> confirmed -> shipped -> delivered
    const nextStep = getNextStatus(order.status);
    if (nextStep) {
      const stepBtn = document.createElement('button');
      stepBtn.className = `btn btn-sm ${
        nextStep.status === 'confirmed'
          ? 'btn-primary'
          : nextStep.status === 'shipped'
          ? 'btn-secondary'
          : 'btn-success'
      }`;
      stepBtn.textContent = nextStep.label;
      stepBtn.onclick = () => updateOrderStatus(order._id, nextStep.status);
      tdAction.appendChild(stepBtn);
    } else {
      const doneSpan = document.createElement('span');
      doneSpan.style.color = 'var(--text-subtle)';
      doneSpan.style.fontSize = '12.5px';
      doneSpan.style.fontWeight = '600';
      doneSpan.textContent = order.status === 'delivered' ? 'Completed' : 'Cancelled';
      tdAction.appendChild(doneSpan);
    }

    tr.appendChild(tdId);
    tr.appendChild(tdDate);
    tr.appendChild(tdItems);
    tr.appendChild(tdCustomer);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  }
}

function getNextStatus(current) {
  if (current === 'pending') {
    return { status: 'confirmed', label: 'Confirm Order' };
  }
  if (current === 'confirmed') {
    return { status: 'shipped', label: 'Mark Shipped' };
  }
  if (current === 'shipped') {
    return { status: 'delivered', label: 'Mark Delivered' };
  }
  return null;
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    await api(`orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    showToast(`Order status updated to "${newStatus}"`, 'success');
    await loadIncomingOrders();
  } catch (err) {
    showToast(err.message || 'Status transition failed', 'danger');
  }
}

async function toggleProductActive(product) {
  try {
    if (product.isActive) {
      // Soft delete endpoint
      await api(`products/${product._id}`, { method: 'DELETE' });
      showToast(`Product "${product.name}" deactivated`, 'info');
    } else {
      // Reactivate
      await api(`products/${product._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true }),
      });
      showToast(`Product "${product.name}" reactivated`, 'success');
    }
    await loadMyProducts();
  } catch (err) {
    showToast(err.message || 'Action failed', 'danger');
  }
}

async function promptStockUpdate(product) {
  const current = product.stock;
  const input = prompt(`Enter new stock units for "${product.name}":`, String(current));
  if (input === null) return;
  const newStock = parseInt(input.trim(), 10);
  if (isNaN(newStock) || newStock < 0) {
    alert('Please enter a valid non-negative integer.');
    return;
  }
  try {
    await api(`products/${product._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock: newStock }),
    });
    showToast(`Stock updated to ${newStock}`, 'success');
    await loadMyProducts();
  } catch (err) {
    showToast(err.message || 'Failed to update stock', 'danger');
  }
}

// -----------------------------------------------------------------------------
// Product Modal Setup (Create / Edit)
// -----------------------------------------------------------------------------
function setupModal() {
  const modal = document.getElementById('product-modal');
  const openBtn = document.getElementById('open-create-product-btn');
  const closeBtn = document.getElementById('close-product-modal-btn');
  const cancelBtn = document.getElementById('cancel-product-modal-btn');
  const form = document.getElementById('product-form');
  const alertEl = document.getElementById('product-modal-alert');

  const closeModal = () => {
    modal.classList.remove('open');
    form.reset();
    document.getElementById('prod-id').value = '';
    clearFormErrors(form, alertEl);
  };

  openBtn.addEventListener('click', () => {
    document.getElementById('product-modal-title').textContent = 'Add New Product';
    document.getElementById('prod-id').value = '';
    form.reset();
    clearFormErrors(form, alertEl);
    modal.classList.add('open');
  });

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form, alertEl);

    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const description = document.getElementById('prod-description').value.trim();
    const price = parseFloat(document.getElementById('prod-price').value);
    const category = document.getElementById('prod-category').value;
    const stock = parseInt(document.getElementById('prod-stock').value, 10);
    const lowStockThreshold = parseInt(document.getElementById('prod-threshold').value, 10) || 5;
    const imageVal = document.getElementById('prod-images').value.trim();
    const images = imageVal ? [imageVal] : [];

    const payload = {
      name,
      description,
      price,
      category,
      stock,
      lowStockThreshold,
      images,
    };

    const saveBtn = document.getElementById('save-product-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (id) {
        // Edit existing
        await api(`products/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast('Product updated successfully!', 'success');
      } else {
        // Create new
        await api('products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Product created successfully!', 'success');
      }

      closeModal();
      await loadMyProducts();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Product';
      showFormErrors(form, err.errors || [], alertEl, err.message || 'Failed to save product');
    }
  });
}

function openEditModal(prod) {
  const modal = document.getElementById('product-modal');
  const form = document.getElementById('product-form');
  const alertEl = document.getElementById('product-modal-alert');

  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('prod-id').value = prod._id;
  document.getElementById('prod-name').value = prod.name;
  document.getElementById('prod-description').value = prod.description || '';
  document.getElementById('prod-price').value = prod.price;
  document.getElementById('prod-category').value = prod.category?._id || prod.category || '';
  document.getElementById('prod-stock').value = prod.stock;
  document.getElementById('prod-threshold').value = prod.lowStockThreshold || 5;
  document.getElementById('prod-images').value = prod.images && prod.images[0] ? prod.images[0] : '';

  clearFormErrors(form, alertEl);
  modal.classList.add('open');
}
