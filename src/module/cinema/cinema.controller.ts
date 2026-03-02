import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CinemaService } from './cinema.service';
import type { CreateCinemaDto } from './dto/create-cinema.dto';
import { Public } from '../../core/decorator/ispublic.decorator';
import type { FindCinemaDto } from './dto/find-cinema.dto';
import type { UpdateCinemaDto } from './dto/update-cinema.dto';
@Public()
@Controller('cinema')
export class CinemaController {
  constructor(private readonly cinemaService: CinemaService) {}

  @Get(':cinema_id')
  getCinema(@Param('cinema_id') cinema_id: number) {
    return this.cinemaService.getCinema(cinema_id);
  }

  @Post()
  createCinema(@Body() createCinemaDto: CreateCinemaDto) {
    return this.cinemaService.createCinema(createCinemaDto);
  }

  @Patch(':cinema_id')
  updateCinema(
    @Body() updateCinemaDto: UpdateCinemaDto,
    @Param('cinema_id') cinema_id: number,
  ) {
    return this.cinemaService.updateCinema(updateCinemaDto, cinema_id);
  }

  @Delete(':cinema_id')
  deleteCinema(@Param('cinema_id') cinema_id: number) {
    return this.cinemaService.deleteCinema(cinema_id);
  }

  @Post('find')
  findCinemas(@Body() dto: FindCinemaDto) {
    return this.cinemaService.findCinemas(dto);
  }
}
