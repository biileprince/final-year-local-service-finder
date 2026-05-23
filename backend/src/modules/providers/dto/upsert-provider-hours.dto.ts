import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ProviderHoursDayDto {
  @ApiProperty({ example: 1, description: "0 = Sunday … 6 = Saturday" })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiPropertyOptional({ example: 540, description: "Minutes since midnight (540 = 09:00)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  openMinutes?: number;

  @ApiPropertyOptional({ example: 1020, description: "Minutes since midnight (1020 = 17:00)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  closeMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

export class UpsertProviderHoursDto {
  @ApiProperty({ type: [ProviderHoursDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderHoursDayDto)
  hours: ProviderHoursDayDto[];
}
