'use strict';

const path = require('path');

/**
 * 全局配置。
 * 当前版本使用本地文件存储；切换数据库时，数据路径相关配置可移除，
 * service 层接口保持不变（依赖倒置：routes/services 只面向 storage 接口编程）。
 */
module.exports = {
  port: process.env.PORT || 3000,
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  roles: Object.freeze({
    HOST: 'host', // 主持人：可见全部（含草稿），可写
    VIEWER: 'viewer' // 普通用户：仅可见已发布内容，只读
  }),
  programStatuses: Object.freeze(['draft', 'published', 'archived']),
  segmentTypes: Object.freeze(['intro', 'talk', 'topic', 'quote', 'ad', 'outro'])
};
