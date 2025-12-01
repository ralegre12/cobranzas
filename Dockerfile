# =============== deps ===============
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
# Si usás pnpm/yarn, copiá su lockfile y reemplazá el comando siguiente
RUN npm ci --no-audit --no-fund

# =============== build ===============
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
RUN npm run build

# =============== runner ===============
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps
# opcional: zona horaria coherente
# RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/America/Argentina/Buenos_Aires /etc/localtime

# Copiamos sólo lo necesario
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
# Si necesitás variables en runtime, montá el .env como secreto/var; evitar copiarlo
# COPY .env ./.env

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
