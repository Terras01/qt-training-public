async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("We couldn't reach the pizza shop. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status}). Please try again.`);
  }
  return data;
}

export const api = {
  getMenu: () => request('GET', '/menu'),
  placeOrder: (order) => request('POST', '/orders', order),
  listOrders: () => request('GET', '/orders'),
  setStatus: (id, status) => request('PATCH', `/orders/${id}/status`, { status }),
};
