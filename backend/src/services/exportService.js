'use strict';

const programService = require('./programService');

/**
 * 节目文稿导出（纯文本）
 * ------------------------------------------------------------------
 * 导出内容与预览一致：viewer 导出草稿会得到 404（getProgram 内部已拦截）。
 * 输出为 UTF-8 纯文本，适合存档 / 提词器 / 二次编辑。
 */

const TYPE_LABELS = {
  intro: '开场',
  topic: '话题',
  talk: '对谈',
  quote: '金句',
  ad: '口播广告',
  outro: '结尾'
};

const formatDuration = (sec) => {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const pad = (ch = '=', n = 60) => ch.repeat(n);

const buildProgramText = (program) => {
  const lines = [];
  const episodeLabel =
    program.episodeNo != null && program.episodeNo !== '' ? ` 第 ${program.episodeNo} 期` : '';
  const showLabel = program.show ? `${program.show}${episodeLabel}` : episodeLabel.trim();

  lines.push(pad('='));
  lines.push(program.title);
  if (showLabel) lines.push(showLabel);
  lines.push(pad('='));
  lines.push(`状态：${program.status === 'draft' ? '草稿（未发布）' : program.status === 'published' ? '已发布' : '已归档'}`);
  if (program.publishedAt) lines.push(`发布时间：${program.publishedAt}`);
  if (program.guests && program.guests.length > 0) {
    lines.push(
      '嘉宾：' +
        program.guests
          .map((g) => [g.name, g.title, g.organization].filter(Boolean).join(' / '))
          .join('；')
    );
  }
  if (program.tags && program.tags.length > 0) lines.push(`标签：${program.tags.join('、')}`);
  if (program.summary) {
    lines.push('');
    lines.push('【简介】');
    lines.push(program.summary);
  }

  const segments = program.segments || [];
  lines.push('');
  lines.push(pad('-'));
  lines.push(`正文（共 ${segments.length} 段）`);
  lines.push(pad('-'));

  segments.forEach((seg, i) => {
    const head = [`${i + 1}. ${seg.title}`, `[${TYPE_LABELS[seg.type] || seg.type}]`];
    const speaker = seg.speaker || (program.guests || []).find((g) => g.id === seg.guestId)?.name;
    if (speaker) head.push(`@${speaker}`);
    const dur = formatDuration(seg.durationSec);
    if (dur) head.push(`(${dur})`);
    lines.push('');
    lines.push(head.join(' '));
    lines.push('-'.repeat(Math.max(head.join(' ').length * 2, 20)));
    lines.push(seg.content || '（暂无内容）');
  });

  lines.push('');
  lines.push(pad('='));
  lines.push(`由播客文稿管理器导出 · ${new Date().toISOString()}`);
  return lines.join('\n');
};

const exportProgram = async (id, { isHost = false }) => {
  const program = await programService.getProgram(id, { isHost });
  return {
    filename: buildFilename(program),
    text: buildProgramText(program)
  };
};

const buildFilename = (program) => {
  const ep = program.episodeNo != null && program.episodeNo !== '' ? `EP${program.episodeNo}-` : '';
  const safeTitle = program.title.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);
  return `${ep}${safeTitle}.txt`;
};

module.exports = { exportProgram, buildProgramText };
