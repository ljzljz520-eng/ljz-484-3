'use strict';

const path = require('path');
const store = require('../storage/fileStore');
const config = require('../config');
const { newId } = require('../lib/ids');
const { notFound, badRequest, forbidden } = require('../lib/errors');
const {
  requiredString,
  optionalString,
  optionalEnum,
  normalizeTags
} = require('../lib/validate');

/**
 * 节目服务
 * ------------------------------------------------------------------
 * 文件布局：
 *   data/programs/{prg_xxx}/meta.json          节目元数据（含状态、嘉宾 id 列表）
 *   data/programs/{prg_xxx}/segments/{seg_xxx}.json   分段文稿（各自独立文件）
 *
 * 可见性规则：
 *   draft（草稿）仅主持人可见可取；viewer 访问草稿一律 404（不暴露其存在）。
 *   published / archived 对所有人可见。
 */

const DRAFT = 'draft';

const programsDir = () => path.join(store.dataRoot, 'programs');
const programDir = (id) => path.join(programsDir(), id);
const metaFile = (id) => path.join(programDir(id), 'meta.json');
const segmentsDir = (id) => path.join(programDir(id), 'segments');
const segmentFile = (programId, segmentId) => path.join(segmentsDir(programId), `${segmentId}.json`);

// ---------- 内部工具 ----------

const getMetaOrNull = async (id) => store.readJson(metaFile(id), { missingOk: true });

const getMeta = async (id) => {
  const meta = await getMetaOrNull(id);
  if (!meta) throw notFound('节目不存在');
  return meta;
};

/** 草稿可见性闸门 */
const assertVisible = (meta, isHost) => {
  if (meta.status === DRAFT && !isHost) throw notFound('节目不存在');
};

/** 把 guestIds 解析为嘉宾摘要（嘉宾文件丢失时容错跳过） */
const resolveGuests = async (guestIds = []) => {
  const guests = [];
  for (const gid of guestIds) {
    const g = await store.readJson(path.join(store.dataRoot, 'guests', `${gid}.json`), {
      missingOk: true
    });
    if (g) guests.push({ id: g.id, name: g.name, title: g.title, organization: g.organization });
  }
  return guests;
};

const loadSegments = async (programId) => {
  const segments = await store.listJson(segmentsDir(programId));
  return segments.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
};

/** 组装节目详情（元数据 + 嘉宾 + 分段） */
const assemble = async (meta, { withGuests = true } = {}) => ({
  ...meta,
  guests: withGuests ? await resolveGuests(meta.guestIds) : [],
  segments: await loadSegments(meta.id)
});

// ---------- 对外查询 ----------

const listPrograms = async ({ status, isHost } = {}) => {
  const dirs = await store.listDirs(programsDir());
  const metas = [];
  for (const dir of dirs) {
    const meta = await getMetaOrNull(dir);
    if (!meta) continue;
    if (meta.status === DRAFT && !isHost) continue; // viewer 看不到草稿
    if (status && meta.status !== status) continue;
    metas.push(meta);
  }
  // 最新更新在前
  metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // 列表附带嘉宾摘要，不带分段正文（避免一次拉出全部文稿）
  return Promise.all(
    metas.map(async (meta) => ({
      ...meta,
      guests: await resolveGuests(meta.guestIds),
      segmentCount: (await store.listJson(segmentsDir(meta.id))).length
    }))
  );
};

const getProgram = async (id, { isHost = false } = {}) => {
  const meta = await getMeta(id);
  assertVisible(meta, isHost);
  return assemble(meta);
};

// ---------- 写入 ----------

const createProgram = async (body = {}, { isHost = false } = {}) => {
  if (!isHost) throw forbidden();
  const title = requiredString(body.title, { field: 'title', max: 200 });
  const now = new Date().toISOString();

  const guestIds = normalizeIdList(body.guestIds, 'guestIds');
  await assertGuestsExist(guestIds);

  const meta = {
    id: newId('prg'),
    title,
    show: optionalString(body.show, { field: 'show', max: 200, allowEmpty: true }) ?? '',
    episodeNo: body.episodeNo === undefined || body.episodeNo === '' ? null : Number(body.episodeNo),
    summary:
      optionalString(body.summary, { field: 'summary', max: 1000, allowEmpty: true }) ?? '',
    tags: normalizeTags(body.tags) ?? [],
    guestIds,
    status: optionalEnum(body.status, config.programStatuses, { field: 'status' }) ?? DRAFT,
    createdAt: now,
    updatedAt: now,
    publishedAt: null
  };
  if (meta.status !== DRAFT) meta.publishedAt = now;
  if (meta.episodeNo !== null && !Number.isInteger(meta.episodeNo))
    throw badRequest('episodeNo 必须是整数');

  await store.writeJson(metaFile(meta.id), meta);
  await store.ensureDir(segmentsDir(meta.id));
  return getProgram(meta.id, { isHost: true });
};

