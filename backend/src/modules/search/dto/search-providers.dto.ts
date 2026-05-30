import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum ProviderSortBy {
  RELEVANCE = "relevance",
  RATING = "rating",
  TRUST = "trust",
  REVIEWS = "reviews",
  DISTANCE = "distance",
  NEWEST = "newest",
  PRICE_LOW = "priceLow",
  PRICE_HIGH = "priceHigh",
}

/** Accepts either `categoryIds=a,b,c` OR `categoryIds=a&categoryIds=b`. */
const splitToArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value == null || value === "") return undefined;
  if (Array.isArray(value))
    return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const toBool = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  return value === true || value === "true" || value === "1";
};

export class AdvancedSearchProvidersDto {
  @ApiPropertyOptional({ description: "Free-text query (fuzzy / trigram)" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(splitToArray)
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ description: "Center latitude for radius search" })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: "Center longitude for radius search" })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ default: 25, description: "Radius in km (1–200)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm?: number;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxHourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({
    description:
      "When true, restrict to providers with availability today (placeholder — currently filters on isActive + verified).",
  })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  availableToday?: boolean;

  @ApiPropertyOptional({ enum: ProviderSortBy, default: ProviderSortBy.RELEVANCE })
  @IsOptional()
  @IsEnum(ProviderSortBy)
  sortBy?: ProviderSortBy = ProviderSortBy.RELEVANCE;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class SuggestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}
