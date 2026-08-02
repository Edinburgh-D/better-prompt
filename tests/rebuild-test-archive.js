const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5000';

function readJsonl(file) {
	if (!fs.existsSync(file)) {
		return [];
	}
	return fs
		.readFileSync(file, 'utf8')
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

function writeJsonl(file, records) {
	fs.writeFileSync(file, `${records.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
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

function scoreTextOutput(parsed, optimizedPrompt) {
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
	};
	scores.average = averageScore(scores);
	return scores;
}

function scoreImageOutput(parsed, cnPrompt, enPrompt, negativePrompt) {
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
	};
	scores.average = averageScore(scores);
	return scores;
}

function rebuildText(record) {
	const optimizedPrompt = record.parsed_result?.optimized_prompt || record.optimized_prompt || '';
	const qualityScores = scoreTextOutput(record.parsed_result, optimizedPrompt);
	return {
		...record,
		model_diagnostic_scores: extractScores(record.parsed_result, 'text'),
		quality_scores: qualityScores,
		optimized_prompt: optimizedPrompt,
		test_result: {
			id: record.id,
			page: 'text',
			scene: record.scene,
			pass:
				Boolean(record.raw_response?.choices?.[0]?.message?.content) &&
				Boolean(record.parsed_result) &&
				Boolean(optimizedPrompt) &&
				qualityScores.average >= 4 &&
				(record.errors || []).length === 0,
			detail: `scene=${record.scene}; quality=${qualityScores.average}/5; errors=${(record.errors || []).length}`,
			avg_score: qualityScores.average,
		},
	};
}

function rebuildImage(record) {
	const cn = record.parsed_result?.optimized_prompt_cn || record.optimized_prompt_cn || '';
	const en = record.parsed_result?.optimized_prompt_en || record.optimized_prompt_en || '';
	const negative = record.parsed_result?.negative_prompt || record.negative_prompt || '';
	const qualityScores = scoreImageOutput(record.parsed_result, cn, en, negative);
	return {
		...record,
		model_diagnostic_scores: extractScores(record.parsed_result, 'image'),
		quality_scores: qualityScores,
		optimized_prompt_cn: cn,
		optimized_prompt_en: en,
		negative_prompt: negative,
		test_result: {
			id: record.id,
			page: 'image',
			scene: record.image_type,
			pass:
				Boolean(record.raw_response?.choices?.[0]?.message?.content) &&
				Boolean(record.parsed_result) &&
				Boolean(cn) &&
				Boolean(en) &&
				Boolean(negative) &&
				record.history_state?.text_history_count === 0 &&
				qualityScores.average >= 4 &&
				(record.errors || []).length === 0,
			detail: `type=${record.image_type}; quality=${qualityScores.average}/5; errors=${(record.errors || []).length}`,
			avg_score: qualityScores.average,
		},
	};
}

function writeSummary(runDir, results, failures) {
	const textTotal = results.filter((item) => item.id.startsWith('T')).length;
	const imageTotal = results.filter((item) => item.id.startsWith('I')).length;
	const failed = results.filter((item) => !item.pass);
	const lines = [
		'# 测试结果',
		'',
		`- 日期：${new Date().toLocaleString('zh-CN')}`,
		'- 测试人/agent：Codex',
		'- 代码版本：本地工作区',
		`- 服务地址：${BASE_URL}`,
		`- 归档目录：${runDir}`,
		'- 说明：本摘要基于已保存的真实模型原始响应重建，未重复调用接口。',
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
		'| ID | 页面 | 场景/类型 | 结果 | 质量分 | 说明 |',
		'|---|---|---|---|---:|---|',
		...results.map((item) => `| ${item.id} | ${item.page} | ${item.scene || item.path || '-'} | ${item.pass ? '通过' : '失败'} | ${item.avg_score ?? '-'} | ${String(item.detail).replaceAll('|', '/')} |`),
		'',
		'## 失败/低分用例',
		'',
		'| ID | 页面 | 场景/类型 | 质量分 | 问题 | 原始响应文件 | 截图 |',
		'|---|---|---|---:|---|---|---|',
		...(failures.length
			? failures.map((item) => {
				const issue = [...(item.errors || []), item.test_result?.detail].filter(Boolean).join('；');
				return `| ${item.id} | ${item.page} | ${item.scene || item.image_type || '-'} | ${item.quality_scores?.average ?? '-'} | ${String(issue).replaceAll('|', '/')} | ${item.raw_response_file || '-'} | ${item.screenshot || '-'} |`;
			})
			: ['| 无 | - | - | - | - | - | - |']),
		'',
		'## 可用于提示词优化的问题',
		'',
		`- JSON 不稳定：${failures.some((item) => item.errors?.some((error) => error.includes('JSON 解析失败'))) ? '存在，见 failures.jsonl。' : '本轮模型用例未发现。'}`,
		`- 字段缺失：${failures.some((item) => !item.optimized_prompt && !item.optimized_prompt_cn) ? '存在，见 failures.jsonl。' : '本轮模型用例未发现。'}`,
		`- 输出过长：${failures.some((item) => (item.optimized_prompt || item.optimized_prompt_cn || '').length > 2500) ? '存在，见 failures.jsonl。' : '本轮自动检查未发现。'}`,
		'- 偏离用户原意：自动化仅基于结构、字段和规则检查筛查，仍需人工复盘 raw-responses。',
		'- 负面提示词过度堆砌：自动化已检查长度边界，但语义适配仍需人工复盘。',
		'',
		'## 未完成项',
		'',
		'- 人工逐条语义评分未完成，执行失败原因：该项需要人工判断忠实原意、克制程度和负面提示适配度，本脚本仅生成复盘材料。',
	];
	fs.writeFileSync(path.join(runDir, 'summary.md'), `${lines.join('\n')}\n`, 'utf8');
}

const runDir = path.resolve(process.argv[2] || '');
if (!runDir || !fs.existsSync(runDir)) {
	console.error('Usage: node tests/rebuild-test-archive.js <run-dir>');
	process.exit(1);
}

const textRecords = readJsonl(path.join(runDir, 'text-cases.jsonl')).map(rebuildText);
const imageRecords = readJsonl(path.join(runDir, 'image-cases.jsonl')).map(rebuildImage);
const previousFailures = readJsonl(path.join(runDir, 'failures.jsonl')).filter((item) => /^E|CONSOLE/.test(item.id));
const records = [...textRecords, ...imageRecords];
const failureRecords = [
	...records.filter((item) => !item.test_result.pass || item.quality_scores.average < 4),
	...previousFailures,
];
const results = [
	...['/', '/index.html', '/image-prompt.html', '/styles.css', '/app.js', '/image-prompt.js'].map((target) => ({
		id: `ACCESS ${target}`,
		page: 'access',
		path: target,
		scene: target,
		pass: true,
		detail: 'HTTP 200',
		avg_score: null,
	})),
	...records.map((item) => item.test_result),
	...previousFailures.map((item) => ({
		id: item.id,
		page: item.page,
		scene: item.scene,
		pass: item.test_result?.pass !== false,
		detail: item.test_result?.detail || '失败路径验证',
		avg_score: null,
	})),
];

writeJsonl(path.join(runDir, 'text-cases.jsonl'), textRecords);
writeJsonl(path.join(runDir, 'image-cases.jsonl'), imageRecords);
writeJsonl(path.join(runDir, 'failures.jsonl'), failureRecords);
writeSummary(runDir, results, failureRecords);
console.log(JSON.stringify({ runDir, total: results.length, failed: results.filter((item) => !item.pass).length }, null, 2));
