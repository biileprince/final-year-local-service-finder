import { IsDateString, IsOptional, IsString, Matches } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RescheduleBookingDto {
  @ApiProperty({ example: "2026-05-20" })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ example: "10:00:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: "scheduledStartTime must be in HH:MM:SS format",
  })
  scheduledStartTime?: string;
}
