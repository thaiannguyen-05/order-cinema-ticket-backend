import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class FilmDetail {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  filmName!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filmGenres!: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filmCast!: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filmDirectors!: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filmProducers!: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filmWriters!: string[] | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filmDistributor!: string | null;

  @IsOptional()
  filmOtherTitle?: unknown;

  @IsOptional()
  filmAgeRating?: unknown;

  @IsOptional()
  @IsString()
  filmSynopsis!: string | null;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(600)
  filmDurationMins!: number;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  filmReviewStars!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  filmReviewTxt!: string | null;
}

export class OrderDetail {
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ticketCode!: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  ticketPrice!: number;

  @ValidateNested()
  @Type(() => FilmDetail)
  film!: FilmDetail;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cinemaName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cinemaCity!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  seatRow!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  seatColumn!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paymentAmount!: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentStatus!: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  orderStatus!: string;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  createdAt!: Date;
}

export class TopFilmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filmName!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filmGenres!: string[] | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderCount!: number;
}

export class TopCinemaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cinemaName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cinemaCity!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderCount!: number;
}

export class OrderStatusBreakdownDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  status!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  count!: number;
}

export class UserOrderFrequentData {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  userFullname!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  userEmail!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalOrders!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalSpent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  avgTicketPrice!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopFilmDto)
  topFilms!: TopFilmDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopCinemaDto)
  topCinemas!: TopCinemaDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderStatusBreakdownDto)
  orderStatusBreakdown!: OrderStatusBreakdownDto[];

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  firstOrder!: Date;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  lastOrder!: Date;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => OrderDetail)
  orders!: OrderDetail[];
}

export class TrackingFrequentResult {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => UserOrderFrequentData)
  users!: UserOrderFrequentData[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalCount!: number;
}
