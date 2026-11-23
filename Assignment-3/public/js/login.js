/**
 * ShopVerse Login Controller (login.html)
 */

import { api } from './api.js';
import { setAccessToken, setRefreshToken, setUser, initAuth } from './auth.js';
import { renderNavbar } from './navbar.js';
import { clearFormErrors, showFormErrors, showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar('login');

  // If already logged in, redirect by role immediately
  const auth = await initAuth();
  if (auth && auth.user) {
    const urlParams = new URLSearchParams(window.location.search);
    handleRedirect(auth.user.role, urlParams.get('redirect'));
    return;
  }

  const form = document.getElementById('login-form');
  const alertEl = document.getElementById('login-alert');
  const submitBtn = document.getElementById('login-submit-btn');

  // Quick Demo Buttons
  document.getElementById('demo-customer-btn').addEventListener('click', () => {
    document.getElementById('login-email').value = 'customer@example.com';
    document.getElementById('login-password').value = 'CustomerPass123!';
    clearFormErrors(form, alertEl);
  });

  document.getElementById('demo-seller-btn').addEventListener('click', () => {
    document.getElementById('login-email').value = 'seller@example.com';
    document.getElementById('login-password').value = 'SellerPass123!';
    clearFormErrors(form, alertEl);
  });

  document.getElementById('demo-admin-btn').addEventListener('click', () => {
    document.getElementById('login-email').value = 'admin@example.com';
    document.getElementById('login-password').value = 'AdminPass123!';
    clearFormErrors(form, alertEl);
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form, alertEl);

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const response = await api('auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const user = response.data?.user;
      const accessToken = response.data?.tokens?.accessToken || response.data?.accessToken;
      const refreshToken = response.data?.tokens?.refreshToken || response.data?.refreshToken;

      // Store access token in memory & refresh token and user in sessionStorage
      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      setUser(user);

      showToast(`Welcome back, ${user?.name || 'User'}!`, 'success');

      // Check for redirect query param
      const urlParams = new URLSearchParams(window.location.search);
      handleRedirect(user.role, urlParams.get('redirect'));
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue to Account';
      showFormErrors(form, err.errors || [], alertEl, err.message || 'Login failed');
    }
  });
});

function handleRedirect(role, redirectUrl) {
  if (redirectUrl && !redirectUrl.includes('login') && !redirectUrl.includes('register')) {
    const isSeller = role === 'seller';
    const isAdmin = role === 'admin';
    const isCustomer = role === 'customer';

    if (isSeller && (redirectUrl.startsWith('/cart.html') || redirectUrl.startsWith('/orders.html') || redirectUrl.startsWith('/admin.html'))) {
      redirectByRole(role);
      return;
    }
    if (isAdmin && (redirectUrl.startsWith('/cart.html') || redirectUrl.startsWith('/seller.html'))) {
      redirectByRole(role);
      return;
    }
    if (isCustomer && (redirectUrl.startsWith('/seller.html') || redirectUrl.startsWith('/admin.html'))) {
      redirectByRole(role);
      return;
    }
    window.location.href = redirectUrl;
  } else {
    redirectByRole(role);
  }
}

function redirectByRole(role) {
  if (role === 'seller') {
    window.location.href = '/seller.html';
  } else if (role === 'admin') {
    window.location.href = '/admin.html';
  } else {
    window.location.href = '/index.html';
  }
}
