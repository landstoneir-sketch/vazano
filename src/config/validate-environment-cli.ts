import { validateEnvironment } from './environment';

try {
  validateEnvironment(process.env);
  process.stdout.write('Production environment validation passed.\n');
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Production environment validation failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
