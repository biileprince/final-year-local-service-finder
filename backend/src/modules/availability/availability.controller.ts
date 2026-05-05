import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { AvailabilityService } from "./availability.service";
import { SetAvailabilityDto } from "./dto/set-availability.dto";
import { SetTimeSlotsDto } from "./dto/set-time-slots.dto";
import { BulkAvailabilityDto } from "./dto/bulk-availability.dto";
import { SetMyAvailabilityDto } from "./dto/set-my-availability.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Public } from "../../common/decorators/public.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("availability")
@ApiTags("availability")
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // NOTE: `me` routes must come before `:providerId` so they don't get
  // captured as `providerId === "me"`.

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current provider's availability for a date range" })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  async getMyAvailability(
    @CurrentUser() user: CurrentUserPayload,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate
      ? new Date(endDate)
      : new Date(new Date().setDate(new Date().getDate() + 30));
    return this.availabilityService.getMyAvailabilityRange(user.id, start, end);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Bulk set the current provider's availability (per-day with custom slots)",
  })
  async setMyAvailability(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SetMyAvailabilityDto,
  ) {
    return this.availabilityService.setMyAvailabilityBulk(
      user.id,
      dto.availabilities,
    );
  }

  @Get(":providerId")
  @Public()
  @ApiOperation({ summary: "Get provider availability for a date" })
  @ApiQuery({ name: "date", required: true, example: "2026-04-15" })
  async getAvailability(
    @Param("providerId") providerId: string,
    @Query("date") date: string,
  ) {
    return this.availabilityService.getAvailability(providerId, new Date(date));
  }

  @Get(":providerId/range")
  @Public()
  @ApiOperation({ summary: "Get provider availability for a date range" })
  @ApiQuery({ name: "startDate", required: true })
  @ApiQuery({ name: "endDate", required: true })
  async getAvailabilityRange(
    @Param("providerId") providerId: string,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    return this.availabilityService.getAvailabilityRange(
      providerId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(":providerId/slots")
  @Public()
  @ApiOperation({ summary: "Get available time slots for a date" })
  @ApiQuery({ name: "date", required: true })
  async getAvailableSlots(
    @Param("providerId") providerId: string,
    @Query("date") date: string,
  ) {
    return this.availabilityService.getAvailableSlots(providerId, new Date(date));
  }

  @Post(":providerId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set availability for a date" })
  @ApiResponse({ status: 201, description: "Availability set successfully" })
  async setAvailability(
    @Param("providerId") providerId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.availabilityService.setAvailability(providerId, user.id, {
      date: new Date(dto.date),
      isAvailable: dto.isAvailable,
      notes: dto.notes,
      timeSlots: dto.timeSlots,
    });
  }

  @Put(":providerId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update availability for a date" })
  @ApiQuery({ name: "date", required: true })
  async updateAvailability(
    @Param("providerId") providerId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query("date") date: string,
    @Body() dto: Partial<SetAvailabilityDto>,
  ) {
    return this.availabilityService.updateAvailability(
      providerId,
      user.id,
      new Date(date),
      {
        isAvailable: dto.isAvailable,
        notes: dto.notes,
      },
    );
  }

  @Post(":providerId/time-slots")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set time slots for a date" })
  async setTimeSlots(
    @Param("providerId") providerId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SetTimeSlotsDto,
  ) {
    return this.availabilityService.setTimeSlots(
      providerId,
      user.id,
      new Date(dto.date),
      dto.slots,
    );
  }

  @Post(":providerId/generate-slots")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Generate default time slots for a date" })
  @ApiQuery({ name: "date", required: true })
  @ApiQuery({ name: "startHour", required: false, type: Number })
  @ApiQuery({ name: "endHour", required: false, type: Number })
  async generateDefaultSlots(
    @Param("providerId") providerId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query("date") date: string,
    @Query("startHour") startHour?: number,
    @Query("endHour") endHour?: number,
  ) {
    return this.availabilityService.generateDefaultSlots(
      providerId,
      user.id,
      new Date(date),
      startHour || 8,
      endHour || 17,
    );
  }

  @Post(":providerId/bulk")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set availability for multiple dates" })
  async bulkSetAvailability(
    @Param("providerId") providerId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkAvailabilityDto,
  ) {
    return this.availabilityService.bulkSetAvailability(
      providerId,
      user.id,
      dto.dates.map((d) => new Date(d)),
      dto.isAvailable,
      dto.slots,
    );
  }

  @Delete(":providerId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete availability for a date" })
  @ApiQuery({ name: "date", required: true })
  async deleteAvailability(
    @Param("providerId") providerId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query("date") date: string,
  ) {
    return this.availabilityService.deleteAvailability(
      providerId,
      user.id,
      new Date(date),
    );
  }
}
