'use strict';

/** 业务错误基类：携带 HTTP 状态码，由统一错误处理中间件转换为响应 */
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const notFound = (message = '资源不存在') => new HttpError(404, 'NOT_FOUND', message);
const badRequest = (message = '请求参数有误') => new HttpError(400, 'BAD_REQUEST', message);
const forbidden = (message = '无权执行该操作') => new HttpError(403, 'FORBIDDEN', message);
const conflict = (message = '资源冲突') => new HttpError(409, 'CONFLICT', message);

module.exports = { HttpError, notFound, badRequest, forbidden, conflict };
