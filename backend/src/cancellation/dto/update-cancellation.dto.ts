import { PartialType } from '@nestjs/mapped-types';
import { CreateCancellationDto } from './create-cancellation.dto';

export class UpdateCancellationDto extends PartialType(CreateCancellationDto) {}
