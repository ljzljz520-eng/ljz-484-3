'use strict';

const express = require('express');
const guestService = require('../services/guestService');
const { hostOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/guests
router.get('/', async (req, res, next) => {
  try {
    res.json(await guestService.listGuests());
  } catch (err) {
    next(err);
  }
});

// GET /api/guests/:id
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await guestService.getGuest(req.params.id));
  } catch (err) {
    next(err);
  }
});

// POST /api/guests  （仅主持人）
router.post('/', hostOnly, async (req, res, next) => {
  try {
    const guest = await guestService.createGuest(req.body || {});
    res.status(201).json(guest);
  } catch (err) {
    next(err);
  }
});

// PUT /api/guests/:id
router.put('/:id', hostOnly, async (req, res, next) => {
  try {
    res.json(await guestService.updateGuest(req.params.id, req.body || {}));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/guests/:id（被节目引用时拒绝）
router.delete('/:id', hostOnly, async (req, res, next) => {
  try {
    await guestService.deleteGuest(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
