# ============================================
# Migrate SQLite to MySQL
# ============================================
# Script de migrate du lieu tu SQLite dev.db sang MySQL

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "SQLite to MySQL Data Migration" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Kiem tra file SQLite
$sqliteFile = "server\prisma\dev.db"
if (-not (Test-Path $sqliteFile)) {
    Write-Host "ERROR: File $sqliteFile khong ton tai!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[1/5] Kiem tra file SQLite..." -ForegroundColor Yellow
$fileSize = (Get-Item $sqliteFile).Length
$fileSizeKB = [Math]::Round($fileSize/1KB, 2)
Write-Host "    File found: $fileSizeKB KB" -ForegroundColor Green

# Kiem tra Docker containers
Write-Host ""
Write-Host "[2/5] Kiem tra MySQL container..." -ForegroundColor Yellow
$mysqlStatus = docker compose ps mysql --format json | ConvertFrom-Json
if ($mysqlStatus.State -ne "running") {
    Write-Host "ERROR: MySQL container không chạy. Chạy: docker compose up -d mysql" -ForegroundColor Red
    exit 1
}
Write-Host "    MySQL đang chạy!" -ForegroundColor Green

# Copy file SQLite vào container
Write-Host "`n[3/5] Copy file SQLite vào backend container..." -ForegroundColor Yellow
docker cp $sqliteFile quizzysmart-backend:/tmp/dev.db
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Không thể copy file SQLite!" -ForegroundColor Red
    exit 1
}
Write-Host "    Đã copy thành công!" -ForegroundColor Green

# Tạo script Node.js để migrate
Write-Host "`n[4/5] Đang migrate dữ liệu..." -ForegroundColor Yellow

$migrationScript = @'
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';

const mysqlPrisma = new PrismaClient();
const sqlite = new Database('/tmp/dev.db', { readonly: true });

async function migrate() {
  console.log('Bắt đầu migration...');
  
  try {
    // 1. Migrate Users
    console.log('  [1/12] Migrate Users...');
    const users = sqlite.prepare('SELECT * FROM User').all();
    for (const user of users) {
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
    }
    console.log(`    ✓ Migrated ${users.length} users`);

    // 2. Migrate KnowledgeBase
    console.log('  [2/12] Migrate KnowledgeBase...');
    const knowledgeBases = sqlite.prepare('SELECT * FROM KnowledgeBase').all();
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
    }
    console.log(`    ✓ Migrated ${knowledgeBases.length} knowledge bases`);

    // 3. Migrate Questions
    console.log('  [3/12] Migrate Questions...');
    const questions = sqlite.prepare('SELECT * FROM Question').all();
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
    }
    console.log(`    ✓ Migrated ${questions.length} questions`);

    // 4. Migrate Tests
    console.log('  [4/12] Migrate Tests...');
    const tests = sqlite.prepare('SELECT * FROM tests').all();
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
    }
    console.log(`    ✓ Migrated ${tests.length} tests`);

    // 5. Migrate Attempts
    console.log('  [5/12] Migrate Attempts...');
    const attempts = sqlite.prepare('SELECT * FROM Attempt').all();
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
    }
    console.log(`    ✓ Migrated ${attempts.length} attempts`);

    // 6. Migrate AttemptAnswers
    console.log('  [6/12] Migrate AttemptAnswers...');
    const attemptAnswers = sqlite.prepare('SELECT * FROM AttemptAnswer').all();
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
    }
    console.log(`    ✓ Migrated ${attemptAnswers.length} attempt answers`);

    // 7. Migrate TestAssignments
    console.log('  [7/12] Migrate TestAssignments...');
    const testAssignments = sqlite.prepare('SELECT * FROM TestAssignment').all();
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
    }
    console.log(`    ✓ Migrated ${testAssignments.length} test assignments`);

    // 8. Migrate StudyPlans
    console.log('  [8/12] Migrate StudyPlans...');
    const studyPlans = sqlite.prepare('SELECT * FROM StudyPlan').all();
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
    }
    console.log(`    ✓ Migrated ${studyPlans.length} study plans`);

    // 9. Migrate QuestionProgress
    console.log('  [9/12] Migrate QuestionProgress...');
    const questionProgress = sqlite.prepare('SELECT * FROM QuestionProgress').all();
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
    }
    console.log(`    ✓ Migrated ${questionProgress.length} question progress records`);

    // 10. Migrate SubscriptionPlans
    console.log('  [10/12] Migrate SubscriptionPlans...');
    const subscriptionPlans = sqlite.prepare('SELECT * FROM subscription_plans').all();
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
    }
    console.log(`    ✓ Migrated ${subscriptionPlans.length} subscription plans`);

    // 11. Migrate Subscriptions
    console.log('  [11/12] Migrate Subscriptions...');
    const subscriptions = sqlite.prepare('SELECT * FROM Subscription').all();
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
    }
    console.log(`    ✓ Migrated ${subscriptions.length} subscriptions`);

    // 12. Migrate Documents (RAG)
    console.log('  [12/12] Migrate Documents...');
    const documents = sqlite.prepare('SELECT * FROM documents').all();
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
    }
    console.log(`    ✓ Migrated ${documents.length} documents`);

    console.log('\n✅ Migration hoàn tất!');
    
  } catch (error) {
    console.error('❌ Lỗi migration:', error);
    process.exit(1);
  } finally {
    await mysqlPrisma.$disconnect();
    sqlite.close();
  }
}

migrate();
'@

# Tạo file migration script trong container
$migrationScript | docker exec -i quizzysmart-backend tee /tmp/migrate.mjs > $null

# Install better-sqlite3 và chạy migration
Write-Host "`n    Cài đặt better-sqlite3..." -ForegroundColor Gray
docker compose exec backend npm install better-sqlite3 --save-dev 2>&1 | Out-Null

Write-Host "    Chạy migration script..." -ForegroundColor Gray
docker compose exec backend node --experimental-modules /tmp/migrate.mjs

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Migration thất bại!" -ForegroundColor Red
    exit 1
}

# Cleanup
Write-Host "`n[5/5] Dọn dẹp..." -ForegroundColor Yellow
docker compose exec backend rm /tmp/dev.db /tmp/migrate.mjs 2>&1 | Out-Null
Write-Host "    Đã xóa file tạm!" -ForegroundColor Green

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "✅ MIGRATION HOÀN TẤT!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nKiểm tra dữ liệu:" -ForegroundColor Yellow
Write-Host "  phpMyAdmin: http://localhost:8080" -ForegroundColor White
Write-Host "  User: root, Pass: rootpassword" -ForegroundColor Gray
Write-Host "`nHoặc chạy query:" -ForegroundColor Yellow
Write-Host "  docker compose exec mysql mysql -u root -prootpassword quizzysmart -e 'SELECT COUNT(*) as total FROM User;'" -ForegroundColor White
