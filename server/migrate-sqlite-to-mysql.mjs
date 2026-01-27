import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';

// Set correct charset for MySQL connection
const mysqlPrisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'mysql://root:rootpassword@localhost:3306/quizzysmart?charset=utf8mb4'
        }
    }
});
const sqlite = new Database(process.argv[2] || './prisma/dev.db', { readonly: true });

async function migrate() {
    console.log('Starting SQLite to MySQL migration...\n');

    try {
        // 1. Migrate Users
        console.log('[1/12] Migrating Users...');
        const users = sqlite.prepare('SELECT * FROM User').all();
        let count = 0;
        let skipped = 0;
        for (const user of users) {
            try {
                await mysqlPrisma.user.upsert({
                    where: { id: user.id },
                    update: {},
                    create: {
                        id: user.id,
                        username: user.username,
                        password: user.password,
                        email: user.email,
                        name: user.name,
                        branchCode: user.branchCode,
                        picture: user.picture,
                        createdAt: new Date(user.createdAt),
                        role: user.role,
                        aiSearchQuota: user.aiSearchQuota,
                        quickSearchQuota: user.quickSearchQuota,
                        currentDeviceId: user.currentDeviceId,
                        currentSessionToken: user.currentSessionToken,
                        pendingThankYouPopup: user.pendingThankYouPopup
                    }
                });
                count++;
            } catch (e) {
                if (e.code === 'P2002') {
                    skipped++;
                } else {
                    throw e;
                }
            }
        }
        console.log(`   ✓ Migrated ${count} users (${skipped} skipped)\n`);

        // 2. Migrate KnowledgeBase
        console.log('[2/12] Migrating KnowledgeBase...');
        const knowledgeBases = sqlite.prepare('SELECT * FROM KnowledgeBase').all();
        count = 0;
        for (const kb of knowledgeBases) {
            await mysqlPrisma.knowledgeBase.upsert({
                where: { id: kb.id },
                update: {},
                create: {
                    id: kb.id,
                    name: kb.name,
                    createdAt: new Date(kb.createdAt),
                    userId: kb.userId
                }
            });
            count++;
        }
        console.log(`   ✓ Migrated ${count} knowledge bases\n`);

        // 3. Migrate Questions
        console.log('[3/12] Migrating Questions...');
        const questions = sqlite.prepare('SELECT * FROM Question').all();
        count = 0;
        for (const q of questions) {
            await mysqlPrisma.question.upsert({
                where: { id: q.id },
                update: {},
                create: {
                    id: q.id,
                    text: q.text,
                    options: q.options,
                    correctAnswerIdx: q.correctAnswerIdx,
                    source: q.source,
                    category: q.category,
                    baseId: q.baseId
                }
            });
            count++;
        }
        console.log(`   ✓ Migrated ${count} questions\n`);

        // 4. Migrate Tests
        console.log('[4/12] Migrating Tests...');
        try {
            const tests = sqlite.prepare('SELECT * FROM tests').all();
            count = 0;
            for (const test of tests) {
                await mysqlPrisma.test.upsert({
                    where: { id: test.id },
                    update: {},
                    create: {
                        id: test.id,
                        name: test.name,
                        description: test.description,
                        questionCount: test.questionCount,
                        timeLimit: test.timeLimit,
                        maxAttempts: test.maxAttempts,
                        startTime: test.startTime ? new Date(test.startTime) : null,
                        endTime: test.endTime ? new Date(test.endTime) : null,
                        knowledgeSources: test.knowledgeSources,
                        questionOrder: test.questionOrder,
                        isActive: test.isActive === 1,
                        createdAt: new Date(test.createdAt)
                    }
                });
                count++;
            }
            console.log(`   ✓ Migrated ${count} tests\n`);
        } catch (e) {
            console.log(`   ⚠ No tests table found, skipping...\n`);
        }

        // 5. Migrate Attempts
        console.log('[5/12] Migrating Attempts...');
        const attempts = sqlite.prepare('SELECT * FROM Attempt').all();
        count = 0;
        for (const attempt of attempts) {
            await mysqlPrisma.attempt.upsert({
                where: { id: attempt.id },
                update: {},
                create: {
                    id: attempt.id,
                    mode: attempt.mode,
                    startedAt: new Date(attempt.startedAt),
                    completedAt: attempt.completedAt ? new Date(attempt.completedAt) : null,
                    score: attempt.score,
                    settings: attempt.settings,
                    userId: attempt.userId,
                    knowledgeBaseId: attempt.knowledgeBaseId,
                    testId: attempt.testId
                }
            });
            count++;
        }
        console.log(`   ✓ Migrated ${count} attempts\n`);

        // 6. Migrate AttemptAnswers
        console.log('[6/12] Migrating AttemptAnswers...');
        const attemptAnswers = sqlite.prepare('SELECT * FROM AttemptAnswer').all();
        count = 0;
        for (const aa of attemptAnswers) {
            await mysqlPrisma.attemptAnswer.upsert({
                where: { id: aa.id },
                update: {},
                create: {
                    id: aa.id,
                    selectedIndex: aa.selectedIndex,
                    isCorrect: aa.isCorrect === 1,
                    attemptId: aa.attemptId,
                    questionId: aa.questionId
                }
            });
            count++;
        }
        console.log(`   ✓ Migrated ${count} attempt answers\n`);

        // 7. Migrate TestAssignments
        console.log('[7/12] Migrating TestAssignments...');
        try {
            const testAssignments = sqlite.prepare('SELECT * FROM TestAssignment').all();
            count = 0;
            for (const ta of testAssignments) {
                await mysqlPrisma.testAssignment.upsert({
                    where: { id: ta.id },
                    update: {},
                    create: {
                        id: ta.id,
                        testId: ta.testId,
                        userId: ta.userId,
                        assignedAt: new Date(ta.assignedAt)
                    }
                });
                count++;
            }
            console.log(`   ✓ Migrated ${count} test assignments\n`);
        } catch (e) {
            console.log(`   ⚠ No TestAssignment table, skipping...\n`);
        }

        // 8. Migrate StudyPlans
        console.log('[8/12] Migrating StudyPlans...');
        try {
            const studyPlans = sqlite.prepare('SELECT * FROM StudyPlan').all();
            count = 0;
            for (const sp of studyPlans) {
                await mysqlPrisma.studyPlan.upsert({
                    where: { id: sp.id },
                    update: {},
                    create: {
                        id: sp.id,
                        userId: sp.userId,
                        knowledgeBaseId: sp.knowledgeBaseId,
                        knowledgeBaseName: sp.knowledgeBaseName,
                        title: sp.title,
                        totalDays: sp.totalDays,
                        minutesPerDay: sp.minutesPerDay,
                        questionsPerDay: sp.questionsPerDay,
                        currentPhase: sp.currentPhase,
                        startDate: new Date(sp.startDate),
                        endDate: new Date(sp.endDate),
                        currentDay: sp.currentDay,
                        newQuestionsLearned: sp.newQuestionsLearned,
                        completedQuestions: sp.completedQuestions || '[]',
                        createdAt: new Date(sp.createdAt),
                        updatedAt: new Date(sp.updatedAt)
                    }
                });
                count++;
            }
            console.log(`   ✓ Migrated ${count} study plans\n`);
        } catch (e) {
            console.log(`   ⚠ No StudyPlan table, skipping...\n`);
        }

        // 9. Migrate QuestionProgress
        console.log('[9/12] Migrating QuestionProgress...');
        try {
            const questionProgress = sqlite.prepare('SELECT * FROM QuestionProgress').all();
            count = 0;
            for (const qp of questionProgress) {
                await mysqlPrisma.questionProgress.upsert({
                    where: { id: qp.id },
                    update: {},
                    create: {
                        id: qp.id,
                        studyPlanId: qp.studyPlanId,
                        questionId: qp.questionId,
                        difficultyLevel: qp.difficultyLevel,
                        lastReviewed: qp.lastReviewed ? new Date(qp.lastReviewed) : null,
                        reviewCount: qp.reviewCount,
                        nextReviewAfter: qp.nextReviewAfter,
                        createdAt: new Date(qp.createdAt),
                        updatedAt: new Date(qp.updatedAt)
                    }
                });
                count++;
            }
            console.log(`   ✓ Migrated ${count} question progress records\n`);
        } catch (e) {
            console.log(`   ⚠ No QuestionProgress table, skipping...\n`);
        }

        // 10. Migrate SubscriptionPlans
        console.log('[10/12] Migrating SubscriptionPlans...');
        try {
            const subscriptionPlans = sqlite.prepare('SELECT * FROM subscription_plans').all();
            count = 0;
            for (const plan of subscriptionPlans) {
                await mysqlPrisma.subscriptionPlan.upsert({
                    where: { id: plan.id },
                    update: {},
                    create: {
                        id: plan.id,
                        planId: plan.planId,
                        name: plan.name,
                        price: plan.price,
                        aiQuota: plan.aiQuota,
                        duration: plan.duration,
                        features: plan.features,
                        isActive: plan.isActive === 1,
                        displayOrder: plan.displayOrder,
                        popular: plan.popular === 1,
                        bestChoice: plan.bestChoice === 1,
                        createdAt: new Date(plan.createdAt),
                        updatedAt: new Date(plan.updatedAt)
                    }
                });
                count++;
            }
            console.log(`   ✓ Migrated ${count} subscription plans\n`);
        } catch (e) {
            console.log(`   ⚠ No subscription_plans table, skipping...\n`);
        }

        // 11. Migrate Subscriptions
        console.log('[11/12] Migrating Subscriptions...');
        try {
            const subscriptions = sqlite.prepare('SELECT * FROM Subscription').all();
            count = 0;
            for (const sub of subscriptions) {
                await mysqlPrisma.subscription.upsert({
                    where: { id: sub.id },
                    update: {},
                    create: {
                        id: sub.id,
                        userId: sub.userId,
                        plan: sub.plan,
                        price: sub.price,
                        aiQuota: sub.aiQuota,
                        duration: sub.duration,
                        status: sub.status,
                        paymentMethod: sub.paymentMethod,
                        transactionCode: sub.transactionCode,
                        telegramMessageId: sub.telegramMessageId,
                        qrCode: sub.qrCode,
                        checkoutUrl: sub.checkoutUrl,
                        accountNumber: sub.accountNumber,
                        accountName: sub.accountName,
                        bin: sub.bin,
                        paymentLinkId: sub.paymentLinkId,
                        description: sub.description,
                        purchasedAt: new Date(sub.purchasedAt),
                        activatedAt: sub.activatedAt ? new Date(sub.activatedAt) : null,
                        expiresAt: sub.expiresAt ? new Date(sub.expiresAt) : null,
                        createdAt: new Date(sub.createdAt),
                        updatedAt: new Date(sub.updatedAt)
                    }
                });
                count++;
            }
            console.log(`   ✓ Migrated ${count} subscriptions\n`);
        } catch (e) {
            console.log(`   ⚠ No Subscription table, skipping...\n`);
        }

        // 12. Migrate Documents (RAG)
        console.log('[12/12] Migrating Documents...');
        try {
            const documents = sqlite.prepare('SELECT * FROM documents').all();
            count = 0;
            for (const doc of documents) {
                await mysqlPrisma.document.upsert({
                    where: { id: doc.id },
                    update: {},
                    create: {
                        id: doc.id,
                        fileName: doc.fileName,
                        fileSize: doc.fileSize,
                        filePath: doc.filePath,
                        uploadedAt: new Date(doc.uploadedAt),
                        uploadedBy: doc.uploadedBy,
                        documentNumber: doc.documentNumber,
                        documentName: doc.documentName,
                        documentType: doc.documentType,
                        issuingAgency: doc.issuingAgency,
                        signerName: doc.signerName,
                        signerTitle: doc.signerTitle,
                        signedDate: doc.signedDate ? new Date(doc.signedDate) : null,
                        rawContent: doc.rawContent,
                        markdownContent: doc.markdownContent,
                        qdrantCollectionName: doc.qdrantCollectionName,
                        qdrantPointIds: doc.qdrantPointIds || '[]',
                        processingStatus: doc.processingStatus,
                        errorMessage: doc.errorMessage,
                        processingStartedAt: new Date(doc.processingStartedAt),
                        processingCompletedAt: doc.processingCompletedAt ? new Date(doc.processingCompletedAt) : null
                    }
                });
                count++;
            }
            console.log(`   ✓ Migrated ${count} documents\n`);
        } catch (e) {
            console.log(`   ⚠ No documents table, skipping...\n`);
        }

        console.log('✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mysqlPrisma.$disconnect();
        sqlite.close();
    }
}

migrate();
