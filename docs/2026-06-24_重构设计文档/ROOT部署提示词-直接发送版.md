# Root 部署提示词（直接复制发送版）

> 用途：把下方"===== 提示词正文 ====="之间的全部内容复制，粘贴到服务器 root 的 ZCode 对话窗口执行。
> 服务器：216.36.124.98，Ubuntu 24.04，2核2G/40G
> 仓库：https://github.com/yfilwzy/simprint-chain

---

## ===== 提示词正文 =====

你是 root 用户，在一台 Ubuntu 24.04 服务器（IP 216.36.124.98，2核2G/40G/25M带宽）上部署 Simprint 桌面应用的**自托管后端服务器**。请严格按阶段执行，每阶段完成后报告 `Status(DONE|DONE_WITH_CONCERNS|BLOCKED)` + 关键输出，任何命令失败立即停下排查并报告，不自行跳过。

设计依据全部在公开仓库 https://github.com/yfilwzy/simprint-chain 的 `docs/2026-06-24_重构设计文档/` 目录，以及 `server/` 目录的骨架代码。遇到规格疑问用 `git clone` 或 `curl raw.githubusercontent.com` 拉取对应文件读取，不要猜测。

## 前置信息（执行前你必须先向用户确认这些值）

部署前必须让用户提供以下 4 个值，缺一不可，全部缺失则 BLOCKED 停下询问：

1. `<YOUR_DOMAIN>` —— 已解析到 216.36.124.98 的域名（用于 TLS 证书）
2. `<YOUR_EMAIL>` —— Let's Encrypt 证书申请邮箱
3. `<YOUR_DB_PASSWORD>` —— PostgreSQL 数据库密码（建议生成 32 位随机强密码）
4. `<YOUR_API_SECRET>` —— 应用层鉴权密钥（建议生成 20 位随机字符串）

服务器登录方式由用户提供（SSH 密码或密钥，原密码已暴露需重置）。

## Phase 0：安全加固（最先执行，不可跳过）

1. 重置 root 密码（原密码已在公开渠道暴露，必须改）：
   ```bash
   passwd root
   ```
2. 创建非 root 部署用户 simprint 并加 sudo：
   ```bash
   adduser simprint && usermod -aG sudo simprint
   ```
3. 配置 SSH（若用户有公钥则写入 authorized_keys），加固 sshd：
   ```bash
   sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   systemctl restart sshd
   ```
   （仅在用户已配置密钥后才禁密码登录，否则保留密码登录以免锁死）
4. UFW 防火墙仅放行 22/80/443：
   ```bash
   ufw default deny incoming && ufw default allow outgoing
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
   ufw --force enable
   ```
5. 安装 fail2ban 防爆破：
   ```bash
   apt update && apt install -y fail2ban && systemctl enable --now fail2ban
   ```
6. 启用自动安全更新：
   ```bash
   apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
   ```

## Phase 1：拉取项目规格

```bash
cd /opt
git clone https://github.com/yfilwzy/simprint-chain.git
```

关键参考文件（执行前先读取理解，不要盲跑）：
- `/opt/simprint-chain/docs/2026-06-24_重构设计文档/03-登录指向自建服务器.md` —— 加密协议完整规格、服务端端点、数据库 Schema
- `/opt/simprint-chain/docs/2026-06-24_重构设计文档/05-服务器部署提示词.md` —— 部署细节参考
- `/opt/simprint-chain/server/db/schema.sql` —— PostgreSQL 建表脚本（直接用）
- `/opt/simprint-chain/server/go-server/` —— Go 服务端骨架（config/crypto/handlers/main，需填充 TODO）

## Phase 2：安装 PostgreSQL 并建库建表

```bash
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql

sudo -u postgres psql <<EOF
CREATE USER simprint_user WITH PASSWORD '<YOUR_DB_PASSWORD>';
CREATE DATABASE simprint_db OWNER simprint_user;
GRANT ALL PRIVILEGES ON DATABASE simprint_db TO simprint_user;
\c simprint_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOF

# 执行建表脚本
sudo -u postgres psql -d simprint_db -f /opt/simprint-chain/server/db/schema.sql
```

验证：`sudo -u postgres psql -d simprint_db -c "\dt"` 应列出 9 张表（users/sessions/referral_codes/environments/proxies/groups/tags/workspaces/browser_kernels）。

## Phase 3：填充 Go 服务端并部署

骨架代码在 `/opt/simprint-chain/server/go-server/`，但 `crypto.go` 和 `handlers.go` 是 stub（TODO）。你必须：

1. **先读加密协议规格**：`/opt/simprint-chain/docs/2026-06-24_重构设计文档/03-登录指向自建服务器.md` 第二节「加密协议完整规格」，以及客户端的 `src-tauri/src/infrastructure/http/encryption/rsa.rs` 和 `aes.rs`（在仓库内，用 curl 或 clone 读），确认 RSA padding 是 PKCS1v15 还是 OAEP。**这是最关键的兼容性点，padding 不对客户端解密必失败**。

2. **填充 crypto.go**：实现三个函数（DecryptRequest / EncryptResponse / GenerateRSAKeyPair），严格按 03 文档第二节的时序：
   - 请求解密：RSA 私钥解密 AES 密钥 → AES-256-GCM 解密 body（nonce 取前12字节）→ 校验 api_secret
   - 响应加密：随机 AES 密钥 → AES-GCM 加密 → 用客户端公钥 RSA 加密 AES 密钥
   - RSA 密钥对生成并持久化到 `/etc/simprint/keys/`

