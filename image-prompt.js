const API_URL =
	window.location.protocol === 'file:'
		? 'http://localhost:5000/api/optimize'
		: '/api/optimize';

const IMAGE_TYPE_INSTRUCTIONS = {
	general: '通用图片：根据用户意图补充主体、场景、构图、光线、风格和约束。',
	portrait: '人物/头像：重点关注人物身份、表情、姿态、服饰、镜头、光线、肤色质感和背景。',
	product: '商品图：重点关注商品主体、材质、卖点、摆放方式、背景、商业质感和可用画幅。',
	poster: '海报/封面：重点关注主题层级、视觉焦点、文字留白、版式、色彩和传播目的。',
	illustration: '插画：重点关注画风、线条、色彩、角色状态、场景氛围和细节密度。',
	scene: '场景图：重点关注空间关系、时间、天气、环境元素、镜头视角和氛围。',
	character: '角色设定：重点关注角色身份、外貌、服装、道具、姿态、性格暗示和设定一致性。',
};

let imageHistory = JSON.parse(localStorage.getItem('imagePromptHistory') || '[]');
let lastImagePrompt = '';
let imageLoadingTimer = null;

function getSelectedImageType() {
	return document.getElementById('imageType')?.value || 'general';
}

function getSelectedTargetModel() {
	return document.getElementById('targetModel')?.value || 'general';
}

const IMAGE_TAG_GROUPS = [
	{
		title: '人像/主体',
		tags: ['单人主体', '双人合影', '半身人像', '全身人像', '自然表情', '职业形象', '角色设定'],
	},
	{
		title: '光影',
		tags: ['自然光', '柔光', '侧光', '逆光', '轮廓光', '冷暖对比', '电影级光影'],
	},
	{
		title: '环境',
		tags: ['室内', '户外', '城市街道', '自然风景', '雨后环境', '夜景', '干净背景', '空间层次'],
	},
	{
		title: '构图镜头',
		tags: ['特写', '中景', '广角', '低角度', '俯视', '中心构图', '三分法', '留白', '浅景深'],
	},
	{
		title: '风格',
		tags: ['写实摄影', '电影感', '商业摄影', '插画风', '动漫感', '极简', '复古胶片', '高级感'],
	},
	{
		title: '色彩/质感',
		tags: ['高级灰', '高饱和', '低饱和', '通透色彩', '水润感', '金属质感', '玻璃质感', '纸张质感'],
	},
	{
		title: '清晰度/质量',
		tags: ['主体清晰', '细节丰富', '边缘锐利', '真实皮肤质感', '无乱码文字', '避免畸形', '避免过度修饰', '层次明确'],
	},
	{
		title: '画面用途',
		tags: ['头像', '商品主图', '海报封面', '社媒配图', '壁纸', '场景概念', '电商广告', '封面视觉'],
	},
];

const IMAGE_TEST_SAMPLE = {
	type: 'portrait',
	tags: ['单人主体', '自然光', '城市街道', '中景', '写实摄影', '主体清晰'],
	subject: '年轻女性，银色机能外套，干净五官',
	scene: '雨后城市街道，适合社媒头像',
	avoid: '过度磨皮、文字乱码、手部畸形',
};

let selectedImageTags = [];

function renderImageTagGroups() {
	const container = document.getElementById('imageTagGroups');
	if (!container) {
		return;
	}

	container.innerHTML = IMAGE_TAG_GROUPS.map(
		(group) => `
			<div class="tag-group">
				<h3>${escapeHtml(group.title)}</h3>
				<div class="tag-list">
					${group.tags
						.map(
							(tag) =>
								`<button type="button" class="tag-chip${selectedImageTags.includes(tag) ? ' selected' : ''}" onclick="toggleImageTag('${escapeJsString(tag)}')">${escapeHtml(tag)}</button>`
						)
						.join('')}
				</div>
			</div>
		`
	).join('');
}

function toggleImageTag(tag) {
	if (selectedImageTags.includes(tag)) {
		selectedImageTags = selectedImageTags.filter((item) => item !== tag);
	} else {
		selectedImageTags.push(tag);
	}
	renderImageTagGroups();
	renderSelectedImageTags();
	refreshImageSummaryPrompt();
}

