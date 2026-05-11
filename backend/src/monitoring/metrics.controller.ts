import {
  Controller,
  Get,
  Header,
  Headers,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { MetricsService } from "./metrics.service";

@Controller("metrics")
@ApiTags("monitoring")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  @Header("Content-Type", "text/plain")
  @ApiOperation({ summary: "Get Prometheus metrics" })
  @ApiResponse({
    status: 200,
    description: "Prometheus metrics in text format",
  })
  async getMetrics(
    @Headers("authorization") authHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    // Optional HTTP Basic auth — enabled by setting both env vars. Grafana
    // Cloud's hosted Prometheus authenticates this way when scraping over
    // the public internet.
    const user = process.env.METRICS_AUTH_USER;
    const pass = process.env.METRICS_AUTH_PASSWORD;
    if (user && pass) {
      const expected =
        "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
      if (authHeader !== expected) {
        res.setHeader("WWW-Authenticate", 'Basic realm="metrics"');
        throw new UnauthorizedException("Invalid metrics credentials");
      }
    }
    return this.metricsService.getMetrics();
  }
}
