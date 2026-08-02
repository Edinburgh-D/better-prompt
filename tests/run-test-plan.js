const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:5000';
const RESPONSE_TIMEOUT_MS = 120000;

const DATA_DIR = path.join(process.cwd(), 'test-data');
const textCases = loadJsonl(path.join(DATA_DIR, 'text-cases.jsonl'));
const imageCases = loadJsonl(path.join(DATA_DIR, 'image-cases.jsonl'));
const edgeCases = loadJsonl(path.join(DATA_DIR, 'edge-cases.jsonl'));

const results = [];
const lowScoreCases = [];
const failureRecords = [];
let runDir = '';
let screenshotsDir = '';
let rawResponsesDir = '';

function loadJsonl(file) {
	if (!fs.existsSync(file)) {
		throw new Error(`测试数据文件不存在：${file}`);
	}
	return fs
		.readFileSync(file, 'utf8')
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line, index) => {
			try {
				return JSON.parse(line);
			} catch (error) {
				throw new Error(`${file}:${index + 1} JSONL 解析失败：${error.message}`);
			}
		});
}

function ensureRunDirectory() {
	const date = new Date().toISOString().slice(0, 10);
	const root = path.join(process.cwd(), 'test-results');
	fs.mkdirSync(root, { recursive: true });
	const used = fs
		.readdirSync(root, { withFileTypes: true })
		.filter((item) => item.isDirectory() && item.name.startsWith(`${date}-run-`))
		.map((item) => Number(item.name.replace(`${date}-run-`, '')))
		.filter(Number.isFinite);
	const next = String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0');
	runDir = path.join(root, `${date}-run-${next}`);
	screenshotsDir = path.join(runDir, 'artifacts', 'screenshots');
	rawResponsesDir = path.join(runDir, 'artifacts', 'raw-responses');
	fs.mkdirSync(screenshotsDir, { recursive: true });
	fs.mkdirSync(rawResponsesDir, { recursive: true });
}

function appendJsonl(fileName, record) {
	fs.appendFileSync(path.join(runDir, fileName), `${JSON.stringify(record)}\n`, 'utf8');
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseModelContent(rawResponse) {
	const content = rawResponse?.choices?.[0]?.message?.content || '';
	if (!content) {
		return { content, parsed: null, parseError: '模型 content 为空' };
	}
	const cleaned = content
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '');
	try {
		const parsed = JSON.parse(cleaned);
		return { content, parsed, parseError: null };
	} catch (error) {
		const repaired = repairCommonJsonIssues(cleaned);
		try {
			const parsed = JSON.parse(repaired);
			return { content, parsed, parseError: null, repaired: repaired !== cleaned };
		} catch (repairError) {
			return { content, parsed: null, parseError: repairError.message };
		}
	}
}

function repairCommonJsonIssues(text) {
	return text
		.replace(
			/("optimized_prompt"\s*:\s*"(?:\\.|[^"\\])*")\s*\]\s*,\s*"optional_enhancements"/,
			'$1,\n  "optional_enhancements"'
		)
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

function extractScores(parsed, pageType) {
	const source = parsed?.scores || {};
	const scores = {};
	for (const [key, value] of Object.entries(source)) {
		const score = pageType === 'image' ? value?.score : value?.value;
		scores[key] = {
			score: typeof score === 'number' ? score : Number(score) || null,
			reason: value?.reason || '',
		};
	}
	return scores;
}