function renderSelectedImageTags() {
	const container = document.getElementById('selectedImageTags');
	if (!container) {
		return;
	}

	if (selectedImageTags.length === 0) {
		container.innerHTML = '<span class="muted-text">暂未选择标签</span>';
		return;
	}

	container.innerHTML = selectedImageTags
		.map(
			(tag) =>
				`<button type="button" class="selected-tag" onclick="toggleImageTag('${escapeJsString(tag)}')">${escapeHtml(tag)} ×</button>`
		)
		.join('');
}

function getImageControlContext() {
	return {
		type: getSelectedImageType(),
		targetModel: getSelectedTargetModel(),
		style: document.getElementById('imageStylePreset')?.value || '',
		aspectRatio: document.getElementById('imageAspectRatio')?.value || '',
		detailLevel: document.getElementById('imageDetailLevel')?.value || '标准',
		subject: document.getElementById('imageSubjectDetail')?.value.trim() || '',
		scene: document.getElementById('imageSceneDetail')?.value.trim() || '',
		avoid: document.getElementById('imageAvoidDetail')?.value.trim() || '',
		tags: selectedImageTags,
	};
}

function buildImageSummaryPrompt() {
	const context = getImageControlContext();
	const lines = [
		`图片类型：${document.getElementById('imageType')?.selectedOptions?.[0]?.textContent || '通用'}`,
		context.subject ? `主体：${context.subject}` : '',
		context.scene ? `场景/用途：${context.scene}` : '',
		context.tags.length ? `视觉标签：${context.tags.join('、')}` : '',
		context.style ? `风格预设：${context.style}` : '',
		context.aspectRatio ? `推荐画幅：${context.aspectRatio}` : '',
		context.detailLevel ? `细节程度：${context.detailLevel}` : '',
		context.avoid ? `避免出现：${context.avoid}` : '',
	].filter(Boolean);

	return lines.join('\n');
}

function buildImageWorkflowInstruction() {
	const context = getImageControlContext();
	return `页面补全信息：
- 图片类型：${document.getElementById('imageType')?.selectedOptions?.[0]?.textContent || '通用'}
- 目标模型：${context.targetModel}
- 已选视觉标签：${context.tags.length ? context.tags.join('、') : '无'}
- 风格预设：${context.style || '自动判断'}
- 推荐画幅：${context.aspectRatio || '自动判断'}
- 细节程度：${context.detailLevel}
- 主体补充：${context.subject || '未填写'}
- 场景/用途：${context.scene || '未填写'}
- 避免出现：${context.avoid || '未填写'}

请优先把这些信息整合进 optimized_prompt_cn、optimized_prompt_en、negative_prompt 和 parameter_suggestions。`;
}

function refreshImageSummaryPrompt() {
	const input = document.getElementById('imageInputPrompt');
	if (!input) {
		return;
	}

	const summary = buildImageSummaryPrompt();
	if (summary) {
		input.value = summary;
	}
	updateImageConfigPreview();
}

function syncImagePromptFromManualInput() {
	updateImageConfigPreview();
}

function updateImageConfigPreview() {
	const container = document.getElementById('imageConfigPreview');
	if (!container) {
		return;
	}

	const context = getImageControlContext();
	container.innerHTML = `
		<div class="config-preview">
			<p><strong>类型：</strong>${escapeHtml(document.getElementById('imageType')?.selectedOptions?.[0]?.textContent || '通用')}</p>
			<p><strong>已选标签：</strong>${escapeHtml(context.tags.join('、') || '暂无')}</p>
			<p><strong>主体：</strong>${escapeHtml(context.subject || '暂无')}</p>
			<p><strong>场景：</strong>${escapeHtml(context.scene || '暂无')}</p>
			<p><strong>风格：</strong>${escapeHtml(context.style || '自动判断')}</p>
			<p><strong>画幅：</strong>${escapeHtml(context.aspectRatio || '自动')}</p>
			<p><strong>细节：</strong>${escapeHtml(context.detailLevel)}</p>
			<p><strong>避免：</strong>${escapeHtml(context.avoid || '暂无')}</p>
			<div class="summary-preview">
				<strong>汇总提示词</strong>
				<p>${escapeHtml(document.getElementById('imageInputPrompt')?.value || buildImageSummaryPrompt() || '暂无').replace(/\n/g, '<br>')}</p>
			</div>
		</div>
	`;
}

