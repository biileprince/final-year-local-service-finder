import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.PROVIDER })
  @IsEnum(UserRole)
  role: UserRole;
}
