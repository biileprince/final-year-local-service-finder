import { IsBoolean, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: "Receive email for booking updates" })
  @IsOptional()
  @IsBoolean()
  emailBookingUpdates?: boolean;

  @ApiPropertyOptional({ description: "Receive email for messages" })
  @IsOptional()
  @IsBoolean()
  emailMessages?: boolean;

  @ApiPropertyOptional({ description: "Receive email for reviews" })
  @IsOptional()
  @IsBoolean()
  emailReviews?: boolean;

  @ApiPropertyOptional({ description: "Receive email for promotions" })
  @IsOptional()
  @IsBoolean()
  emailPromotions?: boolean;

  @ApiPropertyOptional({ description: "Receive SMS for booking updates" })
  @IsOptional()
  @IsBoolean()
  smsBookingUpdates?: boolean;

  @ApiPropertyOptional({ description: "Receive SMS for messages" })
  @IsOptional()
  @IsBoolean()
  smsMessages?: boolean;

  @ApiPropertyOptional({ description: "Receive SMS reminders" })
  @IsOptional()
  @IsBoolean()
  smsReminders?: boolean;

  @ApiPropertyOptional({ description: "Enable push notifications" })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ description: "Receive push for booking updates" })
  @IsOptional()
  @IsBoolean()
  pushBookingUpdates?: boolean;

  @ApiPropertyOptional({ description: "Receive push for messages" })
  @IsOptional()
  @IsBoolean()
  pushMessages?: boolean;

  // Helper to get all preferences as object
  get preferences() {
    return {
      emailBookingUpdates: this.emailBookingUpdates,
      emailMessages: this.emailMessages,
      emailReviews: this.emailReviews,
      emailPromotions: this.emailPromotions,
      smsBookingUpdates: this.smsBookingUpdates,
      smsMessages: this.smsMessages,
      smsReminders: this.smsReminders,
      pushEnabled: this.pushEnabled,
      pushBookingUpdates: this.pushBookingUpdates,
      pushMessages: this.pushMessages,
    };
  }
}
