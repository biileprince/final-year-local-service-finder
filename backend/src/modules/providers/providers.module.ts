import { Module } from "@nestjs/common";
import { ProvidersService } from "./providers.service";
import { ProvidersController } from "./providers.controller";
import { ProvidersRepository } from "./providers.repository";

@Module({
  providers: [ProvidersService, ProvidersRepository],
  controllers: [ProvidersController],
  exports: [ProvidersService],
})
export class ProvidersModule {}
