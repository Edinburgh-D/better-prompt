const API_URL =
				window.location.protocol === 'file:'
					? 'http://localhost:5000/api/optimize'
					: '/api/optimize';

			const OPTIMIZATION_MODES = {
				general:
					'通用模式：优先提升目标清晰度、背景完整性、输出格式和可执行性，适合大多数任务。',
				redbook:
					'小红书笔记：重点关注目标人群、种草角度、标题吸引力、真实体验感、段落节奏和行动引导。',
				wechat_article:
					'公众号文章：重点关注读者定位、主题立意、文章结构、论证层次、案例素材和结尾转化。',
				moments:
					'朋友圈文案：重点关注表达自然度、情绪分寸、简洁程度、社交语境和不显得生硬推销。',
				product_intro:
					'产品介绍：重点关注目标用户、使用场景、核心卖点、利益点、信任依据和表达顺序。',
				work_email:
					'工作邮件：重点关注沟通对象、邮件目的、语气边界、事项优先级、行动要求和礼貌收束。',
				learning_question:
					'学习提问：重点关注学习目标、当前基础、卡点描述、期望讲解方式、例子需求和检验标准。',
			};

			const DETAIL_LEVELS = {
				concise:
					'精简版：只输出 task_type、user_intent、weaknesses、suggestions、optimized_prompt、optional_enhancements。weaknesses 和 suggestions 各控制在 2-3 条。',
				standard:
					'标准版：输出完整 JSON 字段，评分理由简洁明确，weaknesses、suggestions、optional_enhancements 各控制在 3-5 条。',
				full:
					'完整诊断版：输出完整 JSON 字段，评分理由更充分，建议要包含可执行细节，weaknesses、suggestions、optional_enhancements 可扩展到 4-6 条。',
			};

			const PROMPT_TEMPLATES = [
				{
					id: 'article_outline',
					title: '公众号文章',
					mode: 'wechat_article',
					prompt:
						'请帮我优化一篇公众号文章提示词。主题是：[文章主题]。目标读者是：[目标读者]。文章目标是：[希望读者理解或采取的行动]。请输出：标题建议、核心观点、文章结构、每节写作要点和结尾引导。',
				},
				{
					id: 'redbook_note',
					title: '小红书笔记',
					mode: 'redbook',
					prompt:
						'请帮我优化一条小红书笔记提示词。主题是：[主题]。目标人群是：[目标人群]。想表达的体验或观点是：[核心内容]。请输出：标题、开头、正文结构、种草点、真实感表达和结尾互动引导。',
				},
				{
					id: 'moments_copy',
					title: '朋友圈文案',
					mode: 'moments',
					prompt:
						'请帮我优化一条朋友圈文案提示词。发布目的：[目的]。希望表达的情绪：[情绪]。主要内容：[内容]。请输出自然、不夸张、不生硬推销的朋友圈文案，并提供 3 个不同语气版本。',
				},
				{
					id: 'product_intro',
					title: '产品介绍',
					mode: 'product_intro',
					prompt:
						'请帮我优化一段产品介绍提示词。产品是：[产品名称]。目标用户是：[目标用户]。核心卖点是：[卖点]。使用场景是：[场景]。请输出清晰、有说服力、适合普通用户理解的产品介绍。',
				},
				{
					id: 'work_email',
					title: '工作邮件',
					mode: 'work_email',
					prompt:
						'请帮我优化一封工作邮件提示词。收件人是：[收件人身份]。沟通目标是：[目标]。背景信息是：[背景]。语气要求：[正式/友好/克制]。请输出邮件标题、正文和更简洁的备用版本。',
				},
				{
					id: 'learning_question',
					title: '学习提问',
					mode: 'learning_question',
					prompt:
						'请帮我优化一个学习提问提示词。我想学习：[主题]。当前基础是：[基础]。具体卡点是：[问题]。希望讲解方式是：[通俗解释/案例/步骤/练习]。请输出更容易得到清晰讲解的提问方式。',
				},
				{
					id: 'daily_summary',
					title: '资料整理',
					mode: 'general',
					prompt:
						'请帮我优化一个资料整理提示词。资料主题是：[主题]。资料来源是：[来源]。我希望整理成：[表格/摘要/清单/报告]。请输出结构清晰、重点明确、便于后续使用的整理结果。',
				},
			];

			let history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
			let lastPrompt = '';
			let loadingTimer = null;

			function getSelectedMode() {
				return document.getElementById('optimizeMode')?.value || 'general';
			}

			function getSelectedDetailLevel() {
				return document.getElementById('detailLevel')?.value || 'standard';
			}

			function getTextWorkflowContext() {
				const strategies = Array.from(
					document.querySelectorAll('input[name="promptStrategy"]:checked')
				).map((item) => item.value);

				return {
					goal: document.getElementById('intentGoal')?.value.trim() || '',
					audience: document.getElementById('intentAudience')?.value.trim() || '',
					format: document.getElementById('intentFormat')?.value || '',
					tone: document.getElementById('intentTone')?.value || '',
					constraints:
						document.getElementById('intentConstraints')?.value.trim() || '',
					strategies,
				};
			}

			function getTextDiagnosis(input = '') {
				const context = getTextWorkflowContext();
				const checks = [
					{ key: '目标', ok: Boolean(context.goal || input.length >= 6 || /写|生成|优化|总结|分析|整理|解释|帮我/.test(input)) },
					{ key: '输出形式', ok: Boolean(context.format || /表格|清单|标题|正文|步骤|大纲|JSON|分点|一段|文章|邮件|文案|介绍/.test(input)) },
					{ key: '限制条件', ok: Boolean(context.constraints || /不要|避免|控制|限制|必须|不超过|以内/.test(input)) },
				];
				const missing = checks.filter((item) => !item.ok).map((item) => item.key);
				const score = Math.max(1, Math.round((checks.filter((item) => item.ok).length / checks.length) * 5));

				return { checks, missing, score, context };
			}

			function updateTextDiagnosisPreview() {
				const preview = document.getElementById('textDiagnosisPreview');
				if (!preview) {
					return;
				}

				const input = document.getElementById('inputPrompt')?.value.trim() || '';
				if (!input && !getTextWorkflowContext().goal) {
					preview.innerHTML =
						'<div class="empty-state"><p>输入内容后，这里会先判断缺了哪些关键信息。</p></div>';
					return;
				}

				const diagnosis = getTextDiagnosis(input);
				preview.innerHTML = `
					<div class="diagnosis-head">
						<strong>可执行度 ${diagnosis.score}/5</strong>
						<span>${diagnosis.missing.length ? `建议补充：${diagnosis.missing.join('、')}` : '信息较完整，可以开始优化'}</span>
					</div>
					<div class="diagnosis-checks">
						${diagnosis.checks
							.map(
								(item) =>
									`<span class="${item.ok ? 'is-ok' : 'is-missing'}">${item.key}</span>`
							)
							.join('')}
					</div>
				`;
			}

			function buildTextWorkflowInstruction(input) {
				const diagnosis = getTextDiagnosis(input);
				const context = diagnosis.context;
				return `页面补全信息：
- 用户补充要求：${context.constraints || '无额外限制'}
- 优化方向：${context.strategies.length ? context.strategies.join('、') : '清晰可执行'}
- 本地诊断缺失项：${diagnosis.missing.length ? diagnosis.missing.join('、') : '无明显缺失'}

请优先保证 optimized_prompt 是一段可直接复制使用的完整提示词。
可以额外返回 "rewrite_actions": ["列出3-5条你具体做了哪些改动"]。
如果与系统格式冲突，以合法 JSON 为第一优先级。`;
			}

			function initializeTemplates() {
				const templateSelect = document.getElementById('promptTemplate');
				if (!templateSelect) {
					return;
				}

				templateSelect.innerHTML =
					'<option value="">选择模板...</option>' +
					PROMPT_TEMPLATES.map(
						(template) =>
							`<option value="${template.id}">${escapeHtml(template.title)}</option>`
					).join('');
			}

			function loadSelectedTemplate() {
				const templateId = document.getElementById('promptTemplate')?.value;
				const template = PROMPT_TEMPLATES.find((item) => item.id === templateId);
				const input = document.getElementById('inputPrompt');

				if (!template || !input) {
					showToast('请先选择一个模板');
					return;
				}

				if (input.value.trim() && !confirm('当前输入框已有内容，确定要加载模板并覆盖吗？')) {
					return;
				}

				input.value = template.prompt;
				if (document.getElementById('optimizeMode')) {
					document.getElementById('optimizeMode').value = template.mode;
				}
				showToast('模板已加载');
			}

			function updateHistoryDisplay() {
				const historyList = document.getElementById('historyList');
				const keyword =
					document.getElementById('historySearch')?.value.trim().toLowerCase() ||
					'';
				const filteredHistory = history
					.map((item, index) => ({ item, index }))
					.filter(({ item }) => {
						if (!keyword) {
							return true;
						}

						const searchable = [
							item.title,
							item.preview,
							item.original,
							item.structuredResult?.task_type,
							item.structuredResult?.user_intent,
							item.mode,
							item.detailLevel,
						]
							.filter(Boolean)
							.join(' ')
							.toLowerCase();

						return searchable.includes(keyword);
					});

				if (history.length === 0) {
					historyList.innerHTML =
						'<div class="empty-state"><p>暂无历史记录</p></div>';
					return;
				}

				if (filteredHistory.length === 0) {
					historyList.innerHTML =
						'<div class="empty-state"><p>没有匹配的历史记录</p></div>';
					return;
				}

				historyList.innerHTML = filteredHistory
					.map(
						({ item, index }) => `
                <div class="history-item" onclick="loadHistory(${index})">
                    <div class="history-item-header">
                        <div class="history-item-title">${escapeHtml(item.title)}</div>
                        <div class="history-item-time">${escapeHtml(item.time || item.createdAt || '')}</div>
                    </div>
                    <div class="history-item-preview">${escapeHtml(item.preview)}</div>
					<div class="history-actions">
						<button class="btn-secondary" onclick="event.stopPropagation(); loadHistory(${index})">重新加载</button>
						<button class="btn-secondary" onclick="event.stopPropagation(); copyHistoryOptimized(${index}, this)">复制结果</button>
						<button class="btn-secondary" onclick="event.stopPropagation(); deleteHistoryItem(${index})">删除</button>
					</div>
                </div>
            `
					)
					.join('');
			}

			function loadHistory(index) {
				const item = history[index];
				document.getElementById('inputPrompt').value = item.original;
				document.getElementById('outputContent').innerHTML = item.result;
				if (item.mode && document.getElementById('optimizeMode')) {
					document.getElementById('optimizeMode').value = item.mode;
				}
				if (item.detailLevel && document.getElementById('detailLevel')) {
					document.getElementById('detailLevel').value = item.detailLevel;
				}
			}

			function getHistoryOptimizedPrompt(item) {
				return item?.structuredResult?.optimized_prompt || '';
			}

			function copyHistoryOptimized(index, button) {
				const optimizedPrompt = getHistoryOptimizedPrompt(history[index]);
				if (!optimizedPrompt) {
					showToast('该历史记录没有可复制的结构化结果');
					return;
				}

				copyToClipboard(optimizedPrompt, button);
			}

			function deleteHistoryItem(index) {
				history.splice(index, 1);
				localStorage.setItem('promptHistory', JSON.stringify(history));
				updateHistoryDisplay();
				showToast('历史记录已删除');
			}

			function clearHistory() {
				if (confirm('确定要清空所有历史记录吗？')) {
					history = [];
					localStorage.setItem('promptHistory', '[]');
					updateHistoryDisplay();
				}
			}

			function clearInput() {
				document.getElementById('inputPrompt').value = '';
				['intentGoal', 'intentAudience', 'intentConstraints'].forEach((id) => {
					const field = document.getElementById(id);
					if (field) {
						field.value = '';
					}
				});
				['intentFormat', 'intentTone'].forEach((id) => {
					const field = document.getElementById(id);
					if (field) {
						field.value = '';
					}
				});
				document
					.querySelectorAll('input[name="promptStrategy"]')
					.forEach((item) => {
						item.checked = item.value === '清晰可执行';
					});
				updateTextDiagnosisPreview();
				document.getElementById('outputContent').innerHTML =
					'<div class="empty-state"><p>在左侧输入提示词，点击"开始优化"按钮</p></div>';
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
						? '正在理解任务意图...'
						: seconds < 15
						? '正在诊断提示词结构...'
						: '正在生成优化结果...';

				return `
					<div class="loading">
						<div class="loading-spinner"></div>
						<p>${stage}</p>
						<p>已等待 ${seconds} 秒</p>
					</div>
				`;
			}

			async function optimizePrompt() {
				const input = document.getElementById('inputPrompt').value.trim();

				if (!input) {
					alert('请输入提示词！');
					return;
				}

				const btn = document.getElementById('optimizeBtn');
				const outputContent = document.getElementById('outputContent');
				const selectedMode = getSelectedMode();
				const selectedDetailLevel = getSelectedDetailLevel();
				const modeInstruction =
					OPTIMIZATION_MODES[selectedMode] || OPTIMIZATION_MODES.general;
				const detailInstruction =
					DETAIL_LEVELS[selectedDetailLevel] || DETAIL_LEVELS.standard;
				lastPrompt = input;

				btn.disabled = true;
				btn.textContent = '优化中...';

				let elapsedSeconds = 0;
				outputContent.innerHTML = renderLoading(elapsedSeconds);
				loadingTimer = window.setInterval(() => {
					elapsedSeconds += 1;
					outputContent.innerHTML = renderLoading(elapsedSeconds);
				}, 1000);

				const systemPrompt = `你是一个顶尖的提示词优化专家、任务分析师和 AI 工作流设计顾问。你的任务不是简单润色文字，而是识别用户真正想完成的目标，并将原始提示词重构为更清晰、可执行、可复用、能稳定获得高质量结果的提示词。

请根据用户提供的原始提示词完成诊断与优化。该页面面向普通 AI 用户的大众文本场景，例如写作、产品策划、学习研究、资料整理、数据分析、运营营销和自动化工作流。不要把专业开发任务、图片类任务或视频类任务作为本页优化入口；如果用户输入明显属于图片提示词，请建议使用“图片优化”页面。

分析维度：
1. 目标明确性：是否清楚说明要完成什么任务、解决什么问题、面向什么结果。
2. 背景完整性：是否提供必要上下文、使用场景、对象、约束和前提条件。
3. 输出可控性：是否规定输出结构、格式、粒度、长度、语言风格和验收标准。
4. 执行路径：是否说明分析步骤、优先级、判断标准、推理方式或工作流程。
5. 边界约束：是否明确不要做什么、需要避免什么、有哪些限制和风险。
6. 可复用性：是否便于后续修改变量、迁移到相似任务或形成模板。

请先判断原始提示词属于哪类任务，并说明你的优化策略。不要过度复杂化简单任务；如果原始提示词已经足够好，应保留其优势，只做必要增强。

当前优化模式：
${modeInstruction}

当前输出详细度：
${detailInstruction}

请只返回一个合法 JSON 对象，不要返回 Markdown，不要使用代码块包裹，不要添加 JSON 之外的解释文本。JSON 结构必须如下：

{
  "task_type": "通用/小红书笔记/公众号文章/朋友圈文案/产品介绍/工作邮件/学习提问/资料整理/其他",
  "detail_level": "concise/standard/full",
  "user_intent": "用1-2句话概括用户真正想完成的目标",
  "strategy": "说明本次优化重点，例如补充背景、明确输出格式、增加约束、拆解步骤等",
  "scores": {
    "goal_clarity": {"value": 1, "reason": "评分理由"},
    "context_completeness": {"value": 1, "reason": "评分理由"},
    "output_control": {"value": 1, "reason": "评分理由"},
    "execution_path": {"value": 1, "reason": "评分理由"},
    "boundary_constraints": {"value": 1, "reason": "评分理由"},
    "reusability": {"value": 1, "reason": "评分理由"}
  },
  "strengths": ["列出原提示词的主要优点"],
  "weaknesses": ["列出最影响效果的3-5个问题，按重要性排序"],
  "suggestions": ["给出具体、可执行的修改建议，不要空泛描述"],
  "optimized_prompt": "提供一版可以直接复制使用的完整优化提示词。要求结构清晰、目标明确、包含必要背景、输出规范、约束条件和验收标准。",
  "optional_enhancements": ["如果适用，提供2-4条可选增强方向，例如增加示例、限定受众、加入评分标准、要求分阶段输出等"]
}

重要要求：
1. scores 中每个 value 必须是 1-5 的数字。
2. optimized_prompt 必须能直接复制使用，不要包含“请补充 XXX”这类未完成占位，除非原始需求确实缺少关键信息。
3. 如果关键信息缺失，请在 optimized_prompt 中用清晰的变量占位符表示，例如 [目标用户]、[输出长度]、[使用场景]。
4. 不要把所有提示词都改成长篇复杂模板，应根据任务复杂度控制长度。
5. 长文本或复杂任务必须优先保证 JSON 合法性；宁可减少 weaknesses、suggestions、optional_enhancements 的数量，也不要破坏 JSON。
6. 所有字段类型必须严格匹配上面的结构：optimized_prompt 必须是字符串，不能写成数组；字符串字段结束后不能额外输出 ] 或 }。
7. 字符串内部尽量不要使用未转义的英文双引号；如需表示标题、引语或按钮文字，优先使用中文引号“”或单引号，避免导致 JSON 解析失败。
8. 输出前请自检一次：整体必须能被 JSON.parse 直接解析；不得包含尾随逗号、注释、非法换行控制字符或未闭合字符串。
9. 语言应清晰、专业、具体，避免空泛鼓励和泛泛而谈。`;

				try {
					const response = await fetch(API_URL, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							model: 'auto',
							messages: [
								{ role: 'system', content: systemPrompt },
								{
									role: 'user',
									content: `请评估和优化以下提示词：\n\n${input}\n\n${buildTextWorkflowInstruction(input)}`,
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
						? renderStructuredResult(structuredResult)
						: formatResult(result);
					outputContent.innerHTML = formattedResult;

					const historyItem = {
						title: input.substring(0, 20) + (input.length > 20 ? '...' : ''),
						preview: input.substring(0, 50) + (input.length > 50 ? '...' : ''),
						original: input,
						rawResult: result,
						structuredResult,
						mode: selectedMode,
						detailLevel: selectedDetailLevel,
						model: 'deepseek-v4-pro',
						createdAt: new Date().toISOString(),
						result: formattedResult,
						time: new Date().toLocaleString('zh-CN'),
					};

					history.unshift(historyItem);
					if (history.length > 20) {
						history = history.slice(0, 20);
					}
					localStorage.setItem('promptHistory', JSON.stringify(history));
					updateHistoryDisplay();
				} catch (error) {
					console.error('Error:', error);
					outputContent.innerHTML = renderError(error);
				} finally {
					window.clearInterval(loadingTimer);
					loadingTimer = null;
					btn.disabled = false;
					btn.textContent = '开始优化';
				}
			}

			function retryLastRequest() {
				if (lastPrompt) {
					document.getElementById('inputPrompt').value = lastPrompt;
				}
				optimizePrompt();
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
						<h3>❌ 错误：${escapeHtml(code)}</h3>
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
				return text.replace(
					/("optimized_prompt"\s*:\s*"(?:\\.|[^"\\])*")\s*\]\s*,\s*"optional_enhancements"/,
					'$1,\n  "optional_enhancements"'
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

				return `<ul>${items
					.map((item) => `<li>${escapeHtml(item)}</li>`)
					.join('')}</ul>`;
			}

			function renderWorkflowDiagnosis(result) {
				const diagnosis = getTextDiagnosis(lastPrompt || '');
				return `
					<div class="workflow-result">
						<div>
							<strong>优化前诊断</strong>
							<p>可执行度 ${diagnosis.score}/5${diagnosis.missing.length ? `，缺少：${diagnosis.missing.join('、')}` : '，信息较完整'}</p>
						</div>
						<div class="diagnosis-checks">
							${diagnosis.checks
								.map(
									(item) =>
										`<span class="${item.ok ? 'is-ok' : 'is-missing'}">${item.key}</span>`
								)
								.join('')}
						</div>
					</div>
					${renderOptionalSection('具体修改点', result.rewrite_actions)}
				`;
			}

			function getPromptVariants(result) {
				const variants = result.prompt_variants || {};
				return [
					{
						key: 'standard',
						title: '标准版',
						text: variants.standard || '',
					},
					{
						key: 'concise',
						title: '简洁版',
						text: variants.concise || '',
					},
					{
						key: 'enhanced',
						title: '强化版',
						text: variants.enhanced || '',
					},
				].filter((item) => item.text);
			}

			function renderPromptVariants(result) {
				const variants = getPromptVariants(result);
				if (variants.length === 0) {
					return '';
				}

				return `
					<div class="variant-grid">
						${variants
							.map(
								(item) => `
									<div class="variant-card">
										<h3>${escapeHtml(item.title)}</h3>
										<div class="prompt-text">${escapeHtml(item.text).replace(/\n/g, '<br>')}</div>
										<button class="copy-btn" onclick="copyToClipboard(\`${item.text
											.replace(/\\/g, '\\\\')
											.replace(/`/g, '\\`')
											.replace(/\n/g, '\\n')}\`, this)">复制${escapeHtml(item.title)}</button>
									</div>
								`
							)
							.join('')}
					</div>
				`;
			}

			function refinePrompt(direction) {
				const input = document.getElementById('inputPrompt');
				if (!input) {
					return;
				}

				const current = input.value.trim() || lastPrompt;
				if (!current) {
					showToast('请先输入或加载一条提示词');
					return;
				}

				input.value = `${current}\n\n请继续调整：${direction}`;
				updateTextDiagnosisPreview();
				optimizePrompt();
			}

			function renderFollowupOptions(result) {
				const options = Array.isArray(result.followup_options)
					? result.followup_options
					: [];

				if (options.length === 0) {
					return '';
				}

				return `
					<div class="micro-actions">
						${options
							.slice(0, 5)
							.map(
								(option) =>
									`<button class="btn-secondary" onclick="refinePrompt('${escapeHtml(option).replace(/'/g, '&#39;')}')">${escapeHtml(option)}</button>`
							)
							.join('')}
					</div>
				`;
			}

			function renderStructuredResult(result) {
				const scores = result.scores || {};
				const scoreLabels = {
					goal_clarity: '目标明确性',
					context_completeness: '背景完整性',
					output_control: '输出可控性',
					execution_path: '执行路径',
					boundary_constraints: '边界约束',
					reusability: '可复用性',
				};

				const hasScores = scores && Object.keys(scores).length > 0;
				const scoreHtml = hasScores
					? Object.entries(scoreLabels)
					.map(([key, label]) => {
						const score = scores[key] || {};
						return `
							<div class="evaluation-item">
								<h3>${label}<span class="score">${escapeHtml(score.value || '-')}/5</span></h3>
								<p>${escapeHtml(score.reason || '暂无评分理由')}</p>
							</div>
						`;
					})
					.join('')
					: '';

				const optimizedPrompt = result.optimized_prompt || '';
				const escapedPrompt = escapeHtml(optimizedPrompt);

				return `
					${renderWorkflowDiagnosis(result)}
					${renderTaskSummary(result)}
					${scoreHtml}
					${renderOptionalSection('主要问题', result.weaknesses)}
					${renderOptionalSection('优点', result.strengths)}
					${renderOptionalSection('优化建议', result.suggestions)}
					<div class="improved-prompt">
						<h3>📋 优化后的提示词（完整版）</h3>
						<div class="prompt-text">${escapedPrompt.replace(/\n/g, '<br>')}</div>
						<button class="copy-btn" onclick="copyToClipboard(\`${optimizedPrompt
							.replace(/\\/g, '\\\\')
							.replace(/`/g, '\\`')
							.replace(/\n/g, '\\n')}\`, this)">
							📋 复制优化后的提示词
						</button>
					</div>
					${renderPromptVariants(result)}
					${renderOptionalSection('可选增强', result.optional_enhancements)}
					${renderFollowupOptions(result)}
				`;
			}

			function renderTaskSummary(result) {
				if (!result.task_type && !result.user_intent && !result.strategy) {
					return '';
				}

				return `
					<div class="evaluation-item">
						<h3>任务判断</h3>
						${result.task_type ? `<p><strong>任务类型：</strong>${escapeHtml(result.task_type)}</p>` : ''}
						${result.user_intent ? `<p><strong>用户意图：</strong>${escapeHtml(result.user_intent)}</p>` : ''}
						${result.strategy ? `<p><strong>优化策略：</strong>${escapeHtml(result.strategy)}</p>` : ''}
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

			function formatResult(text) {
				const parts = text.split(/## 优化后的提示词/);

				let evaluationPart = parts[0] || '';
				let improvedPrompt = '';

				if (parts.length > 1) {
					const promptSection = parts[1].trim();

					const codeBlockMatch = promptSection.match(
						/```(?:markdown)?\s*([\s\S]*?)```/
					);

					if (codeBlockMatch) {
						improvedPrompt = codeBlockMatch[1].trim();
						evaluationPart +=
							'\n\n## 优化后的提示词\n\n已在下方单独展示优化后的完整提示词。';
					} else {
						improvedPrompt = promptSection;
					}
				}

				let html = evaluationPart;

				html = html.replace(
					/```(\w*)\s*([\s\S]*?)```/g,
					(match, lang, code) => {
						const escapedCode = code
							.trim()
							.replace(/&/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;');
						return `<pre class="code-block"><code class="language-${
							lang || 'text'
						}">${escapedCode}</code></pre>`;
					}
				);

				html = html.replace(
					/`([^`\n]+)`/g,
					'<code class="inline-code">$1</code>'
				);

				html = html.replace(
					/^### (.*)$/gm,
					'<h4 style="color: #555; margin: 15px 0 10px 0; font-size: 1.05em; font-weight: 600;">$1</h4>'
				);
				html = html.replace(
					/^## (.*)$/gm,
					'<h3 style="color: #667eea; margin: 20px 0 15px 0; font-size: 1.2em; font-weight: 600; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">$1</h3>'
				);
				html = html.replace(
					/^# (.*)$/gm,
					'<h2 style="color: #333; margin: 25px 0 15px 0; font-size: 1.4em; font-weight: 700;">$1</h2>'
				);

				html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
				html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

				html = html.replace(
					/^(\d+)\. (.+)$/gm,
					'<li style="margin: 8px 0 8px 20px; line-height: 1.6;">$2</li>'
				);
				html = html.replace(
					/^- (.+)$/gm,
					'<li style="margin: 8px 0 8px 20px; line-height: 1.6;">$1</li>'
				);

				html = html.replace(
					/\n\n/g,
					'</p><p style="margin: 10px 0; line-height: 1.8; color: #333;">'
				);
				html = html.replace(/\n/g, '<br>');

				if (improvedPrompt) {
					const escapedPrompt = improvedPrompt
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;');

					html += `
                    <div class="improved-prompt">
                        <h3>📋 优化后的提示词（完整版）</h3>
                        <div class="prompt-text">${escapedPrompt.replace(
													/\n/g,
													'<br>'
												)}</div>
                        <button class="copy-btn" onclick="copyToClipboard(\`${improvedPrompt
													.replace(/\\/g, '\\\\')
													.replace(/`/g, '\\`')
													.replace(/\n/g, '\\n')}\`, this)">
                            📋 复制优化后的提示词
                        </button>
                    </div>
                `;
				}

				return `<div class="evaluation-item"><div style="margin: 0; line-height: 1.8; color: #333;"><p style="margin: 0;">${html}</p></div></div>`;
			}

			initializeTemplates();
			updateTextDiagnosisPreview();
			updateHistoryDisplay();
