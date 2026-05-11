function getToken(): string | null {
  return localStorage.getItem('lopa_token');
}

function handleUnauthorized() {
  localStorage.removeItem('lopa_token');
  localStorage.removeItem('lopa_refresh');
  window.location.href = '/login';
}

type FetchOptions = RequestInit & { skipAuth?: boolean };

export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth, ...init } = options;
  const headers = new Headers(init.headers);

  if (!skipAuth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path}`, { ...init, headers });

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Sessao expirada');
  }

  if (response.status === 403) {
    throw new Error('Sem permissao para esta acao');
  }

  return response;
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await apiFetch(path);
  if (!r.ok) throw new Error(`Erro ${r.status}`);
  return r.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Erro ${r.status}`);
  }
  return r.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const r = await apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Erro ${r.status}`);
  }
  return r.json();
}

export async function apiDelete(path: string): Promise<void> {
  const r = await apiFetch(path, { method: 'DELETE' });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? `Erro ${r.status}`);
  }
}
