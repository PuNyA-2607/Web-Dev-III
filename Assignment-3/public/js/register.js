/**
 * ShopVerse Register Controller (register.html)
 */

import { api } from './api.js';
import { setAccessToken, setRefreshToken, setUser } from './auth.js';
import { renderNavbar } from './navbar.js';
import { clearFormErrors, showFormErrors, showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar('register');

  const form = document.getElementById('register-form');
  const alertEl = document.getElementById('register-alert');
  const submitBtn = document.getElementById('register-submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form, alertEl);

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPassword) {
      showFormErrors(
        form,
        [{ field: 'confirmPassword', message: 'Passwords do not match.' }],
        alertEl,
        'Please verify that both passwords match.'
      );
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const response = await api('auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });

      const user = response.data?.user;
      const accessToken = response.data?.tokens?.accessToken || response.data?.accessToken;
      const refreshToken = response.data?.tokens?.refreshToken || response.data?.refreshToken;

      // Auto login on registration
      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      setUser(user);

      showToast('Account created successfully!', 'success');

      if (user.role === 'seller') {
        window.location.href = '/seller.html';
      } else {
        window.location.href = '/index.html';
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register Account';
      showFormErrors(form, err.errors || [], alertEl, err.message || 'Registration failed');
    }
  });
});