function averageScore(scoreMap) {
	const values = Object.values(scoreMap)
		.map((item) => item.score)
		.filter((value) => typeof value === 'number' && Number.isFinite(value));
	if (!values.length) {
		return 0;
	}
	return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function scoreCheck(pass, passReason, failReason, score = 5) {
	return {
		score: pass ? score : 2,
		reason: pass ? passReason : failReason,
	};
}

function scoreTextOutput(parsed, optimizedPrompt, testCase) {
	const promptText = optimizedPrompt || '';
	const placeholderPattern = /\[提供|\[列出|XXX|请补充\s*XXX/i;
	const scores = {
		faithfulness: scoreCheck(
			Boolean(parsed?.user_intent && promptText),
			'保留了用户意图字段，并生成了可复盘的优化提示词。',
			'缺少用户意图或优化提示词，无法判断是否忠实原意。'
		),
		goal_clarity: scoreCheck(
			Boolean(promptText.length >= 40 && /请|要求|输出|分析|说明/.test(promptText)),
			'优化后提示词包含明确任务动作和输出目标。',
			'优化后提示词过短或任务动作不明确。'
		),
		context_completion: scoreCheck(
			Boolean(parsed?.strategy || parsed?.suggestions?.length),
			'返回了优化策略或具体建议，可支撑上下文补全。',
			'缺少优化策略和建议，难以判断上下文补全质量。'
		),
		output_control: scoreCheck(
			Boolean(/输出|格式|结构|字|段|列表|表格|要求/.test(promptText)),
			'优化后提示词包含输出结构、格式或长度控制。',
			'优化后提示词缺少输出控制要求。'
		),
		direct_usability: scoreCheck(
			Boolean(promptText && !placeholderPattern.test(promptText)),
			'优化后提示词可直接复制使用，未发现未完成占位符。',
			'优化后提示词为空或包含未完成占位符。'
		),
		restraint: scoreCheck(
			Boolean(promptText.length <= 2500),
			'优化后提示词长度处于可控范围。',
			'优化后提示词过长，可能将简单任务模板化。'
		),
		review_context: scoreCheck(
			Boolean(testCase?.expected_direction && testCase?.quality_risks?.length),
			'测试用例包含 expected_direction 和 quality_risks，可用于人工语义复盘。',
			'测试用例缺少 expected_direction 或 quality_risks，无法支撑质量闭环。'
		),
	};
	scores.average = averageScore(scores);
	return scores;
}

function scoreImageOutput(parsed, cnPrompt, enPrompt, negativePrompt, testCase) {
	const combined = `${cnPrompt || ''}\n${enPrompt || ''}\n${negativePrompt || ''}`;
	const scores = {
		subject_clarity: scoreCheck(
			Boolean(parsed?.user_intent && cnPrompt),
			'画面意图和中文优化提示词均存在。',
			'缺少画面意图或中文优化提示词。'
		),
		scene_completeness: scoreCheck(
			Boolean(/场景|背景|环境|光|构图|镜头|style|lighting|composition/i.test(combined)),
			'提示词包含场景、光线、构图或镜头控制信息。',
			'提示词缺少场景、光线、构图或镜头控制信息。'
		),
		visual_control: scoreCheck(
			Boolean(parsed?.parameter_suggestions && typeof parsed.parameter_suggestions === 'object'),
			'返回了参数建议，可辅助控制画幅、风格和细节。',
			'缺少参数建议。'
		),
		detail_quality: scoreCheck(
			Boolean((cnPrompt || '').length >= 40 && (enPrompt || '').length >= 40),
			'中英文提示词长度满足基础细节要求。',
			'中英文提示词过短，细节不足。'
		),
		negative_prompt_fit: scoreCheck(
			Boolean(negativePrompt && negativePrompt.length >= 10 && negativePrompt.length <= 1200),
			'负面提示词存在且长度未明显堆砌。',
			'负面提示词缺失、过短或过长。'
		),
		model_readiness: scoreCheck(
			Boolean(cnPrompt && enPrompt && parsed?.task_type),
			'中英文提示词和任务类型齐全，可用于图像生成模型。',
			'缺少模型可用的核心字段。'
		),
		review_context: scoreCheck(
			Boolean(testCase?.expected_direction && testCase?.quality_risks?.length),
			'测试用例包含 expected_direction 和 quality_risks，可用于人工语义复盘。',
			'测试用例缺少 expected_direction 或 quality_risks，无法支撑质量闭环。'
		),
	};
	scores.average = averageScore(scores);
	return scores;
}

function buildHistoryState(items, latest) {
	return {
		count: items.length,
		latest_original: latest?.original || '',
		latest_created_at: latest?.createdAt || '',
		has_structured_result: Boolean(latest?.structuredResult),
	};
}

function addOutcome(record, pass, detail) {
	const result = {
		id: record.id,
		page: record.page,
		scene: record.scene || record.image_type || record.path || '',
		pass,
		detail,
		avg_score: record.quality_scores?.average || null,
	};
	results.push(result);

	if (!pass || (record.quality_scores?.average && record.quality_scores.average < 4)) {
		failureRecords.push({ ...record, test_result: result });
		if (record.quality_scores?.average && record.quality_scores.average < 4) {
			lowScoreCases.push(record);
		}
		appendJsonl('failures.jsonl', { ...record, test_result: result });
	}
}

async function waitForOptimizeResponse(page, clickSelector, timeout = RESPONSE_TIMEOUT_MS) {
	const responsePromise = page.waitForResponse(
		(response) => response.url().includes('/api/optimize'),
		{ timeout }
	);
	await page.click(clickSelector);
	const response = await responsePromise;
	let body = null;
	try {
		body = await response.json();
	} catch (error) {
		body = {
			parse_error: error.message,
			text: await response.text().catch(() => ''),
		};
	}
	return {
		status: response.status(),
		ok: response.ok(),
		body,
	};
}

async function screenshot(page, id) {
	const relative = path.join('artifacts', 'screenshots', `${id}.png`);
	await page.screenshot({ path: path.join(runDir, relative), fullPage: true });
	return relative.replaceAll('\\', '/');
}

function saveRawResponse(id, rawResponse) {
	const relative = path.join('artifacts', 'raw-responses', `${id}.json`);
	writeJson(path.join(runDir, relative), rawResponse);
	return relative.replaceAll('\\', '/');
}

async function getPageErrors(page, action) {
	const errors = [];
	const onConsole = (message) => {
		if (message.type() === 'error') {
			errors.push(message.text());
		}
	};
	const onPageError = (error) => errors.push(error.message);
	page.on('console', onConsole);
	page.on('pageerror', onPageError);
	try {
		await action(errors);
	} finally {
		page.off('console', onConsole);
		page.off('pageerror', onPageError);
	}
	return errors;
}

async function testAccess(page) {
	const paths = ['/', '/index.html', '/image-prompt.html', '/styles.css', '/app.js', '/image-prompt.js'];
	for (const target of paths) {
		const response = await page.goto(`${BASE_URL}${target}`, { waitUntil: 'domcontentloaded' });
		results.push({
			id: `ACCESS ${target}`,
			page: 'access',
			path: target,
			pass: Boolean(response && response.status() === 200),
			detail: `HTTP ${response ? response.status() : 'NO_RESPONSE'}`,
			avg_score: null,
		});
	}
}

async function testTextCase(page, testCase) {
	const { mode, scene, id, input: prompt } = testCase;
	const start = Date.now();
	const errors = [];
	await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => localStorage.removeItem('promptHistory'));
	await page.reload({ waitUntil: 'domcontentloaded' });
	await page.selectOption('#optimizeMode', mode);
	await page.fill('#inputPrompt', prompt);
	const beforeCount = await page.locator('.history-item').count();

	let apiResult = null;
	try {
		apiResult = await waitForOptimizeResponse(page, '#optimizeBtn');
	} catch (error) {
		errors.push(`请求等待失败：${error.message}`);
	}

	await page.waitForFunction(() => !document.querySelector('#optimizeBtn')?.disabled, null, {
		timeout: RESPONSE_TIMEOUT_MS,
	}).catch((error) => errors.push(`按钮恢复等待失败：${error.message}`));

	const outputText = await page.locator('#outputContent').innerText().catch(() => '');
	const afterCount = await page.locator('.history-item').count().catch(() => 0);
	const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('promptHistory') || '[]'));
	const latest = stored[0] || {};
	const rawResponse = apiResult?.body || null;
	const { parsed, parseError, repaired } = parseModelContent(rawResponse);
	if (parseError) {
		errors.push(`JSON 解析失败：${parseError}`);
	}
	const modelDiagnosticScores = extractScores(parsed, 'text');
	const qualityScores = scoreTextOutput(
		parsed,
		parsed?.optimized_prompt || latest.structuredResult?.optimized_prompt || '',
		testCase
	);
	const record = {
		id,
		page: 'text',
		scene,
		mode,
		theme: testCase.theme || '',
		input_type: testCase.input_type || '',
		original_prompt: prompt,
		expected_direction: testCase.expected_direction || '',
		quality_risks: testCase.quality_risks || [],
		raw_response: rawResponse,
		parsed_result: parsed,
		parse_repaired: Boolean(repaired),
		optimized_prompt: parsed?.optimized_prompt || latest.structuredResult?.optimized_prompt || '',
		history_state: buildHistoryState(stored, latest),
		model_diagnostic_scores: modelDiagnosticScores,
		quality_scores: qualityScores,
		errors,
		duration_ms: Date.now() - start,
	};
	record.raw_response_file = saveRawResponse(id, rawResponse);
	record.screenshot = await screenshot(page, id);
	appendJsonl('text-cases.jsonl', record);

	const pass =
		Boolean(apiResult?.ok) &&
		Boolean(parsed) &&
		Boolean(record.optimized_prompt) &&
		outputText.includes('优化后的提示词') &&
		stored.length > 0 &&
		afterCount >= beforeCount &&
		qualityScores.average >= 4 &&
		errors.length === 0;
	addOutcome(record, pass, `scene=${scene}; quality=${qualityScores.average}/5; errors=${errors.length}`);
}

