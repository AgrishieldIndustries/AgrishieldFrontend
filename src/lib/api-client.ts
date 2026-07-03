const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export function setCookie(name: string, value: string, days = 7) {
  if (typeof window === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

export function eraseCookie(name: string) {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=; Max-Age=-99999999; path=/`;
}

export interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiFetch(path: string, options: FetchOptions = {}) {
  const token = options.token || getCookie('token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // If request is JSON, set default content type
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Ensure trailing slash on REST collection/resource paths to avoid FastAPI 307 redirects
  // which strip the Authorization header and body. But don't add slash to action segments
  // like /pdf, /download, /ledger that are intentional non-collection endpoints.
  const ACTION_SEGMENTS = ['pdf', 'download', 'ledger', 'export', 'print', 'preview'];
  const lastSegment = path.split('?')[0].split('/').filter(Boolean).pop() || '';
  const needsSlash = !path.endsWith('/') && !ACTION_SEGMENTS.includes(lastSegment);

  const normalizedPath = needsSlash
    ? path.includes('?')
      ? path.replace(/([^?/])(\?.*)$/, '$1/$2')
      : `${path}/`
    : path;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${normalizedPath}`;
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      eraseCookie('token');
      eraseCookie('user_role');
      eraseCookie('user_name');
      window.location.href = '/login';
    }
  }

  return response;
}
