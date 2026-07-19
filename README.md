# Malaysia Bali Travel Dashboard

《马来西亚 × 巴厘岛情侣旅行总控台》是一个面向 iPhone 的原生 PWA。无需构建；旅行数据集中在 `data/trip-data.js`，本机修改保存在 `localStorage`。可选的 Supabase 层只同步清单完成状态，未配置时自动保持离线模式。

## 本地使用

最简单：双击 `index.html` 即可查看主要页面和使用清单。浏览器出于安全限制，不会在 `file://` 模式启用 Service Worker；要测试安装与离线功能，请在项目目录运行：

```bash
python3 -m http.server 8080
```

Mac 打开 `http://localhost:8080`。

iPhone 与 Mac 连接同一 Wi-Fi 后：

1. 在 Mac 的“系统设置 → Wi-Fi → 详细信息”查看局域网 IP。
2. iPhone Safari 打开 `http://Mac局域网IP:8080`。
3. 点 Safari 分享按钮 →“添加到主屏幕”。

说明：iPhone 对非 `localhost` 的普通 HTTP 地址可能限制 PWA 安装或离线能力。长期使用建议部署到带 HTTPS 的 GitHub Pages。

## 修改旅行数据

所有基础内容只在 [`data/trip-data.js`](data/trip-data.js) 修改。不要把航班、酒店、日期、清单或预算内容写进 `index.html` 或 `js/app.js`。

每次修改基础数据：

1. 更新 `meta.lastUpdated`（ISO 日期时间）。
2. 增加 `meta.version`。
3. 在 `changeLog` 顶部或末尾新增一条修改记录。
4. 若希望已安装 PWA 立即识别新版本，同步修改 `service-worker.js` 顶部的缓存版本号。

### 修改航班

在 `flights` 中找到对应 `id`，修改日期、时间、机场、航站楼等字段。未知信息保持 `TBD`，状态保持 `pending`。不得填写完整订单号。

### 修改酒店

在 `hotels` 中找到对应 `id`，补充名称、入住退房日期、房型、早餐、平台和押金方式。`orderAlias` 只能写自定义别名或末四位，不能写完整预订编号。

### 修改每日行程

在 `itinerary` 中按 ISO 日期找到当天，编辑 `periods`、`transport`、`notes` 与 `maps`。冲突内容应保留并在 `alerts` 中解释原因。

## 替换图片

将压缩后的 WebP 图片放入 `assets/images/`，使用以下文件名：

| 文件名 | 内容 |
|---|---|
| `kuala-lumpur-cover.webp` | 吉隆坡城市封面 |
| `petronas-towers.webp` | 双子塔 |
| `putrajaya-mosque.webp` | 布城粉红清真寺 |
| `bali-beach.webp` | 巴厘岛海滩 |
| `nusa-penida.webp` | 努沙佩尼达 |
| `ubud.webp` | 乌布 |
| `uluwatu-sunset.webp` | 乌鲁瓦图日落 |
| `jimbaran-dinner.webp` | 金巴兰晚餐 |

建议横图宽度 1200–1800px、单张尽量小于 350KB。文件不存在时页面自动显示渐变占位，不会破坏布局。更改路径时同步更新 `gallery`、`hotels`、`itinerary` 中的 `src/image` 和准确的 `alt/imageAlt`。

## 本机保存的数据

以下内容通过统一的 `storage` 层保存在当前浏览器：

- 清单完成状态与负责人
- 实际花费、币种、付款人和支付状态
- 航班实际状态与状态标签
- 酒店确认状态
- 今日提醒与临时备注
- 基础数据版本和本机最后修改时间

“更多 → 本机修改数据”可导出、导入或恢复基础数据；清单页也能单独导入导出。清除浏览器网站数据会删除本机修改，请先导出 JSON。

## GitHub Pages 部署

1. 在 GitHub 创建一个空仓库，不要勾选自动创建 README。
2. 在本项目目录执行：

```bash
git init
git add .
git commit -m "Create Malaysia Bali travel dashboard"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

3. GitHub 仓库进入 `Settings → Pages`。
4. `Build and deployment` 选择 `Deploy from a branch`，分支选 `main`、目录选 `/ (root)`，保存。
5. 等待 Pages 显示 HTTPS 地址后，用 iPhone Safari 打开并添加到主屏幕。
6. 后续修改后重新 `git add`、`git commit`、`git push`。在仓库 `Actions` 或 `Settings → Pages` 确认最新部署完成，并强制刷新页面检查版本号。

### 公开部署安全提醒

GitHub Pages 可能是公开网页。绝对不要提交：

- 护照完整号码、身份证信息、护照/身份证照片
- 银行卡号、支付密码、CVV
- 完整预订编号、私人订单 PDF、保险保单原件
- 入境二维码、签证材料、API Key

这些文件应继续保存在私密 iCloud Drive 中。公开页面只保留行程、景点、酒店名称、航班号、非敏感提醒和模糊化状态。

## 当前待确认

- 3U3995 起飞/抵达时间、机场航站楼和行李额
- 吉隆坡 → 巴厘岛航班全部信息
- 巴厘岛 → 吉隆坡航班全部信息及安全转机缓冲
- 3U3994 的准确日期、抵达时间、航站楼和行李额
- 如玛酒店预订、支付、早餐、房型、押金方式和联系电话
- 巴厘岛酒店的区域、名称、日期与全部预订信息
- 各日天气、当地交通、出海与 SPA 等预订
- 全部预算金额和参考汇率
- 旅行保险紧急援助联系方式

## Supabase 共享清单

Phase 1 只同步清单字段，不上传航班、酒店、费用、备注、证件或订单资料：

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，执行 [`supabase/travel_checklist.sql`](supabase/travel_checklist.sql)。
3. 在 Project Settings / API Keys 复制浏览器可用的 Publishable key；旧项目也可使用 anon key。
4. 参考 [`config/sync-config.example.js`](config/sync-config.example.js) 编辑 [`config/sync-config.js`](config/sync-config.js)：填写项目 URL、Publishable key，并将 `enabled` 改为 `true`。
5. `tripId` 保持 `malaysia-bali-2026`。`userName` 可保持 `TBD`，再分别从两台手机的“更多工具 → 共享身份与同步”保存各自显示名称；该覆盖值只保存在对应手机。
6. 重新部署 GitHub Pages。两台手机打开同一地址，首页应依次显示“同步中”和“已同步 · 时间”。

Publishable/anon key 会出现在公开网页中，这是浏览器端应用的正常行为；安全边界由 RLS 控制。绝对不要填写 Supabase secret 或 service_role key。当前 Phase 1 的匿名策略只适合非敏感 Checklist，任何人只要能访问公开站点及配置就可能修改状态；需要严格的情侣身份隔离时，应在下一阶段增加 Supabase Auth。

## 检查

运行无依赖逻辑检查：

```bash
node tests/dashboard.test.js
node tests/sync.test.js
```

PWA 离线检查需通过本地服务器或 HTTPS 地址完成。
