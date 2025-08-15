@echo off
chcp 65001 >nul

echo 🐳 开始部署验证码接收系统到Docker...

REM 检查Docker是否安装
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker未安装，请先安装Docker Desktop
    pause
    exit /b 1
)

REM 检查docker-compose是否安装
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ docker-compose未安装，请先安装docker-compose
    pause
    exit /b 1
)

REM 停止现有容器
echo 🛑 停止现有容器...
docker-compose down

REM 构建镜像
echo 🔨 构建Docker镜像...
docker-compose build

REM 启动服务
echo 🚀 启动服务...
docker-compose up -d

REM 检查服务状态
echo 📊 检查服务状态...
timeout /t 10 /nobreak >nul
docker-compose ps

REM 显示日志
echo 📝 显示最近日志...
docker-compose logs --tail=20

echo ✅ 部署完成！
echo 🌐 访问地址: http://localhost:3000
echo 📊 查看日志: docker-compose logs -f
echo 🛑 停止服务: docker-compose down
pause
