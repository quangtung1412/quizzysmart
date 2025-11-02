/**
 * Test script for Qdrant Search Accuracy
 * 
 * This script tests the accuracy of chat search functionality using Qdrant vector database
 */

// Load environment variables FIRST - before any other imports
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from current directory
config({ path: resolve(process.cwd(), '.env') });

// Verify environment variables are loaded
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  console.error('Please make sure .env file exists in server directory');
  process.exit(1);
}

if (!process.env.QDRANT_URL) {
  console.error('❌ QDRANT_URL not found in environment');
  console.error('Please make sure .env file exists in server directory');
  process.exit(1);
}

console.log('✓ Environment variables loaded successfully');

// Now import services after env is loaded
const { geminiRAGService } = await import('./src/services/gemini-rag.service.js');
const { qdrantService } = await import('./src/services/qdrant.service.js');
const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient();

interface TestCase {
  query: string;
  expectedDocuments?: string[]; // Document IDs or titles that should be found
  description: string;
  minScore?: number; // Minimum expected similarity score
}

// Define test cases
const testCases: TestCase[] = [
  {
    query: 'Tôi có 1 tỷ muốn gửi tiết kiệm, nhưng muốn rút bất cứ lúc nào. Tôi nên sử dụng sản phẩm tiền gửi nào?',
    description: 'Test câu hỏi chung về tín dụng tiêu dùng',
    minScore: 0.6
  },
  // {
  //   query: 'Các điều kiện vay tín dụng tiêu dùng?',
  //   description: 'Test câu hỏi cụ thể về điều kiện vay',
  //   minScore: 0.65
  // },
  // {
  //   query: 'Lãi suất cho vay tiêu dùng',
  //   description: 'Test từ khóa ngắn về lãi suất',
  //   minScore: 0.5
  // },
  // {
  //   query: 'Thủ tục vay mua nhà ở xã hội',
  //   description: 'Test câu hỏi về thủ tục cụ thể',
  //   minScore: 0.6
  // },
  // {
  //   query: 'Quy định về thế chấp tài sản',
  //   description: 'Test câu hỏi về thế chấp',
  //   minScore: 0.6
  // },
  // {
  //   query: 'Hồ sơ cần thiết khi vay tín dụng',
  //   description: 'Test câu hỏi về hồ sơ',
  //   minScore: 0.6
  // },
  // {
  //   query: 'Điều kiện cho vay nông nghiệp nông thôn',
  //   description: 'Test câu hỏi về lĩnh vực nông nghiệp',
  //   minScore: 0.6
  // },
  // {
  //   query: 'Thông tư 01/2024 quy định gì?',
  //   description: 'Test tìm kiếm theo số văn bản cụ thể',
  //   minScore: 0.7
  // },
  // {
  //   query: 'Ngân hàng nhà nước quy định như thế nào về cho vay?',
  //   description: 'Test câu hỏi dài và phức tạp',
  //   minScore: 0.55
  // },
  // {
  //   query: 'Bảo lãnh tín dụng',
  //   description: 'Test tìm kiếm 2 từ khóa',
  //   minScore: 0.5
  // }
];

/**
 * Run a single test case
 */
