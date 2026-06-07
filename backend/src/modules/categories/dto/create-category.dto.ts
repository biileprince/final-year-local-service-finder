import {
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateCategoryDto {
  @ApiProperty({ example: "Plumbing" })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: "plumbing" })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug must only contain lowercase letters, numbers, and hyphens",
  })
  slug: string;

  @ApiPropertyOptional({ example: "Professional plumbing services" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: "wrench" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: "#3B82F6" })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: "Color must be a valid hex color" })
  color?: string;

  @ApiPropertyOptional({ description: "File ID for the category image" })
  @IsOptional()
  @IsString()
  imageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  displayOrder?: number;
}
