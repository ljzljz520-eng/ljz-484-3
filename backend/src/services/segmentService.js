'use strict';

const store = require('../storage/fileStore');
const config = require('../config');
const { newId } = require('../lib/ids');
const { notFound, badRequest, forbidden } = require('../lib/errors');
const {
  requiredString,
  optionalString,
  optionalEnum,
  optionalInt
} = require('../lib/validate');
const programService = require('./programService');
const { segHelpers } = programService;

/**
 * 分段文稿服务
 * ------------------------------------------------------------------
 * 每个分段是独立文件：data/programs/{prg}/segments/{seg}.json
 * order 从 1 开始连续编号，新增分段排到末尾。
 */

const listSegments = async (programId, { isHost = false }) => {
  await programService.getVisibleProgram(programId, { isHost });
  return segHelpers.loadSegments(programId);
};

const getSegment = async (programId, segmentId, { isHost = false }) => {
  await programService.getVisibleProgram(programId, { isHost });
  const seg = await store.readJson(segHelpers.segmentFile(programId, segmentId), {
    missingOk: true
  });
  if (!seg) throw notFound('分段不存在');
  return seg;
};

const createSegment = async (programId, body = {}, { isHost = false }) => {
  if (!isHost) throw forbidden();
  await programService.getMeta(programId); // 写操作：存在即可（主持人才能到这）

  const existing = await segHelpers.loadSegments(programId);
  const now = new Date().toISOString();
  const segment = {
    id: newId('seg'),
    programId,
    title: requiredString(body.title, { field: 'title', max: 200 }),
    type:
      optionalEnum(body.type, config.segmentTypes, { field: 'type' }) ?? 'topic',
    speaker:
      optionalString(body.speaker, { field: 'speaker', max: 100, allowEmpty: true }) ?? '',
    guestId:
      optionalString(body.guestId, { field: 'guestId', max: 100, allowEmpty: true }) || null,
    content:
      optionalString(body.content, { field: 'content', max: 100000, allowEmpty: true }) ?? '',
    durationSec: optionalInt(body.durationSec, { field: 'durationSec' }) ?? null,
    order: existing.length + 1,
    createdAt: now,
    updatedAt: now
  };
  await touchProgram(programId);
  await store.writeJson(segHelpers.segmentFile(programId, segment.id), segment);
  return segment;
};

const updateSegment = async (programId, segmentId, body = {}, { isHost = false }) => {
  if (!isHost) throw forbidden();
  await programService.getMeta(programId);
  const seg = await getSegment(programId, segmentId, { isHost: true });

  if (body.title !== undefined)
    seg.title = requiredString(body.title, { field: 'title', max: 200 });
  if (body.type !== undefined)
    seg.type = optionalEnum(body.type, config.segmentTypes, { field: 'type' });
  if (body.speaker !== undefined)
    seg.speaker = optionalString(body.speaker, { field: 'speaker', max: 100, allowEmpty: true }) ?? '';
  if (body.guestId !== undefined)
    seg.guestId =
      optionalString(body.guestId, { field: 'guestId', max: 100, allowEmpty: true }) || null;
  if (body.content !== undefined)
    seg.content =
      optionalString(body.content, { field: 'content', max: 100000, allowEmpty: true }) ?? '';
  if (body.durationSec !== undefined)
    seg.durationSec = body.durationSec === null ? null : optionalInt(body.durationSec, { field: 'durationSec' });

  seg.updatedAt = new Date().toISOString();
  await touchProgram(programId);
  await store.writeJson(segHelpers.segmentFile(programId, segmentId), seg);
  return seg;
};

const deleteSegment = async (programId, segmentId, { isHost = false }) => {
  if (!isHost) throw forbidden();
  await programService.getMeta(programId);
  await getSegment(programId, segmentId, { isHost: true });

  await store.remove(segHelpers.segmentFile(programId, segmentId));
  // 重新连续编号
  const remaining = await segHelpers.loadSegments(programId);
  for (let i = 0; i < remaining.length; i++) {
    const seg = remaining[i];
    if (seg.order !== i + 1) {
      seg.order = i + 1;
      await store.writeJson(segHelpers.segmentFile(programId, seg.id), seg);
    }
  }
  await touchProgram(programId);
};

/**
 * 分段重排序：body.orders = [{ id, order }, ...]
 * 也支持 body.segmentIds（完整新顺序的 id 数组）。
 */
const reorderSegments = async (programId, body = {}, { isHost = false }) => {
  if (!isHost) throw forbidden();
  await programService.getMeta(programId);
  const segments = await segHelpers.loadSegments(programId);
  const byId = new Map(segments.map((s) => [s.id, s]));

  let pairs;
  if (Array.isArray(body.segmentIds)) {
    pairs = body.segmentIds.map((id, i) => ({ id, order: i + 1 }));
  } else if (Array.isArray(body.orders)) {
    pairs = body.orders;
  } else {
    throw badRequest('需要提供 segmentIds 数组或 orders 数组');
  }

  const nextOrders = pairs.map((p) => Number(p.order));
  if (pairs.length !== segments.length) throw badRequest('必须提供全部分段的顺序');
  if (new Set(nextOrders).size !== nextOrders.length) throw badRequest('顺序不能重复');
  if (nextOrders.some((n) => !Number.isInteger(n) || n < 1 || n > segments.length))
    throw badRequest('顺序值必须是 1..N 的连续整数');

  for (const p of pairs) {
    const seg = byId.get(p.id);
    if (!seg) throw badRequest(`分段不属于该节目：${p.id}`);
    seg.order = Number(p.order);
    seg.updatedAt = new Date().toISOString();
  }
  for (const seg of byId.values()) {
    await store.writeJson(segHelpers.segmentFile(programId, seg.id), seg);
  }
  await touchProgram(programId);
  return segHelpers.loadSegments(programId);
};

/** 分段内容变化时刷新节目 updatedAt */
const touchProgram = (programId) => programService.touch(programId);

module.exports = {
  listSegments,
  getSegment,
  createSegment,
  updateSegment,
  deleteSegment,
  reorderSegments
};
