# syntax=docker/dockerfile:1
# Simprint 自托管 Go 服务器构建镜像
# 多阶段构建：builder 编译静态二进制，runtime 极小镜像

FROM golang:1.22-alpine AS builder
WORKDIR /app
ENV CGO_ENABLED=0 GOOS=linux GOFLAGS=-mod=mod

# 先拷依赖，利用层缓存
COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN go build -trimpath -ldflags="-s -w" -o simprint-server .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/simprint-server /app/simprint-server

# 密钥持久化挂载点（容器内 /etc/simprint/keys/）
RUN mkdir -p /etc/simprint/keys
VOLUME ["/etc/simprint/keys"]

EXPOSE 8080
CMD ["/app/simprint-server"]
