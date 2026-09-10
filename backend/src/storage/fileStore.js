'use strict';

/**
 * 本地文件存储层（File Store）
 * ------------------------------------------------------------------
 * 所有数据以 JSON 文件落盘，上层 services 只通过本模块的方法访问数据，
 * 不直接接触 fs。将来替换为数据库时，只需新增一个实现相同接口的
 * dbStore（如 sqlStore），并在这里切换导出即可：
 *
 *   readJson / writeJson / remove / listJson / ensureDir
 *
 * 写操作采用「写临时文件 + rename」的原子替换策略，避免进程中断产生半截文件。
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const { notFound } = require('../lib/errors');

const dataRoot = config.dataDir;

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

/** 读取并解析 JSON 文件；missingOk=true 时文件不存在返回 null */
const readJson = async (filePath, { missingOk = false } = {}) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      if (missingOk) return null;
      throw notFound('数据文件不存在');
    }
    if (err instanceof SyntaxError) {
      throw new Error(`JSON 文件解析失败: ${filePath} — ${err.message}`);
    }
    throw err;
  }
};

/** 原子写入 JSON（先写 .tmp 再 rename） */
const writeJson = async (filePath, data) => {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, filePath);
  return data;
};

const remove = async (filePath) => {
  await fs.rm(filePath, { force: true, recursive: true });
};

const exists = async (filePath) => fsSync.existsSync(filePath);

/**
 * 列出某目录下全部 *.json 文件并解析。
 * @param dir 目标目录
 * @param missingOk 目录不存在时返回空数组
 */
const listJson = async (dir, { missingOk = true } = {}) => {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT' && missingOk) return [];
    throw err;
  }
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => path.join(dir, e.name));
  return Promise.all(files.map((f) => readJson(f)));
};

/** 列出子目录名（用于按节目目录聚合分段） */
const listDirs = async (dir) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
};

module.exports = {
  dataRoot,
  path,
  ensureDir,
  readJson,
  writeJson,
  remove,
  exists,
  listJson,
  listDirs
};
