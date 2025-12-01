# Cobranzas (Bircle-like) – NestJS + TypeORM

Omnicanal **WhatsApp/SMS/Email/Voz**, **Pagos (Mercado Pago)**, **Campañas (BullMQ)** y **webhooks**.

## Levantar
```bash
cp .env.example .env
docker compose up -d
npm i
npm run typeorm:run
npm run seed
npm run start:dev
```
Docs: http://localhost:3000/api/docs • Mailhog: http://localhost:8025


## VS Code
- Abre la carpeta en VS Code: **File → Open Folder...**
- Crea `.env`: en Windows CMD usa `copy .env.example .env` (en PowerShell `cp .env.example .env`).
- Tareas: `Ctrl+Shift+P` → **Tasks: Run Task** → `Docker: up`, `DB: migrate`, `DB: seed`, `Nest: dev`.
- Debug: `Run and Debug` → **NestJS: Debug API** (breakpoints en TS).

