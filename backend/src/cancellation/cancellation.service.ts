import { Injectable } from '@nestjs/common';
import { CreateCancellationDto } from './dto/create-cancellation.dto';
import { UpdateCancellationDto } from './dto/update-cancellation.dto';

@Injectable()
export class CancellationService {
  create(createCancellationDto: CreateCancellationDto) {
    return 'This action adds a new cancellation';
  }

  findAll() {
    return `This action returns all cancellation`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cancellation`;
  }

  update(id: number, updateCancellationDto: UpdateCancellationDto) {
    return `This action updates a #${id} cancellation`;
  }

  remove(id: number) {
    return `This action removes a #${id} cancellation`;
  }
}
