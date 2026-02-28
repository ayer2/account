# 阿里云服务器部署指南

## 服务器配置要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Ubuntu 20.04+ / CentOS 8+ |
| Node.js | 18.x 或更高 |
| PostgreSQL | 14.x 或更高 |
| 内存 | 至少 2GB |
| 带宽 | 1Mbps 以上 |

---

## 一、环境准备

### 1.1 连接服务器

使用 SSH 连接您的阿里云服务器：

```bash
ssh root@您的服务器IP
```

### 1.2 更新系统

```bash
# Ubuntu / Debian
apt update && apt upgrade -y

# CentOS
yum update -y
```

---

## 二、安装 Node.js

### 2.1 安装 Node.js 18.x

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs
```

### 2.2 验证安装

```bash
node -v
npm -v
```

---

## 三、安装 PostgreSQL

### 3.1 安装 PostgreSQL

```bash
# Ubuntu
apt install -y postgresql postgresql-contrib

# 启动服务
systemctl start postgresql
systemctl enable postgresql
```

### 3.2 配置数据库

```bash
# 切换到 postgres 用户
su - postgres

# 创建数据库
createdb accounting

# 创建用户（请修改密码）
psql -c "CREATE USER accountinguser WITH PASSWORD '您的密码';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE accounting TO accountinguser;"
psql -c "ALTER USER accountinguser WITH SUPERUSER;"

# 退出
exit
```

### 3.3 配置远程连接

```bash
# 编辑 PostgreSQL 配置
nano /etc/postgresql/14/main/postgresql.conf

# 修改监听地址
listen_addresses = '*'

# 编辑访问控制
nano /etc/postgresql/14/main/pg_hba.conf

# 添加允许访问的 IP（根据您的需求修改）
host    all             all             0.0.0.0/0               md5

# 重启服务
systemctl restart postgresql
```

---

## 四、部署后端代码

### 4.1 安装 Git 和克隆代码

```bash
apt install -y git

# 克隆项目（如果还没有）
git clone https://github.com/您的用户名/account.git
# 或者上传您的项目文件夹
```

### 4.2 安装依赖

```bash
cd account/apps/server
npm install
```

### 4.3 配置环境变量

```bash
# 创建 .env 文件
nano .env

# 添加以下内容（请修改对应值）
DATABASE_URL=postgresql://accountinguser:您的密码@localhost:5432/accounting
JWT_SECRET=您的JWT密钥（随机字符串）
PORT=3000
NODE_ENV=production
```

### 4.4 运行数据库迁移

```bash
npm run migrate
```

### 4.5 使用 PM2 启动服务

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start npm --name "accounting-server" -- run start

# 设置开机自启
pm2 startup
pm2 save
```

### 4.6 配置防火墙（阿里云安全组）

在阿里云控制台添加安全组规则：

| 协议 | 端口 | 说明 |
|------|------|------|
| TCP | 3000 | 后端 API |
| TCP | 5432 | PostgreSQL（可选，建议禁止） |

---

## 五、验证部署

### 5.1 测试 API

```bash
curl http://localhost:3000/api/health
```

### 5.2 测试外网访问

```bash
curl http://您的服务器IP:3000/api/health
```

---

## 六、常见问题

### Q1: 数据库连接失败

检查 .env 中的 DATABASE_URL 是否正确，确认 PostgreSQL 服务是否运行。

### Q2: 端口被占用

```bash
# 查看端口占用
lsof -i:3000
# 杀死占用进程
kill -9 <PID>
```

### Q3: PM2 相关命令

```bash
# 查看日志
pm2 logs

# 重启服务
pm2 restart accounting-server

# 查看状态
pm2 status
```

---

## 七、后续更新

### 更新后端代码

```bash
cd /您的项目目录
git pull
cd apps/server
npm install
pm2 restart accounting-server
```

---

## 联系支持

如有问题，请检查：
1. 安全组是否开放了 3000 端口
2. 数据库连接是否正确
3. Node.js 和 PostgreSQL 服务是否正常运行
