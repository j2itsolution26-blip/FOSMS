import assert from "node:assert";
import { formatGuestFullName } from "../../src/lib/formatters";

console.log("Running unit tests for formatGuestFullName...");

// Test 1: First + Middle + Last
assert.strictEqual(
  formatGuestFullName({ firstName: "James", middleName: "Casido", lastName: "Tan" }),
  "James C. Tan"
);

// Test 2: Pre-dotted middle initial
assert.strictEqual(
  formatGuestFullName({ firstName: "James", middleName: "C.", lastName: "Tan" }),
  "James C. Tan"
);

// Test 3: Blank middle name (no dangling period)
assert.strictEqual(
  formatGuestFullName({ firstName: "James", middleName: "", lastName: "Tan" }),
  "James Tan"
);

// Test 4: Null middle name
assert.strictEqual(
  formatGuestFullName({ firstName: "James", middleName: null, lastName: "Tan" }),
  "James Tan"
);

// Test 5: Whitespace middle name
assert.strictEqual(
  formatGuestFullName({ firstName: "James", middleName: "   ", lastName: "Tan" }),
  "James Tan"
);

// Test 6: Null or undefined object
assert.strictEqual(formatGuestFullName(null), "");
assert.strictEqual(formatGuestFullName(undefined), "");

console.log("All unit tests passed cleanly!");
