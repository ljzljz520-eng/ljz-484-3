// 极简 DOM 辅助：h() 创建元素，escapeHtml 防注入，toast/confirm 反馈
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
export function toast(message, type = '') {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.className = `toast ${type}`;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    box.hidden = true;
  }, 2600);
}

export function confirmDialog(message) {
  return window.confirm(message);
}

export const STATUS_LABELS = { draft: '草稿', published: '已发布', archived: '已归档' };
export const TYPE_OPTIONS = [
  { value: 'intro', label: '开场' },
  { value: 'topic', label: '话题' },
  { value: 'talk', label: '对谈' },
  { value: 'quote', label: '金句' },
  { value: 'ad', label: '口播广告' },
  { value: 'outro', label: '结尾' }
];
export const TYPE_LABELS = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));

export function statusBadge(status) {
  return h('span', { class: `badge badge-${status}` }, STATUS_LABELS[status] || status);
}

export function fmtDuration(sec) {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 从表单元素收集值 */
export function formValue(form, name) {
  const el = form.querySelector(`[name="${name}"]`);
  return el ? el.value.trim() : '';
}
