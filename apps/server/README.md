# 个人记账助手 - API 服务

## 环境变量配置

在部署前，需要设置以下环境变量：

```bash
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=accounting
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 前端地址（用于CORS）
FRONTEND_URL=http://localhost:5173
```

## 开发环境启动

```bash
# 安装依赖
npm install

# 初始化数据库
npm run db:migrate

# 启动开发服务器
npm run dev
```

## API 接口文档

### 认证接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/me | 获取当前用户信息 |

### 账户接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/accounts | 获取所有账户 |
| POST | /api/accounts | 创建账户 |
| GET | /api/accounts/:id | 获取单个账户 |
| PUT | /api/accounts/:id | 更新账户 |
| DELETE | /api/accounts/:id | 删除账户 |

### 分类接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/categories | 获取所有分类 |
| POST | /api/categories | 创建分类 |
| GET | /api/categories/:id | 获取单个分类 |
| PUT | /api/categories/:id | 更新分类 |
| DELETE | /api/categories/:id | 删除分类 |

### 交易接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/transactions | 获取交易列表 |
| POST | /api/transactions | 创建交易 |
| GET | /api/transactions/:id | 获取单个交易 |
| PUT | /api/transactions/:id | 更新交易 |
| DELETE | /api/transactions/:id | 删除交易 |

### 设置接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/settings | 获取用户设置 |
| PUT | /api/settings | 更新用户设置 |

### 数据导入导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/export | 导出所有数据 |
| POST | /api/import | 导入数据 |

## 认证说明

除注册/登录接口外，所有接口需要在请求头中携带JWT Token：

```
Authorization: Bearer <token>
```
