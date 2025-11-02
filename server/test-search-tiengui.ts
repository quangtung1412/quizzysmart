/**
 * Test case: Search for deposit (tiền gửi) documents
 * 
 * Issue: When asking about deposits, system returns loan documents instead
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

// Verify environment variables
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found');
  process.exit(1);
}

const { geminiRAGService } = await import('./src/services/gemini-rag.service.js');
const { qdrantService } = await import('./src/services/qdrant.service.js');
const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient();

interface TestQuery {
  query: string;
  expectedKeywords: string[];
  description: string;
}

// Test queries specifically about deposits (tiền gửi)
const depositQueries: TestQuery[] = [
  {
    query: 'Quy định về tiền gửi là gì?',
    expectedKeywords: ['tiền gửi', 'gửi tiền', 'gửi'],
    description: 'General question about deposits'
  },
  {
    query: 'Lãi suất tiền gửi có kỳ hạn',
    expectedKeywords: ['tiền gửi', 'lãi suất', 'kỳ hạn'],
    description: 'Interest rate on term deposits'
  },
  {
    query: 'Tiền gửi không kỳ hạn',
    expectedKeywords: ['tiền gửi', 'không kỳ hạn'],
    description: 'Non-term deposits'
  },
  {
    query: 'Sản phẩm tiền gửi tại ngân hàng',
    expectedKeywords: ['sản phẩm', 'tiền gửi'],
    description: 'Deposit products'
  },
  {
    query: 'Điều kiện mở tài khoản tiền gửi',
    expectedKeywords: ['tài khoản', 'tiền gửi', 'mở'],
    description: 'Account opening for deposits'
  }
];

/**
 * Check if content is relevant to deposits (not loans)
 */
function isRelevantToDeposits(content: string, documentName: string): boolean {
  const contentLower = content.toLowerCase();
  const docNameLower = documentName.toLowerCase();
  
  // Deposit keywords
  const depositKeywords = ['tiền gửi', 'gửi tiền', 'tài khoản tiền gửi', 'lãi suất gửi'];
  
  // Loan keywords (should NOT appear in deposit documents)
  const loanKeywords = ['cho vay', 'vay vốn', 'tín dụng', 'khoản vay', 'thế chấp', 'bảo lãnh'];
  
  // Check document name first
  const hasDepositInName = depositKeywords.some(kw => docNameLower.includes(kw));
  const hasLoanInName = loanKeywords.some(kw => docNameLower.includes(kw));
  
  // Check content
  const hasDepositInContent = depositKeywords.some(kw => contentLower.includes(kw));
  const hasLoanInContent = loanKeywords.some(kw => contentLower.includes(kw));
  
  // Result logic
  if (hasDepositInName || hasDepositInContent) {
    return !hasLoanInName; // Relevant if mentions deposits and NOT loans in name
  }
  
  return false;
}

/**
 * Test a single query
 */
