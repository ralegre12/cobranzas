import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'cobranzas',
  synchronize: false,
  logging: false,
  entities: ['src/entities/*.entity.ts'],
  migrations: ['migrations/*.ts'],
});
export default AppDataSource;
