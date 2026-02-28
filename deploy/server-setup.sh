#!/bin/bash

# 个人记账助手 - 服务器部署脚本
# 适用于 Ubuntu 20.04+ / Debian 10+

set -e

echo "========================================"
echo "  个人记账助手 - 服务器部署脚本"
echo "========================================"

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
  echo "请使用 root 用户运行此脚本"
  exit 1
fi

# 更新系统
echo "[1/6] 更新系统包..."
apt update && apt upgrade -y

# 安装 Node.js 20.x
echo "[2/6] 安装 Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 安装 PostgreSQL 16
echo "[3/6] 安装 PostgreSQL 16..."
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | tee /etc/apt/sources.list.d/pgresql.list
apt update
apt install -y postgresql-16

# 配置 PostgreSQL
echo "[4/6] 配置 PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

# 创建数据库和用户
sudo -u postgres psql -c "CREATE DATABASE accounting;" || true
sudo -u postgres psql -c "CREATE USER dbuser WITH PASSWORD 'your_secure_password';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE accounting TO dbuser;" || true
sudo -u postgres psql -d accounting -c "GRANT ALL ON SCHEMA public TO dbuser;" || true

# 安装 Nginx
echo "[5/6] 安装 Nginx..."
apt install -y nginx

# 配置防火墙
echo "[6/6] 配置防火墙..."
apt install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "========================================"
echo "  环境配置完成!"
echo "========================================"
echo ""
echo "请执行以下步骤:"
echo ""
echo "1. 复制项目到服务器:"
echo "   git clone <your-repo-url> /var/www/accounting"
echo ""
echo "2. 配置环境变量:"
echo "   cd /var/www/accounting/apps/server"
echo "   cp .env.example .env"
echo "   nano .env"
echo ""
echo "3. 安装依赖并初始化数据库:"
echo "   npm install"
echo "   npm run db:migrate"
echo ""
echo "4. 配置 Nginx (参考以下配置)"
echo ""
echo "5. 使用 PM2 启动服务:"
echo "   npm install -g pm2"
echo "   pm2 start npm --name \"accounting-server\" -- run dev"
echo "   pm2 startup"
echo ""
echo "========================================"
