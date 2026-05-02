import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";

export class UpdateBookingDto {
  @ApiPropertyOptional({ example: "2026-04-16" })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  scheduledDate?: Date;

  @ApiPropertyOptional({ example: "10:00:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: "scheduledStartTime must be in HH:MM:SS format",
  })
  scheduledStartTime?: string;

  @ApiPropertyOptional({ example: "11:00:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: "scheduledEndTime must be in HH:MM:SS format",
  })
  scheduledEndTime?: string;

  @ApiPropertyOptional({ example: "456 New Address, Kumasi" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  serviceAddress?: string;

  @ApiPropertyOptional({ example: "Updated problem description" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  problemDescription?: string;

  @ApiPropertyOptional({ example: "Provider notes about the service" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  serviceNotes?: string;

  @ApiPropertyOptional({ example: 175.0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  estimatedAmount?: number;

  @ApiPropertyOptional({ example: 200.0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  finalAmount?: number;
}