async function runTestCase(testCase: TestCase, caseNumber: number): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST CASE ${caseNumber}: ${testCase.description}`);
  console.log(`Query: "${testCase.query}"`);
  console.log(`Expected Min Score: ${testCase.minScore || 0.5}`);
  console.log('='.repeat(80));

  try {
    // Generate embedding for query
    console.log('\n[1] Generating query embedding...');
    const queryEmbedding = await geminiRAGService.generateEmbedding(testCase.query);
    console.log(`✓ Embedding generated (dimension: ${queryEmbedding.length})`);

    // Search in Qdrant with different top-K values
    const topKValues = [3, 5, 10];
    
    for (const topK of topKValues) {
      console.log(`\n[2] Searching in Qdrant (Top-${topK})...`);
      
      const results = await qdrantService.searchSimilar(
        queryEmbedding,
        topK,
        testCase.minScore || 0.5
      );

      console.log(`✓ Found ${results.length} results`);

      if (results.length === 0) {
        console.log('⚠️  No results found with current threshold!');
        
        // Try with lower threshold to see if there are any matches
        console.log('\n[3] Retrying with lower threshold (0.3)...');
        const lowerResults = await qdrantService.searchSimilar(
          queryEmbedding,
          topK,
          0.3
        );
        
        if (lowerResults.length > 0) {
          console.log(`Found ${lowerResults.length} results with lower threshold:`);
          lowerResults.forEach((result, idx) => {
            console.log(`\n  ${idx + 1}. Score: ${result.score.toFixed(4)}`);
            console.log(`     Document: ${result.payload.documentName || 'N/A'}`);
            console.log(`     Chunk Type: ${result.payload.chunkType}`);
            console.log(`     Preview: ${result.payload.content.substring(0, 150)}...`);
          });
        } else {
          console.log('⚠️  Still no results even with lower threshold!');
        }
        continue;
      }

      // Display results
      console.log(`\n📊 Search Results (Top-${topK}):`);
      console.log('-'.repeat(80));

      results.forEach((result, idx) => {
        console.log(`\n${idx + 1}. SCORE: ${result.score.toFixed(4)} ${result.score >= (testCase.minScore || 0.5) ? '✓' : '⚠️'}`);
        console.log(`   Document ID: ${result.payload.documentId}`);
        console.log(`   Document: ${result.payload.documentName || 'N/A'}`);
        console.log(`   Chunk Type: ${result.payload.chunkType}`);
        console.log(`   Article: ${result.payload.articleNumber || 'N/A'}`);
        
        // Preview text
        const preview = result.payload.content.length > 200 
          ? result.payload.content.substring(0, 200) + '...' 
          : result.payload.content;
        console.log(`   Preview: ${preview}`);
      });

      // Calculate statistics
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      const maxScore = Math.max(...results.map(r => r.score));
      const minScore = Math.min(...results.map(r => r.score));
      const aboveThreshold = results.filter(r => r.score >= (testCase.minScore || 0.5)).length;

      console.log('\n📈 Statistics:');
      console.log(`   Average Score: ${avgScore.toFixed(4)}`);
      console.log(`   Max Score: ${maxScore.toFixed(4)}`);
      console.log(`   Min Score: ${minScore.toFixed(4)}`);
      console.log(`   Above Threshold: ${aboveThreshold}/${results.length}`);

      // Check if results meet expectations
      if (results.length > 0 && maxScore >= (testCase.minScore || 0.5)) {
        console.log('\n✅ TEST PASSED - Found relevant results');
      } else {
        console.log('\n⚠️  TEST WARNING - Results may not be optimal');
      }
    }

  } catch (error) {
    console.error(`\n❌ TEST FAILED with error:`, error);
    throw error;
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE STATISTICS');
  console.log('='.repeat(80));

  try {
    // Get collection info from Qdrant
    const collectionInfo = await qdrantService.getCollectionInfo('vietnamese_documents');
    console.log('\n📊 Qdrant Collection Info:');
    console.log(`   Collection Name: ${collectionInfo.name}`);
    console.log(`   Vector Count: ${collectionInfo.pointsCount}`);
    console.log(`   Vector Dimension: ${collectionInfo.config.params.vectors.size}`);
    console.log(`   Distance Metric: ${collectionInfo.config.params.vectors.distance}`);

    // Get document count from database
    const documentCount = await prisma.document.count();
    console.log(`\n📚 Database Documents: ${documentCount}`);

    // Get sample documents
    const sampleDocs = await prisma.document.findMany({
      take: 5,
      select: {
        id: true,
        documentName: true,
        documentNumber: true,
        processingStatus: true,
        uploadedAt: true,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    console.log('\n📄 Sample Documents:');
    sampleDocs.forEach((doc, idx) => {
      console.log(`   ${idx + 1}. ${doc.documentName} (${doc.documentNumber || 'N/A'})`);
      console.log(`      Status: ${doc.processingStatus}, Created: ${doc.uploadedAt.toISOString()}`);
    });

  } catch (error) {
    console.error('Error getting database stats:', error);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n🧪 QDRANT SEARCH ACCURACY TEST SUITE');
  console.log('='.repeat(80));
  console.log(`Test Cases: ${testCases.length}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    // Initialize services
    console.log('\n[SETUP] Initializing services...');
    await qdrantService.initialize();
    console.log('✓ Qdrant service initialized');

    // Get database statistics
    await getDatabaseStats();

    // Run all test cases
    console.log('\n\n🚀 RUNNING TEST CASES...\n');
    
    let passedTests = 0;
    let failedTests = 0;

    for (let i = 0; i < testCases.length; i++) {
      try {
        await runTestCase(testCases[i], i + 1);
        passedTests++;
      } catch (error) {
        failedTests++;
        console.error(`Test case ${i + 1} failed:`, error);
      }

      // Add delay between tests to avoid rate limiting
      if (i < testCases.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${testCases.length}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / testCases.length) * 100).toFixed(2)}%`);
    console.log(`Completed at: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('\n❌ Fatal error during test execution:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n✓ Disconnected from database');
  }
}

// Run tests
main().catch(console.error);
