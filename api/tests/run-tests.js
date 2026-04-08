const suites = [
  require('./chat.test'),
  require('./semanticStyleProfile.test'),
  require('./recommendations.test'),
];

async function main() {
  let passed = 0;
  let failed = 0;

  for (const suite of suites) {
    for (const testCase of suite) {
      try {
        await testCase.run();
        passed += 1;
        console.log(`PASS ${testCase.name}`);
      } catch (error) {
        failed += 1;
        console.error(`FAIL ${testCase.name}`);
        console.error(error && error.stack ? error.stack : error);
      }
    }
  }

  console.log(`\nTest summary: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Failed to run tests');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
