import { api, auth, downloadExport } from '../api.js';
import { h, toast, statusBadge, fmtDuration } from '../dom.js';
import { navigate } from '../router.js';

export async function renderProgramList() {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="loading">加载中…</p>';

  const filter = window.__psmFilter || '';
  let programs;
  try {
    programs = await api.listPrograms(filter || undefined);
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'empty' }, `加载失败：${err.message}`));
    return;
  }

  const wrap = h('div');

  wrap.appendChild(
    h('div', { class: 'page-head' }, [
      h('div', {}, [
        h('h1', {}, '节目'),
        h('div', { class: 'sub' }, auth.isHost
          ? '主持人视角：草稿、已发布、已归档节目均可见可编辑'
          : '听众视角：仅显示已发布节目，草稿不可见')
      ]),
      auth.isHost
        ? h('button', { class: 'btn btn-primary', onclick: () => navigate('#/programs/new') }, '＋ 新建节目')
        : null
    ])
  );

  // 状态筛选（草稿筛选项仅主持人有意义）
  const tabs = [
    { v: '', label: '全部' },
    { v: 'published', label: '已发布' },
    ...(auth.isHost ? [{ v: 'draft', label: '草稿' }, { v: 'archived', label: '已归档' }] : [])
  ];
  const toolbar = h('div', { class: 'toolbar' });
  for (const t of tabs) {
    toolbar.appendChild(
      h('button',
        {
          class: `btn btn-sm ${filter === t.v ? 'btn-primary' : ''}`,
          onclick: () => { window.__psmFilter = t.v; renderProgramList(); }
        },
        t.label)
    );
  }
  toolbar.appendChild(h('div', { class: 'spacer' }));
  toolbar.appendChild(h('span', { class: 'sub', style: 'color:var(--muted);font-size:13px' }, `共 ${programs.length} 个节目`));
  wrap.appendChild(toolbar);

  if (programs.length === 0) {
    wrap.appendChild(h('div', { class: 'empty' }, filter === 'draft' ? '暂无草稿节目' : '暂无节目'));
  }

  for (const p of programs) {
    const actions = h('div', { class: 'card-actions' }, [
      h('a', { class: 'btn btn-sm', href: `#/programs/${p.id}/preview` }, '👁 预览'),
      h('a', { class: 'btn btn-sm', href: `#/programs/${p.id}/export`, onclick: async (e) => {
        e.preventDefault();
        try {
          await downloadExport(p.id);
          toast('已导出 TXT 文件', 'success');
        } catch (err) { toast(err.message, 'error'); }
      } }, '⬇ 导出文本'),
      auth.isHost ? h('a', { class: 'btn btn-sm btn-primary', href: `#/programs/${p.id}/edit` }, '✎ 编辑') : null
    ]);

    wrap.appendChild(
      h('div', { class: 'card program-card' }, [
        h('h3', {}, [
          statusBadge(p.status),
          document.createTextNode(' '),
          h('a', { href: `#/programs/${p.id}/preview` }, p.title)
        ]),
        h('div', { class: 'program-meta' }, [
          p.show ? h('span', {}, `📻 ${p.show}${p.episodeNo != null ? ` · 第 ${p.episodeNo} 期` : ''}`) : null,
          h('span', {}, `📄 ${p.segmentCount} 个分段`),
          p.guests?.length ? h('span', {}, `🎤 ${p.guests.map((g) => g.name).join('、')}`) : null,
          p.tags?.length ? h('span', {}, p.tags.map((t) => `#${t}`).join(' ')) : null
        ]),
        p.summary ? h('p', { class: 'program-summary' }, p.summary) : null,
        actions
      ])
    );
  }

  app.innerHTML = '';
  app.appendChild(wrap);
}