function runImagePromptTest() {
	const type = document.getElementById('imageType');
	if (type) {
		type.value = IMAGE_TEST_SAMPLE.type;
	}
	selectedImageTags = [...IMAGE_TEST_SAMPLE.tags];
	document.getElementById('imageSubjectDetail').value = IMAGE_TEST_SAMPLE.subject;
	document.getElementById('imageSceneDetail').value = IMAGE_TEST_SAMPLE.scene;
	document.getElementById('imageAvoidDetail').value = IMAGE_TEST_SAMPLE.avoid;
	renderImageTagGroups();
	renderSelectedImageTags();
	refreshImageSummaryPrompt();
	showToast('已载入图片提示词测试样例');
}

function escapeJsString(value) {
	return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function updateImageHistoryDisplay() {
	const historyList = document.getElementById('imageHistoryList');
	const keyword =
		document.getElementById('imageHistorySearch')?.value.trim().toLowerCase() ||
		'';
	const filteredHistory = imageHistory
		.map((item, index) => ({ item, index }))
		.filter(({ item }) => {
			if (!keyword) {
				return true;
			}

			const searchable = [
				item.title,
				item.preview,
				item.original,
				item.imageType,
				item.structuredResult?.user_intent,
				item.structuredResult?.optimized_prompt_cn,
				item.structuredResult?.optimized_prompt_en,
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			return searchable.includes(keyword);
		});

	if (imageHistory.length === 0) {
		historyList.innerHTML =
			'<div class="empty-state"><p>暂无图片历史记录</p></div>';
		return;
	}

	if (filteredHistory.length === 0) {
		historyList.innerHTML =
			'<div class="empty-state"><p>没有匹配的图片历史记录</p></div>';
		return;
	}

	historyList.innerHTML = filteredHistory
		.map(
			({ item, index }) => `
			<div class="history-item" onclick="loadImageHistory(${index})">
				<div class="history-item-header">
					<div class="history-item-title">${escapeHtml(item.title)}</div>
					<div class="history-item-time">${escapeHtml(item.time || item.createdAt || '')}</div>
				</div>
				<div class="history-item-preview">${escapeHtml(item.preview)}</div>
				<div class="history-actions">
					<button class="btn-secondary" onclick="event.stopPropagation(); loadImageHistory(${index})">重新加载</button>
					<button class="btn-secondary" onclick="event.stopPropagation(); copyImageHistoryPrompt(${index}, 'cn', this)">复制中文</button>
					<button class="btn-secondary" onclick="event.stopPropagation(); copyImageHistoryPrompt(${index}, 'en', this)">复制英文</button>
					<button class="btn-secondary" onclick="event.stopPropagation(); deleteImageHistoryItem(${index})">删除</button>
				</div>
			</div>
		`
		)
		.join('');
}

function loadImageHistory(index) {
	const item = imageHistory[index];
	document.getElementById('imageInputPrompt').value = item.original;
	document.getElementById('imageOutputContent').innerHTML = item.result;
	if (item.imageType && document.getElementById('imageType')) {
		document.getElementById('imageType').value = item.imageType;
	}
	selectedImageTags = Array.isArray(item.selectedTags) ? item.selectedTags : [];
	if (item.controls) {
		Object.entries({
			imageStylePreset: item.controls.style,
			imageAspectRatio: item.controls.aspectRatio,
			imageDetailLevel: item.controls.detailLevel,
			imageSubjectDetail: item.controls.subject,
			imageSceneDetail: item.controls.scene,
			imageAvoidDetail: item.controls.avoid,
		}).forEach(([id, value]) => {
			const field = document.getElementById(id);
			if (field && value !== undefined) {
				field.value = value;
			}
		});
	}
	renderImageTagGroups();
	renderSelectedImageTags();
	updateImageConfigPreview();
}

function copyImageHistoryPrompt(index, type, button) {
	const result = imageHistory[index]?.structuredResult;
	const text =
		type === 'en' ? result?.optimized_prompt_en : result?.optimized_prompt_cn;
	if (!text) {
		showToast('该历史记录没有可复制的结构化结果');
		return;
	}

	copyToClipboard(text, button);
}

function deleteImageHistoryItem(index) {
	imageHistory.splice(index, 1);
	localStorage.setItem('imagePromptHistory', JSON.stringify(imageHistory));
	updateImageHistoryDisplay();
	showToast('图片历史记录已删除');
}

function clearImageHistory() {
	if (confirm('确定要清空所有图片历史记录吗？')) {
		imageHistory = [];
		localStorage.setItem('imagePromptHistory', '[]');
		updateImageHistoryDisplay();
	}
}

function clearImageInput() {
	document.getElementById('imageInputPrompt').value = '';
	selectedImageTags = [];
	[
		'imageStylePreset',
		'imageAspectRatio',
		'imageSubjectDetail',
		'imageSceneDetail',
		'imageAvoidDetail',
	].forEach((id) => {
		const field = document.getElementById(id);
		if (field) {
			field.value = '';
		}
	});
	const detail = document.getElementById('imageDetailLevel');
	if (detail) {
		detail.value = '标准';
	}
	renderImageTagGroups();
	renderSelectedImageTags();
	updateImageConfigPreview();
	document.getElementById('imageOutputContent').innerHTML =
		'<div class="empty-state"><p>在左侧输入图片提示词，点击"开始优化"按钮</p></div>';
}

function showToast(message) {
	let toast = document.getElementById('toast');
	if (!toast) {
		toast = document.createElement('div');
		toast.id = 'toast';
		toast.className = 'toast';
		document.body.appendChild(toast);
	}

	toast.textContent = message;
	toast.classList.add('show');
	window.clearTimeout(toast.hideTimer);
	toast.hideTimer = window.setTimeout(() => {
		toast.classList.remove('show');
	}, 1800);
}

function copyToClipboard(text, button) {
	navigator.clipboard
		.writeText(text)
		.then(() => {
			if (button) {
				const originalText = button.textContent;
				button.textContent = '已复制';
				window.setTimeout(() => {
					button.textContent = originalText;
				}, 1500);
			}
			showToast('已复制到剪贴板');
		})
		.catch((err) => {
			console.error('复制失败:', err);
			showToast('复制失败，请手动复制');
		});
}

function renderLoading(seconds = 0) {
	const stage =
		seconds < 6
			? '正在理解画面意图...'
			: seconds < 15
			? '正在诊断视觉信息...'
			: '正在生成图片提示词...';

	return `
		<div class="loading">
			<div class="loading-spinner"></div>
			<p>${stage}</p>
			<p>已等待 ${seconds} 秒</p>
		</div>
	`;
}

async function optimizeImagePrompt() {
	const input = document.getElementById('imageInputPrompt').value.trim();

	if (!input) {
		showToast('请输入图片提示词');
		return;
	}

	const btn = document.getElementById('imageOptimizeBtn');
	const outputContent = document.getElementById('imageOutputContent');
	const imageType = getSelectedImageType();
	const targetModel = getSelectedTargetModel();
	const typeInstruction =
		IMAGE_TYPE_INSTRUCTIONS[imageType] || IMAGE_TYPE_INSTRUCTIONS.general;
	lastImagePrompt = input;

	btn.disabled = true;
	btn.textContent = '优化中...';

	let elapsedSeconds = 0;
	outputContent.innerHTML = renderLoading(elapsedSeconds);
	imageLoadingTimer = window.setInterval(() => {
		elapsedSeconds += 1;
		outputContent.innerHTML = renderLoading(elapsedSeconds);
	}, 1000);

	const systemPrompt = `你是一位专业的 AI 图像提示词优化专家，兼具视觉导演与图像生成工作流顾问的能力。你的任务是根据用户提供的原始图片提示词，完成诊断与优化，输出一版更高质量、可直接用于图像生成模型的提示词。

用户将向你提供一段原始图片提示词。你需要接收该内容，先进行内部视觉拆解分析，再生成优化结果。

当前图片类型：
${typeInstruction}

目标模型：
${targetModel}

内部分析步骤，不在输出中体现：
1. 主体识别：明确画面的核心对象、数量、角色特征、动作姿态。
2. 场景环境：分析背景、时代、地点、时间、天气、空间关系。
3. 构图与镜头：确定视角、景别、焦距、构图方式、画面比例倾向。
4. 风格与调性：判断整体风格，如写实、插画、3D、概念艺术等，以及光线、色调、材质质感。
5. 细节与约束：梳理需要强化的细节，如服饰、表情、特效等，以及应当避免的元素。
6. 模型适配：评估当前描述是否适合直接输入图像生成模型，补充缺失的视觉关键词。

基于以上分析进行提示词优化，最终输出严格的 JSON 对象。

输出要求：
- 你必须只输出一个有效 JSON 对象。
- 不要添加任何解释、Markdown 代码块、注释、前缀或后缀。
- 所有字段必须使用合法 JSON 字符串。
- 数组为空时返回 []。
- scores 中每个 score 必须是 1 到 5 的整数，不要输出 “1-5” 这类非法 JSON 值。
- 长文本或复杂画面必须优先保证 JSON 合法性；宁可减少建议数量或变体数量，也不要破坏 JSON。
- 所有字段类型必须严格匹配下面的结构：optimized_prompt_cn、optimized_prompt_en、negative_prompt、negative_prompt_usage 都必须是字符串，不能写成数组。
- 字符串内部不要使用未转义的英文双引号；如果要描述海报标题、画面文字或示例约束，优先使用中文引号“”或单引号。
- negative_prompt_usage 不要写包含英文双引号的示例句；只说明使用方法即可。
- 输出前请自检一次：整体必须能被 JSON.parse 直接解析；不得包含尾随逗号、注释、非法换行控制字符或未闭合字符串。

JSON 结构如下：
{
  "safety_status": "safe",
  "safety_note": "",
  "task_type": "图片生成",
  "user_intent": "用1-2句话概括用户真正想生成的画面目标",
  "optimization_strategy": "本次优化的重点，如补充主体细节、明确构图、强化光线等",
  "scores": {
    "subject_clarity": { "score": 3, "reason": "主体是否明确" },
    "scene_completeness": { "score": 3, "reason": "背景环境完整性" },
    "visual_control": { "score": 3, "reason": "构图、镜头、光线、色彩的控制" },
    "detail_quality": { "score": 3, "reason": "材质、表情、动作等细节" },
    "constraint_clarity": { "score": 3, "reason": "约束和负面提示清晰度" },
    "model_readiness": { "score": 3, "reason": "可直接用于模型的程度" }
  },
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "optimized_prompt_cn": "中文优化提示词，主体明确，细节充实，保留用户原意",
  "optimized_prompt_en": "English optimized prompt, faithful to original intent",
  "negative_prompt": "针对性负面提示词，根据画面可能出现的质量缺陷和结构错误设置",
  "negative_prompt_usage": "如果目标模型支持负面提示词则使用；否则将其转化为正向约束",
  "parameter_suggestions": {
    "aspect_ratio": "推荐画幅比例，如16:9，并说明原因",
    "style_strength": "低/中/高，并说明原因",
    "detail_level": "简洁/标准/丰富，并说明原因"
  },
  "optional_variants": [
    "变体1：更写实",
    "变体2：更具电影感"
  ]
}

字段要求：
- task_type 必须从以下枚举中选择一个：图片生成、图片改图、风格转换、角色设定、商品图、场景图、海报设计、其他。
- safety_status 必须从以下枚举中选择一个：safe、refused、modified。
- optimized_prompt_cn 和 optimized_prompt_en 必须能直接复制到图像生成模型中使用。
- negative_prompt 应根据任务类型生成；如果目标模型不支持负面提示词，则在 negative_prompt_usage 中说明如何转化为正向约束。

优化原则：
- 忠实原意：绝不改变用户核心主体和场景基调，仅在视觉描述上做合理补充。
- 简洁与复杂判别：若原始提示词已包含主体、动作、环境、风格且超过30个英文单词，视为复杂场景，必须保持或深化细节；否则可在不冲突的前提下适当添加周围元素和质感描述。
- 风格处理：用户未指定风格时，根据内容选择自然合理的视觉方向，如人物肖像默认写实摄影，童话默认轻柔插画，不强行套用艺术风格。
- 负面提示词生成：根据画面最易出现的畸形、质量劣化、逻辑错误以及风格冲突进行针对性设置，避免笼统堆砌。
- 参数建议：根据画面动态、视角和目的推荐画幅；风格强度默认中，除非原始提示明确要求强风格；细节程度根据画面复杂度动态调整。
- 合规：遇到违法、侵权、色情、仇恨等内容，将 safety_status 标记为 refused 或 modified，并在 safety_note 中给出原因和安全替代方向。`;

	try {
		const response = await fetch(API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				messages: [
					{ role: 'system', content: systemPrompt },
					{
						role: 'user',
						content: `请评估和优化以下图片提示词：\n\n${input}\n\n${buildImageWorkflowInstruction()}`,
					},
				],
			}),
		});

		const data = await response.json().catch(() => null);

		if (!response.ok) {
			throw (
				data?.error || {
					code: 'REQUEST_FAILED',
					message: `请求失败，HTTP 状态码：${response.status}`,
				}
			);
		}

		if (!data?.choices?.[0]?.message?.content) {
			throw {
				code: 'INVALID_RESPONSE',
				message: '模型返回内容为空或格式不符合预期。',
			};
		}

		const result = data.choices[0].message.content;
		const structuredResult = parseStructuredResult(result);
		const formattedResult = structuredResult
			? renderImageStructuredResult(structuredResult)
			: renderRawFallback(result);
		outputContent.innerHTML = formattedResult;

		const historyItem = {
			title: input.substring(0, 20) + (input.length > 20 ? '...' : ''),
			preview: input.substring(0, 50) + (input.length > 50 ? '...' : ''),
			original: input,
			rawResult: result,
			structuredResult,
			imageType,
			targetModel,
			selectedTags: [...selectedImageTags],
			controls: getImageControlContext(),
			model: 'deepseek-v4-pro',
			createdAt: new Date().toISOString(),
			result: formattedResult,
			time: new Date().toLocaleString('zh-CN'),
		};

		imageHistory.unshift(historyItem);
		if (imageHistory.length > 20) {
			imageHistory = imageHistory.slice(0, 20);
		}
		localStorage.setItem('imagePromptHistory', JSON.stringify(imageHistory));
		updateImageHistoryDisplay();
	} catch (error) {
		console.error('Error:', error);
		outputContent.innerHTML = renderError(error);
	} finally {
		window.clearInterval(imageLoadingTimer);
		imageLoadingTimer = null;
		btn.disabled = false;
		btn.textContent = '开始优化';
	}
}

