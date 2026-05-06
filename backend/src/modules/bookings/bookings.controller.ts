import {
  Controller,
  Get,
  Post,
  Put,
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
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";
import { CancelBookingDto } from "./dto/cancel-booking.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { RescheduleBookingDto } from "./dto/reschedule-booking.dto";
import { ConfirmBookingDto } from "./dto/confirm-booking.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { BookingStatus } from "@prisma/client";

@Controller("bookings")
@ApiTags("bookings")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new booking" })
  @ApiResponse({ status: 201, description: "Booking created successfully" })
  @ApiResponse({ status: 409, description: "Time slot already booked" })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    return this.bookingsService.create({
      ...createBookingDto,
      scheduledDate: new Date(createBookingDto.scheduledDate),
      customerId: user.id,
    });
  }

  @Get("my-bookings")
  @ApiOperation({ summary: "Get current user bookings (as customer)" })
  @ApiQuery({ name: "status", required: false, enum: BookingStatus })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getMyBookings(
    @CurrentUser() user: CurrentUserPayload,
    @Query("status") status?: BookingStatus,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.bookingsService.getCustomerBookings(user.id, {
      status,
      page,
      limit,
    });
  }

  @Get("provider-bookings")
  @ApiOperation({ summary: "Get provider bookings" })
  @ApiQuery({ name: "status", required: false, enum: BookingStatus })
  @ApiQuery({ name: "fromDate", required: false })
  @ApiQuery({ name: "toDate", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getProviderBookings(
    @CurrentUser() user: CurrentUserPayload,
    @Query("providerId") providerId: string,
    @Query("status") status?: BookingStatus,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.bookingsService.getProviderBookings(providerId, {
      status,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page,
      limit,
    });
  }

  @Get("stats/:providerId")
  @ApiOperation({ summary: "Get booking statistics for a provider" })
  async getStats(@Param("providerId") providerId: string) {
    return this.bookingsService.getBookingStats(providerId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get booking by ID" })
  @ApiResponse({ status: 200, description: "Returns booking details" })
  @ApiResponse({ status: 404, description: "Booking not found" })
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.bookingsService.findById(id, user.id);
  }

  @Get("number/:bookingNumber")
  @ApiOperation({ summary: "Get booking by booking number" })
  async findByNumber(@Param("bookingNumber") bookingNumber: string) {
    return this.bookingsService.findByBookingNumber(bookingNumber);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update booking details" })
  @ApiResponse({ status: 200, description: "Booking updated successfully" })
  async update(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(id, user.id, updateBookingDto);
  }

  @Put(":id/confirm")
  @ApiOperation({ summary: "Confirm a pending booking (provider only)" })
  @ApiResponse({ status: 200, description: "Booking confirmed" })
  async confirm(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmBookingDto,
  ) {
    return this.bookingsService.confirm(id, user.id, dto?.scheduledStartTime);
  }

  @Put(":id/start")
  @ApiOperation({ summary: "Start the service (provider only)" })
  @ApiResponse({ status: 200, description: "Service started" })
  async startService(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.bookingsService.startService(id, user.id);
  }

  @Put(":id/complete")
  @ApiOperation({ summary: "Complete the booking (provider only)" })
  @ApiResponse({ status: 200, description: "Booking completed" })
  async complete(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body("finalAmount") finalAmount?: number,
  ) {
    return this.bookingsService.complete(id, user.id, finalAmount);
  }

  @Put(":id/reschedule")
  @ApiOperation({ summary: "Reschedule a booking (customer or provider)" })
  @ApiResponse({ status: 200, description: "Booking rescheduled" })
  async reschedule(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingsService.reschedule(id, user.id, dto);
  }

  @Put(":id/cancel")
  @ApiOperation({ summary: "Cancel the booking" })
  @ApiResponse({ status: 200, description: "Booking cancelled" })
  async cancel(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() cancelBookingDto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(id, user.id, cancelBookingDto.reason);
  }

  @Put(":id/record-payment")
  @ApiOperation({ summary: "Record external payment (provider only)" })
  @ApiResponse({ status: 200, description: "Payment recorded" })
  async recordPayment(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() recordPaymentDto: RecordPaymentDto,
  ) {
    return this.bookingsService.recordExternalPayment(id, user.id, recordPaymentDto);
  }
}
