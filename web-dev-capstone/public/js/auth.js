/**
 * ShopVerse Authentication State and Session Management
 *
 * ARCHITECTURAL RULE:
 * - Access Token is strictly held in memory (in-memory JS variable).
 * - Refresh Token is held in sessionStorage.
 * - User metadata is cached in sessionStorage for instantaneous UI rendering.
 */

// Ephemeral in-memory access token with sessionStorage persistence across navigations
let inMemoryAccessToken = null;

export function getAccessToken() {
  return sessionStorage.getItem('shopverse_access_token') || inMemoryAccessToken;
}

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
  if (token && token !== 'undefined' && token !== 'null') {
    sessionStorage.setItem('shopverse_access_token', token);
  } else {
    sessionStorage.removeItem('shopverse_access_token');
  }
  if (typeof window !== 'undefined' && token) {
    window.dispatchEvent(new CustomEvent('shopverse:token-updated', { detail: { token } }));
  }
}

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    // 10-second buffer
    return !payload.exp || payload.exp * 1000 < Date.now() + 10000;
  } catch {
    return true;
  }
}

export function getRefreshToken() {
  const token = sessionStorage.getItem('shopverse_refresh_token');
  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }
  return token;
}

export function setRefreshToken(token) {
  if (token && token !== 'undefined' && token !== 'null') {
    sessionStorage.setItem('shopverse_refresh_token', token);
  } else {
    sessionStorage.removeItem('shopverse_refresh_token');
  }
}

export function getUser() {
  const userStr = sessionStorage.getItem('shopverse_user');
  if (!userStr || userStr === 'undefined' || userStr === 'null') return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user && typeof user === 'object') {
    sessionStorage.setItem('shopverse_user', JSON.stringify(user));
  } else {
    sessionStorage.removeItem('shopverse_user');
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken() || getRefreshToken());
}

export function clearAuth() {
  inMemoryAccessToken = null;
  sessionStorage.removeItem('shopverse_access_token');
  sessionStorage.removeItem('shopverse_refresh_token');
  sessionStorage.removeItem('shopverse_user');
}

/**
 * Single in-flight refresh mutex to prevent duplicate concurrent refresh requests
 */
let refreshPromise = null;

/**
 * Call /api/v1/auth/refresh to rotate tokens and obtain a fresh in-memory access token.
 * Single-flight mutex protected: concurrent callers receive the same Promise.
 * @returns {Promise<string|null>}
 */