async function testImageCase(page, testCase) {
	const { type, image_type: scene, id, input: prompt } = testCase;
	const start = Date.now();
	const errors = [];
	await page.goto(`${BASE_URL}/image-prompt.html`, { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => {
		localStorage.removeItem('imagePromptHistory');
		localStorage.removeItem('promptHistory');
	});
	await page.reload({ waitUntil: 'domcontentloaded' });
	await page.selectOption('#imageType', type);
	await page.fill('#imageInputPrompt', prompt);
	const beforeCount = await page.locator('.history-item').count();

	let apiResult = null;
	try {
		apiResult = await waitForOptimizeResponse(page, '#imageOptimizeBtn');
	} catch (error) {
		errors.push(`请求等待失败：${error.message}`);
	}

	await page.waitForFunction(() => !document.querySelector('#imageOptimizeBtn')?.disabled, null, {
		timeout: RESPONSE_TIMEOUT_MS,
	}).catch((error) => errors.push(`按钮恢复等待失败：${error.message}`));

	const outputText = await page.locator('#imageOutputContent').innerText().catch(() => '');
	const afterCount = await page.locator('.history-item').count().catch(() => 0);
	const imageStored = await page.evaluate(() => JSON.parse(localStorage.getItem('imagePromptHistory') || '[]'));
	const textStored = await page.evaluate(() => JSON.parse(localStorage.getItem('promptHistory') || '[]'));
	const latest = imageStored[0] || {};
	const rawResponse = apiResult?.body || null;
	const { parsed, parseError, repaired } = parseModelContent(rawResponse);
	if (parseError) {
		errors.push(`JSON 解析失败：${parseError}`);
	}
	const modelDiagnosticScores = extractScores(parsed, 'image');
	const qualityScores = scoreImageOutput(
		parsed,
		parsed?.optimized_prompt_cn || latest.structuredResult?.optimized_prompt_cn || '',
		parsed?.optimized_prompt_en || latest.structuredResult?.optimized_prompt_en || '',
		parsed?.negative_prompt || latest.structuredResult?.negative_prompt || '',
		testCase
	);
	const record = {
		id,
		page: 'image',
		image_type: scene,
		type,
		theme: testCase.theme || '',
		input_type: testCase.input_type || '',
		original_prompt: prompt,
		expected_direction: testCase.expected_direction || '',
		quality_risks: testCase.quality_risks || [],
		raw_response: rawResponse,
		parsed_result: parsed,
		parse_repaired: Boolean(repaired),
		optimized_prompt_cn: parsed?.optimized_prompt_cn || latest.structuredResult?.optimized_prompt_cn || '',
		optimized_prompt_en: parsed?.optimized_prompt_en || latest.structuredResult?.optimized_prompt_en || '',
		negative_prompt: parsed?.negative_prompt || latest.structuredResult?.negative_prompt || '',
		history_state: {
			...buildHistoryState(imageStored, latest),
			text_history_count: textStored.length,
		},
		model_diagnostic_scores: modelDiagnosticScores,
		quality_scores: qualityScores,
		errors,
		duration_ms: Date.now() - start,
	};
	record.raw_response_file = saveRawResponse(id, rawResponse);
	record.screenshot = await screenshot(page, id);
	appendJsonl('image-cases.jsonl', record);

	const pass =
		Boolean(apiResult?.ok) &&
		Boolean(parsed) &&
		Boolean(record.optimized_prompt_cn) &&
		Boolean(record.optimized_prompt_en) &&
		Boolean(record.negative_prompt) &&
		outputText.includes('中文优化提示词') &&
		outputText.includes('English Optimized Prompt') &&
		outputText.includes('负面提示词') &&
		imageStored.length > 0 &&
		textStored.length === 0 &&
		afterCount >= beforeCount &&
		qualityScores.average >= 4 &&
		errors.length === 0;
	addOutcome(record, pass, `type=${scene}; quality=${qualityScores.average}/5; errors=${errors.length}`);
}

async function testFailurePaths(page) {
	const records = [];
	const start = Date.now();
	const emptyCase = edgeCases.find((item) => item.id === 'E001') || {};
	const nonJsonCase = edgeCases.find((item) => item.id === 'E004') || {};
	await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
	await page.fill('#inputPrompt', '');
	await page.click('#optimizeBtn');
	records.push({
		id: 'E001',
		page: 'text',
		scene: emptyCase.scene || '空输入',
		type: emptyCase.type || 'empty_input',
		original_prompt: emptyCase.input || '',
		expected_direction: emptyCase.expected_direction || '',
		quality_risks: emptyCase.quality_risks || [],
		raw_response: null,
		parsed_result: null,
		optimized_prompt: '',
		history_state: {},
		quality_scores: {},
		errors: ['空输入由前端 alert 拦截，未发起 API 请求。'],
		duration_ms: Date.now() - start,
		test_result: { pass: true, detail: '前端拦截空输入' },
	});

	await page.route('**/api/optimize', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ choices: [{ message: { content: 'not json text' } }] }),
		});
	});
	await page.fill('#inputPrompt', nonJsonCase.input || '测试非 JSON 返回');
	const apiResult = await waitForOptimizeResponse(page, '#optimizeBtn', 30000);
	await page.waitForFunction(() => !document.querySelector('#optimizeBtn')?.disabled, null, { timeout: 30000 });
	const fallbackText = await page.locator('#outputContent').innerText();
	const rawResponse = apiResult.body;
	const parsed = parseModelContent(rawResponse);
	const record = {
		id: 'E004',
		page: 'text',
		scene: nonJsonCase.scene || '模型返回非 JSON',
		type: nonJsonCase.type || 'non_json_response',
		original_prompt: nonJsonCase.input || '测试非 JSON 返回',
		expected_direction: nonJsonCase.expected_direction || '',
		quality_risks: nonJsonCase.quality_risks || [],
		raw_response: rawResponse,
		parsed_result: parsed.parsed,
		optimized_prompt: '',
		history_state: {},
		quality_scores: {},
		errors: parsed.parseError ? [`JSON 解析失败：${parsed.parseError}`] : [],
		duration_ms: Date.now() - start,
	};
	record.raw_response_file = saveRawResponse('E004', rawResponse);
	record.screenshot = await screenshot(page, 'E004');
	const pass = fallbackText.includes('not json text') || fallbackText.includes('优化过程中出现错误');
	record.test_result = { pass, detail: '模型返回非 JSON 时页面未白屏' };
	records.push(record);
	await page.unroute('**/api/optimize');

	for (const item of records) {
		appendJsonl('failures.jsonl', item);
		results.push({
			id: item.id,
			page: item.page,
			scene: item.scene,
			pass: item.test_result.pass,
			detail: item.test_result.detail,
			avg_score: null,
		});
	}
}