3. **填充 handlers.go**：实现所有端点（Login/Register/RefreshCredentials/LocalApiProxy/CheckVersion/GetLatestJson/GetRuntimeLatestJson），按 03 文档第三节的请求/响应格式。

4. **安装 Go 1.22**：
   ```bash
   cd /tmp && wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
   tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
   echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile && source /etc/profile
   ```

5. **编译部署**：
   ```bash
   mkdir -p /opt/simprint/bin /etc/simprint/keys
   cd /opt/simprint-chain/server/go-server
   go build -o /opt/simprint/bin/simprint-server .
   ```

6. **配置文件** `/etc/simprint/config.env`：
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_USER=simprint_user
   DB_PASSWORD=<YOUR_DB_PASSWORD>
   DB_NAME=simprint_db
   API_SECRET=<YOUR_API_SECRET>
   SERVER_PORT=8080
   RSA_PRIVATE_KEY_PATH=/etc/simprint/keys/server_private.pem
   RSA_PUBLIC_KEY_PATH=/etc/simprint/keys/server_public.pem
   ```

7. **systemd 服务** `/etc/systemd/system/simprint.service`：
   ```ini
   [Unit]
   Description=Simprint Self-hosted Server
   After=network.target postgresql.service
   [Service]
   Type=simple
   User=simprint
   WorkingDirectory=/opt/simprint
   EnvironmentFile=/etc/simprint/config.env
   ExecStart=/opt/simprint/bin/simprint-server
   Restart=always
   RestartSec=5
   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   systemctl daemon-reload && systemctl enable --now simprint
   systemctl status simprint
   ```

## Phase 4：Nginx 反代 + TLS

```bash
apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/simprint`：
```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN>;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name <YOUR_DOMAIN>;
    ssl_certificate /etc/letsencrypt/live/<YOUR_DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<YOUR_DOMAIN>/privkey.pem;
    client_max_body_size 256M;

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /update/ {
        proxy_pass http://127.0.0.1:8080/update/;
        proxy_set_header Host $host;
    }
}
```

```bash
ln -sf /etc/nginx/sites-available/simprint /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d <YOUR_DOMAIN> --email <YOUR_EMAIL> --agree-tos --no-eff-email
systemctl enable --now certbot.timer
```

## Phase 5：验证（全部通过才算部署成功）

1. 公钥端点：`curl https://<YOUR_DOMAIN>/api/v1/secret/public/key` 返回 `{public_key: "-----BEGIN RSA PUBLIC KEY-----..."}`
2. 健康检查：`curl https://<YOUR_DOMAIN>/api/v1/secret/public/key` 不报 502，且 `systemctl status simprint` active
3. 进程内存：`free -h` 确认总占用 < 1.5G（2核2G 约束）
4. 数据库连通：`sudo -u postgres psql -d simprint_db -c "SELECT count(*) FROM users;"` 返回 0
5. TLS 有效：`curl -vI https://<YOUR_DOMAIN>/ 2>&1 | grep -E "SSL|expire"`

## Phase 6：输出客户端配置

部署成功后，输出一份客户端用的 `config.production.toml`（供用户填到客户端 `src-tauri/config.production.toml` 后重新编译）：
```toml
[server]
base_url = "https://<YOUR_DOMAIN>/api/"
version = "v1"
secret_key = "<YOUR_API_SECRET>"

[updater]
check_url = "https://<YOUR_DOMAIN>/update/api/v1/versions/check"
latest_json_url = "https://<YOUR_DOMAIN>/update/latest.json"
runtime_latest_json_url = "https://<YOUR_DOMAIN>/update/simprint-runtime/latest.json"
updater_temp_dir = "updates"

[webview]
downlaod_url = "https://<YOUR_DOMAIN>/update/webview-fixed.zip"
```

## 执行规则

- 每阶段报告 Status + 关键输出，失败立即停下报告错误
- 密码/密钥不写入任何日志或 echo 到终端明文（用 *** 占位）
- crypto.go 的 RSA padding 实现前必须核对客户端 rsa.rs，这是最高风险点
- 2核2G 资源有限，PostgreSQL 若内存过高调整 shared_buffers=128MB
- 全程不要碰客户端代码（那是用户开发机的事），只管服务端

## ===== 提示词正文结束 =====

---

## 使用说明（给你看的，不要复制）

1. 把上方"===== 提示词正文 ====="到"===== 提示词正文结束 ====="之间的全部内容复制
2. 粘贴到服务器 root 的 ZCode 对话窗口
3. ZCode 会先问你 4 个值（域名/邮箱/数据库密码/API密钥），你提供后它自动执行 Phase 0-6
4. 你需要提前准备：一个解析到 216.36.124.98 的域名（没有域名就先去注册一个并做 DNS 解析，这是硬前提）

⚠️ 域名是必须的——没有域名 Let's Encrypt 不发证书，客户端加密通信就建立不起来。如果你暂时没域名，告诉本小姐，可以给一个用 IP + 自签证书的临时方案（但客户端要手动信任证书，不推荐长期用）。
