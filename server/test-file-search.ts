/**
 * Test script for Google File Search
 * 
 * Tests retrieval and query capabilities of File Search stores
 * 
 * Usage:
 *   npx tsx test-file-search.ts
 */

import 'dotenv/config';
import { geminiFileSearchService } from './src/services/gemini-file-search.service.js';

// ANSI color codes for pretty output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
};

function log(message: string, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function section(title: string) {
    console.log('\n' + '='.repeat(80));
    log(title, colors.bright + colors.cyan);
    console.log('='.repeat(80) + '\n');
}

async function testFileSearch() {
    try {
        // Configuration
        const STORE_NAME = process.env.FILE_SEARCH_STORE_NAME || 'fileSearchStores/loan-a7i3ilp7o143';
        const TEST_QUESTIONS = [
            'Điều kiện vay thế chấp là gì?',
            'Lãi suất vay tiêu dùng bao nhiêu?',
            'Thời gian xét duyệt hồ sơ vay mất bao lâu?',
            'Cần giấy tờ gì để vay?',
        ];

        section('🔍 GOOGLE FILE SEARCH - TEST SCRIPT');

        // Check API key
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not found in .env file');
        }
        log('✓ API Key configured', colors.green);

        // Test 1: List all stores
        section('📁 Test 1: List All File Search Stores');
        try {
            const stores = await geminiFileSearchService.listFileSearchStores();
            log(`Found ${stores.length} store(s):`, colors.blue);
            stores.forEach((store, index) => {
                console.log(`  ${index + 1}. ${colors.yellow}${store.displayName}${colors.reset}`);
                console.log(`     Name: ${store.name}`);
                console.log(`     Created: ${store.createTime}`);
            });
        } catch (error: any) {
            log(`✗ Failed to list stores: ${error.message}`, colors.red);
        }

        // Test 2: Get specific store
        section('📂 Test 2: Get Specific Store');
        try {
            const store = await geminiFileSearchService.getFileSearchStore(STORE_NAME);
            if (store) {
                log('✓ Store found:', colors.green);
                console.log(`  Display Name: ${colors.yellow}${store.displayName}${colors.reset}`);
                console.log(`  Name: ${store.name}`);
                console.log(`  Created: ${store.createTime}`);
            } else {
                log('✗ Store not found', colors.red);
                log(`  Make sure STORE_NAME is correct: ${STORE_NAME}`, colors.yellow);
                return;
            }
        } catch (error: any) {
            log(`✗ Failed to get store: ${error.message}`, colors.red);
            return;
        }

        // Test 3: Query with File Search (Non-streaming)
        section('💬 Test 3: Query File Search (Non-streaming)');
        const testQuestion = TEST_QUESTIONS[0];
        log(`Question: "${testQuestion}"`, colors.yellow);
        console.log('Querying...\n');

        try {
            const startTime = Date.now();
            const response = await geminiFileSearchService.generateRAGAnswer(
                { question: testQuestion, topK: 5 },
                [STORE_NAME]
            );
            const duration = Date.now() - startTime;

            log('✓ Query successful!', colors.green);
            console.log('\n' + '─'.repeat(80));
            log('📝 Answer:', colors.bright + colors.cyan);
            console.log(response.answer);
            console.log('─'.repeat(80) + '\n');

            log(`📊 Metadata:`, colors.magenta);
            console.log(`  Model: ${response.model}`);
            console.log(`  Confidence: ${response.confidence}%`);
            console.log(`  Sources: ${response.sources.length}`);
            console.log(`  Citations: ${response.citations?.length || 0}`);
            console.log(`  Duration: ${duration}ms`);
            console.log(`  Tokens: ${response.tokenUsage.total} (input: ${response.tokenUsage.input}, output: ${response.tokenUsage.output})`);

            // Display sources
            if (response.sources.length > 0) {
                console.log('\n' + '─'.repeat(80));
                log('📚 Sources:', colors.bright + colors.blue);
                response.sources.forEach((source: any, index: number) => {
                    console.log(`\n  ${index + 1}. ${colors.yellow}${source.documentName}${colors.reset}`);
                    console.log(`     URI: ${source.uri}`);
                    console.log(`     Score: ${source.score}`);
                    if (source.content) {
                        const preview = source.content.substring(0, 100);
                        console.log(`     Preview: ${preview}...`);
                    }
                });
            }

            // Display citations
            if (response.citations && response.citations.length > 0) {
                console.log('\n' + '─'.repeat(80));
                log('🔗 Citations (Answer → Source Mapping):', colors.bright + colors.magenta);
                response.citations.forEach((citation: any, index: number) => {
                    const segmentText = citation.segment?.text || citation.segment;
                    const preview = typeof segmentText === 'string' ? segmentText.substring(0, 60) : '';
                    console.log(`\n  ${index + 1}. "${preview}..."`);
                    console.log(`     From sources: [${citation.chunkIndices.join(', ')}]`);
                    if (citation.confidenceScores && citation.confidenceScores.length > 0) {
                        console.log(`     Confidence: ${citation.confidenceScores.map((s: number) => `${Math.round(s * 100)}%`).join(', ')}`);
                    }
                });
            }
        } catch (error: any) {
            log(`✗ Query failed: ${error.message}`, colors.red);
            console.error(error);
        }

        // Test 4: Query with Streaming
        section('🌊 Test 4: Query File Search (Streaming)');
        const streamQuestion = TEST_QUESTIONS[1];
        log(`Question: "${streamQuestion}"`, colors.yellow);
        console.log('Streaming response...\n');

        try {
            const startTime = Date.now();
            let fullAnswer = '';
            let metadata: any = null;

            log('📝 Streaming Answer:', colors.bright + colors.cyan);
            process.stdout.write(colors.green);

            for await (const { chunk, done, metadata: meta } of geminiFileSearchService.generateRAGAnswerStream(
                { question: streamQuestion, topK: 5 },
                [STORE_NAME]
            )) {
                if (!done) {
                    process.stdout.write(chunk);
                    fullAnswer += chunk;
                } else {
                    metadata = meta;
                }
            }
            process.stdout.write(colors.reset + '\n');

            const duration = Date.now() - startTime;

            console.log('\n' + '─'.repeat(80));
            log('✓ Streaming completed!', colors.green);

            if (metadata) {
                log(`\n📊 Metadata:`, colors.magenta);
                console.log(`  Model: ${metadata.model}`);
                console.log(`  Confidence: ${metadata.confidence}%`);
                console.log(`  Sources: ${metadata.sources.length}`);
                console.log(`  Citations: ${metadata.citations?.length || 0}`);
                console.log(`  Duration: ${duration}ms`);
            }
        } catch (error: any) {
            log(`\n✗ Streaming failed: ${error.message}`, colors.red);
            console.error(error);
        }

        // Test 5: Query with Metadata Filter (if applicable)
        section('🔍 Test 5: Query with Metadata Filter');
        log('Testing metadata filter functionality...', colors.yellow);
        log('Note: This requires documents to have custom metadata set', colors.yellow);

        try {
            const response = await geminiFileSearchService.generateRAGAnswer(
                { question: 'Lãi suất vay là bao nhiêu?', topK: 3 },
                [STORE_NAME],
                'documentType="loan_policy"' // Example filter
            );

            log('✓ Query with filter successful!', colors.green);
            console.log(`  Answer length: ${response.answer.length} chars`);
            console.log(`  Sources: ${response.sources.length}`);
        } catch (error: any) {
            log(`⚠ Query with filter failed (expected if no metadata): ${error.message}`, colors.yellow);
        }

        // Test 6: Multiple Questions Benchmark
        section('⚡ Test 6: Performance Benchmark');
        log(`Testing ${TEST_QUESTIONS.length} questions...`, colors.yellow);

        const results: any[] = [];
        for (let i = 0; i < TEST_QUESTIONS.length; i++) {
            const question = TEST_QUESTIONS[i];
            log(`\n[${i + 1}/${TEST_QUESTIONS.length}] "${question}"`, colors.cyan);

            try {
                const startTime = Date.now();
                const response = await geminiFileSearchService.generateRAGAnswer(
                    { question, topK: 3 },
                    [STORE_NAME]
                );
                const duration = Date.now() - startTime;

                results.push({
                    question,
                    success: true,
                    duration,
                    sources: response.sources.length,
                    citations: response.citations?.length || 0,
                    tokens: response.tokenUsage.total,
                    confidence: response.confidence,
                });

                log(`  ✓ ${duration}ms | ${response.sources.length} sources | ${response.citations?.length || 0} citations`, colors.green);
            } catch (error: any) {
                results.push({
                    question,
                    success: false,
                    error: error.message,
                });
                log(`  ✗ Failed: ${error.message}`, colors.red);
            }
        }

        // Summary
        console.log('\n' + '─'.repeat(80));
        log('📈 Performance Summary:', colors.bright + colors.magenta);
        const successful = results.filter(r => r.success);
        const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
        const avgSources = successful.reduce((sum, r) => sum + r.sources, 0) / successful.length;
        const avgCitations = successful.reduce((sum, r) => sum + r.citations, 0) / successful.length;
        const totalTokens = successful.reduce((sum, r) => sum + r.tokens, 0);

        console.log(`  Success Rate: ${successful.length}/${results.length} (${Math.round(successful.length / results.length * 100)}%)`);
        console.log(`  Average Duration: ${Math.round(avgDuration)}ms`);
        console.log(`  Average Sources: ${avgSources.toFixed(1)}`);
        console.log(`  Average Citations: ${avgCitations.toFixed(1)}`);
        console.log(`  Total Tokens Used: ${totalTokens}`);

        section('✅ TEST COMPLETED');
        log('All tests finished successfully!', colors.green);

    } catch (error: any) {
        section('❌ TEST FAILED');
        log(`Error: ${error.message}`, colors.red);
        console.error(error);
        process.exit(1);
    }
}

// Run tests
log('\n🚀 Starting Google File Search Tests...', colors.bright + colors.blue);
log('Make sure you have set FILE_SEARCH_STORE_NAME in .env or it will use default\n', colors.yellow);

testFileSearch()
    .then(() => {
        log('\n✨ Test script completed', colors.green);
        process.exit(0);
    })
    .catch((error) => {
        log(`\n💥 Fatal error: ${error.message}`, colors.red);
        console.error(error);
        process.exit(1);
    });
