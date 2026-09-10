# 🎙️ 播客文稿管理器（Podcast Script Manager）

管理播客节目的**节目元数据、分段文稿、嘉宾与发布状态**，前端支持**编辑 / 预览 / 导出纯文本**。
**草稿仅主持人可见**。当前版本不接数据库，使用**本地 JSON 文件存储**，但分层清晰，可平滑替换为数据库。

## 快速开始

```bash
npm install
npm run seed     # 可选：写入演示数据（2 位嘉宾 / 1 个已发布节目 / 1 个草稿节目）
npm start        # 启动 http://localhost:3000
# 开发模式（文件变更自动重启）：npm run dev
```

浏览器打开 <http://localhost:3000>，右上角可切换演示身份：

| 身份 | 能力 |
| --- | --- |
| **主持人 host** | 新建/编辑/删除节目与分段、管理嘉宾、发布/撤回/归档，**可见草稿** |
| **听众 viewer**（默认） | 只读浏览**已发布/已归档**节目、预览与导出；草稿一律 404（不暴露草稿存在） |

> 角色通过请求头 `X-User-Role: host | viewer` 传递（演示用，存于 localStorage）。
> 接入真实登录时，只需改写 `backend/src/middleware/auth.js` 解析 Cookie/JWT，路由层零改动。

## 目录结构

```
.
├── package.json
├── backend/
│   ├── data/                         # 本地文件存储（运行时生成，可整体备份/清空）
│   │   ├── guests/{gst_xxxx}.json
│   │   └── programs/{prg_xxxx}/
│   │       ├── meta.json             # 节目元数据 + 发布状态 + 嘉宾 id 列表
│   │       └── segments/{seg_xxxx}.json   # 每个分段一个独立文件，order 决定顺序
│   └── src/
│       ├── config.js                 # 端口/数据目录/角色/状态与分段类型枚举
│       ├── server.js                 # 启动入口（确保数据目录存在后监听）
│       ├── app.js                    # Express 装配、统一错误处理、前端静态托管
│       ├── middleware/auth.js        # 角色识别 + hostOnly 写保护
│       ├── routes/                   # HTTP 层：参数校验委托 service，错误统一 next(err)
│       │   ├── programRoutes.js      # 节目 / 分段 / 导出 全部路由
│       │   └── guestRoutes.js
│       ├── services/                 # 业务层：唯一接触存储接口的地方
│       │   ├── programService.js     # 节目 CRUD、状态流转、草稿可见性、嘉宾 id 解析
│       │   ├── segmentService.js     # 分段 CRUD、自动编号、重排序
│       │   ├── guestService.js       # 嘉宾 CRUD、删除前引用检查
│       │   └── exportService.js      # 纯文本排版导出
│       ├── storage/fileStore.js      # ★ 存储层：readJson/writeJson/listJson/remove…
│       ├── lib/                      # errors / ids / validate 工具
│       └── scripts/seed.js           # 演示数据
└── frontend/                         # 原生 ES Module 单页应用（零构建）
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── main.js                   # 入口、角色切换
        ├── api.js                    # fetch 封装（自动带角色头）、导出下载
        ├── router.js                 # hash 路由
        ├── dom.js                    # DOM/常量/提示工具
        └── views/                    # 节目列表 / 节目编辑 / 预览 / 嘉宾
```

### 文件即数据模型

`data/programs/{prg_xxxx}/meta.json`

```json
{
  "id": "prg_...",
  "title": "声音的形状",
  "show": "声波纹",
  "episodeNo": 12,
  "summary": "……",
  "tags": ["声学", "录音"],
  "guestIds": ["gst_..."],
  "status": "draft | published | archived",
  "createdAt": "...", "updatedAt": "...", "publishedAt": null
}
```

`data/programs/{prg_xxxx}/segments/{seg_xxxx}.json`

```json
{
  "id": "seg_...", "programId": "prg_...",
  "title": "驻波、混响与小房间难题",
  "type": "intro | topic | talk | quote | ad | outro",
  "speaker": "林知夏", "guestId": "gst_...",
  "content": "正文……",
  "durationSec": 420, "order": 2,
  "createdAt": "...", "updatedAt": "..."
}
```

写入采用 **临时文件 + rename 原子替换**，避免进程中断产生半截 JSON。

## HTTP 接口

