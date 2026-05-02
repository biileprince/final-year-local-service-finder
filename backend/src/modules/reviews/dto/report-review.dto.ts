import { IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ReportReviewDto {
  @ApiProperty({ example: "Inappropriate content" })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
