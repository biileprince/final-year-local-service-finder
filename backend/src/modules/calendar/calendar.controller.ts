import {
  Controller,
  Get,
  Delete,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CalendarService } from "./calendar.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { Public } from "../../common/decorators/public.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("calendar")
@ApiTags("calendar")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("feed")
  @ApiOperation({ summary: "Get the subscribable calendar feed URL" })
  async getFeed(@CurrentUser() user: CurrentUserPayload) {
    return this.calendarService.getFeed(user.id);
  }

  @Delete("feed")
  @ApiOperation({ summary: "Reset the calendar feed token (revokes the old URL)" })
  async resetFeed(@CurrentUser() user: CurrentUserPayload) {
    return this.calendarService.resetFeed(user.id);
  }

  @Get("booking/:id")
  @ApiOperation({ summary: "Download a single booking as an .ics file" })
  async getBookingIcs(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.calendarService.getBookingIcs(
      id,
      user.id,
    );
    res.set({
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    res.send(content);
  }

  // Public: calendar apps poll this URL without auth headers, so the unguessable
  // token in the path is the credential. The `.ics` suffix is optional.
  @Get("feed/:token")
  @Public()
  @ApiOperation({ summary: "Subscribable iCal feed of a user's bookings" })
  async getFeedIcs(@Param("token") token: string, @Res() res: Response) {
    const content = await this.calendarService.getFeedIcs(
      token.replace(/\.ics$/, ""),
    );
    res.set({
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    });
    res.send(content);
  }
}
