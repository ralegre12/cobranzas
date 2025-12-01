// src/data-source.ts
import { resolve } from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env") }); // 👈 carga .env de la raíz

import { DataSource } from "typeorm";

const host = process.env.DB_HOST || "localhost";
const port = Number(process.env.DB_PORT || 5433); // 👈 tu PG está en 5433
const user = process.env.DB_USER || "postgres";
const pass = process.env.DB_PASS || "postgres";
const db = process.env.DB_NAME || "cobranzas";

// DEBUG opcional (mientras probás):
console.log("[TypeORM DS]", { host, port, user, db });

const dataSource = new DataSource({
  type: "postgres",
  host,
  port,
  username: user,
  password: pass,
  database: db,
  // logging: true,  // habilitalo si querés ver SQL
  synchronize: false,
  migrations: ["src/migrations/**/*.ts"],
  // entities no son necesarias para correr migraciones
  ssl: false,
});

export default dataSource;
