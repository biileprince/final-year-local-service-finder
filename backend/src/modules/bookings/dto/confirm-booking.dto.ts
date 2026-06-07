import { IsOptional, IsString, Matches } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ConfirmBookingDto {
  // Optional. When provided on a flexible-time booking, locks in the time the
  // provider negotiated with the customer (replaces the 00:00:00 sentinel).
  @ApiPropertyOptional({ example: "10:00:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: "scheduledStartTime must be in HH:MM:SS format",
  })
  scheduledStartTime?: string;
}
