import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { IsArray, ArrayMaxSize, IsUUID } from "class-validator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { FavoritesService } from "./favorites.service";

class CheckFavoritesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  providerIds!: string[];
}

@ApiTags("favorites")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("favorites")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's saved providers" })
  @ApiResponse({ status: 200, description: "Favorites returned" })
  async list(@CurrentUser() user: CurrentUserPayload) {
    return this.favoritesService.list(user.id);
  }

  @Post("check")
  @ApiOperation({
    summary: "Return which of the supplied provider ids the user has favorited",
  })
  async check(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CheckFavoritesDto,
  ) {
    const ids = await this.favoritesService.idsFavoritedBy(
      user.id,
      dto.providerIds,
    );
    return { favoritedProviderIds: ids };
  }

  @Post(":providerId")
  @ApiOperation({ summary: "Save a provider to favorites" })
  @ApiResponse({ status: 201, description: "Added (or already saved)" })
  async add(
    @CurrentUser() user: CurrentUserPayload,
    @Param("providerId") providerId: string,
  ) {
    return this.favoritesService.add(user.id, providerId);
  }

  @Delete(":providerId")
  @ApiOperation({ summary: "Remove a provider from favorites" })
  @ApiResponse({ status: 200, description: "Removed" })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("providerId") providerId: string,
  ) {
    return this.favoritesService.remove(user.id, providerId);
  }
}
