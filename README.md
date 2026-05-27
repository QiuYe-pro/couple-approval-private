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

创建一个 Vercel KV 数据库后，将其环境变量绑定到项目（Vercel 通常会自动帮你注入 `KV_*` 变量；如果没有，需要把 KV 的环境变量全部加到本项目）。

## 入口

部署后访问根路径 `/` 会自动跳转到 `/couple/index.html`。

## 使用方式

- 未登录：页面右上角显示“未登录（只读）”，不能提交/审批
- 登录：点右上角“登录”，输入用户名/密码后即可操作
