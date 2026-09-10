import { api, auth } from '../api.js';
import { h, toast, confirmDialog } from '../dom.js';

export async function renderGuestPage() {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="loading">加载中…</p>';

  let guests;
  try {
    guests = await api.listGuests();
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'empty' }, `加载失败：${err.message}`));
    return;
  }

  const wrap = h('div');
  wrap.appendChild(
    h('div', { class: 'page-head' }, [
      h('div', {}, [
        h('h1', {}, '嘉宾库'),
        h('div', { class: 'sub' }, '嘉宾可在节目编辑页关联到整期节目，分段也可单独标注嘉宾发言')
      ])
    ])
  );

  if (auth.isHost) wrap.appendChild(guestForm(null, guests, () => renderGuestPage()));

  if (guests.length === 0) {
    wrap.appendChild(h('div', { class: 'empty' }, '还没有嘉宾'));
  } else {
    const grid = h('div', { class: 'guest-grid', style: 'margin-top:16px' });
    for (const g of guests) grid.appendChild(guestCard(g, guests));
    wrap.appendChild(grid);
  }

  app.innerHTML = '';
  app.appendChild(wrap);
}

function guestCard(g) {
  const body = h('div', { class: 'card guest-card', id: `guest-${g.id}` }, [
    h('h3', {}, g.name),
    (g.title || g.organization)
      ? h('div', { class: 'org' }, [g.title, g.organization].filter(Boolean).join(' · '))
      : null,
    g.bio ? h('p', { class: 'bio' }, g.bio) : null,
    g.tags?.length ? h('div', {}, g.tags.map((t) => h('span', { class: 'tag' }, `#${t}`))) : null
  ]);
  if (auth.isHost) {
    body.appendChild(h('div', { class: 'card-actions' }, [
      h('button', {
        class: 'btn btn-sm',
        onclick: () => {
          const existing = document.getElementById(`edit-${g.id}`);
          if (existing) { existing.remove(); return; }
          const form = guestForm(g, null, async () => {
            toast('嘉宾已更新', 'success');
            renderGuestPage();
          });
          form.id = `edit-${g.id}`;
          body.after(form);
        }
      }, '✎ 编辑'),
      h('button', {
        class: 'btn btn-sm btn-danger',
        onclick: async () => {
          if (!confirmDialog(`删除嘉宾「${g.name}」？被节目引用的嘉宾无法删除。`)) return;
          try {
            await api.deleteGuest(g.id);
            toast('嘉宾已删除', 'success');
            renderGuestPage();
          } catch (err) { toast(err.message, 'error'); }
        }
      }, '删除')
    ]));
  }
  return body;
}

function guestForm(g, _allGuests, onSaved) {
  const isEdit = !!g;
  const data = g || { name: '', title: '', organization: '', bio: '', tags: [] };

  const form = h('form', { class: 'card' }, [
    h('strong', { style: 'display:block;margin-bottom:12px' }, isEdit ? `编辑：${g.name}` : '＋ 添加嘉宾'),
    h('div', { class: 'form-grid' }, [
      h('div', { class: 'field' }, [
        h('label', {}, '姓名 *'),
        h('input', { type: 'text', name: 'name', value: data.name, maxlength: 100 })
      ]),
      h('div', { class: 'field' }, [
        h('label', {}, '头衔'),
        h('input', { type: 'text', name: 'title', value: data.title || '', maxlength: 100 })
      ]),
      h('div', { class: 'field' }, [
        h('label', {}, '机构'),
        h('input', { type: 'text', name: 'organization', value: data.organization || '', maxlength: 100 })
      ]),
      h('div', { class: 'field' }, [
        h('label', {}, '标签', ' ', h('span', { class: 'hint' }, '逗号分隔')),
        h('input', { type: 'text', name: 'tags', value: (data.tags || []).join(',') })
      ]),
      h('div', { class: 'field full' }, [
        h('label', {}, '简介'),
        h('textarea', { name: 'bio', rows: 2, maxlength: 2000 }, data.bio || '')
      ])
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, isEdit ? '保存修改' : '添加嘉宾')
    ])
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: form.name.value.trim(),
      title: form.title.value.trim(),
      organization: form.organization.value.trim(),
      tags: form.tags.value,
      bio: form.bio.value.trim()
    };
    if (!body.name) return toast('请填写嘉宾姓名', 'error');
    try {
      if (isEdit) await api.updateGuest(g.id, body);
      else await api.createGuest(body);
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  });

  return form;
}
