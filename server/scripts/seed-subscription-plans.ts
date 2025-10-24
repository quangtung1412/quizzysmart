import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding subscription plans...');

    // Create or update Plus plan
    await prisma.subscriptionPlan.upsert({
        where: { planId: 'plus' },
        update: {
            name: 'Plus',
            price: 50000,
            aiQuota: 100,
            duration: 30,
            features: JSON.stringify([
                'Tra cứu không giới hạn',
                '100 lượt tìm kiếm AI',
                'Hỗ trợ camera trực tiếp',
                'Sử dụng trong 30 ngày'
            ]),
            isActive: true,
            displayOrder: 1,
            popular: false
        },
        create: {
            planId: 'plus',
            name: 'Plus',
            price: 50000,
            aiQuota: 100,
            duration: 30,
            features: JSON.stringify([
                'Tra cứu không giới hạn',
                '100 lượt tìm kiếm AI',
                'Hỗ trợ camera trực tiếp',
                'Sử dụng trong 30 ngày'
            ]),
            isActive: true,
            displayOrder: 1,
            popular: false
        }
    });

    // Create or update Premium plan
    await prisma.subscriptionPlan.upsert({
        where: { planId: 'premium' },
        update: {
            name: 'Premium',
            price: 500000,
            aiQuota: 1500,
            duration: 365,
            features: JSON.stringify([
                'Tra cứu không giới hạn',
                '1500 lượt tìm kiếm AI',
                'Hỗ trợ camera trực tiếp',
                'Sử dụng trong 1 năm',
                'Ưu tiên hỗ trợ'
            ]),
            isActive: true,
            displayOrder: 2,
            popular: true
        },
        create: {
            planId: 'premium',
            name: 'Premium',
            price: 500000,
            aiQuota: 1500,
            duration: 365,
            features: JSON.stringify([
                'Tra cứu không giới hạn',
                '1500 lượt tìm kiếm AI',
                'Hỗ trợ camera trực tiếp',
                'Sử dụng trong 1 năm',
                'Ưu tiên hỗ trợ'
            ]),
            isActive: true,
            displayOrder: 2,
            popular: true
        }
    });

    console.log('Subscription plans seeded successfully!');
}

main()
    .catch((e) => {
        console.error('Error seeding subscription plans:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
