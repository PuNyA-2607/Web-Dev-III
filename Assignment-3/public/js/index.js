/**
 * ShopVerse Product Catalog Controller (index.html)
 */

import { api } from './api.js';
import { getUser, getAccessToken, initAuth } from './auth.js';
import { renderNavbar, updateCartBadgeUI } from './navbar.js';
import { initSocket } from './socket.js';
import { escapeHtml, formatPrice, showToast } from './utils.js';

let currentPage = 1;
const pageLimit = 12;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize auth on page load (restores tokens and loads profile if refresh token exists)
  const auth = await initAuth();

  // 2. Render navigation bar
  await renderNavbar('products');

  // 3. Connect Socket.IO only if authenticated
  if (auth && auth.accessToken) {
    initSocket();
  }

  // 4. Load categories into dropdown
  await loadCategories();

  // 5. Load initial product list
  await loadProducts(1);

  // Setup form event listeners
  const filterForm = document.getElementById('filter-form');
  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loadProducts(1);
  });

  const resetBtn = document.getElementById('reset-filter-btn');
  resetBtn.addEventListener('click', () => {
    filterForm.reset();
    const sortSelect = document.getElementById('filter-sort');
    if (sortSelect) sortSelect.value = '-createdAt';
    loadProducts(1);
  });

  // Listen for real-time stock drops to update UI cards dynamically
  window.addEventListener('shopverse:stock:low', () => {
    loadProducts(currentPage);
  });
});

async function loadCategories() {
  const select = document.getElementById('filter-category');
  try {
    const res = await api('categories');
    if (res && res.data) {
      for (const cat of res.data) {
        const option = document.createElement('option');
        option.value = cat._id;
        option.textContent = cat.name;
        select.appendChild(option);
      }
    }
  } catch (err) {
    console.warn('Failed to load categories:', err.message);
  }
}

async function loadProducts(page = 1) {
  currentPage = page;
  const grid = document.getElementById('product-grid');
  const loadingEl = document.getElementById('catalog-loading');
  const emptyEl = document.getElementById('catalog-empty');
  const paginationEl = document.getElementById('catalog-pagination');

  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  grid.innerHTML = '';
  paginationEl.style.display = 'none';

  // Gather filter values
  const search = document.getElementById('filter-search')?.value.trim() || '';
  const category = document.getElementById('filter-category')?.value.trim() || '';
  const minPrice = document.getElementById('filter-min-price')?.value.trim() || '';
  const maxPrice = document.getElementById('filter-max-price')?.value.trim() || '';
  const sort = document.getElementById('filter-sort')?.value.trim() || '';
  const inStock = document.getElementById('filter-in-stock')?.checked || false;

  const params = new URLSearchParams();
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(pageLimit, 10) || 12));

  params.set('page', String(safePage));
  params.set('limit', String(safeLimit));

  // Only include search if non-empty
  if (search) {
    params.set('search', search);
  }

  // Only include category if selected and non-empty
  if (category) {
    params.set('category', category);
  }

  // Only include price limits if non-empty, valid non-negative numbers
  if (minPrice !== '' && !isNaN(Number(minPrice)) && Number(minPrice) >= 0) {
    params.set('minPrice', String(Number(minPrice)));
  }
  if (maxPrice !== '' && !isNaN(Number(maxPrice)) && Number(maxPrice) >= 0) {
    params.set('maxPrice', String(Number(maxPrice)));
  }

  // Only include inStock if true (omit when false / unchecked)
  if (inStock === true) {
    params.set('inStock', 'true');
  }

  // Backend sort whitelist: 'price', '-price', 'createdAt', '-createdAt', 'name', '-name'
  // Backend default sort is '-createdAt'; omit when empty, invalid, or matching default
  const validSorts = ['price', '-price', 'createdAt', '-createdAt', 'name', '-name'];
  if (sort && sort !== '-createdAt' && validSorts.includes(sort)) {
    params.set('sort', sort);
  }

  try {
    const res = await api(`products?${params.toString()}`);
    loadingEl.style.display = 'none';

    const products = res.data?.products || [];
    const pagination = res.data?.pagination || { totalPages: 1 };

    if (products.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    renderProductCards(products);
    renderPagination(pagination);
  } catch (err) {
    loadingEl.style.display = 'none';
    showToast(err.message || 'Failed to load products', 'danger');
  }
}

