import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { Message } from '../entities/message.entity';

// src/messaging/message.repository.ts
@Injectable()
export class MessageRepository {
  constructor(@InjectRepository(Message) private readonly repo: Repository<Message>) {}

  save(partial: Partial<Message>) {
    return this.repo.save(this.repo.create(partial));
  }

  updateByExternalId(channel: string | undefined, externalId: string, patch: Partial<Message>) {
    return channel
      ? this.repo.update({ externalId, channel: channel as any }, patch)
      : this.repo.update({ externalId }, patch);
  }

  async updateById(id: string | number, patch: Partial<Message>) {
    return this.repo.update({ id: id as any }, { ...patch, updatedAt: () => 'NOW()' } as any);
  }

  findByExternalId(channel: string, externalId: string) {
    return this.repo.findOne({ where: { externalId, channel: channel as any } });
  }

  findByExternalIdAnyChannel(externalId: string) {
    return this.repo.findOne({ where: { externalId } });
  }
}
