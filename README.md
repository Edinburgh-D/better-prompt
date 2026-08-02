# Better Prompt

一个本地优先、轻量可维护的提示词优化工具。当前包含首页、文本提示词优化页和图片提示词优化页。

## 当前架构

- 前端与页面路由：Next.js App Router
- API 代理：Next.js Route Handler `app/api/optimize/route.js`
- 样式：Tailwind 编译入口 `src/tailwind.css`，设计变量 `tokens.css`
- 模型接口：DeepSeek 兼容 OpenAI Chat Completions 接口
- 本地历史：浏览器 `localStorage`，文本与图片历史分开保存
- 兼容遗留：`server.py` 和 `functions/api/optimize.js` 暂时保留，方便回滚或对照

## 功能入口

- `/`：产品首页
- `/text`：文本提示词优化
- `/image`：图片提示词优化
- `/api/optimize`：提示词优化 API，只支持 POST

旧路径会重定向：

- `/index.html` -> `/`
- `/text-prompt.html` -> `/text`
- `/image-prompt.html` -> `/image`

## 本地运行

### 1. 配置 API Key

不要把 API Key 写入代码或提交到 GitHub。PowerShell 临时配置：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
```

### 2. 安装依赖

```powershell
npm.cmd install
```

### 3. 启动开发服务

```powershell
npm.cmd run dev
```

然后访问：

```text
http://localhost:3000
```

## Cloudflare 部署

Next.js 版本建议使用 OpenNext for Cloudflare 构建为 Worker，而不是继续依赖旧的 Pages Functions。

常用命令：

```powershell
npm.cmd run cf:build
npm.cmd run cf:preview
npm.cmd run cf:deploy
```

Cloudflare 环境变量至少需要配置：

```text
DEEPSEEK_API_KEY = 你的 DeepSeek API Key
```

如果仍使用旧 Cloudflare Pages 静态部署，`functions/api/optimize.js` 可以作为临时兼容方案；等 Next 版本稳定后再删除 legacy 文件。

## 接口说明

### POST `/api/optimize`

请求体：

```json
{
  "messages": [
    {
      "role": "system",
      "content": "系统提示词"
    },
    {
      "role": "user",
      "content": "用户原始提示词"
    }
  ]
}
```

常见错误：

- `MISSING_API_KEY`：未配置 `DEEPSEEK_API_KEY`
- `INVALID_JSON`：请求体不是有效 JSON
- `INVALID_REQUEST`：`messages` 缺失或不是非空数组
- `UPSTREAM_ERROR`：DeepSeek 请求失败、超时或返回非 2xx
- `METHOD_NOT_ALLOWED`：接口不是 POST 请求

## 开发命令

```powershell
npm.cmd run build:css
npm.cmd run build
node --check app.js
node --check image-prompt.js
node --check app/api/optimize/route.js
```

Flask legacy 语法检查：

```powershell
python -c "from pathlib import Path; compile(Path('server.py').read_text(encoding='utf-8'), 'server.py', 'exec'); print('server syntax ok')"
```

## 文件结构

```text
better-prompt/
├── app/                         # Next.js 页面与 API
│   ├── api/optimize/route.js
│   ├── image/page.jsx
│   ├── text/page.jsx
│   ├── layout.jsx
│   └── page.jsx
├── public/                      # 浏览器脚本静态资源
│   ├── app.js
│   └── image-prompt.js
├── src/tailwind.css             # Tailwind 源样式
├── styles.css                   # Tailwind 构建产物
├── tokens.css                   # 设计变量
├── server.py                    # Flask legacy 本地代理
├── functions/api/optimize.js    # Cloudflare Pages Functions legacy
├── test-data/                   # 测试提示词数据集
├── tests/                       # 测试脚本
├── ROADMAP.md
├── TEST_PLAN.md
├── design.md
├── next.config.mjs
├── wrangler.jsonc
└── package.json
```

## 安全注意

- 不要提交 `.env`、`.env.*`、`.dev.vars`
- 前端只请求 `/api/optimize`，不要直接调用 DeepSeek API
- 线上 API Key 放在 Cloudflare 环境变量中
- 后续如果开放给多人使用，应补充登录、限流和基础滥用防护
