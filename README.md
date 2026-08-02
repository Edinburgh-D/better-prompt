# Better Prompt

一个本地优先、轻量可维护的提示词优化工具。当前包含首页和两个功能页面：

- 首页：介绍工具能力，并作为后续个人数据管理的入口。
- 文本提示词优化：把日常需求整理成更清晰、可执行、可复用的 AI 提问。
- 图片提示词优化：通过标签、补充信息和模型诊断，生成中文提示词、英文提示词、负面提示词和参数建议。

项目支持两种使用方式：

- 本地运行：使用 Flask 代理 DeepSeek API。
- 在线部署：使用 Cloudflare Pages 托管静态页面，使用 Pages Functions 提供 `/api/optimize` 接口。

## 功能

- 多场景文本优化：通用、小红书笔记、公众号文章、朋友圈文案、产品介绍、工作邮件、学习提问。
- 图片提示词三栏工作台：标签选择、汇总提示词、补充信息与测试。
- 结构化优化结果：评分、优点、缺点、建议、优化后的完整提示词。
- 一键复制：文本页和图片页均支持复制关键结果。
- 本地历史记录：文本历史和图片历史分开保存在浏览器 localStorage，最多 20 条。
- 本地和线上兼容：本地可用 Flask，线上可用 Cloudflare Pages Functions。

## 本地运行

### 1. 配置 DeepSeek API Key

不要把 API Key 写进代码或提交到 GitHub。建议在当前命令行设置环境变量：

```powershell
set DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

如果使用 PowerShell，也可以用：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
```

### 2. 安装依赖

```powershell
pip install -r requirements.txt
```

### 3. 启动服务

```powershell
python server.py
```

然后访问：

```text
http://localhost:5000
```

图片提示词页面：

```text
http://localhost:5000/image-prompt.html
```

文本提示词页面：

```text
http://localhost:5000/text-prompt.html
```

也可以运行：

```powershell
start.bat
```

`start.bat` 会检查 `DEEPSEEK_API_KEY` 是否存在，但不会内置任何密钥。

## Cloudflare Pages 部署

推荐部署方式：

```text
Cloudflare Pages + Pages Functions
```

原因：

- 静态页面由 Cloudflare Pages 托管。
- `/api/optimize` 由 `functions/api/optimize.js` 自动提供。
- DeepSeek API Key 存在 Cloudflare 环境变量中，不暴露给前端。

### 1. 创建 Pages 项目

在 Cloudflare Dashboard 中：

```text
Workers & Pages
→ Create
→ Pages
→ Connect to Git
→ 选择 GitHub 仓库 Edinburgh-D/better-prompt
```

### 2. 构建配置

如果 Cloudflare 要求填写构建配置，使用：

```text
Build command: npm run build:css
Build output directory: /
Root directory: /
```

如果界面里有部署命令或非生产分支部署命令，通常不需要额外命令；如果表单强制必填，可以填：

```text
exit 0
```

### 3. 配置环境变量

进入 Pages 项目：

```text
Settings
→ Environment variables
→ Add variable
```

添加：

```text
DEEPSEEK_API_KEY = 你的 DeepSeek API Key
```

至少添加到 Production 环境。为了预览部署也能用，可以同时添加到 Preview 环境。

添加或修改环境变量后，需要重新部署一次：

```text
Deployments
→ 选择最新部署
→ Retry deployment / Redeploy
```

### 4. 验证 Pages Function

部署完成后，在浏览器打开：

```text
https://你的项目.pages.dev/api/optimize
```

如果看到下面结果，说明 Pages Function 已生效：

```json
{"error":{"code":"METHOD_NOT_ALLOWED","message":"只支持 POST 请求。"}}
```

这是正常的，因为浏览器直接打开会发送 GET 请求，而接口只接受 POST。

然后访问首页：

```text
https://你的项目.pages.dev/
```

输入一段提示词并点击“开始优化”。如果能返回优化结果，说明完整链路已经跑通：

```text
页面 → /api/optimize → Cloudflare Pages Function → DeepSeek → 页面展示
```

## 文件结构

```text
better-prompt/
├── index.html                  # 首页介绍与功能入口
├── text-prompt.html            # 文本提示词优化页面
├── image-prompt.html           # 图片提示词优化页面
├── app.js                      # 文本页交互逻辑
├── image-prompt.js             # 图片页交互逻辑
├── styles.css                  # Tailwind 构建后的页面样式
├── tokens.css                  # 设计变量
├── src/
│   └── tailwind.css            # Tailwind 源样式
├── functions/
│   └── api/
│       └── optimize.js         # Cloudflare Pages Function
├── server.py                   # 本地 Flask API 代理
├── requirements.txt            # Python 依赖
├── package.json                # 前端构建脚本
├── start.bat                   # Windows 本地启动脚本
├── test-data/                  # 测试提示词数据集
├── tests/                      # 测试脚本
├── ROADMAP.md                  # 产品迭代计划
├── TEST_PLAN.md                # 测试方案
└── design.md                   # 设计系统记录
```

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

线上由 `functions/api/optimize.js` 处理，本地由 `server.py` 处理。

常见错误：

- `MISSING_API_KEY`：未配置 `DEEPSEEK_API_KEY`。
- `INVALID_JSON`：请求体不是有效 JSON。
- `INVALID_REQUEST`：`messages` 缺失或不是非空数组。
- `UPSTREAM_ERROR`：DeepSeek API 请求失败、超时或返回非 2xx。
- `METHOD_NOT_ALLOWED`：接口不是 POST 请求。

## 开发命令

重新构建 CSS：

```powershell
npm.cmd run build:css
```

检查 JS 语法：

```powershell
node --check app.js
node --check image-prompt.js
node --check functions/api/optimize.js
```

检查 Flask 语法：

```powershell
python -c "from pathlib import Path; compile(Path('server.py').read_text(encoding='utf-8'), 'server.py', 'exec'); print('server syntax ok')"
```

## 安全注意事项

- 不要把 DeepSeek API Key 写入 `app.js`、`image-prompt.js`、`server.py`、`start.bat` 或任何文档。
- 不要提交 `.env`、`.env.*`、`.dev.vars`。
- 如果 GitHub Push Protection 提示发现密钥，不要选择绕过，应先从文件和提交历史中移除。
- 前端只能请求 `/api/optimize`，不能直接请求 DeepSeek API。

## License

MIT License
