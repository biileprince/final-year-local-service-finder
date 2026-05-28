import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { RecurringBookingsService } from "./recurring-bookings.service";
import { CreateRecurringBookingDto } from "./dto/create-recurring-booking.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("recurring-bookings")
@ApiTags("bookings")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecurringBookingsController {
  constructor(
    private readonly recurringBookingsService: RecurringBookingsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a recurring booking series" })
  @ApiResponse({ status: 201, description: "Series created" })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRecurringBookingDto,
  ) {
    return this.recurringBookingsService.createSeries(user.id, dto);
  }

  @Get("my")
  @ApiOperation({ summary: "List the current user's recurring booking series" })
  async getMine(@CurrentUser() user: CurrentUserPayload) {
    return this.recurringBookingsService.getCustomerSeries(user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a recurring booking series" })
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.recurringBookingsService.findSeries(id, user.id);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Stop a recurring series (keeps already-created bookings)",
  })
  @ApiResponse({ status: 200, description: "Series stopped" })
  async cancel(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.recurringBookingsService.cancelSeries(id, user.id);
  }
}
