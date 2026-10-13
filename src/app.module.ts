import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ComplexityPlugin } from './graphql/complexity.plugin.js';
import { depthLimit } from './graphql/depth-limit.js';
import { HealthController } from './health/health.controller.js';
import { resolveLang } from './i18n/i18n.js';
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
        // API pública: el esquema es abierto para que las herramientas lo exploren.
        introspection: true,
        // Idioma de la respuesta: ?lang=es|en o el encabezado Accept-Language.
        context: ({
          req,
        }: {
          req: {
            headers: Record<string, string | string[] | undefined>;
            query?: Record<string, unknown>;
          };
        }) => ({
          lang: resolveLang(req.headers['accept-language'], req.query?.lang),
        }),
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
