import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsDateString,
  ValidateNested,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

class TimeSlotDto {
  @ApiProperty({ example: "09:00:00" })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
  startTime: string;

  @ApiProperty({ example: "10:00:00" })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
  endTime: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class SetTimeSlotsDto {
  @ApiProperty({ example: "2026-04-15" })
  @IsDateString()
  date: string;

  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  slots: TimeSlotDto[];
}
