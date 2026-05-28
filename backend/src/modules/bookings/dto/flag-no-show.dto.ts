import { IsString, IsOptional, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class FlagNoShowDto {
  @ApiPropertyOptional({ example: "Waited 20 minutes, nobody arrived." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
