const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

const JSON_HEADERS = {
	...CORS_HEADERS,
	'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: JSON_HEADERS,
	});
}

function errorResponse(code, message, status) {
	return jsonResponse({ error: { code, message } }, status);
}

async function readJson(request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

async function callDeepSeek(messages, env) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 60000);

	try {
		return await fetch('https://api.deepseek.com/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
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

async function handlePost(request, env) {
	if (!env.DEEPSEEK_API_KEY) {
		return errorResponse(
			'MISSING_API_KEY',
			'未配置 DEEPSEEK_API_KEY，请在 Cloudflare Pages 环境变量中设置。',
			500
		);
	}

	const data = await readJson(request);
	if (!data) {
		return errorResponse('INVALID_JSON', '请求体不是有效 JSON。', 400);
	}

	const { messages } = data;
	if (!Array.isArray(messages) || messages.length === 0) {
		return errorResponse(
			'INVALID_REQUEST',
			'请求参数无效：messages 必须是非空数组。',
			400
		);
	}

	try {
		const upstream = await callDeepSeek(messages, env);
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

export async function onRequest({ request, env }) {
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: CORS_HEADERS,
		});
	}

	if (request.method === 'POST') {
		return handlePost(request, env);
	}

	return errorResponse('METHOD_NOT_ALLOWED', '只支持 POST 请求。', 405);
}
