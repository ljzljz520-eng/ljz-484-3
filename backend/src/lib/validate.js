'use strict';

const { badRequest } = require('./errors');

const assert = (condition, message) => {
  if (!condition) throw badRequest(message);
};

const trim = (value) => (typeof value === 'string' ? value.trim() : value);

/** 可选字符串字段：未提供返回 undefined；提供了则 trim，可限制长度 */
const optionalString = (value, { field, max = 10000, allowEmpty = false } = {}) => {
  if (value === undefined || value === null) return undefined;
  assert(typeof value === 'string', `${field} 必须是字符串`);
  const v = value.trim();
  assert(allowEmpty || v.length > 0, `${field} 不能为空`);
  assert(v.length <= max, `${field} 长度不能超过 ${max} 个字符`);
  return v;
};

/** 必填字符串字段 */
const requiredString = (value, { field, max = 10000 } = {}) => {
  assert(typeof value === 'string' && value.trim().length > 0, `${field} 为必填项`);
  const v = value.trim();
  assert(v.length <= max, `${field} 长度不能超过 ${max} 个字符`);
  return v;
};

/** 可选枚举字段 */
const optionalEnum = (value, allowed, { field } = {}) => {
  if (value === undefined || value === null) return undefined;
  assert(allowed.includes(value), `${field} 必须是以下值之一：${allowed.join(' / ')}`);
  return value;
};

/** 标签数组：兼容 "a,b,c" 字符串与数组输入，去重去空 */
const normalizeTags = (value) => {
  if (value === undefined || value === null) return undefined;
  const arr = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : null;
  if (!arr) throw badRequest('tags 必须是数组或逗号分隔字符串');
  return [...new Set(arr.map((t) => trim(t)).filter(Boolean))];
};

/** 可选整数（分段时长，秒） */
const optionalInt = (value, { field, min = 0, max = 24 * 3600 } = {}) => {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  assert(Number.isInteger(n), `${field} 必须是整数`);
  assert(n >= min && n <= max, `${field} 必须在 ${min}~${max} 之间`);
  return n;
};

module.exports = {
  assert,
  trim,
  optionalString,
  requiredString,
  optionalEnum,
  normalizeTags,
  optionalInt
};
