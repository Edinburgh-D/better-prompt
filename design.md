# Design · Better Prompt

这是 better-prompt 的前端设计系统记录。后续页面优化应优先遵循这里的视觉、交互和内容边界。

## Genre

modern-minimal，本地工作台质感。页面应像一个日常可用工具，而不是营销页、低代码后台或 AI 组件拼贴。

## Macrostructure Family

- App pages: Split Workbench。核心操作区优先，辅助配置和历史记录从属于主流程。
- Content pages: Compact Directory。只展示必要入口，不展示内部部署状态。

## Theme

- 背景：暖白纸面，不使用大面积霓虹渐变。
- 主色：低饱和蓝，用于主按钮、焦点和关键状态。
- 辅色：低饱和绿和暖棕，只用于标签、提示和分组强调。
- 边框：细线、低对比，不做厚重卡片堆叠。

## Typography

- Display: 系统衬线优先，用在页面主标题和面板标题。
- Body: 系统无衬线优先，用在表单、按钮和结果内容。
- Mono: 系统等宽字体，用在 JSON、代码块和标签性文本。
- 标题不使用斜体，不使用负字距。

## Components

- Header: 品牌标识 + 简短任务标题 + 双页导航。
- Panel: 只承载真实工具区域，不嵌套装饰卡片。
- Select: 自定义箭头和统一边框，避免浏览器原生默认观感。
- Buttons: 胶囊形，主按钮克制蓝色，悬停转深墨色。
- Tags: 轻量胶囊标签，选中态用浅底深字，不用高饱和色块。

## Motion

只使用 transform 和 opacity，保持 180ms 左右的短反馈。减少动效，工具页以稳定为先。

## What To Avoid

- 大面积紫蓝渐变、玻璃拟态叠满屏、Emoji 图标、营销式 hero。
- 展示“AI 工具说明书”式文案。
- 每个区域都做成同样大小的圆角卡片。
- 让图片页和文本页拥有完全不同的视觉语言。
