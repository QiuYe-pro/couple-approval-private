# 公网部署（未登录只读 / 登录可写）

这是一个可部署到 Vercel 的站点：

- **任何人打开网址都能查看（只读）**
- 只有登录了 “秋叶 / Yael” 账号的人，才可以提交/审批/修改
- 数据存储在 Vercel KV（云端共享，不再是 localStorage）

## 必需环境变量

在 Vercel 项目 Settings → Environment Variables 添加：

### 登录账号（必须）

- `USER_A_USERNAME`：秋叶用户名（默认建议 `qiuyue`）
- `USER_A_PASSWORD`：秋叶密码（必须设置，建议强密码）
- `USER_B_USERNAME`：Yael 用户名（默认建议 `yael`）
- `USER_B_PASSWORD`：Yael 密码（必须设置，建议强密码）

### Vercel KV（必须）

### Redis（必须，Upstash）

`@vercel/kv` 已弃用，本项目改用 **Upstash Redis（REST）**。

在 Vercel → Marketplace 安装并绑定一个 Redis（Upstash）后，给项目注入下面两个环境变量：

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## 入口

部署后访问根路径 `/` 会自动跳转到 `/couple/index.html`。

## 使用方式

- 未登录：页面右上角显示“未登录（只读）”，不能提交/审批
- 登录：点右上角“登录”，输入用户名/密码后即可操作
