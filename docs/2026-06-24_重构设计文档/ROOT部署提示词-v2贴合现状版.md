# Root 部署提示词 v2（贴合服务器现状版）

> **用途**：把下方"===== 提示词正文 ====="之间的全部内容复制，粘贴到服务器 root 的 ZCode 对话窗口执行。
> **服务器**：216.36.124.98，Ubuntu 24.04，2核2G（+2G Swap）/40G
> **仓库**：https://github.com/yfilwzy/simprint-chain
> **修订说明**：本版基于服务器真实运维手册重写，修正了"装 Nginx/certbot/系统级 PostgreSQL"等错误假设，改用现有 Caddy + Docker 体系。

---

## 你（用户）发提示词前必须先做的两件事

**① 加 DNS A 记录（在 DNSHE 平台操作，zcode 代不了）**
- 主机记录：`simprint`
- 类型：`A`
- 值：`216.36.124.98`
- 等待 DNS 生效（可用 `nslookup simprint.yfilwzy.cc.cd` 验证能解析到 IP）

**② 准备 2 个值（zcode 执行时会问你）**
- `<YOUR_DB_PASSWORD>`：PostgreSQL 数据库密码（建议生成 32 位随机强密码）
- `<YOUR_API_SECRET>`：应用层鉴权密钥（建议生成 20 位随机字符串）

域名 `yfilwzy.cc.cd` 已有，Caddy 自动管证书，所以不用问域名和邮箱。

---

## ===== 提示词正文 =====

你是 root 用户，在一台**已在运行生产服务**的 Ubuntu 24.04 服务器（IP 216.36.124.98，2核2G物理内存+2G Swap/40G）上，**新增部署** Simprint 桌面应用的**自托管后端服务器**。

## ⚠️ 服务器现状（必须先理解，避免破坏现有服务）

这台服务器**已在跑生产业务**，当前架构：
- **反代**：Caddy（已运行，自动管理 Let's Encrypt 证书，**不要再装 Nginx/certbot**）
- **容器**：Docker v29.6.0 + Compose v5.2.0（已就绪）
- **现有服务**（全部 Docker 化，监听 127.0.0.1）：
  - new-api（AI 网关）：127.0.0.1:3000，内存限 700MB
  - new-api-redis：内部 6379，内存限 160MB
  - gpt-image-playground：127.0.0.1:8088，内存限 128MB
- **安全加固已完成**：UFW（仅 22/80/443）+ fail2ban + SSH + HTTPS（HSTS）—— **Phase 0 安全加固不要重复做**
- **域名**：`yfilwzy.cc.cd`（DNSHE 免费域名），已解析子域 `api.yfilwzy.cc.cd`
- **内存红线**：物理 1.9G 已用约 1.3G，**本次新增部署总内存必须控制在 500MB 以内**，超出立即停下报告，靠 2G Swap 兜底但不可长期吃 Swap

## 设计依据（在公开仓库，遇到规格疑问去拉取，不要猜）

仓库 https://github.com/yfilwzy/simprint-chain ：
- `docs/2026-06-24_重构设计文档/03-登录指向自建服务器.md` —— 加密协议完整规格、服务端端点、数据库 Schema
- `server/db/schema.sql` —— PostgreSQL 建表脚本（直接用）
- `server/go-server/` —— Go 服务端骨架（config/crypto/handlers/main，**crypto 和 handlers 是 TODO stub，你必须填充**）
- `src-tauri/src/infrastructure/http/encryption/rsa.rs` 和 `aes.rs` —— **客户端加密实现，必须读这两个文件确认 RSA padding（OAEP vs PKCS1v15），这是最高风险点，padding 错客户端解密必失败**

## 前置确认（执行 Phase 前必须核对）

执行前必须确认以下 3 项，任何一项不满足则 BLOCKED 停下询问用户：
1. DNS：`nslookup simprint.yfilwzy.cc.cd` 能解析到 216.36.124.98（用户需已在 DNSHE 加 A 记录）
2. 用户提供的 `<YOUR_DB_PASSWORD>`（数据库密码）
3. 用户提供的 `<YOUR_API_SECRET>`（应用层鉴权密钥）

## Phase 1：拉取项目规格 + 读加密协议

```bash
cd /opt
git clone https://github.com/yfilwzy/simprint-chain.git
```

**必读文件**（用 cat 读取理解，不要盲跑）：
```bash
cat /opt/simprint-chain/docs/2026-06-24_重构设计文档/03-登录指向自建服务器.md
cat /opt/simprint-chain/server/db/schema.sql
cat /opt/simprint-chain/server/go-server/crypto.go
cat /opt/simprint-chain/server/go-server/handlers.go
# 最关键：读客户端加密实现确认 RSA padding
cat /opt/simprint-chain/src-tauri/src/infrastructure/http/encryption/rsa.rs
cat /opt/simprint-chain/src-tauri/src/infrastructure/http/encryption/aes.rs
```

