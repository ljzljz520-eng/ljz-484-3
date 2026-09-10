// API 客户端：统一加角色头、解析错误 JSON、导出走 blob/直链
const ROLE_KEY = 'psm.role';

export const auth = {
  get role() {
    return localStorage.getItem(ROLE_KEY) === 'host' ? 'host' : 'viewer';
  },
  get isHost() {
    return this.role === 'host';
  },
  setRole(role) {
    localStorage.setItem(ROLE_KEY, role === 'host' ? 'host' : 'viewer');
  }
};

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': auth.role
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = data && data.error ? data.error.message : `请求失败（${res.status}）`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // 节目
  listPrograms: (status) => request('GET', `/api/programs${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getProgram: (id) => request('GET', `/api/programs/${id}`),
  createProgram: (body) => request('POST', '/api/programs', body),
  updateProgram: (id, body) => request('PUT', `/api/programs/${id}`, body),
  deleteProgram: (id) => request('DELETE', `/api/programs/${id}`),
  // 分段
  createSegment: (programId, body) => request('POST', `/api/programs/${programId}/segments`, body),
  updateSegment: (programId, segmentId, body) =>
    request('PUT', `/api/programs/${programId}/segments/${segmentId}`, body),
  deleteSegment: (programId, segmentId) =>
    request('DELETE', `/api/programs/${programId}/segments/${segmentId}`),
  reorderSegments: (programId, segmentIds) =>
    request('PUT', `/api/programs/${programId}/segments/reorder`, { segmentIds }),
  // 嘉宾
  listGuests: () => request('GET', '/api/guests'),
  getGuest: (id) => request('GET', `/api/guests/${id}`),
  createGuest: (body) => request('POST', '/api/guests', body),
  updateGuest: (id, body) => request('PUT', `/api/guests/${id}`, body),
  deleteGuest: (id) => request('DELETE', `/api/guests/${id}`)
};

/** 导出地址（带角色头需经 fetch 触发下载；草稿对 viewer 会得到 404） */
export async function downloadExport(programId, filename) {
  const res = await fetch(`/api/programs/${programId}/export`, {
    headers: { 'X-User-Role': auth.role }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message || `导出失败（${res.status}）`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
