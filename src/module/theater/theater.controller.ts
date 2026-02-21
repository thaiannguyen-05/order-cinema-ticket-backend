import { Controller } from '@nestjs/common';
import { TheaterService } from './theater.service';

@Controller('theater')
export class TheaterController {
  constructor(private readonly theaterService: TheaterService) {}
}
