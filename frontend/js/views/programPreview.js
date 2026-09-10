import { api, auth, downloadExport } from '../api.js';
import { h, toast, statusBadge, TYPE_LABELS, fmtDuration } from '../dom.js';

export async function renderProgramPreview({ params }) {
  const id = params[0];
  const app = document.getElementById('app');
  app.innerHTML = '<p class="loading">加载中…</p>';

  let program;
  try {
    program = await api.getProgram(id);
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'empty' },
      err.status === 404 ? '节目不存在或尚未发布。' : `加载失败：${err.message}`));
    return;
  }

  const totalSec = program.segments.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const guestName = (gid) => program.guests.find((g) => g.id === gid)?.name;

  const wrap = h('div');

  wrap.appendChild(
    h('div', { class: 'page-head' }, [
      h('div', {}, [
        h('a', { href: '#/programs', style: 'font-size:13px' }, '← 节目列表'),
        h('h1', { style: 'margin-top:6px' }, program.title),
        h('div', { class: 'sub' }, [
          program.show ? document.createTextNode(program.show + (program.episodeNo != null ? ` · 第 ${program.episodeNo} 期` : '')) : null
        ])
      ]),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
        auth.isHost ? h('a', { class: 'btn btn-primary', href: `#/programs/${id}/edit` }, '✎ 编辑') : null,
        h('button', {
          class: 'btn',
          onclick: async () => {
            try {
              await downloadExport(id);
              toast('已导出 TXT 文件', 'success');
            } catch (err) { toast(err.message, 'error'); }
          }
        }, '⬇ 导出文本')
      ])
    ])
  );

  if (program.status === 'draft') {
    wrap.appendChild(h('div', { class: 'draft-banner' },
      '⚠ 草稿状态：仅主持人可见。发布后听众才能看到并导出本期节目。'));
  }
  if (program.status === 'archived') {
    wrap.appendChild(h('div', { class: 'draft-banner', style: 'background:#f1f2f5;border-color:#d5d8e0;color:#555a66' },
      '该节目已归档（只读存档）。'));
  }

  const doc = h('div', { class: 'preview-doc' }, [
    h('div', { class: 'doc-meta' }, [
      statusBadge(program.status),
      ' ',
      program.publishedAt ? document.createTextNode('发布于 ' + new Date(program.publishedAt).toLocaleString('zh-CN')) : null,
      totalSec ? h('span', { style: 'margin-left:12px' }, `预计时长 ${fmtDuration(totalSec)}`) : null
    ]),
    program.guests?.length
      ? h('div', { class: 'doc-meta', style: 'margin-top:6px' },
          '🎤 嘉宾：' + program.guests.map((g) => [g.name, g.title, g.organization].filter(Boolean).join(' / ')).join('；'))
      : null,
    program.tags?.length ? h('div', { style: 'margin:6px 0' }, program.tags.map((t) => h('span', { class: 'tag' }, `#${t}`))) : null,
    program.summary ? h('div', { class: 'doc-summary' }, program.summary) : null
  ]);

  if (program.segments.length === 0) {
    doc.appendChild(h('p', { class: 'loading' }, '（暂无分段内容）'));
  }

  program.segments.forEach((seg, i) => {
    const speaker = seg.speaker || guestName(seg.guestId) || '';
    doc.appendChild(
      h('div', { class: 'preview-seg' }, [
        h('h3', {}, [
          document.createTextNode(`${i + 1}. ${seg.title}`),
          h('span', { class: 'badge badge-type' }, TYPE_LABELS[seg.type] || seg.type),
          speaker ? h('span', { class: 'seg-speaker' }, `@${speaker}`) : null,
          seg.durationSec ? h('span', { class: 'seg-dur' }, fmtDuration(seg.durationSec)) : null
        ]),
        h('div', { class: 'seg-content' }, seg.content || '（暂无内容）')
      ])
    );
  });

  wrap.appendChild(doc);
  app.innerHTML = '';
  app.appendChild(wrap);
}
