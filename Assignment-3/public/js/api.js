/**
 * ShopVerse Unified API Fetch Wrapper
 *
 * Capabilities:
 * - Automatically attaches Authorization: Bearer <accessToken>
 * - Intercepts 401 responses, performs a single token refresh attempt,
 *   retries the original request, and redirects to login if refresh fails.
 * - Extracts structured errors ({ message, errors: [] }) from ApiResponse / ApiError.
 */

import {
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  initAuth,
  clearAuth,
} from './auth.js';

export async function api(endpoint, options = {}) {
  // If we don't have an in-memory access token yet, but a refresh token exists, restore session
  if (!getAccessToken() && getRefreshToken()) {
    await initAuth();
  }

  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Auto set Content-Type to JSON if body is a plain object/string and not FormData
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/')
    ? endpoint
    : `/api/v1/${endpoint}`;

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401: Refresh token rotation attempt
  if (response.status === 401 && !options._isRetry && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, {
        ...options,
        _isRetry: true,
        headers,
      });
    } else {
      clearAuth();
      if (!options.skipAuthRedirect) {
        const returnUrl = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        window.location.href = `/login.html?redirect=${returnUrl}`;
        return;
      }
    }
  }

  // Parse JSON response safely
  const payload = await response.json().catch(() => ({
    success: false,
    message: 'An unexpected response was received from the server.',
  }));

  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.errors = payload.errors || [];
    error.data = payload.data || null;
    throw error;
  }

  return payload;
}
