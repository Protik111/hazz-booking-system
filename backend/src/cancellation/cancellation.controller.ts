import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CancellationService } from './cancellation.service';
import { CreateCancellationDto } from './dto/create-cancellation.dto';
import { UpdateCancellationDto } from './dto/update-cancellation.dto';

@Controller('cancellation')
export class CancellationController {
  constructor(private readonly cancellationService: CancellationService) {}

  @Post()
  create(@Body() createCancellationDto: CreateCancellationDto) {
    return this.cancellationService.create(createCancellationDto);
  }

  @Get()
  findAll() {
    return this.cancellationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cancellationService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCancellationDto: UpdateCancellationDto) {
    return this.cancellationService.update(+id, updateCancellationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cancellationService.remove(+id);
  }
}
