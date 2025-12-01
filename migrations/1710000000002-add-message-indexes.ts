// migrations/1710000000002-add-message-indexes.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageIndexes1710000000002 implements MigrationInterface {
  name = 'AddMessageIndexes1710000000002';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC)`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages (external_id)`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_messages_channel_external_id ON messages (channel, external_id)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_messages_channel_status_created_at ON messages (channel, status, created_at DESC)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_messages_provider_payload_gin`);
    await q.query(`DROP INDEX IF EXISTS idx_messages_channel_status_created_at`);
    await q.query(`DROP INDEX IF EXISTS idx_messages_channel_external_id`);
    await q.query(`DROP INDEX IF EXISTS idx_messages_external_id`);
    await q.query(`DROP INDEX IF EXISTS idx_messages_created_at`);
  }
}
