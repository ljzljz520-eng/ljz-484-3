'use strict';

const app = require('./app');
const config = require('./config');
const store = require('./storage/fileStore');

(async () => {
  await store.ensureDir(config.dataDir);
  await store.ensureDir(require('path').join(config.dataDir, 'programs'));
  await store.ensureDir(require('path').join(config.dataDir, 'guests'));

  app.listen(config.port, () => {
    console.log(`🎙️  播客文稿管理器已启动: http://localhost:${config.port}`);
    console.log(`   数据目录: ${config.dataDir}（本地文件存储）`);
  });
})().catch((err) => {
  console.error('启动失败：', err);
  process.exit(1);
});
