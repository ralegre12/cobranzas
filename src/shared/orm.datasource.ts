// file: src/shared/orm.datasource.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { SnakeNamingStrategy } from './snake.strategy';

dotenv.config({ path: '.env' });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'cobranzas',
  synchronize: false,
  logging: false,
  namingStrategy: new SnakeNamingStrategy(),

  // Usando la CLI TS (typeorm-ts-node-commonjs) podemos apuntar a TS directamente:
  entities: ['src/entities/**/*.entity.ts', 'src/entities/*.entity.ts'],
  migrations: ['migrations/*.ts'],
});

export default dataSource;
