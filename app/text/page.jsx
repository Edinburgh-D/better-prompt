'use client';

import Script from 'next/script';

export default function TextPromptPage() {
	return (
		<>
			<div className="app-shell">
				<header className="workspace-header">
					<div className="brand-block">
						<a className="brand-mark" href="/" aria-label="Better Prompt 首页">
							BP
						</a>
						<div>
							<p className="eyebrow">Local Prompt Workbench</p>
							<h1>把想法整理成可执行的提问</h1>
						</div>
					</div>
					<nav className="top-nav" aria-label="页面导航">
						<a className="nav-link" href="/">
							首页
						</a>
						<a className="nav-link active" href="/text">
							文本
						</a>
						<a className="nav-link" href="/image">
							图片
						</a>
					</nav>
				</header>

				<main className="text-layout">
					<section className="panel input-panel" aria-labelledby="input-title">
						<div className="panel-header">
							<div>
								<p className="panel-kicker">Draft</p>
								<h2 id="input-title">原始需求</h2>
							</div>
							<span className="panel-meta">本地历史 · 20 条</span>
						</div>

						<div className="control-grid">
							<label className="field-block" htmlFor="optimizeMode">
								<span className="field-label">场景</span>
								<select id="optimizeMode">
									<option value="general">通用</option>
									<option value="redbook">小红书笔记</option>
									<option value="wechat_article">公众号文章</option>
									<option value="moments">朋友圈文案</option>
									<option value="product_intro">产品介绍</option>
									<option value="work_email">工作邮件</option>
									<option value="learning_question">学习提问</option>
								</select>
							</label>
							<label className="field-block" htmlFor="detailLevel">
								<span className="field-label">输出密度</span>
								<select id="detailLevel">
									<option value="standard">标准版</option>
									<option value="concise">精简版</option>
									<option value="full">完整诊断版</option>
								</select>
							</label>
						</div>

						<div className="template-row">
							<label className="field-block" htmlFor="promptTemplate">
								<span className="field-label">常用模板</span>
								<select id="promptTemplate">
									<option value="">选择模板...</option>
								</select>
							</label>
							<button
								className="btn-secondary inline-btn"
								type="button"
								onClick={() => window.loadSelectedTemplate?.()}
							>
								加载
							</button>
						</div>

						<textarea
							id="inputPrompt"
							placeholder="直接写下你想让 AI 帮你做什么。例如：帮我写一封催资料的邮件，语气别太强硬，控制在 300 字以内。"
							onInput={() => window.updateTextDiagnosisPreview?.()}
						/>

						<div className="workflow-panel compact-workflow">
							<div>
								<label className="field-label">优化方向</label>
								<div className="strategy-strip" aria-label="优化方向">
									<label>
										<input
											type="radio"
											name="promptStrategy"
											value="清晰可执行"
											defaultChecked
											onChange={() => window.updateTextDiagnosisPreview?.()}
										/>
										清晰可执行
									</label>
									<label>
										<input type="radio" name="promptStrategy" value="简洁直接" onChange={() => window.updateTextDiagnosisPreview?.()} />
										简洁直接
									</label>
									<label>
										<input type="radio" name="promptStrategy" value="更专业" onChange={() => window.updateTextDiagnosisPreview?.()} />
										更专业
									</label>
									<label>
										<input type="radio" name="promptStrategy" value="保留原意" onChange={() => window.updateTextDiagnosisPreview?.()} />
										保留原意
									</label>
								</div>
							</div>
							<details className="optional-context">
								<summary>有特殊要求再补充</summary>
								<input
									id="intentConstraints"
									type="text"
									placeholder="例如：控制在 300 字内、不要营销腔、面向新手、语气更自然"
									onInput={() => window.updateTextDiagnosisPreview?.()}
								/>
							</details>
						</div>

						<div className="diagnosis-preview compact-diagnosis" id="textDiagnosisPreview">
							<div className="empty-state">
								<p>输入后会先判断是否缺少目标、格式或限制。</p>
							</div>
						</div>

						<div className="btn-group">
							<button className="btn-primary" id="optimizeBtn" onClick={() => window.optimizePrompt?.()}>
								开始优化
							</button>
							<button className="btn-secondary" onClick={() => window.clearInput?.()}>
								清空
							</button>
						</div>
					</section>

					<section className="panel output-panel" aria-labelledby="output-title">
						<div className="panel-header">
							<div>
								<p className="panel-kicker">Result</p>
								<h2 id="output-title">优化结果</h2>
							</div>
							<span className="panel-meta">可复制 · 可回溯</span>
						</div>
						<div className="output-content" id="outputContent">
							<div className="empty-state">
								<p>在左侧输入提示词后开始优化。</p>
							</div>
						</div>
					</section>
				</main>

				<section className="history-panel" aria-labelledby="history-title">
					<div className="panel-header">
						<div>
							<p className="panel-kicker">Archive</p>
							<h2 id="history-title">历史记录</h2>
						</div>
						<button className="btn-secondary compact-btn" onClick={() => window.clearHistory?.()}>
							清空历史
						</button>
					</div>
					<div className="history-toolbar">
						<input id="historySearch" type="search" placeholder="搜索历史记录..." onInput={() => window.updateHistoryDisplay?.()} />
					</div>
					<div className="history-list" id="historyList">
						<div className="empty-state">
							<p>暂无历史记录</p>
						</div>
					</div>
				</section>
			</div>
			<Script src="/app.js" strategy="afterInteractive" />
		</>
	);
}
