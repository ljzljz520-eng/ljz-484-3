'use strict';

const express = require('express');
const segmentService = require('../services/segmentService');
const programService = require('../services/programService');
const { exportProgram } = require('../services/exportService');
const { hostOnly } = require('../middleware/auth');

const router = express.Router();

const viewerCtx = (req) => ({ isHost: req.isHost });

// ---------- 节目 ----------

// GET /api/programs?status=published
router.get('/', async (req, res, next) => {
  try {
    res.json(await programService.listPrograms({ status: req.query.status, ...viewerCtx(req) }));
  } catch (err) {
    next(err);
  }
});

// POST /api/programs
router.post('/', hostOnly, async (req, res, next) => {
  try {
    res.status(201).json(await programService.createProgram(req.body || {}, viewerCtx(req)));
  } catch (err) {
    next(err);
  }
});

// GET /api/programs/:id（含分段 + 嘉宾，草稿仅主持人）
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await programService.getProgram(req.params.id, viewerCtx(req)));
  } catch (err) {
    next(err);
  }
});

// PUT /api/programs/:id
router.put('/:id', hostOnly, async (req, res, next) => {
  try {
    res.json(await programService.updateProgram(req.params.id, req.body || {}, viewerCtx(req)));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/programs/:id
router.delete('/:id', hostOnly, async (req, res, next) => {
  try {
    await programService.deleteProgram(req.params.id, viewerCtx(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- 导出 ----------

// GET /api/programs/:id/export?inline=1 → 纯文本（草稿对 viewer 同样 404）
router.get('/:id/export', async (req, res, next) => {
  try {
    const { filename, text } = await exportProgram(req.params.id, viewerCtx(req));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (req.query.inline) {
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    }
    res.send(text);
  } catch (err) {
    next(err);
  }
});

// ---------- 分段 ----------

// GET /api/programs/:id/segments
router.get('/:id/segments', async (req, res, next) => {
  try {
    res.json(await segmentService.listSegments(req.params.id, viewerCtx(req)));
  } catch (err) {
    next(err);
  }
});

// POST /api/programs/:id/segments
router.post('/:id/segments', hostOnly, async (req, res, next) => {
  try {
    res
      .status(201)
      .json(await segmentService.createSegment(req.params.id, req.body || {}, viewerCtx(req)));
  } catch (err) {
    next(err);
  }
});

// PUT /api/programs/:id/segments/reorder（注意要在 /:segmentId 之前注册）
router.put('/:id/segments/reorder', hostOnly, async (req, res, next) => {
  try {
    res.json(await segmentService.reorderSegments(req.params.id, req.body || {}, viewerCtx(req)));
  } catch (err) {
    next(err);
  }
});

// GET /api/programs/:id/segments/:segmentId
router.get('/:id/segments/:segmentId', async (req, res, next) => {
  try {
    res.json(
      await segmentService.getSegment(req.params.id, req.params.segmentId, viewerCtx(req))
    );
  } catch (err) {
    next(err);
  }
});

// PUT /api/programs/:id/segments/:segmentId
router.put('/:id/segments/:segmentId', hostOnly, async (req, res, next) => {
  try {
    res.json(
      await segmentService.updateSegment(
        req.params.id,
        req.params.segmentId,
        req.body || {},
        viewerCtx(req)
      )
    );
  } catch (err) {
    next(err);
  }
});

// DELETE /api/programs/:id/segments/:segmentId
router.delete('/:id/segments/:segmentId', hostOnly, async (req, res, next) => {
  try {
    await segmentService.deleteSegment(req.params.id, req.params.segmentId, viewerCtx(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
