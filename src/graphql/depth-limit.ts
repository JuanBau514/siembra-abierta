import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
} from 'graphql';

type Fragments = Record<string, FragmentDefinitionNode>;

function measure(
  selectionSet: SelectionSetNode,
  fragments: Fragments,
  visiting: Set<string>,
): number {
  let deepest = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value.startsWith('__')) continue;
      const inner = selection.selectionSet
        ? measure(selection.selectionSet, fragments, visiting)
        : 0;
      deepest = Math.max(deepest, 1 + inner);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      deepest = Math.max(
        deepest,
        measure(selection.selectionSet, fragments, visiting),
      );
    } else {
      const name = selection.name.value;
      const fragment = fragments[name];
      if (fragment && !visiting.has(name)) {
        visiting.add(name);
        deepest = Math.max(
          deepest,
          measure(fragment.selectionSet, fragments, visiting),
        );
        visiting.delete(name);
      }
    }
  }
  return deepest;
}

/** Regla de validación: rechaza consultas con más de `maxDepth` niveles. */
export function depthLimit(maxDepth: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments: Fragments = {};
    for (const definition of context.getDocument().definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragments[definition.name.value] = definition;
      }
    }
    return {
      OperationDefinition(node) {
        const depth = measure(node.selectionSet, fragments, new Set());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `La consulta tiene profundidad ${depth}; el máximo permitido es ${maxDepth}.`,
              { nodes: [node] },
            ),
          );
        }
      },
    };
  };
}
