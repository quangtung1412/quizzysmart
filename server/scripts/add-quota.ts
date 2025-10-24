import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query: string): Promise<string> {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

async function addQuota() {
    try {
        const usernameOrEmail = await question('Nhập username hoặc email của user: ');
        const quotaToAdd = await question('Nhập số lượt tìm kiếm muốn thêm: ');

        const quota = parseInt(quotaToAdd, 10);
        if (isNaN(quota) || quota <= 0) {
            console.error('❌ Số lượt không hợp lệ');
            process.exit(1);
        }

        // Find user by username or email
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: usernameOrEmail },
                    { email: usernameOrEmail }
                ]
            }
        });

        if (!user) {
            console.error(`❌ Không tìm thấy user với username/email: ${usernameOrEmail}`);
            process.exit(1);
        }

        // Update quota
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                aiSearchQuota: {
                    increment: quota
                }
            },
            select: {
                username: true,
                email: true,
                aiSearchQuota: true
            }
        });

        console.log('✅ Đã nạp quota thành công!');
        console.log(`📧 User: ${updated.username || updated.email}`);
        console.log(`🔢 Quota mới: ${updated.aiSearchQuota} lượt`);

    } catch (error) {
        console.error('❌ Lỗi:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        rl.close();
    }
}

addQuota();