function renderProductCards(products) {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = '';

  const user = getUser();
  const token = getAccessToken();
  const isCustomer = user && user.role === 'customer' && Boolean(token);
  const isPrivileged = user && (user.role === 'seller' || user.role === 'admin') && Boolean(token);

  for (const product of products) {
    const card = document.createElement('div');
    card.className = 'product-card';

    // Image container
    const imgContainer = document.createElement('div');
    imgContainer.className = 'product-image-container';

    if (product.images && product.images.length > 0 && product.images[0]) {
      const img = document.createElement('img');
      img.className = 'product-image';
      img.src = product.images[0];
      img.alt = product.name;
      img.loading = 'lazy';
      img.onerror = () => {
        img.remove();
        const initial = escapeHtml((product.name || 'P').charAt(0).toUpperCase());
        imgContainer.innerHTML = `<span class="product-image-fallback">${initial}</span>`;
      };
      imgContainer.appendChild(img);
    } else {
      const initial = escapeHtml((product.name || 'P').charAt(0).toUpperCase());
      imgContainer.innerHTML = `<span class="product-image-fallback">${initial}</span>`;
    }

    // Badge overlay for low stock or out of stock
    if (product.stock === 0) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-out-of-stock product-badge-overlay';
      badge.textContent = 'Out of Stock';
      imgContainer.appendChild(badge);
    } else if (product.stock <= (product.lowStockThreshold || 5)) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-low-stock product-badge-overlay';
      badge.textContent = `Only ${product.stock} left`;
      imgContainer.appendChild(badge);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'product-body';

    const catTag = document.createElement('div');
    catTag.className = 'product-category-tag';
    catTag.textContent = product.category?.name || 'General';

    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = product.name;

    const desc = document.createElement('p');
    desc.className = 'product-desc';
    desc.textContent = product.description || 'No description provided.';

    // Footer
    const footer = document.createElement('div');
    footer.className = 'product-footer';

    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = formatPrice(product.price);

    const actionContainer = document.createElement('div');

    if (isCustomer) {
      if (product.stock > 0) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary btn-sm';
        addBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="8" cy="21" r="1"/>
            <circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
          </svg>
          <span>Add to Bag</span>
        `;
        addBtn.onclick = () => handleAddToCart(product._id, addBtn);
        actionContainer.appendChild(addBtn);
      } else {
        const soldOutBtn = document.createElement('button');
        soldOutBtn.className = 'btn btn-secondary btn-sm';
        soldOutBtn.disabled = true;
        soldOutBtn.textContent = 'Sold Out';
        actionContainer.appendChild(soldOutBtn);
      }
    } else if (isPrivileged) {
      const roleNotice = document.createElement('span');
      roleNotice.style.fontSize = '0.75rem';
      roleNotice.style.fontWeight = '600';
      roleNotice.style.color = 'var(--text-muted)';
      roleNotice.textContent = `(${user.role})`;
      actionContainer.appendChild(roleNotice);
    } else {
      // Guest: redirect to login
      const signinLink = document.createElement('a');
      signinLink.href = '/login.html';
      signinLink.className = 'btn btn-primary btn-sm';
      signinLink.textContent = 'Buy Now';
      actionContainer.appendChild(signinLink);
    }

    footer.appendChild(price);
    footer.appendChild(actionContainer);

    body.appendChild(catTag);
    body.appendChild(title);
    body.appendChild(desc);
    body.appendChild(footer);

    card.appendChild(imgContainer);
    card.appendChild(body);
    grid.appendChild(card);
  }
}

async function handleAddToCart(productId, buttonEl) {
  // Ensure authentication state is verified before initiating cart mutation
  const auth = await initAuth();
  if (!auth || !auth.user || auth.user.role !== 'customer') {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?redirect=${returnUrl}`;
    return;
  }

  const originalContent = buttonEl.innerHTML;
  buttonEl.disabled = true;
  buttonEl.innerHTML = `
    <span style="display: inline-block; width: 12px; height: 12px; border: 2px solid #FFF; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></span>
    <span>Adding...</span>
  `;

  try {
    const res = await api('cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity: 1 }),
    });

    buttonEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
      <span>Added!</span>
    `;
    showToast('Product added to your cart!', 'success');

    if (res.data && res.data.itemCount !== undefined) {
      updateCartBadgeUI(res.data.itemCount);
    }

    setTimeout(() => {
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalContent;
    }, 1400);
  } catch (err) {
    buttonEl.disabled = false;
    buttonEl.innerHTML = originalContent;
    showToast(err.message || 'Failed to add item to cart', 'danger');
  }
}

function renderPagination(pagination) {
  const paginationEl = document.getElementById('catalog-pagination');
  paginationEl.innerHTML = '';

  const { page, totalPages } = pagination;
  if (!totalPages || totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = 'flex';

  // Prev button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'pagination-btn';
  prevBtn.innerHTML = '&larr; Prev';
  prevBtn.disabled = page <= 1;
  prevBtn.onclick = () => loadProducts(page - 1);
  paginationEl.appendChild(prevBtn);

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    // Show first, last, and window around current
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `pagination-btn ${i === page ? 'active' : ''}`;
      pageBtn.textContent = String(i);
      pageBtn.onclick = () => loadProducts(i);
      paginationEl.appendChild(pageBtn);
    }
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'pagination-btn';
  nextBtn.innerHTML = 'Next &rarr;';
  nextBtn.disabled = page >= totalPages;
  nextBtn.onclick = () => loadProducts(page + 1);
  paginationEl.appendChild(nextBtn);
}