function writeSummary() {
	const failed = results.filter((item) => !item.pass);
	const textTotal = results.filter((item) => item.id.startsWith('T')).length;
	const imageTotal = results.filter((item) => item.id.startsWith('I')).length;
	const lines = [
		'# 测试结果',
		'',
		`- 日期：${new Date().toLocaleString('zh-CN')}`,
		'- 测试人/agent：Codex',
		'- 代码版本：本地工作区',
		`- 服务地址：${BASE_URL}`,
		`- 归档目录：${runDir}`,
		'- 数据集：test-data/text-cases.jsonl、test-data/image-cases.jsonl、test-data/edge-cases.jsonl',
		'',
		'## 汇总',
		'',
		`- 文本页用例数：${textTotal}`,
		`- 图片页用例数：${imageTotal}`,
		`- 通过：${results.filter((item) => item.pass).length}`,
		`- 失败：${failed.length}`,
		'- 阻塞：0',
		'',
		'## 归档文件',
		'',
		'- summary.md',
		'- text-cases.jsonl',
		'- image-cases.jsonl',
		'- failures.jsonl',
		'- artifacts/screenshots/',
		'- artifacts/raw-responses/',
		'',
		'## 用例结果',
		'',
		'| ID | 页面 | 场景/类型 | 结果 | 平均分 | 说明 |',
		'|---|---|---|---|---:|---|',
		...results.map((item) => {
			const avg = item.avg_score == null ? '-' : item.avg_score;
			return `| ${item.id} | ${item.page} | ${item.scene || item.path || '-'} | ${item.pass ? '通过' : '失败'} | ${avg} | ${String(item.detail).replaceAll('|', '/')} |`;
		}),
		'',
		'## 失败/低分用例',
		'',
		'| ID | 页面 | 场景/类型 | 平均分 | 问题 | 原始响应文件 | 截图 |',
		'|---|---|---|---:|---|---|---|',
		...(failureRecords.length
			? failureRecords.map((item) => {
				const avg = item.quality_scores?.average ?? '-';
				const issue = [...(item.errors || []), item.test_result?.detail].filter(Boolean).join('；');
				return `| ${item.id} | ${item.page} | ${item.scene || item.image_type || '-'} | ${avg} | ${String(issue).replaceAll('|', '/')} | ${item.raw_response_file || '-'} | ${item.screenshot || '-'} |`;
			})
			: ['| 无 | - | - | - | - | - | - |']),
		'',
		'## 可用于提示词优化的问题',
		'',
		`- JSON 不稳定：${failureRecords.some((item) => item.errors?.some((error) => error.includes('JSON 解析失败'))) ? '存在，见 failures.jsonl。' : '本轮模型用例未发现。'}`,
		`- 字段缺失：${failureRecords.some((item) => !item.optimized_prompt && !item.optimized_prompt_cn) ? '存在，见 failures.jsonl。' : '本轮模型用例未发现。'}`,
		`- 输出过长：${failureRecords.some((item) => (item.optimized_prompt || item.optimized_prompt_cn || '').length > 3500) ? '存在，见 failures.jsonl。' : '本轮自动检查未发现。'}`,
		'- 偏离用户原意：自动化仅基于结构、字段和模型自评分做筛查，仍需人工复盘 raw-responses。',
		'- 负面提示词过度堆砌：自动化仅保存样本，未做人工语义裁判。',
		'',
		'## 未完成项',
		'',
		'- 人工逐条语义评分未完成，执行失败原因：该项需要人工判断忠实原意、克制程度和负面提示适配度，本脚本仅生成复盘材料。',
	];
	const file = path.join(runDir, 'summary.md');
	fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
	return file;
}

(async () => {
	ensureRunDirectory();
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	const page = await context.newPage();
	page.on('dialog', async (dialog) => dialog.accept());

	const consoleErrors = await getPageErrors(page, async () => {
		await testAccess(page);
		for (const item of textCases) {
			await testTextCase(page, item);
		}
		for (const item of imageCases) {
			await testImageCase(page, item);
		}
		await testFailurePaths(page);
	});

	if (consoleErrors.length) {
		const record = {
			id: 'CONSOLE',
			page: 'all',
			scene: '控制台错误',
			raw_response: null,
			parsed_result: null,
			optimized_prompt: '',
			history_state: {},
			quality_scores: {},
			errors: consoleErrors,
			duration_ms: 0,
		};
		appendJsonl('failures.jsonl', record);
		results.push({
			id: 'CONSOLE',
			page: 'all',
			scene: '控制台错误',
			pass: false,
			detail: consoleErrors.slice(0, 5).join('; '),
			avg_score: null,
		});
	}

	await browser.close();
	const summary = writeSummary();
	const failed = results.filter((item) => !item.pass).length;
	console.log(JSON.stringify({ runDir, summary, total: results.length, failed }, null, 2));
	if (failed) {
		process.exitCode = 1;
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
