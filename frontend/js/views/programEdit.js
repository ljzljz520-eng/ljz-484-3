import { api, auth } from '../api.js';
import { h, toast, statusBadge, TYPE_OPTIONS, confirmDialog } from '../dom.js';
import { navigate } from '../router.js';

const NEXT_STATUS = {
  draft: ['published'],
  published: ['draft', 'archived'],
  archived: ['published']
};
const STATUS_LABEL = { draft: '草稿', published: '已发布', archived: '已归档' };

export async function renderProgramEdit({ params }) {
  if (!auth.isHost) {
    document.getElementById('app').innerHTML =
      '<div class="empty">仅主持人可编辑节目。<a href="#/programs">返回列表</a></div>';
    return;
  }

  const programId = params[0]; // 新建时为 undefined
  const isNew = !programId;
  const app = document.getElementById('app');
  app.innerHTML = '<p class="loading">加载中…</p>';

  let guests = [];
  let program = null;
  try {
    guests = await api.listGuests();
    if (!isNew) program = await api.getProgram(programId);
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'empty' }, `${err.message} · <a href="#/programs">返回列表</a>`));
    return;
  }

  const wrap = h('div');
  wrap.appendChild(
    h('div', { class: 'page-head' }, [
      h('div', {}, [
        h('h1', {}, isNew ? '新建节目' : `编辑：${program.title}`),
        h('div', { class: 'sub' }, '所有修改即时保存到本地文件（JSON）')
      ]),
      isNew
        ? h('a', { class: 'btn', href: '#/programs' }, '返回')
        : h('div', {}, [
            h('a', { class: 'btn', href: `#/programs/${programId}/preview` }, '👁 预览'),
            ' '
          ])
    ])
  );

  // ---------------- 元数据表单 ----------------
  const meta = program || { title: '', show: '', episodeNo: '', summary: '', tags: [], guestIds: [], status: 'draft' };
  const form = h('form', { class: 'card', id: 'metaForm' }, [
    h('div', { class: 'form-grid' }, [
      h('div', { class: 'field full' }, [
        h('label', {}, '节目标题 *'),
        h('input', { type: 'text', name: 'title', value: meta.title, placeholder: '例如：声音的形状', maxlength: 200 })
      ]),
      h('div', { class: 'field' }, [
        h('label', {}, '播客名称'),
        h('input', { type: 'text', name: 'show', value: meta.show, placeholder: '例如：声波纹' })
      ]),
      h('div', { class: 'field' }, [
        h('label', {}, '期号'),
        h('input', { type: 'number', name: 'episodeNo', value: meta.episodeNo ?? '', min: '1', placeholder: '12' })
      ]),
      h('div', { class: 'field full' }, [
        h('label', {}, '标签', ' ', h('span', { class: 'hint' }, '逗号分隔')),
        h('input', { type: 'text', name: 'tags', value: (meta.tags || []).join(','), placeholder: '声学,录音' })
      ]),
      h('div', { class: 'field full' }, [
        h('label', {}, '本期嘉宾'),
        guests.length === 0
          ? h('div', { class: 'hint', style: 'color:var(--muted);font-size:13px' },
              '还没有嘉宾，可先到「嘉宾」页创建后再回来关联。')
          : h('div', { class: 'checklist', name: 'guestIds' },
              guests.map((g) =>
                h('label', {}, [
                  h('input', {
                    type: 'checkbox',
                    value: g.id,
                    ...((meta.guestIds || []).includes(g.id) ? { checked: true } : {})
                  }),
                  document.createTextNode(`${g.name}${g.title ? `（${g.title}）` : ''}`)
                ])
              ))
      ]),
      h('div', { class: 'field full' }, [
        h('label', {}, '内容简介'),
        h('textarea', { name: 'summary', rows: 3, maxlength: 1000 }, meta.summary || '')
      ]),
      !isNew
        ? h('div', { class: 'field' }, [
            h('label', {}, '发布状态'),
            (() => {
              const select = h('select', { name: 'status' }, [
                h('option', { value: program.status, selected: true },
                  `${STATUS_LABEL[program.status]}（当前）`)
              ]);
              for (const s of NEXT_STATUS[program.status] || []) {
                select.appendChild(h('option', { value: s }, `→ ${STATUS_LABEL[s]}`));
              }
              return select;
            })()
          ])
        : null
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'submit', class: 'btn btn-primary' }, isNew ? '创建并开始编辑' : '保存节目信息'),
      !isNew
        ? h('button', {
            type: 'button',
            class: 'btn btn-danger',
            onclick: async () => {
              if (!confirmDialog(`确定删除节目「${program.title}」及其全部分段？此操作不可恢复。`)) return;
              try {
                await api.deleteProgram(programId);
                toast('节目已删除', 'success');
                navigate('#/programs');
              } catch (err) { toast(err.message, 'error'); }
            }
          }, '删除节目')
        : null
    ])
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      title: form.title.value.trim(),
      show: form.show.value.trim(),
      episodeNo: form.episodeNo.value,
      tags: form.tags.value,
      summary: form.summary.value.trim(),
      guestIds: [...form.querySelectorAll('[name=guestIds] input:checked')].map((i) => i.value)
    };
    if (!body.title) return toast('请填写节目标题', 'error');
    try {
      if (isNew) {
        const created = await api.createProgram(body);
        toast('节目已创建（草稿）', 'success');
        navigate(`#/programs/${created.id}/edit`);
      } else {
        if (form.status) body.status = form.status.value;
        const updated = await api.updateProgram(programId, body);
        program.status = updated.status;
        program.guestIds = updated.guestIds;
        toast('节目信息已保存', 'success');
        renderProgramEdit({ params: [programId] });
      }
    } catch (err) { toast(err.message, 'error'); }
  });

  wrap.appendChild(form);

  if (!isNew) wrap.appendChild(await renderSegmentsSection(program, guests));

  app.innerHTML = '';
  app.appendChild(wrap);
}

