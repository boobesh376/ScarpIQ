// Test file for parseGeminiResponse
const { parseGeminiResponse } = require('./services/imageAnalysis.js');

// Test 1: Valid response
console.log('=== TEST 1: Valid response ===');
const validResponse = JSON.stringify({
  material: "copper",
  category: "metal",
  condition: "good",
  cleanliness: "clean",
  estimatedWeightKg: 2.5,
  confidence: 0.95,
  reasoning: [
    "Reddish-orange coloration consistent with copper",
    "Metallic sheen with minimal oxidation",
    "Wire form typical of scrap copper"
  ]
});

try {
  const result1 = parseGeminiResponse(validResponse);
  console.log('Result:', JSON.stringify(result1, null, 2));
  
  const requiredFields = ['material', 'category', 'condition', 'cleanliness', 'estimatedWeightKg', 'confidence', 'confidenceScore', 'reasoning'];
  const hasAllFields = requiredFields.every(field => field in result1);
  console.log('\nHas all required fields:', hasAllFields);
  console.log('Field checks:');
  console.log('  - material:', typeof result1.material === 'string', '(' + result1.material + ')');
  console.log('  - category:', typeof result1.category === 'string', '(' + result1.category + ')');
  console.log('  - condition:', typeof result1.condition === 'string', '(' + result1.condition + ')');
  console.log('  - cleanliness:', typeof result1.cleanliness === 'string', '(' + result1.cleanliness + ')');
  console.log('  - estimatedWeightKg:', typeof result1.estimatedWeightKg, '(' + result1.estimatedWeightKg + ')');
  console.log('  - confidence:', typeof result1.confidence === 'number', '(value: ' + result1.confidence + ', range: 0-1)');
  console.log('  - confidenceScore:', typeof result1.confidenceScore === 'number', '(value: ' + result1.confidenceScore + ', range: 0-100)');
  console.log('  - reasoning:', Array.isArray(result1.reasoning), '(length: ' + result1.reasoning.length + ')');
} catch (err) {
  console.error('ERROR:', err.message);
}

// Test 2: Response with markdown fences
console.log('\n=== TEST 2: Response with markdown fences ===');
const fencedResponse = '```json\n' + JSON.stringify({
  material: "aluminum",
  category: "metal",
  condition: "used",
  cleanliness: "moderate",
  estimatedWeightKg: 1.2,
  confidence: 0.75,
  reasoning: ["Silvery color", "Lightweight appearance"]
}) + '\n```';

try {
  const result2 = parseGeminiResponse(fencedResponse);
  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('\nconfidence is in 0-1 range:', result2.confidence >= 0 && result2.confidence <= 1);
  console.log('confidenceScore is in 0-100 range:', result2.confidenceScore >= 0 && result2.confidenceScore <= 100);
} catch (err) {
  console.error('ERROR:', err.message);
}

// Test 3: Confidence clamping test
console.log('\n=== TEST 3: Confidence values (0-1 clamping) ===');
const confTests = [
  { confidence: 1.5, expectedClipped: 1 },
  { confidence: 0, expectedClipped: 0 },
  { confidence: 0.5, expectedClipped: 0.5 },
  { confidence: -0.5, expectedClipped: 0 }
];

confTests.forEach((test, idx) => {
  const resp = JSON.stringify({ confidence: test.confidence });
  try {
    const result = parseGeminiResponse(resp);
    console.log(`  Test ${idx+1}: input=${test.confidence} -> confidence=${result.confidence}, confidenceScore=${result.confidenceScore}, clipped=${result.confidence === test.expectedClipped}`);
  } catch (err) {
    console.error(`  Test ${idx+1}: ERROR - ${err.message}`);
  }
});

// Test 4: Minimal valid response
console.log('\n=== TEST 4: Minimal response (edge case) ===');
const minimalResponse = JSON.stringify({ confidence: 0.5 });

try {
  const result4 = parseGeminiResponse(minimalResponse);
  console.log('Result:', JSON.stringify(result4, null, 2));
  console.log('\nDefaults applied:');
  console.log('  - material defaults to:', result4.material);
  console.log('  - category defaults to:', result4.category);
  console.log('  - condition defaults to:', result4.condition);
  console.log('  - cleanliness defaults to:', result4.cleanliness);
  console.log('  - reasoning generated:', result4.reasoning);
} catch (err) {
  console.error('ERROR:', err.message);
}

// Test 5: Full realistic response
console.log('\n=== TEST 5: Full realistic Gemini-like response ===');
const realisticResponse = JSON.stringify({
  material: "steel",
  category: "metal",
  condition: "damaged",
  cleanliness: "dirty",
  estimatedWeightKg: 12.5,
  confidence: 88,
  reasoning: [
    "Ferrous metal with significant rust formation",
    "Bent and corroded structural components",
    "Heavy contamination visible on surface"
  ]
});

try {
  const result5 = parseGeminiResponse(realisticResponse);
  console.log('Result:', JSON.stringify(result5, null, 2));
  console.log('\nVerification:');
  console.log('  - Confidence converted to 0-1:', result5.confidence <= 1 ? 'YES (value: ' + result5.confidence + ')' : 'NO - ERROR!');
  console.log('  - ConfidenceScore for UI:', result5.confidenceScore, '(should be 0-100)');
  console.log('  - Reasoning preserved:', result5.reasoning.length, 'items');
} catch (err) {
  console.error('ERROR:', err.message);
}

console.log('\n=== ALL TESTS COMPLETE ===');
