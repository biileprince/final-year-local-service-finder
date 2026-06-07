import { IsOptional, IsString, Matches } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class SendOtpDto {
  @ApiPropertyOptional({
    example: "+233201234567",
    description:
      "Phone to verify. Optional — defaults to the phone on the user's account.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: "Invalid phone number format" })
  phone?: string;
}
