import { IsString, IsNumber, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FileContext } from "@prisma/client";

export class RegisterFileDto {
  @ApiProperty({ description: "Cloudinary storage key (public_id)" })
  @IsString()
  storageKey: string;

  @ApiProperty({ description: "File URL from Cloudinary" })
  @IsString()
  url: string;

  @ApiProperty({ description: "Original file name" })
  @IsString()
  fileName: string;

  @ApiProperty({ description: "MIME type", example: "image/jpeg" })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: "File size in bytes" })
  @IsNumber()
  fileSize: number;

  @ApiPropertyOptional({
    description: "File context",
    enum: FileContext,
    example: "GALLERY",
  })
  @IsOptional()
  @IsEnum(FileContext)
  context?: FileContext;

  @ApiPropertyOptional({ description: "Image width in pixels" })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional({ description: "Image height in pixels" })
  @IsOptional()
  @IsNumber()
  height?: number;
}