读完后报告：RSA padding 是 OAEP 还是 PKCS1v15？AES 是 AES-256-GCM nonce 12字节？把结论写进 crypto.go 的实现。

## Phase 2：PostgreSQL（Docker 化，复用 schema.sql，严格内存限制）

新建 `/opt/simprint/docker-compose.yml`，把 PostgreSQL 和 Go 服务一起编排（Go 服务在 Phase 3 填充后加入）：

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: simprint-postgres
    restart: always
    ports:
      - "127.0.0.1:5433:5432"      # 用 5433 避免与可能存在的本地 PG 冲突
    environment:
      POSTGRES_USER: simprint_user
      POSTGRES_PASSWORD: <YOUR_DB_PASSWORD>
      POSTGRES_DB: simprint_db
    volumes:
      - /opt/simprint/pg-data:/var/lib/postgresql/data
      - /opt/simprint-chain/server/db/schema.sql:/docker-entrypoint-initdb.d/schema.sql:ro
    mem_limit: 300m
    command: >
      postgres
      -c shared_buffers=48MB
      -c work_mem=2MB
      -c max_connections=50
```

启动 PostgreSQL 并建表：
```bash
mkdir -p /opt/simprint/pg-data
cd /opt/simprint
# 先只起 postgres（Go 服务 Phase 3 加）
docker compose up -d postgres
# 等待健康
sleep 10
docker exec simprint-postgres pg_isready -U simprint_user -d simprint_db
# 验证建表（schema.sql 在 entrypoint 自动执行）
docker exec simprint-postgres psql -U simprint_user -d simprint_db -c "\dt"
# 应列出 9 张表：users/sessions/referral_codes/environments/proxies/groups/tags/workspaces/browser_kernels
```

报告：表数量是否为 9？内存占用 `docker stats simprint-postgres --no-stream` 是否 < 300MB？

## Phase 3：填充 Go 服务端 + Docker 化部署

骨架代码在 `/opt/simprint-chain/server/go-server/`，`crypto.go` 和 `handlers.go` 是 TODO stub。

### 3.1 填充 crypto.go
严格按 Phase 1 读到的 RSA padding + 03 文档第二节时序实现：
- `DecryptRequest`：RSA 私钥解密 AES 密钥 → AES-256-GCM 解密 body（nonce=前12字节）→ 返回明文 map
- `EncryptResponse`：随机 AES 密钥 → AES-GCM 加密 → 用客户端公钥 RSA 加密 AES 密钥 → 返回 EncryptedBody
- `GenerateRSAKeyPair`：生成 RSA-2048 并 PKCS1 PEM 持久化到 `/etc/simprint/keys/`（容器内挂载）

### 3.2 填充 handlers.go
按 03 文档第三节端点格式实现（每个 handler 注释里已写清请求/响应字段）：
- `GetPublicKey`：返回服务端 RSA 公钥 PEM（不加密）
- `Login`：解密→校验 api_secret→查 users→bcrypt 校验→签发 token 写 sessions→加密响应
- `Register`：解密→校验 api_secret→邮箱唯一性→bcrypt 落库→邀请码核销→签发 token
- `RefreshCredentials`：校验 refresh_token→轮换 token
- `LocalApiProxy`：鉴权→操作对应资源表
- `CheckVersion` / `GetLatestJson` / `GetRuntimeLatestJson`：返回更新清单

数据库连接用 `database/sql` + `lib/pq` 或 `pgx`（在 go.mod 加依赖）。

### 3.3 编写 Dockerfile
新建 `/opt/simprint-chain/server/go-server/Dockerfile`：
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o simprint-server .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/simprint-server .
EXPOSE 8080
CMD ["./simprint-server"]
```

### 3.4 把 Go 服务加入 docker-compose
更新 `/opt/simprint/docker-compose.yml` 追加：
```yaml
  server:
    build: /opt/simprint-chain/server/go-server
    container_name: simprint-server
    restart: always
    ports:
      - "127.0.0.1:8090:8080"      # 用 8090，避免与 gpt-image-playground(8088) 冲突
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: simprint_user
      DB_PASSWORD: <YOUR_DB_PASSWORD>
      DB_NAME: simprint_db
      API_SECRET: <YOUR_API_SECRET>
      SERVER_PORT: 8080
    depends_on:
      - postgres
    mem_limit: 200m
```

注意：Go 容器连 PG 用容器名 `postgres`（compose 内网），端口 5432（容器内部），不是宿主 5433。

### 3.5 编译启动
```bash
cd /opt/simprint
docker compose up -d --build
docker compose ps
docker logs simprint-server --tail 50
```

报告：Go 服务是否启动成功监听 8080？`curl http://127.0.0.1:8090/health` 是否返回 `{"status":"ok"}`？`curl http://127.0.0.1:8090/api/v1/secret/public/key` 是否返回公钥 PEM？

