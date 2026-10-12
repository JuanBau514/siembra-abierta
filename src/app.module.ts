import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ComplexityPlugin } from './graphql/complexity.plugin.js';
import { depthLimit } from './graphql/depth-limit.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SpeciesModule } from './species/species.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        autoSchemaFile: true,
        sortSchema: true,
        validationRules: [
          depthLimit(Number(config.get('GRAPHQL_MAX_DEPTH') ?? 8)),
        ],
      }),
    }),
    SpeciesModule,
  ],
  controllers: [HealthController],
  providers: [ComplexityPlugin],
})
export class AppModule {}
