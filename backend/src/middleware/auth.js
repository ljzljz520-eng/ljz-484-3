'use strict';

const config = require('../config');
const { forbidden } = require('../lib/errors');

/**
 * 轻量鉴权中间件（演示版）
 * ------------------------------------------------------------------
 * 通过请求头 X-User-Role 识别角色：host（主持人）/ viewer（普通用户）。
 * 未携带时默认 viewer（最小权限原则）。
 *
 * 接入真实登录后，在此解析 Cookie / JWT，把 req.role、req.user 替换为
 * 会话中的用户即可，路由层无需改动。
 */
module.exports = (req, _res, next) => {
  const headerRole = req.get('X-User-Role');
  req.role = headerRole === config.roles.HOST ? config.roles.HOST : config.roles.VIEWER;
  req.isHost = req.role === config.roles.HOST;
  next();
};

/** 限制仅主持人可写 */
module.exports.hostOnly = (req, _res, next) => {
  if (!req.isHost) return next(forbidden('仅主持人可执行该操作'));
  next();
};
