export default function HomePage() {
	return (
		<div className="app-shell home-shell">
			<header className="workspace-header home-header">
				<div className="brand-block">
					<a className="brand-mark" href="/" aria-label="Better Prompt 首页">
						BP
					</a>
					<div>
						<p className="eyebrow">Better Prompt</p>
						<h1>把模糊想法变成可用指令</h1>
					</div>
				</div>
				<nav className="top-nav" aria-label="页面导航">
					<a className="nav-link active" href="/">
						首页
					</a>
					<a className="nav-link" href="/text">
						文本
					</a>
					<a className="nav-link" href="/image">
						图片
					</a>
				</nav>
			</header>

			<main className="home-grid">
				<section className="home-intro" aria-labelledby="home-title">
					<p className="eyebrow">Local-first prompt optimizer</p>
					<h2 id="home-title">先整理任务，再交给模型。</h2>
					<p>
						Better Prompt 面向日常用户，不要求懂提示词工程。你只需要写下原始想法，
						工具会帮你补齐目标、对象、格式、限制和可执行步骤，让 AI 更容易给出稳定结果。
					</p>
					<div className="home-actions">
						<a className="btn-primary home-cta" href="/text">
							开始文本优化
						</a>
						<a className="btn-secondary home-cta" href="/image">
							进入图片优化
						</a>
					</div>
				</section>

				<aside className="home-note" aria-label="部署状态">
					<p className="panel-kicker">Next runtime</p>
					<h3>接口迁入 Next.js</h3>
					<p>
						页面和 API Route 放在同一个 Next 应用里，后续接入账号、个人数据和云端历史会更顺。
					</p>
				</aside>
			</main>

			<section className="home-entry-grid" aria-label="功能入口">
				<a className="entry-card entry-card-primary" href="/text">
					<span className="entry-index">01</span>
					<div>
						<p className="panel-kicker">Text</p>
						<h2>文本提示词优化</h2>
						<p>
							适合邮件、公众号、小红书、朋友圈、产品介绍和学习提问。把一句松散需求整理成可直接复制的完整提示词。
						</p>
					</div>
					<span className="entry-link">进入</span>
				</a>

				<a className="entry-card" href="/image">
					<span className="entry-index">02</span>
					<div>
						<p className="panel-kicker">Image</p>
						<h2>图片提示词优化</h2>
						<p>
							通过主体、光影、环境、构图、风格和清晰度标签，把画面想法拆成更可控的图像生成提示词。
						</p>
					</div>
					<span className="entry-link">进入</span>
				</a>

				<div className="entry-card entry-card-disabled" aria-disabled="true">
					<span className="entry-index">03</span>
					<div>
						<p className="panel-kicker">Data</p>
						<h2>个人数据中心</h2>
						<p>
							预留给后续的个人历史、收藏提示词、使用统计和账号设置。当前历史仍保存在浏览器本地。
						</p>
					</div>
					<span className="entry-link">规划中</span>
				</div>
			</section>

			<section className="home-flow" aria-labelledby="flow-title">
				<div>
					<p className="panel-kicker">How it works</p>
					<h2 id="flow-title">不是替你写一段漂亮话，而是补齐任务信息。</h2>
				</div>
				<div className="flow-list">
					<div>
						<strong>识别意图</strong>
						<p>判断你真正想完成什么，以及缺少哪些背景。</p>
					</div>
					<div>
						<strong>补齐约束</strong>
						<p>把对象、格式、语气、长度和边界条件写清楚。</p>
					</div>
					<div>
						<strong>生成成品</strong>
						<p>输出可复制的优化提示词，并保留本地历史。</p>
					</div>
				</div>
			</section>
		</div>
	);
}
