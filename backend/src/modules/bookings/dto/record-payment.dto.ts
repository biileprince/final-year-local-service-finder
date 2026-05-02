import { IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RecordPaymentDto {
  @ApiProperty({ example: "cash" })
  @IsString()
  @MaxLength(50)
  paymentMethod: string;

  @ApiProperty({ example: "RECEIPT-12345" })
  @IsString()
  @MaxLength(100)
  paymentReference: string;
}