async function testDepositQuery(testQuery: TestQuery, queryNumber: number): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST ${queryNumber}: ${testQuery.description}`);
  console.log(`Query: "${testQuery.query}"`);
  console.log(`Expected Keywords: ${testQuery.expectedKeywords.join(', ')}`);
  console.log('='.repeat(80));

  try {
    // 1. Generate embedding
    console.log('\n[1] Generating query embedding...');
    const queryEmbedding = await geminiRAGService.generateEmbedding(testQuery.query);
    console.log(`✓ Embedding generated (dimension: ${queryEmbedding.length})`);

    // 2. Search in Qdrant (get 30 results for post-filtering)
    console.log('\n[2] Searching in Qdrant (Top 30 for filtering)...');
    let searchResults = await qdrantService.searchSimilar(queryEmbedding, 30, 0.5);
    console.log(`✓ Found ${searchResults.length} results`);

    // 3. Apply smart post-filtering (exclude loan documents)
    console.log('\n[3] Applying smart filtering (exclude loan documents)...');
    const beforeFilterCount = searchResults.length;
    searchResults = searchResults.filter((result: any) => {
      const docNameLower = result.payload.documentName.toLowerCase();
      const hasLoanKeyword = ['cho vay', 'vay vốn', 'tín dụng'].some(kw => docNameLower.includes(kw));
      return !hasLoanKeyword; // Exclude loan documents
    });
    console.log(`✓ Filtered: ${beforeFilterCount} → ${searchResults.length} results (removed ${beforeFilterCount - searchResults.length} loan docs)`);

    // 4. Take top 10 after filtering
    searchResults = searchResults.slice(0, 10);
    console.log(`✓ Using top 10 results after filtering\n`);

    if (searchResults.length === 0) {
      console.log('⚠️  No results found!');
      return;
    }

    // 3. Analyze results
    console.log('📊 SEARCH RESULTS ANALYSIS:\n');
    
    let depositRelevantCount = 0;
    let loanResultsCount = 0;

    searchResults.forEach((result, idx) => {
      const isRelevant = isRelevantToDeposits(
        result.payload.content,
        result.payload.documentName
      );
      
      const contentLower = result.payload.content.toLowerCase();
      const docNameLower = result.payload.documentName.toLowerCase();
      const hasLoanKeyword = ['cho vay', 'vay vốn', 'tín dụng'].some(kw => 
        docNameLower.includes(kw) || contentLower.includes(kw)
      );
      
      if (isRelevant) depositRelevantCount++;
      if (hasLoanKeyword) loanResultsCount++;

      const statusIcon = isRelevant ? '✅' : (hasLoanKeyword ? '❌' : '⚠️');
      
      console.log(`${idx + 1}. ${statusIcon} Score: ${result.score.toFixed(4)}`);
      console.log(`   Document: ${result.payload.documentName}`);
      console.log(`   Type: ${result.payload.chunkType}`);
      console.log(`   Article: ${result.payload.articleNumber || 'N/A'}`);
      
      // Highlight keywords in preview
      const preview = result.payload.content.substring(0, 150);
      console.log(`   Preview: ${preview}...`);
      
      // Show why it's relevant or not
      if (hasLoanKeyword && !isRelevant) {
        console.log(`   ⚠️  WARNING: Contains loan keywords - NOT relevant to deposits!`);
      }
      console.log();
    });

    // 4. Summary statistics
    console.log('\n📈 STATISTICS:');
    console.log(`   Total Results: ${searchResults.length}`);
    console.log(`   Deposit-Relevant: ${depositRelevantCount} (${Math.round(depositRelevantCount/searchResults.length*100)}%)`);
    console.log(`   Loan-Related: ${loanResultsCount} (${Math.round(loanResultsCount/searchResults.length*100)}%)`);
    console.log(`   Average Score: ${(searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length).toFixed(4)}`);

    // 5. Test verdict
    console.log('\n🎯 TEST VERDICT:');
    if (depositRelevantCount === 0 && loanResultsCount > 0) {
      console.log('   ❌ FAILED - Only found loan documents, NO deposit documents!');
      console.log('   Problem: Search is returning irrelevant results');
    } else if (depositRelevantCount < searchResults.length / 2) {
      console.log('   ⚠️  WARNING - Less than 50% results are deposit-relevant');
      console.log(`   Issue: ${loanResultsCount} loan documents in results`);
    } else {
      console.log('   ✅ PASSED - Majority of results are deposit-relevant');
    }

  } catch (error) {
    console.error(`\n❌ Test failed with error:`, error);
  }
}

/**
 * Check database for deposit documents
 */
async function checkDepositDocuments(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE CHECK - DEPOSIT DOCUMENTS');
  console.log('='.repeat(80));

  try {
    // Search for documents with "tiền gửi" in name
    const depositDocs = await prisma.document.findMany({
      where: {
        OR: [
          { documentName: { contains: 'tiền gửi' } },
          { documentName: { contains: 'gửi tiền' } },
          { documentName: { contains: 'TIỀN GỬI' } },
          { fileName: { contains: 'tiengui' } },
          { fileName: { contains: 'tien_gui' } },
        ]
      },
      include: {
        _count: {
          select: { chunks: true }
        }
      }
    });

    console.log(`\n📚 Found ${depositDocs.length} deposit-related documents:\n`);

    if (depositDocs.length === 0) {
      console.log('⚠️  NO DEPOSIT DOCUMENTS FOUND IN DATABASE!');
      console.log('   This explains why search returns loan documents.');
      console.log('   Please upload deposit documents first.');
    } else {
      depositDocs.forEach((doc, idx) => {
        console.log(`${idx + 1}. ${doc.documentName}`);
        console.log(`   File: ${doc.fileName}`);
        console.log(`   Status: ${doc.processingStatus}`);
        console.log(`   Chunks: ${doc._count.chunks}`);
        console.log(`   Uploaded: ${doc.uploadedAt.toISOString()}`);
        console.log();
      });
    }

    // Also check all documents
    const allDocs = await prisma.document.findMany({
      include: {
        _count: { select: { chunks: true } }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`\n📊 All Documents in Database (${allDocs.length} total):\n`);
    allDocs.forEach((doc, idx) => {
      console.log(`${idx + 1}. ${doc.documentName} (${doc.processingStatus}, ${doc._count.chunks} chunks)`);
    });

  } catch (error) {
    console.error('Error checking database:', error);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n🧪 TEST SUITE: DEPOSIT (TIỀN GỬI) SEARCH');
  console.log('='.repeat(80));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    // Initialize services
    console.log('[SETUP] Initializing Qdrant...');
    await qdrantService.initialize();
    console.log('✓ Qdrant initialized\n');

    // Step 1: Check if deposit documents exist
    await checkDepositDocuments();

    // Step 2: Run test queries
    console.log('\n\n🚀 RUNNING TEST QUERIES...\n');
    
    for (let i = 0; i < depositQueries.length; i++) {
      await testDepositQuery(depositQueries[i], i + 1);
      
      // Delay between tests
      if (i < depositQueries.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final summary
    console.log('\n\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Queries Tested: ${depositQueries.length}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   1. Check if deposit documents are uploaded and processed');
    console.log('   2. Verify embeddings capture deposit vs loan differences');
    console.log('   3. Consider adding document type filtering to search');
    console.log('   4. Review reranking to boost document name matching');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n✓ Disconnected from database');
  }
}

// Run tests
main().catch(console.error);