/** 允许的状态流转；主持人可随时撤回为草稿 */
const STATUS_TRANSITIONS = {
  draft: ['published'],
  published: ['draft', 'archived'],
  archived: ['published']
};

const updateProgram = async (id, body = {}, { isHost = false } = {}) => {
  if (!isHost) throw forbidden();
  const meta = await getMeta(id);

  if (body.title !== undefined)
    meta.title = requiredString(body.title, { field: 'title', max: 200 });
  if (body.show !== undefined)
    meta.show = optionalString(body.show, { field: 'show', max: 200, allowEmpty: true }) ?? '';
  if (body.episodeNo !== undefined) {
    meta.episodeNo = body.episodeNo === '' || body.episodeNo === null ? null : Number(body.episodeNo);
    if (meta.episodeNo !== null && !Number.isInteger(meta.episodeNo))
      throw badRequest('episodeNo 必须是整数');
  }
  if (body.summary !== undefined)
    meta.summary =
      optionalString(body.summary, { field: 'summary', max: 1000, allowEmpty: true }) ?? '';
  if (body.tags !== undefined) meta.tags = normalizeTags(body.tags) ?? [];
  if (body.guestIds !== undefined) {
    meta.guestIds = normalizeIdList(body.guestIds, 'guestIds');
    await assertGuestsExist(meta.guestIds);
  }
  if (body.status !== undefined && body.status !== meta.status) {
    const allowed = STATUS_TRANSITIONS[meta.status] || [];
    if (!allowed.includes(body.status))
      throw badRequest(`不允许从 ${meta.status} 变更为 ${body.status}`);
    meta.status = body.status;
    if (meta.status === 'published' && !meta.publishedAt) meta.publishedAt = new Date().toISOString();
  }

  meta.updatedAt = new Date().toISOString();
  await store.writeJson(metaFile(id), meta);
  return getProgram(id, { isHost: true });
};

const deleteProgram = async (id, { isHost = false } = {}) => {
  if (!isHost) throw forbidden();
  await getMeta(id);
  await store.remove(programDir(id));
};

// ---------- 分段内容变化时刷新节目时间戳 ----------

const touch = async (id) => {
  const meta = await getMeta(id);
  meta.updatedAt = new Date().toISOString();
  await store.writeJson(metaFile(id), meta);
};

// ---------- 给 segment / guest 服务复用 ----------

/** 供分段路由调用：按可见性取节目（viewer 读草稿 = 404） */
const getVisibleProgram = async (id, { isHost = false } = {}) => {
  const meta = await getMeta(id);
  assertVisible(meta, isHost);
  return meta;
};

/** 供 guestService 反查引用（删除嘉宾前校验），只需扫描元数据 */
const findProgramsUsingGuest = async (guestId) => {
  const dirs = await store.listDirs(programsDir());
  const result = [];
  for (const dir of dirs) {
    const meta = await getMetaOrNull(dir);
    if (meta && Array.isArray(meta.guestIds) && meta.guestIds.includes(guestId)) {
      result.push({ id: meta.id, title: meta.title, status: meta.status });
    }
  }
  return result;
};

// ---------- 分段文稿操作（由 segmentService 扩展） ----------

const segHelpers = {
  segmentsDir,
  segmentFile,
  loadSegments
};

// ---------- 校验辅助 ----------

function normalizeIdList(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`${field} 必须是数组`);
  const ids = value.map((v) => (typeof v === 'string' ? v.trim() : v)).filter(Boolean);
  if (ids.some((v) => typeof v !== 'string')) throw badRequest(`${field} 必须是字符串数组`);
  return [...new Set(ids)];
}

async function assertGuestsExist(guestIds) {
  for (const gid of guestIds) {
    const g = await store.readJson(path.join(store.dataRoot, 'guests', `${gid}.json`), {
      missingOk: true
    });
    if (!g) throw badRequest(`嘉宾不存在：${gid}`);
  }
}

module.exports = {
  listPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram,
  getVisibleProgram,
  findProgramsUsingGuest,
  getMeta,
  touch,
  segHelpers
};
