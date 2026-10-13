import {
  GraphQLEnumType,
  GraphQLObjectType,
  getNamedType,
  isEnumType,
  isNonNullType,
  isObjectType,
  isScalarType,
  lexicographicSortSchema,
  printSchema,
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLSchema,
} from 'graphql';

const oneLine = (text?: string | null) =>
  (text ?? '').replace(/\s*\n\s*/g, ' ').trim();
const cell = (text: string) => text.replace(/\|/g, '\\|');
const BUILT_IN = /^(String|Int|Float|Boolean|ID)$/;

/** Tipo en código; los tipos propios enlazan a su sección. */
function typeLabel(type: { toString(): string }): string {
  const raw = type.toString();
  const name = raw.replace(/[[\]!]/g, '');
  return BUILT_IN.test(name)
    ? `\`${raw}\``
    : `[\`${raw}\`](#${name.toLowerCase()})`;
}

/** Valor de ejemplo válido para un argumento, para que la consulta de muestra se pueda ejecutar. */
function exampleValue(arg: GraphQLArgument): string {
  if (arg.defaultValue !== undefined) return JSON.stringify(arg.defaultValue);
  const name = getNamedType(arg.type).name;
  if (name === 'Int') return '5';
  if (name === 'ID') return '"ID"';
  if (/iso/i.test(arg.name)) return '"CO"';
  return '"almácigo"';
}

function renderArgs(args: readonly GraphQLArgument[]): string[] {
  if (args.length === 0) return [];
  const rows = [
    '| Argumento | Tipo | Por defecto | Descripción |',
    '|---|---|---|---|',
  ];
  for (const arg of args) {
    const required = isNonNullType(arg.type) && arg.defaultValue === undefined;
    rows.push(
      `| \`${arg.name}\` | ${typeLabel(arg.type)}${required ? ' (obligatorio)' : ''} | ${arg.defaultValue === undefined ? '' : `\`${JSON.stringify(arg.defaultValue)}\``} | ${cell(oneLine(arg.description))} |`,
    );
  }
  return rows;
}

function renderOperation(field: GraphQLField<unknown, unknown>): string[] {
  const out = [`### ${field.name}`, ''];
  if (field.description) out.push(oneLine(field.description), '');
  out.push(`Devuelve: ${typeLabel(field.type)}`, '');
  out.push(...renderArgs(field.args));
  if (field.args.length) out.push('');
  const args = field.args.length
    ? `(${field.args.map((a) => `${a.name}: ${exampleValue(a)}`).join(', ')})`
    : '';
  const named = getNamedType(field.type);
  const selection = isObjectType(named)
    ? ` { ${Object.keys(named.getFields())
        .filter((n) => !isObjectType(getNamedType(named.getFields()[n].type)))
        .slice(0, 4)
        .join(' ')} }`
    : '';
  out.push('```graphql', `{ ${field.name}${args}${selection} }`, '```', '');
  return out;
}

/** Documentación de referencia de la API GraphQL, generada desde el esquema real. */
export function renderApiReference(schema: GraphQLSchema): string {
  const sorted = lexicographicSortSchema(schema);
  const out = [
    '# Referencia de la API GraphQL',
    '',
    '> Documento **generado** desde el esquema real de la API. No lo edites a mano:',
    '> cambia el código y ejecuta `pnpm docs:generate`.',
    '',
    'Cómo conectarte y ejemplos de uso: [API.md](../API.md). Esquema en formato SDL: [`schema.graphql`](schema.graphql).',
    '',
  ];

  const query = sorted.getQueryType();
  if (query) {
    out.push('## Consultas (Query)', '');
    for (const field of Object.values(query.getFields()))
      out.push(...renderOperation(field));
  }
  const mutation = sorted.getMutationType();
  if (mutation) {
    out.push('## Mutaciones (Mutation)', '');
    for (const field of Object.values(mutation.getFields()))
      out.push(...renderOperation(field));
  }

  const types = Object.values(sorted.getTypeMap()).filter(
    (t) =>
      !t.name.startsWith('__') &&
      !isScalarType(t) &&
      t !== query &&
      t !== mutation,
  );
  const objects = types.filter((t): t is GraphQLObjectType => isObjectType(t));
  const enums = types.filter((t): t is GraphQLEnumType => isEnumType(t));

  out.push('## Tipos', '');
  for (const type of objects) {
    out.push(`### ${type.name}`, '');
    if (type.description) out.push(oneLine(type.description), '');
    out.push('| Campo | Tipo | Descripción |', '|---|---|---|');
    for (const field of Object.values(type.getFields())) {
      out.push(
        `| \`${field.name}\` | ${typeLabel(field.type)} | ${cell(oneLine(field.description))} |`,
      );
    }
    out.push('');
  }
  out.push('## Enumeraciones', '');
  for (const type of enums) {
    out.push(`### ${type.name}`, '');
    if (type.description) out.push(oneLine(type.description), '');
    for (const value of type.getValues())
      out.push(
        `- \`${value.name}\`${value.description ? `: ${oneLine(value.description)}` : ''}`,
      );
    out.push('');
  }
  return out.join('\n');
}

export const renderSdl = (schema: GraphQLSchema) =>
  `${printSchema(lexicographicSortSchema(schema))}\n`;
