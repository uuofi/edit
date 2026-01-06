import { API_BASE_URL } from './api';

export async function fetchPublicConfig() {
  const url = `${API_BASE_URL}/api/public/config`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-app-client': 'mobile',
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    const msg = body?.message || `Request failed (${res.status})`;
    throw new Error(String(msg));
  }
  return body?.config;
}
