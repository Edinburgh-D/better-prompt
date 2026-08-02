'use client';

import Script from 'next/script';

export default function ImagePromptPage() {
	return (
		<>
			<div className="app-shell">
				<header className="workspace-header">
					<div className="brand-block">
						<a className="brand-mark" href="/" aria-label="Better Prompt 首页">
							BP
						</a>
						<div>
							<p className="eyebrow">Image Prompt Bench</p>
							<h1>把画面想法拆成可控镜头</h1>
						</div>
					</div>
					<nav className="top-nav" aria-label="页面导航">
						<a className="nav-link" href="/">
							首页
						</a>
						<a className="nav-link" href="/text">
							文本
						</a>
						<a className="nav-link active" href="/image">
							图片
						</a>
					</nav>
				</header>

				<main className="image-workbench">
					<section className="panel image-tag-panel" aria-labelledby="tag-title">
						<div className="panel-header">
							<div>
								<p className="panel-kicker">Tags</p>
								<h2 id="tag-title">标签选择</h2>
							</div>
							<span className="panel-meta">主体 · 光影 · 环境</span>
						</div>
						<label className="field-block" htmlFor="imageType">
							<span className="field-label">图片类型</span>
							<select id="imageType" onChange={() => window.refreshImageSummaryPrompt?.()}>
								<option value="general">通用</option>
								<option value="portrait">人物 / 头像</option>
								<option value="product">商品图</option>
								<option value="poster">海报 / 封面</option>
								<option value="illustration">插画</option>
								<option value="scene">场景图</option>
								<option value="character">角色设定</option>
							</select>
						</label>
						<div id="imageTagGroups" className="tag-groups" aria-label="图片标签选择" />
					</section>

					<section className="panel image-summary-panel" aria-labelledby="summary-title">
						<div className="panel-header">
							<div>
								<p className="panel-kicker">Prompt</p>
								<h2 id="summary-title">已选标签与汇总提示词</h2>
							</div>
							<span className="panel-meta">可手动改写</span>
						</div>
						<div className="selected-tags" id="selectedImageTags">
							<span className="muted-text">暂未选择标签</span>
						</div>
						<textarea
							id="imageInputPrompt"
							placeholder="从左侧选择标签，或直接输入原始图片提示词。例如：雨后的城市街头，一个穿银色外套的年轻女性，写实摄影。"
							onInput={() => window.syncImagePromptFromManualInput?.()}
						/>
						<div className="btn-group">
							<button className="btn-secondary" onClick={() => window.refreshImageSummaryPrompt?.()}>
								生成汇总
							</button>
							<button className="btn-secondary" onClick={() => window.clearImageInput?.()}>
								清空
							</button>
						</div>
					</section>

					<section className="panel image-action-panel" aria-labelledby="action-title">
						<div className="panel-header">
							<div>
								<p className="panel-kicker">Controls</p>
								<h2 id="action-title">补充信息与测试</h2>
							</div>
							<span className="panel-meta">运行前检查</span>
						</div>
						<div className="control-stack">
							<label className="field-block" htmlFor="targetModel">
								<span className="field-label">目标模型</span>
								<select id="targetModel">
									<option value="general">通用</option>
								</select>
							</label>

							<label className="field-block" htmlFor="imageStylePreset">
								<span className="field-label">风格预设</span>
								<select id="imageStylePreset" onChange={() => window.refreshImageSummaryPrompt?.()}>
									<option value="">自动判断</option>
									<option value="真实摄影，干净自然，适合普通用户直接出图">真实摄影</option>
									<option value="电影感画面，层次光影，情绪明确">电影感</option>
									<option value="商业产品图，干净背景，高级质感">商业产品图</option>
									<option value="轻柔插画，色彩舒适，细节适中">轻柔插画</option>
									<option value="动漫风格，角色特征清晰，画面干净">动漫风</option>
									<option value="极简海报，留白明确，主体突出">极简海报</option>
								</select>
							</label>

							<div className="workflow-grid image-param-grid">
								<label className="field-block" htmlFor="imageAspectRatio">
									<span className="field-label">画幅</span>
									<select id="imageAspectRatio" onChange={() => window.refreshImageSummaryPrompt?.()}>
										<option value="">自动</option>
										<option value="1:1">1:1</option>
										<option value="3:4">3:4</option>
										<option value="4:5">4:5</option>
										<option value="9:16">9:16</option>
										<option value="16:9">16:9</option>
									</select>
								</label>
								<label className="field-block" htmlFor="imageDetailLevel">
									<span className="field-label">细节</span>
									<select id="imageDetailLevel" onChange={() => window.refreshImageSummaryPrompt?.()}>
										<option value="标准">标准</option>
										<option value="简洁">简洁</option>
										<option value="丰富">丰富</option>
									</select>
								</label>
							</div>

							<label className="field-block" htmlFor="imageSubjectDetail">
								<span className="field-label">主体补充</span>
								<input id="imageSubjectDetail" type="text" placeholder="例如：年轻女性、白色保温杯、唐代街市" onInput={() => window.refreshImageSummaryPrompt?.()} />
							</label>

							<label className="field-block" htmlFor="imageSceneDetail">
								<span className="field-label">场景 / 用途</span>
								<input id="imageSceneDetail" type="text" placeholder="例如：电商主图、封面海报、雨夜街道" onInput={() => window.refreshImageSummaryPrompt?.()} />
							</label>

							<label className="field-block" htmlFor="imageAvoidDetail">
								<span className="field-label">避免出现</span>
								<input id="imageAvoidDetail" type="text" placeholder="例如：文字乱码、现代建筑、过度磨皮" onInput={() => window.refreshImageSummaryPrompt?.()} />
							</label>
						</div>
						<div className="btn-group vertical-actions">
							<button className="btn-primary" id="imageOptimizeBtn" onClick={() => window.optimizeImagePrompt?.()}>
								开始优化
							</button>
							<button className="btn-secondary" id="imageTestBtn" onClick={() => window.runImagePromptTest?.()}>
								运行测试
							</button>
						</div>
					</section>
				</main>

				<section className="image-result-grid">
					<div className="panel">
						<div className="panel-header">
							<div>
								<p className="panel-kicker">Result</p>
								<h2>图片优化结果</h2>
							</div>
							<span className="panel-meta">中英提示词 · 负面提示词</span>
						</div>
						<div className="output-content" id="imageOutputContent">
							<div className="empty-state">
								<p>选择标签或输入图片提示词后开始优化。</p>
							</div>
						</div>
					</div>

					<div className="panel">
						<div className="panel-header">
							<div>
								<p className="panel-kicker">Snapshot</p>
								<h2>当前配置</h2>
							</div>
						</div>
						<div className="output-content compact-output" id="imageConfigPreview">
							<div className="empty-state">
								<p>标签和补充信息会汇总在这里。</p>
							</div>
						</div>
					</div>
				</section>

				<section className="history-panel" aria-labelledby="image-history-title">
					<div className="panel-header">
						<div>
							<p className="panel-kicker">Archive</p>
							<h2 id="image-history-title">图片历史记录</h2>
						</div>
						<button className="btn-secondary compact-btn" onClick={() => window.clearImageHistory?.()}>
							清空历史
						</button>
					</div>
					<div className="history-toolbar">
						<input id="imageHistorySearch" type="search" placeholder="搜索图片历史记录..." onInput={() => window.updateImageHistoryDisplay?.()} />
					</div>
					<div className="history-list" id="imageHistoryList">
						<div className="empty-state">
							<p>暂无图片历史记录</p>
						</div>
					</div>
				</section>
			</div>
			<Script src="/image-prompt.js" strategy="afterInteractive" />
		</>
	);
}