所有 `/api` 请求读取 `X-User-Role` 头。写操作（POST/PUT/DELETE）仅 host，否则 `403`。
错误体统一为 `{ "error": { "code": "...", "message": "..." } }`。

### 节目 Programs

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/programs?status=draft\|published\|archived` | 节目列表（viewer 自动过滤草稿；含嘉宾摘要与分段数，不含正文） |
| POST | `/api/programs` | 新建节目（默认 `draft`），host |
| GET | `/api/programs/:id` | 节目详情（元数据 + 嘉宾 + 按 order 排序的分段）；viewer 访问草稿 → `404` |
| PUT | `/api/programs/:id` | 更新元数据 / 改变状态，host |
| DELETE | `/api/programs/:id` | 删除节目及其全部分段，host |
| GET | `/api/programs/:id/export?inline=1` | 导出 UTF-8 纯文本（默认 attachment 下载）；草稿对 viewer 同样 `404` |

**状态流转**：`draft → published`；`published → draft | archived`；`archived → published`。
非法流转返回 `400`。首次发布写入 `publishedAt`。

### 分段 Segments（嵌套在节目下）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/programs/:id/segments` | 分段列表（按 order） |
| POST | `/api/programs/:id/segments` | 新增分段（自动排到末尾，order 连续），host |
| PUT | `/api/programs/:id/segments/:sid` | 修改分段（标题/类型/发言人/嘉宾/正文/时长），host |
| DELETE | `/api/programs/:id/segments/:sid` | 删除分段并自动重排 order，host |
| PUT | `/api/programs/:id/segments/reorder` | 整体重排，body 为 `{"segmentIds":[...]}` 或 `{"orders":[{"id","order"}]}`，host |

### 嘉宾 Guests

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/guests` / `/api/programs` 中带嘉宾摘要 | 嘉宾列表 / 详情 |
| POST | `/api/guests` | 新建（name 必填），host |
| PUT | `/api/guests/:id` | 更新，host |
| DELETE | `/api/guests/:id` | 删除；仍被节目引用时返回 `409`，host |

另有 `GET /api/health` 健康检查。

### curl 示例

```bash
curl -H "X-User-Role: host" http://localhost:3000/api/programs                 # 含草稿
curl http://localhost:3000/api/programs                                        # 仅已发布/归档
curl -X POST http://localhost:3000/api/programs \
  -H "Content-Type: application/json" -H "X-User-Role: host" \
  -d '{"title":"新一期","tags":"闲聊,问答","guestIds":["gst_xxx"]}'
curl -OJ http://localhost:3000/api/programs/prg_xxx/export                     # 导出 txt
```

## 前端功能

- **节目列表**：状态筛选（草稿筛选仅主持人可见）、分段数/嘉宾/标签概览
- **节目编辑（host）**：元数据表单、嘉宾勾选关联、状态下拉（只列合法流转）、删除节目
- **分段编辑（host）**：逐段内联编辑并即时保存、↑/↓ 重排序、删除自动重编号、新增分段
- **预览**：只读排版稿，草稿显示橙色「仅主持人可见」横幅，自动汇总预计时长
- **导出文本**：与预览一致的纯文本（头部信息 + 分段正文），文件名自动含期号与标题
- 切换右上角身份后当前页立即重渲染（草稿显隐、编辑按钮即时变化）

## 将来接入数据库的改造点

分层刻意做了依赖倒置：`routes → services → storage 接口`，service 从不直接用 `fs`。

1. 新增 `backend/src/storage/dbStore.js`，实现与 `fileStore` 同名方法（或把存储接口收窄为
   `programRepo / segmentRepo / guestRepo` 三个仓储，在 service 中用仓储替代文件读写）；
2. 建议表结构：`guests`、`programs`（含 status/时间戳）、`program_guests`（多对多）、
   `segments`（外键 program_id，`order` 列加索引）；
3. 在 `services/*` 中把文件路径调用替换为仓储调用；状态流转、可见性、重排等业务逻辑不变；
4. 事务边界：分段重排、删除节目（级联分段）建议包在一个数据库事务里。

## 说明与限制（文件存储版）

- 适合单实例 / 小规模使用；无并发写锁，多实例同时写入需换数据库或加文件锁；
- 每次列表请求读取目录下全部 JSON，数据量很大时需加分页与索引（数据库版天然支持）。
