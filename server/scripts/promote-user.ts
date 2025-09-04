import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function promoteUserToAdmin() {
    try {
        const userIdentifier = process.argv[2]; // can be email or username

        if (!userIdentifier) {
            console.log('Usage: npm run promote-user <email_or_username>');
            console.log('Example: npm run promote-user user@example.com');
            console.log('Example: npm run promote-user myusername');
            process.exit(1);
        }

        // Try to find user by email or username
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: userIdentifier },
                    { username: userIdentifier }
                ]
            }
        });

        if (!user) {
            console.log(`❌ User not found: ${userIdentifier}`);
            process.exit(1);
        }

        if ((user as any).role === 'admin') {
            console.log(`✅ User ${userIdentifier} is already an admin!`);
            process.exit(0);
        }

        // Promote user to admin
        await prisma.user.update({
            where: { id: user.id },
            data: { role: 'admin' }
        });

        console.log('✅ User promoted to admin successfully!');
        console.log(`Email: ${user.email}`);
        console.log(`Username: ${user.username}`);
        console.log(`Name: ${user.name}`);
        console.log(`New Role: admin`);

    } catch (error) {
        console.error('❌ Error promoting user:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

promoteUserToAdmin();
