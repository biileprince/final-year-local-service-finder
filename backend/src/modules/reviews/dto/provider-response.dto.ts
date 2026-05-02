import { IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ProviderResponseDto {
  @ApiProperty({ example: "Thank you for your kind review!" })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  response: string;
}
