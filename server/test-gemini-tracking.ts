import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTracking() {
    try {
        console.log('Checking Gemini API tracking data...\n');

        // Count total records
        const count = await (prisma as any).geminiApiCall.count();
        console.log(`✅ Total API calls tracked: ${count}`);

        if (count === 0) {
            console.log('\n⚠️  No data found! This means:');
            console.log('   1. Either no API calls have been made yet');
            console.log('   2. Or tracking is not working properly');
            console.log('\n💡 Try making a chat request to generate tracking data');
            return;
        }

        // Get recent calls
        const recent = await (prisma as any).geminiApiCall.findMany({
            take: 10,
            orderBy: { startTime: 'desc' },
        });

        console.log('\n📊 Recent API calls:');
        recent.forEach((call: any, idx: number) => {
            console.log(`\n${idx + 1}. ${call.modelName} - ${call.requestType}`);
            console.log(`   Time: ${call.startTime}`);
            console.log(`   Tokens: ${call.totalTokens} (in: ${call.inputTokens}, out: ${call.outputTokens})`);
            console.log(`   Cost: $${call.totalCost.toFixed(6)}`);
            console.log(`   Duration: ${call.duration}ms`);
            console.log(`   Status: ${call.status}`);
        });

        // Get stats by model
        const byModel = await (prisma as any).geminiApiCall.groupBy({
            by: ['modelName'],
            _count: { id: true },
            _sum: {
                totalTokens: true,
                totalCost: true,
            },
        });

        console.log('\n📈 Stats by model:');
        byModel.forEach((stat: any) => {
            console.log(`   ${stat.modelName}:`);
            console.log(`     Calls: ${stat._count.id}`);
            console.log(`     Total tokens: ${stat._sum.totalTokens || 0}`);
            console.log(`     Total cost: $${(stat._sum.totalCost || 0).toFixed(6)}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkTracking();
