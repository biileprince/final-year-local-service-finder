import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ModerateReviewDto {
  @ApiProperty({
    enum: ["approve", "hide", "delete"],
    example: "approve",
  })
  @IsEnum(["approve", "hide", "delete"])
  action: "approve" | "hide" | "delete";
}
