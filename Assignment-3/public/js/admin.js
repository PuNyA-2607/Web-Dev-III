/**
 * ShopVerse System Administration Console Controller (admin.html)
 */

import { api } from './api.js';
import { guardPage, getUser } from './auth.js';
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

let allCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
  const allowed = await guardPage(['admin']);
  if (!allowed) return;

  await renderNavbar('admin');
  initSocket();

  setupTabs();
  setupCategoryModal();

  await loadUsers();
  await loadCategories();
  await loadAllOrders();
  await loadReports();

  document.getElementById('refresh-sales-btn').addEventListener('click', async () => {
    await loadReports();
    showToast('Analytical reports refreshed', 'info');
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

// -----------------------------------------------------------------------------
// Tab 1: User Management
// -----------------------------------------------------------------------------
async function loadUsers() {
  const tbody = document.getElementById('admin-users-body');
  try {
    const res = await api('users');
    const users = res.data?.users || [];
    renderUsersTable(users);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--status-cancelled-text); padding: 2rem;">${escapeHtml(err.message || 'Failed to load users')}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('admin-users-body');
  tbody.innerHTML = '';
  const currentUser = getUser();

  for (const u of users) {
    const tr = document.createElement('tr');
    const isSelf = currentUser && (currentUser.id === u._id || currentUser._id === u._id);
    const initial = escapeHtml((u.name || 'U').charAt(0).toUpperCase());

    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(99, 102, 241, 0.2); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.35); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0;">
            ${initial}
          </div>
          <div>
            <strong style="color: #FFFFFF; font-size: 13.5px;">${escapeHtml(u.name)}</strong>
            ${isSelf ? '<span class="badge badge-active" style="font-size: 10px; padding: 2px 7px; margin-left: 6px;">CURRENT</span>' : ''}
          </div>
        </div>
      </td>
      <td style="color: var(--text-secondary);">${escapeHtml(u.email)}</td>
      <td><span class="user-role-tag ${u.role}">${escapeHtml(u.role)}</span></td>
      <td>
        <span class="badge ${u.isActive ? 'badge-active' : 'badge-inactive'}">
          ${u.isActive ? 'Active' : 'Deactivated'}
        </span>
      </td>
      <td style="color: var(--text-muted); font-size: 12.5px;">${formatDate(u.createdAt)}</td>
      <td style="text-align: right;">
        <button class="btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'} toggle-user-btn" ${isSelf ? 'disabled title="Cannot deactivate your own active session"' : ''}>
          ${u.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    `;

    const btn = tr.querySelector('.toggle-user-btn');
    if (!isSelf) {
      btn.onclick = () => toggleUserStatus(u);
    }

    tbody.appendChild(tr);
  }
}

async function toggleUserStatus(user) {
  const actionText = user.isActive ? 'deactivate' : 'activate';
  if (!confirm(`Are you sure you want to ${actionText} user "${user.name}" (${user.email})?`)) {
    return;
  }

  try {
    await api(`users/${user._id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    showToast(`User status updated to ${!user.isActive ? 'Active' : 'Deactivated'}`, 'success');
    await loadUsers();
  } catch (err) {
    showToast(err.message || 'Status update failed', 'danger');
  }
}

// -----------------------------------------------------------------------------
// Tab 2: Category Management
// -----------------------------------------------------------------------------
async function loadCategories() {
  const tbody = document.getElementById('admin-categories-body');
  try {
    const res = await api('categories');
    allCategories = res.data || [];
    renderCategoriesTable(allCategories);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--status-cancelled-text); padding: 2rem;">${escapeHtml(err.message || 'Failed to load categories')}</td></tr>`;
  }
}

function renderCategoriesTable(categories) {
  const tbody = document.getElementById('admin-categories-body');
  tbody.innerHTML = '';

  for (const cat of categories) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color: #FFFFFF;">${escapeHtml(cat.name)}</strong></td>
      <td><code style="background: #0B0F19; color: #818CF8; border: 1px solid var(--border-dark); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-family: var(--font-mono);">${escapeHtml(cat.slug)}</code></td>
      <td style="color: var(--text-muted); font-size: 13px;">${escapeHtml(cat.description || '—')}</td>
      <td style="text-align: right;">
        <button class="btn btn-secondary btn-sm edit-cat-btn" style="margin-right: 0.35rem;">Edit</button>
        <button class="btn btn-danger btn-sm del-cat-btn">Delete</button>
      </td>
    `;

    tr.querySelector('.edit-cat-btn').onclick = () => openEditCategoryModal(cat);
    tr.querySelector('.del-cat-btn').onclick = () => handleDeleteCategory(cat);

    tbody.appendChild(tr);
  }
}

function setupCategoryModal() {
  const modal = document.getElementById('category-modal');
  const openBtn = document.getElementById('open-create-category-btn');
  const closeBtn = document.getElementById('close-cat-modal-btn');
  const cancelBtn = document.getElementById('cancel-cat-modal-btn');
  const form = document.getElementById('category-form');
  const alertEl = document.getElementById('cat-modal-alert');

  const closeModal = () => {
    modal.classList.remove('open');
    form.reset();
    document.getElementById('cat-id').value = '';
    clearFormErrors(form, alertEl);
  };

  openBtn.addEventListener('click', () => {
    document.getElementById('category-modal-title').textContent = 'Create Category';
    document.getElementById('cat-id').value = '';
    form.reset();
    clearFormErrors(form, alertEl);
    modal.classList.add('open');
  });

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form, alertEl);

    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value.trim();
    const description = document.getElementById('cat-desc').value.trim();

    const saveBtn = document.getElementById('save-cat-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (id) {
        await api(`categories/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, description }),
        });
        showToast('Category updated successfully!', 'success');
      } else {
        await api('categories', {
          method: 'POST',
          body: JSON.stringify({ name, description }),
        });
        showToast('Category created successfully!', 'success');
      }

      closeModal();
      await loadCategories();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Category';
      showFormErrors(form, err.errors || [], alertEl, err.message || 'Operation failed');
    }
  });
}

