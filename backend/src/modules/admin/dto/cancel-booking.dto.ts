import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CancelBookingDto {
  @ApiProperty({ example: "Customer requested cancellation" })
  @IsString()
  @MinLength(5)
  reason: string;
}
