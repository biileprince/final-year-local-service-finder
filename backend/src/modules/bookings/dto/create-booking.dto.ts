import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Matches,
  MinLength,
  MaxLength,
  IsLatitude,
  IsLongitude,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateBookingDto {
  @ApiProperty({ example: "provider-uuid" })
  @IsString()
  providerId: string;

  @ApiProperty({ example: "2026-04-15" })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({
    example: "09:00:00",
    description:
      "Time in HH:MM:SS format. Optional — when omitted the booking is treated as flexible-time and the provider confirms a slot via messaging.",
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

  @ApiProperty({ example: "My sink is leaking and needs repair" })
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
