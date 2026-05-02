import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SuspendUserDto {
  @ApiProperty({ example: "Violation of terms of service" })
  @IsString()
  @MinLength(10)
  reason: string;
}
