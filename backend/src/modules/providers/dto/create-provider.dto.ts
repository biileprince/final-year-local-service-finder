import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsLatitude,
  IsLongitude,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateProviderDto {
  @ApiPropertyOptional({ example: "Experienced plumber with 10+ years..." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  hourlyRate: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(50)
  yearsExperience?: number;

  @ApiProperty({ example: "Accra, Ghana" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location: string;

  @ApiPropertyOptional({ example: 5.6037 })
  @IsOptional()
  @IsNumber()
  @IsLatitude()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ example: -0.187 })
  @IsOptional()
  @IsNumber()
  @IsLongitude()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  serviceRadiusKm?: number;

  @ApiPropertyOptional({ example: ["cat-uuid-1", "cat-uuid-2"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ example: ["Pipe repair", "Drain cleaning"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}
