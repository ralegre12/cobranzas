import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { ApiKeyEntity } from '../entities/api-key.entity';

@Injectable()
export class ApiKeysService {
  constructor(@InjectRepository(ApiKeyEntity) private repo: Repository<ApiKeyEntity>) {}

  async issue(tenantId: string, name: string) {
    const prefix = 'ak_' + randomBytes(4).toString('hex');
    const secret = prefix + '_' + randomBytes(16).toString('hex');
    const hash = await bcrypt.hash(secret, Number(process.env.API_KEY_COST_FACTOR || 10));
    const row = this.repo.create({ tenantId, name, prefix, hash });
    await this.repo.save(row);
    return { id: row.id, apiKey: secret, prefix };
  }

  async verify(tenantId: string, provided: string): Promise<boolean> {
    const [prefix] = provided.split('_');
    const row = await this.repo.findOne({ where: { tenantId, prefix } });
    if (!row) return false;
    const ok = await bcrypt.compare(provided, row.hash);
    if (ok) {
      await this.repo.update(row.id, { lastUsedAt: new Date() });
    }
    return ok;
  }
}
