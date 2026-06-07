import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { SearchService } from "./search.service";
import {
  AdvancedSearchProvidersDto,
  SuggestDto,
} from "./dto/search-providers.dto";
import { Public } from "../../common/decorators/public.decorator";

@Controller("search")
@ApiTags("search")
@Public()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("suggest")
  @Throttle({ short: { limit: 30, ttl: 5_000 } })
  @ApiOperation({
    summary:
      "Typeahead suggestions across categories, providers, specialties, locations",
  })
  async suggest(@Query() dto: SuggestDto) {
    return this.searchService.suggest(dto.q ?? "", dto.limit ?? 5);
  }

  @Get("trending")
  @ApiOperation({
    summary: "Trending categories, popular providers, top search terms",
  })
  async trending() {
    return this.searchService.trending();
  }

  @Get("locations")
  @ApiOperation({
    summary: "Top locations by active provider count (homepage city panel)",
  })
  async topLocations(@Query("limit") limit?: string) {
    const n = Number(limit);
    return this.searchService.topLocations(
      Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 8,
    );
  }

  @Get("stats")
  @ApiOperation({
    summary: "Live platform totals (verified providers, categories, bookings, avg rating)",
  })
  async stats() {
    return this.searchService.platformStats();
  }

  @Get("providers")
  @ApiOperation({
    summary:
      "Advanced provider search with full-text, multi-category filter, geo-radius, and rich sorting",
  })
  async searchProviders(@Query() dto: AdvancedSearchProvidersDto) {
    return this.searchService.searchProviders(dto);
  }
}
