// file: src/shared/config.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      cache: true,
      validate, // valida variables
    }),
  ],
})
export class AppConfigModule {}