// ---------------- 分段管理区 ----------------

async function renderSegmentsSection(program, guests) {
  const section = h('div', { class: 'segments-section' });
  section.appendChild(
    h('div', { class: 'page-head', style: 'margin-top:28px' }, [
      h('h1', { style: 'font-size:18px' }, `分段文稿（${program.segments.length}）`)
    ])
  );

  const listEl = h('div', { id: 'segmentList' });
  section.appendChild(listEl);

  const drawSegments = (segments) => {
    listEl.innerHTML = '';
    if (segments.length === 0) {
      listEl.appendChild(h('div', { class: 'empty' }, '还没有分段，在下方添加第一段吧'));
    }
    segments.forEach((seg, idx) => listEl.appendChild(segmentCard(seg, idx, segments.length, program, guests, drawSegments)));
  };
  drawSegments(program.segments);
  section.appendChild(addSegmentForm(program, guests, drawSegments));
  return section;
}

function segmentCard(seg, idx, total, program, guests, drawSegments) {
  const programGuests = guests.filter((g) => (program.guestIds || []).includes(g.id));

  const body = h('div', { class: 'segment-body' }, [
    h('div', { class: 'field' }, [
      h('label', {}, '标题'),
      h('input', { type: 'text', 'data-f': 'title', value: seg.title, maxlength: 200 })
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, '发言人'),
      h('input', { type: 'text', 'data-f': 'speaker', value: seg.speaker || '', placeholder: '主持人 / 嘉宾姓名' })
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, '时长(秒)'),
      h('input', { type: 'number', 'data-f': 'durationSec', value: seg.durationSec ?? '', min: '0' })
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, '类型'),
      h('select', { 'data-f': 'type' },
        TYPE_OPTIONS.map((t) =>
          h('option', { value: t.value, ...(seg.type === t.value ? { selected: true } : {}) }, t.label)
        ))
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, '关联嘉宾'),
      h('select', { 'data-f': 'guestId' }, [
        h('option', { value: '' }, '— 不关联 —'),
        ...programGuests.map((g) =>
          h('option', { value: g.id, ...(seg.guestId === g.id ? { selected: true } : {}) }, g.name))
      ])
    ]),
    h('div', { class: 'field full' }, [
      h('label', {}, '文稿正文'),
      h('textarea', { 'data-f': 'content', rows: 5, maxlength: 100000 }, seg.content || '')
    ])
  ]);

  const card = h('div', { class: 'segment-item' }, [
    h('div', { class: 'segment-head' }, [
      h('span', { class: 'order' }, `#${idx + 1}`),
      h('span', { class: 'badge badge-type' }, TYPE_OPTIONS.find((t) => t.value === seg.type)?.label || seg.type),
      h('span', { class: 'seg-title' }, seg.title),
      h('div', { class: 'seg-actions' }, [
        h('button', { class: 'icon-btn', title: '上移', disabled: idx === 0, onclick: () => move(idx, -1) }, '↑'),
        h('button', { class: 'icon-btn', title: '下移', disabled: idx === total - 1, onclick: () => move(idx, 1) }, '↓'),
        h('button', {
          class: 'icon-btn danger',
          title: '删除',
          onclick: async () => {
            if (!confirmDialog(`删除分段「${seg.title}」？`)) return;
            try {
              await api.deleteSegment(program.id, seg.id);
              program.segments.splice(idx, 1);
              drawSegments(program.segments);
              toast('分段已删除', 'success');
            } catch (err) { toast(err.message, 'error'); }
          }
        }, '🗑')
      ])
    ]),
    body,
    h('div', { style: 'padding:0 14px 14px' }, [
      h('button', {
        class: 'btn btn-primary btn-sm',
        onclick: async () => {
          const payload = collectSegment(body);
          if (!payload.title) return toast('分段标题不能为空', 'error');
          try {
            const updated = await api.updateSegment(program.id, seg.id, payload);
            program.segments[idx] = updated;
            drawSegments(program.segments);
            toast('分段已保存', 'success');
          } catch (err) { toast(err.message, 'error'); }
        }
      }, '保存该段')
    ])
  ]);

  async function move(from, delta) {
    const to = from + delta;
    const ids = program.segments.map((s) => s.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    try {
      const reordered = await api.reorderSegments(program.id, ids);
      program.segments = reordered;
      drawSegments(reordered);
    } catch (err) { toast(err.message, 'error'); }
  }

  return card;
}

