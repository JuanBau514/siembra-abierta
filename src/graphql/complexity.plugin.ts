import { Plugin } from '@nestjs/apollo';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import type {
  ApolloServerPlugin,
  GraphQLRequestListener,
} from '@apollo/server';
import { GraphQLError } from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';

/** Rechaza consultas cuyo costo estimado supera el máximo configurado. */
@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  constructor(
    @Inject(GraphQLSchemaHost) private readonly schemaHost: GraphQLSchemaHost,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const { schema } = this.schemaHost;
    const max = Number(this.config.get('GRAPHQL_MAX_COMPLEXITY') ?? 1000);
    return {
      async didResolveOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });
        if (complexity > max) {
          throw new GraphQLError(
            `La consulta es demasiado costosa (${complexity}); el máximo permitido es ${max}.`,
            { extensions: { code: 'QUERY_TOO_COMPLEX' } },
          );
        }
      },
    };
  }
}
