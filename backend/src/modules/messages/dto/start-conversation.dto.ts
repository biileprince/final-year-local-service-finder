import { IsString, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StartConversationDto {
  @ApiProperty({ description: "Provider ID to start conversation with" })
  @IsString()
  providerId: string;

  @ApiPropertyOptional({
    description: "Optional booking ID to link conversation",
  })
  @IsOptional()
  @IsString()
  bookingId?: string;
}
