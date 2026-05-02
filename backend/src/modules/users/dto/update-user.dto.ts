import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "John Doe" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: "+233201234567" })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: "Invalid phone number format" })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImage?: string;
}
