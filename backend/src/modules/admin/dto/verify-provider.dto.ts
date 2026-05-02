import { IsString, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class VerifyProviderDto {
  @ApiPropertyOptional({ description: "Rejection reason (if rejecting)" })
  @IsOptional()
  @IsString()
  reason?: string;
}
