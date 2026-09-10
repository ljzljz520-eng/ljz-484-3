'use strict';

const path = require('path');
const store = require('../storage/fileStore');
const { newId } = require('../lib/ids');
const { notFound, badRequest, conflict } = require('../lib/errors');
const { requiredString, optionalString, normalizeTags } = require('../lib/validate');
const programService = require('./programService');

/**
 * 嘉宾服务
 * 文件布局： data/guests/{gst_xxx}.json
 */

const guestsDir = () => path.join(store.dataRoot, 'guests');
const guestFile = (id) => path.join(guestsDir(), `${id}.json`);

const listGuests = async () => store.listJson(guestsDir());

const getGuest = async (id) => {
  const guest = await store.readJson(guestFile(id), { missingOk: true });
  if (!guest) throw notFound('嘉宾不存在');
  return guest;
};

const createGuest = async (body) => {
  const name = requiredString(body.name, { field: 'name', max: 100 });
  const now = new Date().toISOString();
  const guest = {
    id: newId('gst'),
    name,
    title: optionalString(body.title, { field: 'title', max: 100, allowEmpty: true }) ?? '',
    organization:
      optionalString(body.organization, { field: 'organization', max: 100, allowEmpty: true }) ?? '',
    bio: optionalString(body.bio, { field: 'bio', max: 2000, allowEmpty: true }) ?? '',
    tags: normalizeTags(body.tags) ?? [],
    createdAt: now,
    updatedAt: now
  };
  await store.writeJson(guestFile(guest.id), guest);
  return guest;
};

const updateGuest = async (id, body) => {
  const guest = await getGuest(id);

  if (body.name !== undefined) guest.name = requiredString(body.name, { field: 'name', max: 100 });
  if (body.title !== undefined)
    guest.title = optionalString(body.title, { field: 'title', max: 100, allowEmpty: true }) ?? '';
  if (body.organization !== undefined)
    guest.organization =
      optionalString(body.organization, { field: 'organization', max: 100, allowEmpty: true }) ?? '';
  if (body.bio !== undefined)
    guest.bio = optionalString(body.bio, { field: 'bio', max: 2000, allowEmpty: true }) ?? '';
  if (body.tags !== undefined) guest.tags = normalizeTags(body.tags) ?? [];

  guest.updatedAt = new Date().toISOString();
  await store.writeJson(guestFile(id), guest);
  return guest;
};

const deleteGuest = async (id) => {
  await getGuest(id); // 确保存在
  const usedBy = await programService.findProgramsUsingGuest(id);
  if (usedBy.length > 0) {
    throw conflict(`该嘉宾仍被 ${usedBy.length} 个节目引用，请先解除关联`);
  }
  await store.remove(guestFile(id));
};

module.exports = { listGuests, getGuest, createGuest, updateGuest, deleteGuest };
