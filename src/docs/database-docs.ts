/** Genera la documentación de la base de datos (diccionario de datos + diagrama ER) desde el esquema de Prisma. */

interface DmmfField {
  name: string;
  dbName?: string | null;
  kind: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  hasDefaultValue: boolean;
  default?: unknown;
  documentation?: string;
  relationFromFields?: string[];
  relationToFields?: string[];
  relationOnDelete?: string;
}
interface DmmfModel {
  name: string;
  dbName: string | null;
  documentation?: string;
  fields: DmmfField[];
}
interface DmmfEnum {
  name: string;
  dbName?: string | null;
  documentation?: string;
  values: { name: string; dbName?: string | null; documentation?: string }[];
}
interface DmmfIndex {
  model: string;
  type: 'id' | 'unique' | 'normal' | 'fulltext';
  isDefinedOnField: boolean;
  fields: { name: string }[];
}
export interface Dmmf {
  datamodel: { models: DmmfModel[]; enums: DmmfEnum[]; indexes: DmmfIndex[] };
}

const PG_TYPES: Record<string, string> = {
  String: 'text',
  Int: 'integer',
  Float: 'double precision',
  Boolean: 'boolean',
  DateTime: 'timestamp(3)',
};

const oneLine = (text?: string) =>
  (text ?? '').replace(/\s*\n\s*/g, ' ').trim();
const cell = (text: string) => text.replace(/\|/g, '\\|');
const table = (model: DmmfModel) => model.dbName ?? model.name;
const column = (field: DmmfField) => field.dbName ?? field.name;
/** Nombre de la columna en la base de datos a partir del nombre del campo en el código. */
const columnOf = (model: DmmfModel, fieldName: string) => {
  const field = model.fields.find((f) => f.name === fieldName);
  return field ? column(field) : fieldName;
};

function describeDefault(field: DmmfField): string {
  if (!field.hasDefaultValue) return '';
  const value = field.default as { name?: string } | string | number | boolean;
  if (typeof value === 'object' && value !== null) {
    const names: Record<string, string> = {
      now: 'now()',
      cuid: 'cuid (app)',
      uuid: 'uuid (app)',
      autoincrement: 'autoincrement',
    };
    return names[value.name ?? ''] ?? String(value.name);
  }
  return `\`${String(value)}\``;
}

function relationLine(
  model: DmmfModel,
  field: DmmfField,
  models: DmmfModel[],
): string | null {
  if (field.kind !== 'object' || !field.relationFromFields?.length) return null;
  const target = models.find((m) => m.name === field.type)!;
  const parent = table(target);
  const child = table(model);
  // Mermaid: el lado del hijo es "muchos"; el padre es obligatorio u opcional.
  const parentSide = field.isRequired ? '||' : '|o';
  return `  ${parent} ${parentSide}--o{ ${child} : "${field.relationFromFields.map((f) => columnOf(model, f)).join(', ')}"`;
}

