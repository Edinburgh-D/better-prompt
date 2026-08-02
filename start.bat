@echo off
chcp 65001 >nul
echo ====================================
echo Better Prompt - 本地启动脚本
echo ====================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.7+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

if "%DEEPSEEK_API_KEY%"=="" (
    echo [错误] 未检测到 DEEPSEEK_API_KEY 环境变量。
    echo.
    echo 请先在当前命令行设置:
    echo set DEEPSEEK_API_KEY=你的 DeepSeek API Key
    echo.
    echo 或在 Windows 系统环境变量中长期配置 DEEPSEEK_API_KEY。
    pause
    exit /b 1
)

echo [1/3] 检测 Python 环境...
python --version

echo.
echo [2/3] 安装依赖包...
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

echo.
echo [3/3] 启动代理服务器...
echo.
echo ====================================
echo 服务启动后，请在浏览器中打开:
echo http://localhost:5000
echo ====================================
echo.
python server.py

pause
