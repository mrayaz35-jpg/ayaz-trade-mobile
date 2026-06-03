const {
  evaluateCandidate,
  selectFinalSeven,
  executionGate
} = require("./src/championSelectorV153");

const candidates = require("./sample_candidates.json");

console.log("Tek tek değerlendirme:");
for (const c of candidates) {
  console.log(evaluateCandidate(c));
}

console.log("\nFinal Long:");
console.log(selectFinalSeven(candidates, "LONG"));

console.log("\nFinal Short:");
const finalShorts = selectFinalSeven(candidates, "SHORT");
console.log(finalShorts);

if (finalShorts[0]) {
  console.log("\nCanlı icra kapısı:");
  console.log(executionGate(finalShorts[0], finalShorts[0].raw.livePrice));
}
