import { QdrantService } from './src/services/qdrant.service';
import { UnifiedQueryProcessor } from './src/services/unified-query-processor.service';

async function test() {
  const query = process.argv[2] || 'lãi suất tiền gửi';
  console.log(`Testing query with fallback: "${query}"`);

  const processor = new UnifiedQueryProcessor();
  const analysis = await processor.analyzeQuery(query);
  console.log('Analysis:', JSON.stringify(analysis, null, 2));

  const qdrant = new QdrantService();
  const { results, fallbackTriggered } = await qdrant.searchWithFallback(
    analysis.searchQuery,
    analysis.suggestedCollections,
    5,
    0.55,
    () => {
      console.log('>>> CALLBACK TRIGGERED: Fallback search triggered!');
    }
  );
  
  console.log(`\nFallback triggered? ${fallbackTriggered}`);
  console.log(`Found ${results.length} results:`);
  results.forEach((r, idx) => {
    console.log(`\n[${idx + 1}] Collection: ${r.collection} | Score: ${r.score.toFixed(4)}`);
    console.log(`Title: ${r.payload.title || r.payload.fileName || 'N/A'}`);
    console.log(`Text: ${r.payload.text?.substring(0, 150)}...`);
  });
}

test().catch(console.error);