export async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuth();
    return null;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result || !result.success) {
        throw new Error(result?.message || 'Token refresh failed');
      }

      // Backend returns { accessToken, refreshToken }
      const newAccess = result.data?.accessToken;
      const newRefresh = result.data?.refreshToken;

      if (!newAccess || !newRefresh) {
        throw new Error('Malformed token response from server');
      }

      setAccessToken(newAccess);
      setRefreshToken(newRefresh);
      return newAccess;
    } catch (err) {
      console.warn('Failed to refresh access token:', err.message);
      clearAuth();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Helper to fetch fresh user profile from /api/v1/users/me using an active access token
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function fetchCurrentUser(token) {
  try {
    const res = await fetch('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json().catch(() => null);
    if (json && json.success && json.data) {
      const user = json.data;
      setUser(user);
      return user;
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch /users/me:', err.message);
    return null;
  }
}

/**
 * Single in-flight initialization mutex to prevent parallel /auth/refresh + /users/me calls
 */
let initAuthPromise = null;

/**
 * Initializes and restores the user authentication session on page load.
 * Runs on EVERY page load (including public pages like index.html) before navbar renders:
 *   1. If an access token is in memory, use it.
 *   2. Otherwise, if a refresh token exists in sessionStorage, call /auth/refresh once,
 *      save the new tokens, then load the user with /users/me.
 *   3. If that fails, clear storage and treat the user as logged out.
 *   4. Never redirects on public pages.
 *
 * @returns {Promise<{ user: object, accessToken: string }|null>}
 */
export async function initAuth() {
  if (initAuthPromise) {
    return initAuthPromise;
  }

  initAuthPromise = (async () => {
    const accessToken = getAccessToken();
    const user = getUser();

    // 1. If we have a valid, non-expired access token and cached user
    if (accessToken && !isTokenExpired(accessToken)) {
      if (user) {
        return { user, accessToken };
      }
      const freshUser = await fetchCurrentUser(accessToken);
      if (freshUser) {
        return { user: freshUser, accessToken };
      }
    }

    // 2. Otherwise, check if a refresh token exists in sessionStorage
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuth();
      return null;
    }

    try {
      // Rotate refresh token and obtain fresh access token
      const newAccess = await refreshAccessToken();
      if (!newAccess) {
        clearAuth();
        return null;
      }

      // Load user profile with /users/me
      const freshUser = await fetchCurrentUser(newAccess);
      if (!freshUser) {
        clearAuth();
        return null;
      }

      return { user: freshUser, accessToken: newAccess };
    } catch (err) {
      console.warn('Authentication restoration failed:', err.message);
      clearAuth();
      return null;
    }
  })();

  try {
    return await initAuthPromise;
  } finally {
    initAuthPromise = null;
  }
}

/**
 * Log out user: revoke refresh token on backend and clear local state
 */
export async function logout() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (e) {
      console.warn('Backend logout notification failed:', e);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shopverse:logout'));
  }
  clearAuth();
  window.location.href = '/login.html';
}

/**
 * Guard a protected page by checking authentication and user role.
 * Redirects to login only on protected pages if unauthenticated.
 * @param {string[]} [allowedRoles=[]] If empty, any authenticated role is permitted
 * @returns {Promise<boolean>}
 */
export async function guardPage(allowedRoles = []) {
  const auth = await initAuth();

  if (!auth || !auth.user || !auth.accessToken) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?redirect=${returnUrl}`;
    return false;
  }

  const { user } = auth;
  if (allowedRoles.length > 0 && (!user || !allowedRoles.includes(user.role))) {
    render403Forbidden(allowedRoles);
    return false;
  }

  return true;
}

/**
 * Render a friendly 403 Forbidden screen in the current main container
 * @param {string[]} allowedRoles
 */
function render403Forbidden(allowedRoles) {
  const main = document.querySelector('main') || document.body;
  main.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'container';
  card.style.maxWidth = '600px';
  card.style.margin = '4rem auto';

  const inner = document.createElement('div');
  inner.className = 'card text-center';
  inner.style.textAlign = 'center';
  inner.style.padding = '3rem 2rem';

  const icon = document.createElement('div');
  icon.style.fontSize = '3rem';
  icon.style.lineHeight = '1';
  icon.style.marginBottom = '1rem';
  icon.textContent = '🔒';

  const h2 = document.createElement('h2');
  h2.style.margin = '0 0 0.5rem';
  h2.textContent = 'Access Restricted (403)';

  const p = document.createElement('p');
  p.style.color = 'var(--text-muted)';
  p.style.marginBottom = '1.75rem';
  const user = getUser();
  p.textContent = `You are signed in as a "${user?.role || 'user'}", but this page requires one of the following roles: ${allowedRoles.join(', ')}.`;

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'center';
  actions.style.gap = '1rem';

  const homeBtn = document.createElement('a');
  homeBtn.href = '/index.html';
  homeBtn.className = 'btn btn-primary';
  homeBtn.textContent = 'Browse Catalog';

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-secondary';
  logoutBtn.textContent = 'Switch Account';
  logoutBtn.onclick = () => logout();

  actions.appendChild(homeBtn);
  actions.appendChild(logoutBtn);

  inner.appendChild(icon);
  inner.appendChild(h2);
  inner.appendChild(p);
  inner.appendChild(actions);
  card.appendChild(inner);
  main.appendChild(card);
}