export function renderDatabaseDocs(dmmf: Dmmf, migrations: string[]): string {
  const { models, enums, indexes } = dmmf.datamodel;
  const enumDbName = (name: string) =>
    enums.find((e) => e.name === name)?.dbName ?? name;
  const out: string[] = [];

  out.push('# Base de datos');
  out.push('');
  out.push(
    '> Documento **generado** desde `prisma/schema.prisma`. No lo edites a mano:',
  );
  out.push('> cambia el esquema y ejecuta `pnpm docs:generate`.');
  out.push('');
  out.push(
    'Motor: PostgreSQL 17. Cómo conectarte con DBeaver: [DATABASE.md](../DATABASE.md).',
  );
  out.push('');

  out.push('## Diagrama entidad-relación');
  out.push('');
  out.push('```mermaid');
  out.push('erDiagram');
  for (const model of models) {
    out.push(`  ${table(model)} {`);
    const foreignKeys = new Set(
      model.fields.flatMap((f) => f.relationFromFields ?? []),
    );
    for (const field of model.fields.filter((f) => f.kind !== 'object')) {
      const type =
        field.kind === 'enum'
          ? enumDbName(field.type)
          : (PG_TYPES[field.type] ?? field.type)
              .replace(/\(.*\)/, '')
              .replace(/ /g, '_');
      const keys = [
        field.isId && 'PK',
        foreignKeys.has(field.name) && 'FK',
        field.isUnique && 'UK',
      ]
        .filter(Boolean)
        .join(',');
      out.push(`    ${type} ${column(field)}${keys ? ` ${keys}` : ''}`);
    }
    out.push('  }');
  }
  for (const model of models) {
    for (const field of model.fields) {
      const line = relationLine(model, field, models);
      if (line) out.push(line);
    }
  }
  out.push('```');
  out.push('');

  out.push('## Tablas');
  out.push('');
  out.push('| Tabla | Modelo (código) | Descripción |');
  out.push('|---|---|---|');
  for (const model of models) {
    out.push(
      `| [\`${table(model)}\`](#${table(model)}) | ${model.name} | ${cell(oneLine(model.documentation))} |`,
    );
  }
  out.push('');

  for (const model of models) {
    out.push(`### ${table(model)}`);
    out.push('');
    if (model.documentation) out.push(oneLine(model.documentation), '');
    out.push(
      '| Columna | Campo (código) | Tipo | Nulo | Clave | Por defecto | Descripción |',
    );
    out.push('|---|---|---|---|---|---|---|');
    const foreignKeys = new Map<string, string>();
    for (const field of model.fields) {
      for (const [i, from] of (field.relationFromFields ?? []).entries()) {
        const target = models.find((m) => m.name === field.type)!;
        foreignKeys.set(
          from,
          `${table(target)}.${field.relationToFields![i]}${field.relationOnDelete ? ` (ON DELETE ${field.relationOnDelete.toUpperCase()})` : ''}`,
        );
      }
    }
    const primary = new Set(
      indexes
        .filter((i) => i.model === model.name && i.type === 'id')
        .flatMap((i) => i.fields.map((f) => f.name)),
    );
    for (const field of model.fields.filter((f) => f.kind !== 'object')) {
      const type =
        field.kind === 'enum'
          ? `enum ${enumDbName(field.type)}`
          : (PG_TYPES[field.type] ?? field.type);
      const keys = [
        primary.has(field.name) && 'PK',
        foreignKeys.has(field.name) && `FK → ${foreignKeys.get(field.name)}`,
        field.isUnique && 'único',
      ]
        .filter(Boolean)
        .join('; ');
      out.push(
        `| \`${column(field)}\` | \`${field.name}\` | ${type} | ${field.isRequired ? 'no' : 'sí'} | ${cell(keys)} | ${describeDefault(field)} | ${cell(oneLine(field.documentation))} |`,
      );
    }
    out.push('');
    const own = indexes.filter(
      (i) => i.model === model.name && i.type !== 'id' && !i.isDefinedOnField,
    );
    const inline = indexes.filter(
      (i) =>
        i.model === model.name && i.type === 'unique' && i.isDefinedOnField,
    );
    if (own.length + inline.length > 0) {
      out.push('Índices y restricciones:', '');
      for (const index of [...inline, ...own]) {
        const kind = index.type === 'unique' ? 'único' : 'índice';
        out.push(
          `- ${kind}: (${index.fields.map((f) => `\`${columnOf(model, f.name)}\``).join(', ')})`,
        );
      }
      out.push('');
    }
    const compositeKey = [...primary];
    if (compositeKey.length > 1)
      out.push(
        `Clave primaria compuesta: (${compositeKey.map((c) => `\`${c}\``).join(', ')})`,
        '',
      );
  }

  out.push('## Enumeraciones');
  out.push('');
  for (const e of enums) {
    out.push(`### ${e.dbName ?? e.name}`, '');
    if (e.documentation) out.push(oneLine(e.documentation), '');
    if (e.dbName) out.push(`Enumeración del código: \`${e.name}\`.`, '');
    for (const value of e.values) {
      const code =
        value.dbName && value.dbName !== value.name
          ? ` (código: \`${value.name}\`)`
          : '';
      const description = value.documentation
        ? `: ${oneLine(value.documentation)}`
        : '';
      out.push(`- \`${value.dbName ?? value.name}\`${code}${description}`);
    }
    out.push('');
  }

  out.push('## Historial de migraciones');
  out.push('');
  out.push(
    'Cada cambio en las tablas queda en `prisma/migrations/`, en orden cronológico:',
  );
  out.push('');
  for (const m of migrations) out.push(`- \`${m}\``);
  out.push('');
  return out.join('\n');
}
