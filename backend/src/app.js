'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');
const auth = require('./middleware/auth');
const { HttpError } = require('./lib/errors');

const programRoutes = require('./routes/programRoutes');
const guestRoutes = require('./routes/guestRoutes');

const app = express();
app.use(express.json({ limit: '2mb' }));

// 简易访问日志
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} (${req.get('X-User-Role') || 'viewer'})`);
  next();
});

// 所有接口先经过角色中间件（路由内部再做细粒度授权）
app.use('/api', auth);

app.get('/api/health', (_req, res) => res.json({ ok: true, storage: 'file', time: new Date().toISOString() }));
app.use('/api/programs', programRoutes);
app.use('/api/guests', guestRoutes);

// 404（未命中的 API）
app.use('/api', (req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `接口不存在：${req.method} ${req.path}`));
});

// ---------- 统一错误处理 ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: '请求体不是合法 JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' } });
  }
  console.error('[unhandled error]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } });
});

// ---------- 前端静态资源（同源部署，免跨域） ----------
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendDir));
// 非 API 路径统一回退到 index.html（hash 路由其实用不到，留作扩展 history 路由）
app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

module.exports = app;
