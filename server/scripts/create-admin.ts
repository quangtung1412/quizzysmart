import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdminUser() {
    try {
        const username = process.argv[2];
        const password = process.argv[3];
        const email = process.argv[4];
        const name = process.argv[5];
        const branchCode = process.argv[6];

        if (!username || !password || !email || !name || !branchCode) {
            console.log('Usage: npm run create-admin <username> <password> <email> <name> <branchCode>');
            console.log('Example: npm run create-admin admin admin123 admin@example.com "Admin User" 2300');
            process.exit(1);
        }

        // Validate branch code
        const allowedBranchCodes = ["2300", "2301", "2302", "2305", "2306", "2308", "2309", "2310", "2312", "2313"];
        if (!allowedBranchCodes.includes(branchCode)) {
            console.log('❌ Invalid branch code. Allowed codes:', allowedBranchCodes.join(', '));
            process.exit(1);
        }

        // Check if user with this username already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                username: username
            }
        });

        if (existingUser) {
            console.log('❌ User with this username already exists!');
            process.exit(1);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin user
        const adminUser = await prisma.user.create({
            data: {
                username: username,
                password: hashedPassword,
                email: email,
                name: name,
                branchCode: branchCode,
                role: 'admin'
            }
        });

        console.log('✅ Admin user created successfully!');
        console.log(`ID: ${adminUser.id}`);
        console.log(`Username: ${username}`);
        console.log(`Email: ${email}`);
        console.log(`Name: ${name}`);
        console.log(`Branch Code: ${branchCode}`);
        console.log(`Role: admin`);

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

createAdminUser();
