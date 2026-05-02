import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../database/prisma.service";
import { CacheService } from "../../cache/cache.service";

interface HealthStatus {
  status: "ok" | "error";
  timestamp: string;
  services: {
    database: "up" | "down";
    cache: "up" | "down";
  };
  uptime: number;
}

@Controller("health")
@ApiTags("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "Health check endpoint" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  @ApiResponse({ status: 503, description: "Service is unhealthy" })
  async check(): Promise<HealthStatus> {
    const [dbStatus, cacheStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    const allHealthy = dbStatus === "up" && cacheStatus === "up";

    return {
      status: allHealthy ? "ok" : "error",
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        cache: cacheStatus,
      },
      uptime: process.uptime(),
    };
  }

  @Get("ready")
  @Public()
  @ApiOperation({ summary: "Readiness check" })
  async ready(): Promise<{ ready: boolean }> {
    const dbReady = await this.checkDatabase();
    return { ready: dbReady === "up" };
  }

  @Get("live")
  @Public()
  @ApiOperation({ summary: "Liveness check" })
  live(): { live: boolean } {
    return { live: true };
  }

  private async checkDatabase(): Promise<"up" | "down"> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "up";
    } catch {
      return "down";
    }
  }

  private async checkCache(): Promise<"up" | "down"> {
    try {
      await this.cache.set("health:check", "ok", 10);
      const value = await this.cache.get("health:check");
      return value === "ok" ? "up" : "down";
    } catch {
      return "down";
    }
  }
}