function retryLastRequest() {
	if (lastImagePrompt) {
		document.getElementById('imageInputPrompt').value = lastImagePrompt;
	}
	optimizeImagePrompt();
}

function getErrorAction(code) {
	const actions = {
		MISSING_API_KEY:
			'请检查是否通过 start.bat 启动，或手动设置 DEEPSEEK_API_KEY 环境变量。',
		INVALID_REQUEST: '请刷新页面后重试；如果仍失败，请检查输入内容。',
		UPSTREAM_TIMEOUT: '上游响应超时，可以稍后重试，或减少输入长度。',
		UPSTREAM_ERROR: '请检查网络连接、代理设置或 DeepSeek 服务状态，然后重试。',
		INVALID_RESPONSE: '模型返回为空或格式异常，请重试一次。',
		REQUEST_FAILED: '请确认本地服务已启动，并检查浏览器控制台中的请求状态。',
		UNKNOWN_ERROR: '请重试；如果持续失败，请查看后端控制台输出。',
	};

	return actions[code] || '请检查本地服务、网络连接和 API Key 配置后重试。';
}

function renderError(error) {
	const code = error?.code || 'UNKNOWN_ERROR';
	const message = error?.message || '优化过程中出现未知错误。';

	return `
		<div class="evaluation-item error-message">
			<h3>错误：${escapeHtml(code)}</h3>
			<p>${escapeHtml(message)}</p>
			<p>${escapeHtml(getErrorAction(code))}</p>
			<button class="copy-btn" onclick="retryLastRequest()">重试</button>
		</div>
	`;
}

