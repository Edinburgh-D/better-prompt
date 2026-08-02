export const runtime = 'edge';

const JSON_HEADERS = {
	'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(payload, status = 200) {
	return Response.json(payload, {
		status,
		headers: JSON_HEADERS,
	});
}

function errorResponse(code, message, status) {
	return jsonResponse({ error: { code, message } }, status);
}

async function callDeepSeek(messages) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 60000);

	try {
		return await fetch('https://api.deepseek.com/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'deepseek-v4-pro',
				messages,
				stream: false,
				reasoning_effort: 'high',
				thinking: { type: 'enabled' },
			}),
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function POST(request) {
	if (!process.env.DEEPSEEK_API_KEY) {
		return errorResponse(
			'MISSING_API_KEY',
			'未配置 DEEPSEEK_API_KEY，请在部署环境变量中设置。',
			500
		);
	}

	let data;
	try {
		data = await request.json();
	} catch {
		return errorResponse('INVALID_JSON', '请求体不是有效 JSON。', 400);
	}

	const { messages } = data || {};
	if (!Array.isArray(messages) || messages.length === 0) {
		return errorResponse(
			'INVALID_REQUEST',
			'请求参数无效：messages 必须是非空数组。',
			400
		);
	}

	try {
		const upstream = await callDeepSeek(messages);
		const text = await upstream.text();

		if (!upstream.ok) {
			return errorResponse(
				'UPSTREAM_ERROR',
				`DeepSeek 接口返回异常状态：${upstream.status}。`,
				502
			);
		}

		return new Response(text, {
			status: 200,
			headers: JSON_HEADERS,
		});
	} catch {
		return errorResponse(
			'UPSTREAM_ERROR',
			'无法连接 DeepSeek 接口或请求超时，请稍后重试。',
			502
		);
	}
}

export async function GET() {
	return errorResponse('METHOD_NOT_ALLOWED', '只支持 POST 请求。', 405);
}