## Phase 4：Caddy 加 simprint 子域反代（不装 Nginx）

编辑 `/etc/caddy/Caddyfile`，在现有 `api.yfilwzy.cc.cd` 块**之后**追加新块：

```caddy
simprint.yfilwzy.cc.cd {
    request_body { max_size 256MB }

    # 客户端主 API
    handle /api/* {
        reverse_proxy 127.0.0.1:8090
    }

    # 更新服务
    handle /update/* {
        reverse_proxy 127.0.0.1:8090
    }

    # 兜底
    handle {
        respond "Not Found" 404
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
    encode gzip zstd
    log {
        output file /var/log/caddy/simprint.log
    }
}
```

验证并重载（不中断现有服务）：
```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
# Caddy 会自动给 simprint.yfilwzy.cc.cd 签 Let's Encrypt 证书（需 DNS A 记录已生效）
```

报告：Caddy validate 是否通过？reload 是否成功？`curl -I https://simprint.yfilwzy.cc.cd/api/v1/secret/public/key` 是否 200 + 返回公钥（证书自动签发可能需 30 秒，重试几次）？

## Phase 5：验证（全部通过才算部署成功）

```bash
# 1. 公钥端点（HTTPS + 证书）
curl -s https://simprint.yfilwzy.cc.cd/api/v1/secret/public/key | head -c 100
# 预期：{"public_key":"-----BEGIN RSA PUBLIC KEY-----

# 2. 健康检查
curl -s https://simprint.yfilwzy.cc.cd/api/v1/secret/public/key  # 不应 502
docker compose -f /opt/simprint/docker-compose.yml ps

# 3. TLS 证书有效
curl -vI https://simprint.yfilwzy.cc.cd/ 2>&1 | grep -E "SSL|expire|subject"

# 4. 数据库连通 + 表数量
docker exec simprint-postgres psql -U simprint_user -d simprint_db -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# 预期：9

# 5. 内存红线核验（最关键）
free -h
docker stats --no-stream
# 核验：simprint-postgres < 300MB，simprint-server < 200MB，物理内存使用未超 1.8G
```

报告：5 项是否全通过？内存是否在红线内？

## Phase 6：输出客户端配置 + 更新运维手册

### 6.1 输出客户端 config.production.toml
```toml
[server]
base_url = "https://simprint.yfilwzy.cc.cd/api/"
version = "v1"
secret_key = "<YOUR_API_SECRET>"

[updater]
check_url = "https://simprint.yfilwzy.cc.cd/update/api/v1/versions/check"
latest_json_url = "https://simprint.yfilwzy.cc.cd/update/latest.json"
runtime_latest_json_url = "https://simprint.yfilwzy.cc.cd/update/simprint-runtime/latest.json"
updater_temp_dir = "updates"

[webview]
downlaod_url = "https://simprint.yfilwzy.cc.cd/update/webview-fixed.zip"
```
把这份配置输出给用户（用户会填到客户端 `src-tauri/config.production.toml` 后重新编译）。

### 6.2 追加到运维手册
把本次部署的关键信息（目录 /opt/simprint/、compose 配置、simprint.yfilwzy.cc.cd、端口 8090/5433、内存限额）追加到 `/root/服务器运维手册.md` 或独立成 `/root/simprint-deploy.md`，便于日后维护。

## 执行规则

- 每 Phase 完成 report `Status(DONE|DONE_WITH_CONCERNS|BLOCKED)` + 关键输出，失败立即停下
- **绝不破坏现有服务**：new-api/redis/image 一个都不准动，Caddy reload 前必须 validate
- **内存红线**：新增总内存 < 500MB，监控 `docker stats`，超出停下报告
- 密码/密钥不 echo 明文到日志（用 *** 占位）
- crypto.go 的 RSA padding 必须与客户端 rsa.rs 一致，不一致停下报告
- 全程用 docker-compose 管控，不用裸 systemd（与现有体系一致）

## ===== 提示词正文结束 =====

---

## 发送后的预期流程

1. 你复制正文粘贴到 root zcode
2. zcode 先核对 DNS（你若没加 A 记录，它会 BLOCKED 停下提示你）
3. zcode 问你 DB密码 + API密钥，你提供
4. zcode 自动执行 Phase 1-6，每步报告
5. zcode 在 Phase 3 填充 Go 服务端 TODO 时耗时最长（这是真实编码工作）
6. 完成后 zcode 输出客户端 config.production.toml，你填回客户端重新编译

## 关键提醒

- **DNS A 记录是你唯一必须手动做的**（在 DNSHE 平台加 `simprint` A 记录指向 216.36.124.98），zcode 代不了
- 加密协议的 RSA padding 是最高风险点，提示词已让 zcode 读客户端 rsa.rs 确认，但它若报告 padding 不确定，你需要让本小姐（在客户端这边）核实 rsa.rs 的实际 padding
