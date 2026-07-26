import { getDailyConfig } from "./index";

async function runTests() {
  console.log("-----------------------------------------");
  console.log("🧪 Running Daily Config Transition Tests...");
  console.log("-----------------------------------------");

  // Test 1: Verify legacy unconstrained behavior before May 29, 2026
  console.log("1. Verifying unconstrained pre-transition configs...");
  const dateBefore = "2026-05-20";
  const configAuth = await getDailyConfig(true, dateBefore);
  const configGuest = await getDailyConfig(false, dateBefore);
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
      const config = await getDailyConfig(authStatus, currentStr);
      
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
  const run1 = await getDailyConfig(true, dateTest);
  const run2 = await getDailyConfig(true, dateTest);
  if (run1.word !== run2.word || run1.length !== run2.length) {
    throw new Error(`Determinism violation on ${dateTest}!`);
  }
  console.log(`   ✅ Success! Deterministic results verified.`);
  
  // Test 4: Verify Unpredictable Weekly Word Length Rotation starting July 27, 2026
  console.log("\n4. Verifying Unpredictable Weekly Word Length Rotation starting July 27, 2026...");
  
  const testWeeks = [
    { start: "2026-07-27", end: "2026-08-02", name: "Week 31" },
    { start: "2026-08-03", end: "2026-08-09", name: "Week 32" },
  ];

  for (const week of testWeeks) {
    const lengths: number[] = [];
    const current = new Date(week.start);
    const endDate = new Date(week.end);

    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];
      const config = await getDailyConfig(true, dateStr);
      lengths.push(config.length);

      current.setDate(current.getDate() + 1);
    }

    console.log(`   ${week.name} (${week.start} to ${week.end}) lengths:`, lengths);

    // Verify 7-day composition: 2x 4L, 2x 5L, 2x 6L, 1x 7L
    const count4 = lengths.filter(l => l === 4).length;
    const count5 = lengths.filter(l => l === 5).length;
    const count6 = lengths.filter(l => l === 6).length;
    const count7 = lengths.filter(l => l === 7).length;

    if (count4 !== 2 || count5 !== 2 || count6 !== 2 || count7 !== 1) {
      throw new Error(`Weekly pool composition mismatch for ${week.name}! Got: 4L:${count4}, 5L:${count5}, 6L:${count6}, 7L:${count7}`);
    }

    // Verify no adjacent matching lengths
    for (let i = 0; i < lengths.length - 1; i++) {
      if (lengths[i] === lengths[i + 1]) {
        throw new Error(`Adjacent duplicate length violation in ${week.name} at index ${i}: ${lengths[i]}L and ${lengths[i + 1]}L`);
      }
    }
  }

  console.log(`   ✅ Success! Weekly pool composition and non-adjacent constraints verified.`);

  console.log("\n-----------------------------------------");
  console.log("🎉 ALL DAILY CONFIG TESTS PASSED!");
  console.log("-----------------------------------------");
}

(async () => {
  try {
    await runTests();
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
})();

