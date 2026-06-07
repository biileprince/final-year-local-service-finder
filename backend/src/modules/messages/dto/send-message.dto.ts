import { IsString, IsOptional, MaxLength, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
  VOICE = "voice",
}

export class SendMessageDto {
  @ApiProperty({ example: "Hello, I have a question about your services." })
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional({ description: "File ID if sending an attachment" })
  @IsOptional()
  @IsString()
  fileId?: string;
}
