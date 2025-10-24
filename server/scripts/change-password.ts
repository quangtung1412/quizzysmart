import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function changePassword() {
    try {
        const username = process.argv[2];
        const newPassword = process.argv[3];

        if (!username || !newPassword) {
            console.log('Usage: npm run change-password <username> <new_password>');
            console.log('Example: npm run change-password admin 123456a@');
            process.exit(1);
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            console.log(`❌ User '${username}' not found!`);
            process.exit(1);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { username: username },
            data: { password: hashedPassword }
        });

        console.log('✅ Password changed successfully!');
        console.log(`Username: ${username}`);
        console.log(`New password has been set.`);

    } catch (error) {
        console.error('❌ Error changing password:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

changePassword();
