// hash 路由：#/programs、#/programs/new、#/programs/:id/edit、#/programs/:id/preview、#/guests
import { renderProgramList } from './views/programList.js';
import { renderProgramEdit } from './views/programEdit.js';
import { renderProgramPreview } from './views/programPreview.js';
import { renderGuestPage } from './views/guests.js';

const routes = [
  { re: /^#\/programs\/new$/, view: renderProgramEdit },
  { re: /^#\/programs\/([\w-]+)\/edit$/, view: renderProgramEdit },
  { re: /^#\/programs\/([\w-]+)\/preview$/, view: renderProgramPreview },
  { re: /^#\/programs$/, view: renderProgramList },
  { re: /^#\/guests$/, view: renderGuestPage },
  { re: /^#\/?$/, view: renderProgramList }
];

export function navigate(hash) {
  if (location.hash === hash) {
    route(); // 强制重新渲染
  } else {
    location.hash = hash;
  }
}

export function route() {
  const hash = location.hash || '#/programs';
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      highlightNav(/guests/.test(hash) ? 'guests' : 'programs');
      return r.view({ params: m.slice(1) });
    }
  }
  document.getElementById('app').innerHTML =
    '<div class="empty">页面不存在 · <a href="#/programs">回到节目列表</a></div>';
}

function highlightNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === name);
  });
}
