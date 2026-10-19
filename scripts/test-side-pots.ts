// Compatibility entry point: exercise the real room implementation.
process.env.POKER_TEST_MODE = '1';
void import('./test-server-regressions.ts').catch(error => {
  console.error(error);
  process.exitCode = 1;
});
