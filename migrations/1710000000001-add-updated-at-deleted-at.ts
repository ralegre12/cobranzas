// migrations/1710000000001-add-updated-at.ts
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUpdatedAt1710000000001 implements MigrationInterface {
  name = 'AddUpdatedAt1710000000001';
  public async up(q: QueryRunner): Promise<void> {
    await q.addColumn(
      'messages',
      new TableColumn({
        name: 'updated_at',
        type: 'timestamptz',
        isNullable: true,
        // default: 'now()'  // <- opcional
      }),
    );
    await q.addColumn(
      'messages',
      new TableColumn({
        name: 'deleted_at',
        type: 'timestamptz',
        isNullable: true,
      }),
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.dropColumn('messages', 'updated_at');
    await q.dropColumn('messages', 'deleted_at');
  }
}
