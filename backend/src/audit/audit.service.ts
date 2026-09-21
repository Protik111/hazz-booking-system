import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async recordLog(dto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.auditRepo.create({
      actor_id: dto.actor_id ?? null,
      action: dto.action,
      entity_type: dto.entity_type,
      entity_id: dto.entity_id,
      old_value: dto.old_value ?? null,
      new_value: dto.new_value ?? null,
      ip_address: dto.ip_address ?? null,
      user_agent: dto.user_agent ?? null,
    });

    return this.auditRepo.save(log);
  }

  @OnEvent('audit.log')
  async handleAuditLogEvent(dto: CreateAuditLogDto) {
    try {
      await this.recordLog(dto);
    } catch {
      // Do not let audit log failures crash caller
    }
  }

  async findAll(query: ListAuditLogsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.actor', 'actor');

    if (query.actor_id) {
      qb.andWhere('a.actor_id = :actorId', { actorId: query.actor_id });
    }

    if (query.action) {
      qb.andWhere('a.action ILIKE :action', { action: `%${query.action}%` });
    }

    if (query.entity_type) {
      qb.andWhere('a.entity_type = :entityType', {
        entityType: query.entity_type,
      });
    }

    if (query.entity_id) {
      qb.andWhere('a.entity_id = :entityId', { entityId: query.entity_id });
    }

    if (query.date_from) {
      qb.andWhere('a.created_at >= :dateFrom', {
        dateFrom: new Date(query.date_from),
      });
    }

    if (query.date_to) {
      qb.andWhere('a.created_at <= :dateTo', {
        dateTo: new Date(query.date_to),
      });
    }

    qb.orderBy('a.created_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<AuditLog> {
    const log = await this.auditRepo.findOne({
      where: { id },
      relations: ['actor'],
    });

    if (!log) {
      throw new NotFoundException(`Audit log with ID '${id}' not found`);
    }

    return log;
  }
}