function addSegmentForm(program, guests, drawSegments) {
  const programGuests = guests.filter((g) => (program.guestIds || []).includes(g.id));
  const body = h('div', { class: 'segment-body' }, [
    h('div', { class: 'field' }, [
      h('label', {}, '标题'),
      h('input', { type: 'text', 'data-f': 'title', placeholder: '新分段标题', maxlength: 200 })
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, '发言人'),
      h('input', { type: 'text', 'data-f': 'speaker', placeholder: '可留空' })
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, '时长(秒)'),
      h('input', { type: 'number', 'data-f': 'durationSec', min: '0', placeholder: '120' })
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, '类型'),
      h('select', { 'data-f': 'type' }, TYPE_OPTIONS.map((t, i) =>
        h('option', { value: t.value, ...(t.value === 'topic' ? { selected: true } : {}) }, t.label)))
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, '关联嘉宾'),
      h('select', { 'data-f': 'guestId' }, [
        h('option', { value: '' }, '— 不关联 —'),
        ...programGuests.map((g) => h('option', { value: g.id }, g.name))
      ])
    ]),
    h('div', { class: 'field full' }, [
      h('label', {}, '文稿正文'),
      h('textarea', { 'data-f': 'content', rows: 4, placeholder: '可以先创建分段，再逐段完善正文…' })
    ])
  ]);

  return h('div', { class: 'card', style: 'margin-top:14px' }, [
    h('strong', { style: 'display:block;margin-bottom:10px' }, '＋ 添加分段'),
    body,
    h('div', { class: 'form-actions', style: 'margin-top:12px' }, [
      h('button', {
        class: 'btn btn-primary',
        onclick: async () => {
          const payload = collectSegment(body);
          if (!payload.title) return toast('请填写分段标题', 'error');
          try {
            const seg = await api.createSegment(program.id, payload);
            program.segments.push(seg);
            drawSegments(program.segments);
            toast('分段已添加（排到末尾）', 'success');
          } catch (err) { toast(err.message, 'error'); }
        }
      }, '添加到末尾')
    ])
  ]);
}

function collectSegment(container) {
  const get = (f) => container.querySelector(`[data-f="${f}"]`);
  const durRaw = get('durationSec').value;
  return {
    title: get('title').value.trim(),
    type: get('type').value,
    speaker: get('speaker').value.trim(),
    guestId: get('guestId').value || null,
    durationSec: durRaw === '' ? null : Number(durRaw),
    content: get('content').value
  };
}
