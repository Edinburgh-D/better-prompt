import os

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI

app = Flask(__name__)
CORS(app)


def error_response(code, message, status_code):
    return jsonify({"error": {"code": code, "message": message}}), status_code


@app.route("/")
@app.route("/index.html")
def index():
    return send_from_directory(".", "index.html")


@app.route("/text-prompt.html")
def text_prompt():
    return send_from_directory(".", "text-prompt.html")


@app.route("/styles.css")
def styles():
    return send_from_directory(".", "styles.css")


@app.route("/tokens.css")
def tokens():
    return send_from_directory(".", "tokens.css")


@app.route("/app.js")
def app_js():
    return send_from_directory(".", "app.js")


@app.route("/image-prompt.html")
def image_prompt():
    return send_from_directory(".", "image-prompt.html")


@app.route("/image-prompt.js")
def image_prompt_js():
    return send_from_directory(".", "image-prompt.js")


@app.route("/api/optimize", methods=["POST"])
def optimize():
    try:
        if not os.environ.get("DEEPSEEK_API_KEY"):
            return error_response(
                "MISSING_API_KEY",
                "未配置 DEEPSEEK_API_KEY，请先设置环境变量或使用 start.bat 启动。",
                500,
            )

        data = request.get_json(silent=True) or {}
        messages = data.get("messages")

        if not isinstance(messages, list) or not messages:
            return error_response(
                "INVALID_REQUEST",
                "请求参数无效：messages 必须是非空数组。",
                400,
            )

        client = OpenAI(
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url="https://api.deepseek.com",
            timeout=60,
        )

        response = client.chat.completions.create(
            model="deepseek-v4-pro",
            messages=messages,
            stream=False,
            reasoning_effort="high",
            extra_body={"thinking": {"type": "enabled"}},
        )

        return jsonify(response.model_dump())

    except APITimeoutError:
        return error_response(
            "UPSTREAM_TIMEOUT",
            "DeepSeek 接口响应超时，请稍后重试。",
            504,
        )
    except APIConnectionError:
        return error_response(
            "UPSTREAM_ERROR",
            "无法连接 DeepSeek 接口，请检查网络连接或代理设置。",
            502,
        )
    except APIStatusError as e:
        return error_response(
            "UPSTREAM_ERROR",
            f"DeepSeek 接口返回异常状态：{e.status_code}。",
            502,
        )
    except Exception as e:
        return error_response(
            "UNKNOWN_ERROR",
            f"服务处理请求时出现未知错误：{str(e)}",
            500,
        )


if __name__ == "__main__":
    print("=" * 50)
    print("Better Prompt 本地代理服务器")
    print("=" * 50)
    print("服务地址: http://localhost:5000")
    print("请在浏览器中打开 http://localhost:5000 使用")
    print("按 Ctrl+C 停止服务器")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
