import { ApiProperty } from "@nestjs/swagger";
import { ReportReason } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateReportDto {
  @ApiProperty()
  @IsUUID()
  reportedUserId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  messageId?: string;

  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
