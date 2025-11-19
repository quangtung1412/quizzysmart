import 'dotenv/config';
import { geminiFileSearchService } from './src/services/gemini-file-search.service.js';

async function testDebug() {
    try {
        console.log('Testing single query...\n');

        const result = await geminiFileSearchService.generateRAGAnswer({
            question: 'Lãi suất là bao nhiêu?',
            storeNames: ['fileSearchStores/loan-a7i3ilp7o143'],
            useModelRotation: false
        });

        console.log('\n✓ Test completed');
        console.log('Answer length:', result.answer.length);
        console.log('Sources:', result.sources?.length || 0);
        console.log('Citations:', result.citations?.length || 0);

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

testDebug();
