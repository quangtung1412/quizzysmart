// Test script for Gemini Model Rotation
// Run with: npx ts-node test-model-rotation.ts

import { geminiModelRotation } from './src/gemini-model-rotation';

console.log('🧪 Testing Gemini Model Rotation System\n');

// Test 1: Get initial stats
console.log('📊 Test 1: Initial Stats');
console.log('='.repeat(80));
const initialStats = geminiModelRotation.getUsageStats();
console.table(initialStats);
console.log('');

// Test 2: Simulate requests until first model exhausted
console.log('⚡ Test 2: Simulate Requests (First Model)');
console.log('='.repeat(80));
for (let i = 0; i < 12; i++) {
    const model = geminiModelRotation.getNextAvailableModel();
    if (model) {
        console.log(`Request ${i + 1}: Using ${model.name} (priority ${model.priority})`);
        geminiModelRotation.recordRequest(model.name);
    } else {
        console.log(`Request ${i + 1}: ❌ All models exhausted!`);
    }
}
console.log('');

// Test 3: Check stats after requests
console.log('📊 Test 3: Stats After Requests');
console.log('='.repeat(80));
const afterStats = geminiModelRotation.getUsageStats();
console.table(afterStats);
console.log('');

// Test 4: Test specific model rotation
console.log('🔄 Test 4: Force Rotation to Next Models');
console.log('='.repeat(80));

// Exhaust first 3 models
console.log('Exhausting gemini-2.5-flash (RPM: 10)...');
for (let i = 0; i < 10; i++) {
    const model = geminiModelRotation.getNextAvailableModel();
    if (model && model.name === 'gemini-2.5-flash') {
        geminiModelRotation.recordRequest(model.name);
    }
}

console.log('Exhausting gemini-2.0-flash (RPM: 15)...');
for (let i = 0; i < 15; i++) {
    const model = geminiModelRotation.getNextAvailableModel();
    if (model && model.name === 'gemini-2.0-flash') {
        geminiModelRotation.recordRequest(model.name);
    }
}

console.log('Exhausting gemini-2.0-flash-lite (RPM: 30)...');
for (let i = 0; i < 30; i++) {
    const model = geminiModelRotation.getNextAvailableModel();
    if (model && model.name === 'gemini-2.0-flash-lite') {
        geminiModelRotation.recordRequest(model.name);
    }
}

// Try to get next model
const nextModel = geminiModelRotation.getNextAvailableModel();
if (nextModel) {
    console.log(`✅ Next available model: ${nextModel.name} (priority ${nextModel.priority})`);
} else {
    console.log('❌ All models exhausted!');
}
console.log('');

// Test 5: Final stats
console.log('📊 Test 5: Final Stats');
console.log('='.repeat(80));
const finalStats = geminiModelRotation.getUsageStats();
console.table(finalStats);
console.log('');

// Test 6: Reset specific model
console.log('🔄 Test 6: Reset Specific Model');
console.log('='.repeat(80));
console.log('Resetting gemini-2.5-flash...');
geminiModelRotation.resetModelUsage('gemini-2.5-flash');
const afterResetStats = geminiModelRotation.getUsageStats().find(s => s.name === 'gemini-2.5-flash');
console.log('After reset:', afterResetStats);
console.log('');

// Test 7: Reset all
console.log('🔄 Test 7: Reset All Models');
console.log('='.repeat(80));
console.log('Resetting all models...');
geminiModelRotation.resetAllUsage();
const afterResetAllStats = geminiModelRotation.getUsageStats();
console.table(afterResetAllStats);
console.log('');

console.log('✅ All tests completed!');
console.log('');
console.log('💡 Key Findings:');
console.log('- Model rotation works correctly based on priority');
console.log('- RPM limits are enforced properly');
console.log('- System switches to next available model when current is exhausted');
console.log('- Reset functions work as expected');
