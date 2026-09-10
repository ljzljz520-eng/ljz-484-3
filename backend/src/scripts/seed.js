'use strict';

/**
 * 写入演示数据：2 位嘉宾、1 个已发布节目（含 3 个分段）、1 个草稿节目。
 * 用法：npm run seed   （重复执行会先清空 data 目录）
 */

const path = require('path');
const store = require('../storage/fileStore');
const guestService = require('../services/guestService');
const programService = require('../services/programService');
const segmentService = require('../services/segmentService');

const HOST = { isHost: true };

async function main() {
  await store.remove(store.dataRoot);
  await store.ensureDir(path.join(store.dataRoot, 'programs'));
  await store.ensureDir(path.join(store.dataRoot, 'guests'));

  const guest1 = await guestService.createGuest({
    name: '林知夏',
    title: '声学工程师',
    organization: '回声实验室',
    bio: '长期研究空间声学与播客录音工艺。',
    tags: '技术,声学'
  });
  const guest2 = await guestService.createGuest({
    name: '周远航',
    title: '独立制作人',
    organization: '晚风电台',
    bio: '制作过十余档百万播放量的独立播客。',
    tags: '制作,叙事'
  });

  const published = await programService.createProgram(
    {
      title: '声音的形状：从一间好录音棚说起',
      show: '声波纹',
      episodeNo: 12,
      summary: '我们聊了录音环境的声学处理、预算有限时的改造方案，以及为什么「先听后买」永远是硬道理。',
      tags: '声学,录音,设备',
      guestIds: [guest1.id],
      status: 'published'
    },
    HOST
  );

  await segmentService.createSegment(
    published.id,
    { title: '片头与今日话题', type: 'intro', speaker: '主持人', durationSec: 45,
      content: '大家好，欢迎收听《声波纹》。今天我们从「为什么你录出来的声音总是闷」聊起。' },
    HOST
  );
  await segmentService.createSegment(
    published.id,
    { title: '驻波、混响与小房间难题', type: 'topic', speaker: '林知夏', guestId: guest1.id, durationSec: 420,
      content: '小房间最大的敌人是驻波和早期反射。先别急着买吸音棉，第一步是找到合适的录音位置……' },
    HOST
  );
  await segmentService.createSegment(
    published.id,
    { title: '结尾与下期预告', type: 'outro', speaker: '主持人', durationSec: 60,
      content: '感谢知夏！下期我们聊聊「播客剪辑里最容易被忽略的呼吸感」，我们下期见。' },
    HOST
  );

  const draft = await programService.createProgram(
    {
      title: '（策划中）独立播客如何赚到第一块钱',
      show: '声波纹',
      episodeNo: 13,
      summary: '草稿：嘉宾与商业化路径部分待补充。',
      tags: '商业化,策划',
      guestIds: [guest2.id],
      status: 'draft'
    },
    HOST
  );
  await segmentService.createSegment(
    draft.id,
    { title: '开场：三种常见变现模式', type: 'intro', speaker: '主持人', durationSec: 90,
      content: '口播广告、会员订阅、线下活动——各自适合什么阶段的节目？（此处待补充数据）' },
    HOST
  );

  console.log('✅ 种子数据写入完成');
  console.log(`   已发布节目 id: ${published.id}`);
  console.log(`   草稿节目 id:   ${draft.id}（仅 X-User-Role: host 可见）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
