-- ============================================================================
-- Simprint 自托管服务器 数据库 Schema
-- ============================================================================
-- 说明：
--   1. 本文件是 Simprint 自托管（self-hosted）服务端的 PostgreSQL 建表脚本。
--   2. 配合设计文档使用：
--      docs/2026-06-24_重构设计文档/03-登录指向自建服务器.md （第四节「数据库 Schema」）
--   3. 目标数据库：PostgreSQL 15+ （依赖 pgcrypto 扩展的 gen_random_uuid()）。
--   4. 业务表（environments / proxies / groups / tags / workspaces / browser_kernels）
--      承载 /local-api/* 透传过来的用户自托管工作区数据，结构与 environments 同构。
--   5. 密码字段 password_hash 统一使用 bcrypt 哈希存储，应用层（Go 服务端）
--      使用 golang.org/x/crypto/bcrypt 进行 hash/verify，cost 建议 >= 12。
--      数据库层不存储明文密码，也不做明文比对。
-- ============================================================================

-- pgcrypto：提供 gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. users  用户表
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    -- bcrypt 哈希：应用层用 bcrypt(cost>=12) 生成；禁止存储明文。
    password_hash   VARCHAR(255) NOT NULL,
    is_first_login  BOOLEAN      DEFAULT TRUE,
    user_info       JSONB,                       -- 登录响应返回的用户信息，灵活扩展
    user_extra      JSONB,                       -- 额外扩展字段（JSONB 自由 schema）
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- updated_at 自动维护触发器（可选，便于应用层不显式更新时间戳）
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. sessions  会话/令牌表
-- ----------------------------------------------------------------------------
CREATE TABLE sessions (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
    access_token    VARCHAR(512) NOT NULL,
    refresh_token   VARCHAR(512) NOT NULL,
    expires_at      TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id       ON sessions (user_id);
CREATE INDEX idx_sessions_access_token  ON sessions (access_token);
CREATE INDEX idx_sessions_refresh_token ON sessions (refresh_token);
CREATE INDEX idx_sessions_expires_at    ON sessions (expires_at);

-- ----------------------------------------------------------------------------
-- 3. referral_codes  邀请码表
-- ----------------------------------------------------------------------------
CREATE TABLE referral_codes (
    code            VARCHAR(64)  PRIMARY KEY,
    referrer_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
    used_count      INT          DEFAULT 0,
    max_uses        INT          DEFAULT 100,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_referral_codes_referrer_id ON referral_codes (referrer_id);

-- ----------------------------------------------------------------------------
-- 4. environments  指纹环境（自托管业务数据，结构与设计文档一致）
-- ----------------------------------------------------------------------------
CREATE TABLE environments (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255),
    config          JSONB,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_environments_user_id ON environments (user_id);

CREATE TRIGGER trg_environments_updated_at
    BEFORE UPDATE ON environments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. proxies  代理（与 environments 同构）
-- ----------------------------------------------------------------------------
CREATE TABLE proxies (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255),
    config          JSONB,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_proxies_user_id ON proxies (user_id);

CREATE TRIGGER trg_proxies_updated_at
    BEFORE UPDATE ON proxies
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. groups  分组（与 environments 同构）
-- ----------------------------------------------------------------------------
CREATE TABLE groups (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255),
    config          JSONB,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_groups_user_id ON groups (user_id);

CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. tags  标签（与 environments 同构）
-- ----------------------------------------------------------------------------
CREATE TABLE tags (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255),
    config          JSONB,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_tags_user_id ON tags (user_id);

CREATE TRIGGER trg_tags_updated_at
    BEFORE UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. workspaces  工作区（与 environments 同构）
-- ----------------------------------------------------------------------------
CREATE TABLE workspaces (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255),
    config          JSONB,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_workspaces_user_id ON workspaces (user_id);

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. browser_kernels  浏览器内核（与 environments 同构）
-- ----------------------------------------------------------------------------
CREATE TABLE browser_kernels (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255),
    config          JSONB,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_browser_kernels_user_id ON browser_kernels (user_id);

CREATE TRIGGER trg_browser_kernels_updated_at
    BEFORE UPDATE ON browser_kernels
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- End of schema.sql
-- ============================================================================
