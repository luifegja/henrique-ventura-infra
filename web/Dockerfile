# Henrique Ventura — painel (Next.js standalone). Versão de Node fixada; nada de :latest.
# Build:  docker build -t henriqueventura-web:0.1.0 ./web
# O contêiner NÃO publica porta na internet: o Caddy faz o proxy (infra/).

# ---- dependências ----
FROM node:22.23.4-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build ----
FROM node:22.23.4-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders só para o build não reclamar; os valores reais entram em runtime.
# Não há banco: o Chatwoot e a Evolution só são chamados em runtime.
ENV AUTH_SECRET=build-time-placeholder
RUN npm run build

# ---- runtime ----
FROM node:22.23.4-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=America/Sao_Paulo
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
