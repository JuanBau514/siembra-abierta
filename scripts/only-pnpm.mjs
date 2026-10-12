// Bloquea npm, yarn y bun: este proyecto solo se instala con pnpm.
const agent = process.env.npm_config_user_agent ?? '';
if (!agent.startsWith('pnpm/')) {
  console.error(
    '\n⛔ Este proyecto solo admite pnpm.\n' +
      '   Instálalo con: corepack enable && corepack prepare pnpm@latest --activate\n' +
      '   Luego usa: pnpm install\n',
  );
  process.exit(1);
}
