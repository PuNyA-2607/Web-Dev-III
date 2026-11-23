/**
 * ShopVerse Frontend Utilities
 */

/**
 * Escape HTML special characters to prevent XSS injection
 * @param {string|number|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format numeric amount into currency string with 2 decimals
 * @param {number|string} amount
 * @returns {string}
 */
export function formatPrice(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}

/**
 * Format ISO date string into readable local format
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Display toast notification with modern icons and dismissible button
 * @param {string} message
 * @param {'success'|'danger'|'warning'|'info'} type
 * @param {number} durationMs
 */
export function showToast(message, type = 'info', durationMs = 4500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    `,
    danger: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" x2="9" y1="9" y2="15"/>
        <line x1="9" x2="15" y1="9" y2="15"/>
      </svg>
    `,
    warning: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <line x1="12" x2="12" y1="9" y2="13"/>
        <line x1="12" x2="12.01" y1="17" y2="17"/>
      </svg>
    `,
    info: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" x2="12" y1="16" y2="12"/>
        <line x1="12" x2="12.01" y1="8" y2="8"/>
      </svg>
    `,
  };

  const iconContainer = document.createElement('div');
  iconContainer.style.display = 'flex';
  iconContainer.style.alignItems = 'center';
  iconContainer.style.flexShrink = '0';
  iconContainer.innerHTML = iconMap[type] || iconMap.info;
  toast.appendChild(iconContainer);

  const textSpan = document.createElement('div');
  textSpan.style.flex = '1';
  textSpan.style.lineHeight = '1.4';
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = 'var(--text-subtle)';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.padding = '0 0 0 8px';
  closeBtn.style.lineHeight = '1';
  closeBtn.onclick = () => removeToast(toast);
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  const timer = setTimeout(() => {
    removeToast(toast);
  }, durationMs);

  function removeToast(el) {
    clearTimeout(timer);
    el.style.animation = 'fadeOut 0.25s ease forwards';
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 250);
  }
}

/**
 * Show field-level validation errors from Joi/backend error array
 * @param {HTMLFormElement} form
 * @param {Array<{field: string, message: string}>} errors
 * @param {HTMLElement} [generalAlertEl]
 * @param {string} [generalMessage]
 */
export function showFormErrors(form, errors = [], generalAlertEl = null, generalMessage = '') {
  // Clear existing errors
  clearFormErrors(form, generalAlertEl);

  if (generalAlertEl && generalMessage) {
    generalAlertEl.textContent = generalMessage;
    generalAlertEl.style.display = 'block';
  }

  if (Array.isArray(errors) && errors.length > 0) {
    for (const err of errors) {
      const fieldName = err.field || '';
      const input = form.querySelector(`[name="${fieldName}"]`);
      if (input) {
        input.classList.add('is-invalid');
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.textContent = err.message;
        input.parentNode.appendChild(feedback);
      }
    }
  }
}

/**
 * Clear all form validation error markings
 * @param {HTMLFormElement} form
 * @param {HTMLElement} [generalAlertEl]
 */
export function clearFormErrors(form, generalAlertEl = null) {
  if (generalAlertEl) {
    generalAlertEl.style.display = 'none';
    generalAlertEl.textContent = '';
  }
  const invalids = form.querySelectorAll('.is-invalid');
  invalids.forEach((el) => el.classList.remove('is-invalid'));
  const feedbacks = form.querySelectorAll('.invalid-feedback');
  feedbacks.forEach((el) => el.remove());
}