function parseStructuredResult(text) {
	const cleaned = text
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '');

	try {
		const parsed = JSON.parse(cleaned);
		return parsed && typeof parsed === 'object' ? parsed : null;
	} catch (error) {
		const repaired = repairCommonJsonIssues(cleaned);
		try {
			const parsed = JSON.parse(repaired);
			return parsed && typeof parsed === 'object' ? parsed : null;
		} catch (repairError) {
			return null;
		}
	}
}

function repairCommonJsonIssues(text) {
	return text
		.replace(
			/("optimized_prompt_cn"\s*:\s*"(?:\\.|[^"\\])*")\s*\]\s*,\s*"optimized_prompt_en"/,
			'$1,\n  "optimized_prompt_en"'
		)
		.replace(
			/("optimized_prompt_en"\s*:\s*"(?:\\.|[^"\\])*")\s*\]\s*,\s*"negative_prompt"/,
			'$1,\n  "negative_prompt"'
		)
		.replace(
			/("negative_prompt"\s*:\s*"(?:\\.|[^"\\])*")\s*\]\s*,\s*"negative_prompt_usage"/,
			'$1,\n  "negative_prompt_usage"'
		);
}

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function renderList(items) {
	if (!Array.isArray(items) || items.length === 0) {
		return '<p>暂无</p>';
	}

	return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderImageStructuredResult(result) {
	const scores = result.scores || {};
	const scoreLabels = {
		subject_clarity: '主体清晰度',
		scene_completeness: '场景完整度',
		visual_control: '视觉控制',
		detail_quality: '细节质量',
		constraint_clarity: '约束清晰度',
		model_readiness: '模型可用度',
	};

	const scoreHtml = Object.entries(scoreLabels)
		.map(([key, label]) => {
			const score = scores[key] || {};
			return `
				<div class="evaluation-item">
					<h3>${label}<span class="score">${escapeHtml(score.score || '-')}/5</span></h3>
					<p>${escapeHtml(score.reason || '暂无评分理由')}</p>
				</div>
			`;
		})
		.join('');

	return `
		<div class="evaluation-item">
			<h3>画面意图</h3>
			<p><strong>任务类型：</strong>${escapeHtml(result.task_type || '图片生成')}</p>
			<p><strong>安全状态：</strong>${escapeHtml(result.safety_status || 'safe')}</p>
			${result.safety_note ? `<p><strong>安全说明：</strong>${escapeHtml(result.safety_note)}</p>` : ''}
			<p>${escapeHtml(result.user_intent || '暂无')}</p>
			<p><strong>优化策略：</strong>${escapeHtml(result.optimization_strategy || '暂无')}</p>
		</div>
		${scoreHtml}
		${renderOptionalSection('主要问题', result.weaknesses)}
		${renderOptionalSection('优化建议', result.suggestions)}
		${renderPromptBlock('中文优化提示词', result.optimized_prompt_cn)}
		${renderPromptBlock('English Optimized Prompt', result.optimized_prompt_en)}
		${renderPromptBlock('负面提示词', result.negative_prompt)}
		<div class="evaluation-item">
			<h3>负面提示词使用说明</h3>
			<p>${escapeHtml(result.negative_prompt_usage || '暂无')}</p>
		</div>
		${renderParameterSuggestions(result.parameter_suggestions)}
		${renderOptionalSection('可选变体', result.optional_variants)}
	`;
}

function renderPromptBlock(title, text) {
	const value = text || '';
	return `
		<div class="improved-prompt">
			<h3>${escapeHtml(title)}</h3>
			<div class="prompt-text">${escapeHtml(value).replace(/\n/g, '<br>')}</div>
			<button class="copy-btn" onclick="copyToClipboard(\`${value
				.replace(/\\/g, '\\\\')
				.replace(/`/g, '\\`')
				.replace(/\n/g, '\\n')}\`, this)">复制</button>
		</div>
	`;
}

function renderParameterSuggestions(params) {
	if (!params || typeof params !== 'object') {
		return '';
	}

	return `
		<div class="evaluation-item">
			<h3>参数建议</h3>
			<p><strong>画幅比例：</strong>${escapeHtml(params.aspect_ratio || '暂无')}</p>
			<p><strong>风格强度：</strong>${escapeHtml(params.style_strength || '暂无')}</p>
			<p><strong>细节程度：</strong>${escapeHtml(params.detail_level || '暂无')}</p>
		</div>
	`;
}

function renderOptionalSection(title, items) {
	if (!Array.isArray(items) || items.length === 0) {
		return '';
	}

	return `
		<div class="evaluation-item">
			<h3>${title}</h3>
			${renderList(items)}
		</div>
	`;
}

function renderRawFallback(text) {
	return `
		<div class="evaluation-item error-message">
			<h3>结果格式异常，已展示原始内容</h3>
			<p>模型没有返回可解析 JSON，本次结果仍可阅读，但无法单独提取复制字段。</p>
		</div>
		<div class="evaluation-item">
			<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>
		</div>
	`;
}

renderImageTagGroups();
renderSelectedImageTags();
updateImageConfigPreview();
updateImageHistoryDisplay();
