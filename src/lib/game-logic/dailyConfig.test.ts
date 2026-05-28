import { getDailyConfig } from "./index";

function runTests() {
  console.log("-----------------------------------------");
  console.log("🧪 Running Daily Config Transition Tests...");
  console.log("-----------------------------------------");

  // Test 1: Verify legacy unconstrained behavior before May 29, 2026
  console.log("1. Verifying unconstrained pre-transition configs...");
  const dateBefore = "2026-05-20";
  const configAuth = getDailyConfig(true, dateBefore);
  const configGuest = getDailyConfig(false, dateBefore);
  console.log(`   Auth [${dateBefore}]: ${configAuth.word} (${configAuth.length}L)`);
  console.log(`   Guest [${dateBefore}]: ${configGuest.word} (${configGuest.length}L)`);

  // Test 2: Verify consecutive length constraints starting May 29, 2026
  console.log("\n2. Verifying consecutive length constraints (May 29 - July 15, 2026)...");
  
  for (const authStatus of [true, false]) {
    console.log(`   Testing with isAuthenticated = ${authStatus}...`);
    let prevLength: number | null = null;
    let prevWord: string | null = null;
    
    const startDate = new Date("2026-05-15");
    const endDate = new Date("2026-07-15");
    
    const current = new Date(startDate);
    while (current <= endDate) {
      const currentStr = current.toISOString().split("T")[0];
      const config = getDailyConfig(authStatus, currentStr);
      
      if (currentStr >= "2026-05-29") {
        if (prevLength !== null && config.length === prevLength) {
          throw new Error(
            `Violation on ${currentStr} (auth=${authStatus}): Consecutive length is both ${config.length}L. Prev: ${prevWord}, Current: ${config.word}`
          );
        }
      }
      
      prevLength = config.length;
      prevWord = config.word;
      current.setDate(current.getDate() + 1);
    }
    console.log(`   ✅ Success! No successive duplicate lengths found.`);
  }

  // Test 3: Verify determinism (multiple calls return same values)
  console.log("\n3. Verifying determinism...");
  const dateTest = "2026-06-12";
  const run1 = getDailyConfig(true, dateTest);
  const run2 = getDailyConfig(true, dateTest);
  if (run1.word !== run2.word || run1.length !== run2.length) {
    throw new Error(`Determinism violation on ${dateTest}!`);
  }
  console.log(`   ✅ Success! Deterministic results verified.`);
  
  console.log("\n-----------------------------------------");
  console.log("🎉 ALL DAILY CONFIG TESTS PASSED!");
  console.log("-----------------------------------------");
}

try {
  runTests();
  const nodeProcess = (globalThis as any).process;
  if (nodeProcess && typeof nodeProcess.exit === "function") {
    nodeProcess.exit(0);
  }
} catch (error: any) {
  console.error("❌ TEST FAILURE:", error.message);
  const nodeProcess = (globalThis as any).process;
  if (nodeProcess && typeof nodeProcess.exit === "function") {
    nodeProcess.exit(1);
  }
}
