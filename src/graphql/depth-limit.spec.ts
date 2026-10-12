import { buildSchema, parse, validate } from 'graphql';
import { depthLimit } from './depth-limit.js';

const schema = buildSchema(`
  type Node { id: ID, child: Node }
  type Query { node: Node }
`);

const run = (query: string, max: number) =>
  validate(schema, parse(query), [depthLimit(max)]).map((e) => e.message);

describe('depthLimit', () => {
  it('permite consultas dentro del límite', () => {
    expect(run('{ node { id child { id } } }', 3)).toEqual([]);
  });

  it('rechaza consultas que superan el límite', () => {
    const errors = run('{ node { child { child { child { id } } } } }', 3);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('profundidad 5');
  });

  it('cuenta la profundidad a través de fragmentos', () => {
    const q = `query { node { ...F } } fragment F on Node { child { child { id } } }`;
    expect(run(q, 3)).toHaveLength(1);
  });

  it('ignora la introspección', () => {
    expect(run('{ __schema { types { name } } }', 1)).toEqual([]);
  });
});
