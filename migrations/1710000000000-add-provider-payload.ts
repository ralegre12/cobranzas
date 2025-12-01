// migrations/1710000000000-add-provider-payload.ts
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProviderPayload1710000000000 implements MigrationInterface {
  name = 'AddProviderPayload1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('messages', [
      new TableColumn({
        name: 'provider_payload',
        type: 'jsonb',
        isNullable: true,
      }),
      new TableColumn({
        name: 'last_provider_status',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
      new TableColumn({
        name: 'last_provider_status_at',
        type: 'timestamptz',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('messages', [
      'provider_payload',
      'last_provider_status',
      'last_provider_status_at',
    ]);
  }
}
