#!/bin/bash

# 验证码接收系统 Docker 部署脚本

echo "🐳 开始部署验证码接收系统到Docker..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 检查docker-compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose未安装，请先安装docker-compose"
    exit 1
fi

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose down

# 构建镜像
echo "🔨 构建Docker镜像..."
docker-compose build

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

# 检查服务状态
echo "📊 检查服务状态..."
sleep 10
docker-compose ps

# 显示日志
echo "📝 显示最近日志..."
docker-compose logs --tail=20

echo "✅ 部署完成！"
echo "🌐 访问地址: http://localhost:3000"
echo "📊 查看日志: docker-compose logs -f"
echo "🛑 停止服务: docker-compose down"