function openEditCategoryModal(cat) {
  const modal = document.getElementById('category-modal');
  const form = document.getElementById('category-form');
  const alertEl = document.getElementById('cat-modal-alert');

  document.getElementById('category-modal-title').textContent = 'Edit Category';
  document.getElementById('cat-id').value = cat._id;
  document.getElementById('cat-name').value = cat.name;
  document.getElementById('cat-desc').value = cat.description || '';

  clearFormErrors(form, alertEl);
  modal.classList.add('open');
}

async function handleDeleteCategory(cat) {
  if (!confirm(`Are you sure you want to delete category "${cat.name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    await api(`categories/${cat._id}`, { method: 'DELETE' });
    showToast(`Category "${cat.name}" deleted`, 'info');
    await loadCategories();
  } catch (err) {
    showToast(err.message || 'Cannot delete category with associated products.', 'danger', 6000);
  }
}

// -----------------------------------------------------------------------------
// Tab 3: Global Orders
// -----------------------------------------------------------------------------
async function loadAllOrders() {
  const tbody = document.getElementById('admin-orders-body');
  try {
    const res = await api('orders');
    const orders = res.data?.orders || [];

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">No orders placed across the system.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    for (const order of orders) {
      let customerDisplay = '—';
      if (order.customer && typeof order.customer === 'object') {
        if (order.customer.name && order.customer.email) {
          customerDisplay = `<strong style="color: #FFFFFF;">${order.customer.name}</strong> <span style="color: var(--text-muted);">(${order.customer.email})</span>`;
        } else if (order.customer.name) {
          customerDisplay = `<strong style="color: #FFFFFF;">${order.customer.name}</strong>`;
        } else if (order.customer.email) {
          customerDisplay = order.customer.email;
        } else if (order.customer._id) {
          customerDisplay = String(order.customer._id);
        }
      } else if (order.customer) {
        customerDisplay = String(order.customer);
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="font-family: var(--font-mono); font-size: 13px; color: #818CF8;">#${String(order._id || '').slice(-8).toUpperCase()}</strong></td>
        <td style="color: var(--text-muted); font-size: 12.5px;">${formatDate(order.createdAt)}</td>
        <td>${customerDisplay}</td>
        <td style="font-weight: 800; color: #FFFFFF;">${formatPrice(order.total || 0)}</td>
        <td><span class="badge badge-${order.status || 'pending'}">${escapeHtml(order.status || 'unknown')}</span></td>
        <td style="font-size: 12.5px; color: var(--text-secondary);">${escapeHtml(order.payment?.method || 'SIMULATED')} &bull; <span style="font-weight: 700; color: #34D399;">${escapeHtml(order.payment?.status || 'completed')}</span></td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--status-cancelled-text); padding: 2rem;">${escapeHtml(err.message || 'Failed to load orders')}</td></tr>`;
  }
}

// -----------------------------------------------------------------------------
// Tab 4: Aggregation Reports
// -----------------------------------------------------------------------------
async function loadReports() {
  await Promise.all([loadSalesReport(), loadBestSellersReport(), loadInventoryReport()]);
}

async function loadSalesReport() {
  const tbody = document.getElementById('report-sales-body');
  try {
    const res = await api('reports/sales');
    const reportData = res.data || {};
    const rows = Array.isArray(reportData.dailyBreakdown)
      ? reportData.dailyBreakdown
      : Array.isArray(reportData)
      ? reportData
      : [];
    const summary = reportData.summary;

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No completed sales data available for this range.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    for (const row of rows) {
      const orders = row.ordersCount ?? row.orderCount ?? 0;
      const revenue = Number(row.revenue ?? row.totalRevenue ?? 0);
      const avgOrderValue = orders > 0 ? revenue / orders : 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: #FFFFFF;">${escapeHtml(row.date || '—')}</strong></td>
        <td style="text-align: center; font-weight: 650; color: #CBD5E1;">${orders}</td>
        <td style="text-align: right; font-weight: 800; color: #818CF8;">${formatPrice(revenue)}</td>
        <td style="text-align: right; font-weight: 650; color: #FFFFFF;">${formatPrice(avgOrderValue)}</td>
      `;
      tbody.appendChild(tr);
    }

    // Render summary totals row if available
    if (summary && (summary.totalOrders !== undefined || summary.totalRevenue !== undefined)) {
      const totalOrders = summary.totalOrders ?? 0;
      const totalRevenue = Number(summary.totalRevenue ?? 0);
      const overallAvg = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalTr = document.createElement('tr');
      totalTr.style.background = 'rgba(99, 102, 241, 0.12)';
      totalTr.style.borderTop = '2px solid rgba(99, 102, 241, 0.4)';
      totalTr.style.fontWeight = '750';
      totalTr.innerHTML = `
        <td><strong style="color: #FFFFFF;">Total / Summary</strong></td>
        <td style="text-align: center; color: #CBD5E1;"><strong>${totalOrders} orders</strong></td>
        <td style="text-align: right; color: #818CF8; font-size: 15px;"><strong>${formatPrice(totalRevenue)}</strong></td>
        <td style="text-align: right; color: #FFFFFF;"><strong>${formatPrice(overallAvg)}</strong></td>
      `;
      tbody.appendChild(totalTr);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--status-cancelled-text); padding: 1.5rem;">${escapeHtml(err.message || 'Failed to load sales report')}</td></tr>`;
  }
}

async function loadBestSellersReport() {
  const tbody = document.getElementById('report-bestsellers-body');
  try {
    const res = await api('reports/best-sellers?limit=10');
    const records = Array.isArray(res.data) ? res.data : [];

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No products have been purchased yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    records.forEach((item, index) => {
      const unitsSold = item.totalUnitsSold ?? item.totalQuantitySold ?? 0;
      const revenue = Number(item.totalRevenue ?? item.totalRevenueGenerated ?? 0);
      const stock = item.currentStock !== undefined && item.currentStock !== null ? `${item.currentStock} units` : '—';
      const rankBadge = index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span style="display: inline-block; width: 44px; font-weight: 800; font-size: 13px; color: #818CF8;">${rankBadge}</span>
          <strong style="color: #FFFFFF;">${escapeHtml(item.name || String(item.productId) || 'Product')}</strong>
        </td>
        <td style="text-align: center; font-weight: 750; color: #34D399;">${unitsSold}</td>
        <td style="text-align: right; font-weight: 800; color: #818CF8;">${formatPrice(revenue)}</td>
        <td style="text-align: right; color: #CBD5E1;">${stock}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--status-cancelled-text); padding: 1.5rem;">${escapeHtml(err.message || 'Failed to load best sellers')}</td></tr>`;
  }
}

async function loadInventoryReport() {
  const tbody = document.getElementById('report-inventory-body');
  try {
    const res = await api('reports/inventory');
    const records = Array.isArray(res.data) ? res.data : [];

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No inventory records available.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    for (const cat of records) {
      const products = cat.totalProducts ?? cat.productCount ?? 0;
      const stockUnits = cat.totalStock ?? cat.totalStockUnits ?? 0;
      const valuation = Number(cat.totalStockValue ?? cat.totalValuation ?? 0);
      const lowStock = cat.lowStockProductsCount ?? cat.lowStockCount ?? 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: #FFFFFF;">${escapeHtml(cat.categoryName || 'Uncategorized')}</strong></td>
        <td style="text-align: center; font-weight: 600; color: #CBD5E1;">${products}</td>
        <td style="text-align: center; font-weight: 700; color: #FFFFFF;">${stockUnits}</td>
        <td style="text-align: right; font-weight: 800; color: #818CF8;">${formatPrice(valuation)}</td>
        <td style="text-align: center;"><span class="${lowStock > 0 ? 'badge badge-low-stock' : 'badge badge-active'}">${lowStock > 0 ? `${lowStock} warning` : 'Healthy'}</span></td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--status-cancelled-text); padding: 1.5rem;">${escapeHtml(err.message || 'Failed to load inventory report')}</td></tr>`;
  }
}
