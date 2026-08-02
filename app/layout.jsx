import '../tokens.css';
import '../styles.css';

export const metadata = {
	title: 'Better Prompt',
	description: '本地优先的提示词优化工作台',
};

export default function RootLayout({ children }) {
	return (
		<html lang="zh-CN">
			<body>{children}</body>
		</html>
	);
}
