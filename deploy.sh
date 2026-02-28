#!/bin/bash

echo "========================================"
echo "  个人记账助手 - 一键部署脚本"
echo "  适用于 Alibaba Cloud Linux / CentOS / RHEL"
echo "========================================"

# 1. 安装 Node.js
echo "[1/6] 安装 Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# 2. 安装 PostgreSQL
echo "[2/6] 安装 PostgreSQL..."
yum install -y postgresql-server postgresql-contrib

# 初始化数据库
postgresql-setup initdb

# 启动服务
systemctl start postgresql
systemctl enable postgresql

# 3. 配置数据库
echo "[3/6] 配置数据库..."
su - postgres -c "createdb accounting" 2>/dev/null || true
su - postgres -c "psql -c \"CREATE USER accountinguser WITH PASSWORD 'accounting2024';\"" 2>/dev/null || true
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE accounting TO accountinguser;\"" 2>/dev/null || true
su - postgres -c "psql -c \"ALTER USER accountinguser WITH SUPERUSER;\"" 2>/dev/null || true

# 4. 配置 PostgreSQL 允许远程连接
echo "[4/6] 配置 PostgreSQL..."
PG_CONF="/var/lib/pgsql/data/postgresql.conf"
if [ -f "$PG_CONF" ]; then
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
fi

# 配置访问控制
PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
if [ -f "$PG_HBA" ]; then
    echo "host    all             all             0.0.0.0/0               md5" >> "$PG_HBA"
    echo "host    all             all             ::0/0                   md5" >> "$PG_HBA"
fi

# 重启服务
systemctl restart postgresql

# 5. 安装 Git（如果没有）
echo "[5/6] 安装 Git..."
yum install -y git

# 6. 部署后端代码
echo "[6/6] 部署后端代码..."

# 检查项目目录
if [ ! -d "/project/account" ]; then
    echo ""
    echo "========================================"
    echo "  错误: 未找到项目目录 /project/account"
    echo "========================================"
    echo "请先将项目文件上传到服务器"
    exit 1
fi

# 安装 PM2
npm install -g pm2

# 进入后端目录并安装依赖
cd /project/account/apps/server

# 创建 .env 文件
cat > .env << EOF
DATABASE_URL=postgresql://accountinguser:accounting2024@localhost:5432/accounting
JWT_SECRET=$(openssl rand -base64 32)
PORT=3000
NODE_ENV=production
EOF

# 安装依赖
npm install

# 运行迁移
npm run migrate

# 使用 PM2 启动
pm2 start npm --name "accounting-server" -- run start
pm2 save

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "API 地址: http://您的服务器IP:3000"
echo ""
echo "常用命令:"
echo "  查看日志: pm2 logs"
echo "  重启服务: pm2 restart accounting-server"
echo "  查看状态: pm2 status"
