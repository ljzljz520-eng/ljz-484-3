'use strict';

const { randomUUID } = require('crypto');

/** 生成带前缀的 ID，便于在文件系统 / 日志中辨认类型，例如 prg_xxxx / seg_xxxx / gst_xxxx */
const newId = (prefix) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;

module.exports = { newId };
