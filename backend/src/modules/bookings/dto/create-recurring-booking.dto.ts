import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  Matches,
  MinLength,
  MaxLength,
  IsLatitude,
  IsLongitude,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { RecurrenceFrequency } from "@prisma/client";

export class CreateRecurringBookingDto {
  @ApiProperty({ example: "provider-uuid" })
  @IsString()
  providerId: string;

  @ApiProperty({ enum: RecurrenceFrequency, example: "WEEKLY" })
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @ApiProperty({ example: "2026-06-01", description: "Date of the first occurrence" })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    example: "2026-12-31",
    description: "Series stops after this date. Provide this or maxOccurrences.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 12,
    description: "Stop after this many bookings. Provide this or endDate.",
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(104)
  maxOccurrences?: number;

  @ApiPropertyOptional({
    example: "09:00:00",
    description: "Time in HH:MM:SS. Omit for flexible-time (provider confirms).",
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: "scheduledStartTime must be in HH:MM:SS format",
  })
  scheduledStartTime?: string;

  @ApiPropertyOptional({ example: "10:00:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: "scheduledEndTime must be in HH:MM:SS format",
  })
  scheduledEndTime?: string;

  @ApiProperty({ example: "123 Main Street, Accra" })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  serviceAddress: string;

  @ApiPropertyOptional({ example: 5.6037 })
  @IsOptional()
  @IsNumber()
  @IsLatitude()
  @Type(() => Number)
  serviceLatitude?: number;

  @ApiPropertyOptional({ example: -0.187 })
  @IsOptional()
  @IsNumber()
  @IsLongitude()
  @Type(() => Number)
  serviceLongitude?: number;

  @ApiProperty({ example: "Weekly home cleaning" })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  problemDescription: string;

  @ApiPropertyOptional({ example: 150.0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  estimatedAmount?: number;
}
