import "dotenv/config";
import {
  PrismaClient,
  UserRole,
  VerificationStatus,
  BookingStatus,
  PaymentStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "Password123!";

async function hash(plain: string) {
  return bcrypt.hash(plain, 10);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function upsertUser(opts: {
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  passwordHash: string;
  emailVerified?: boolean;
}) {
  return prisma.user.upsert({
    where: { email: opts.email },
    update: {},
    create: {
      email: opts.email,
      password: opts.passwordHash,
      name: opts.name,
      role: opts.role,
      phone: opts.phone,
      emailVerifiedAt: opts.emailVerified ? new Date() : null,
    },
  });
}

async function main() {
  console.log("🌱 seeding database...");
  const passwordHash = await hash(PASSWORD);

  // -------------------------------------------------------------------------
  // 1. Admin
  // -------------------------------------------------------------------------
  const admin = await upsertUser({
    email: "admin@lsf.local",
    name: "Platform Admin",
    role: UserRole.ADMIN,
    passwordHash,
    emailVerified: true,
  });
  console.log(`  ✓ admin: ${admin.email}`);

  // -------------------------------------------------------------------------
  // 2. Categories
  // -------------------------------------------------------------------------
  const categoryDefs = [
    { name: "Plumbing", icon: "wrench", color: "#0EA5E9" },
    { name: "Electrical", icon: "zap", color: "#F59E0B" },
    { name: "Cleaning", icon: "sparkles", color: "#10B981" },
    { name: "Carpentry", icon: "hammer", color: "#8B5CF6" },
    { name: "Tutoring", icon: "graduation-cap", color: "#EF4444" },
  ];

  const categories = await Promise.all(
    categoryDefs.map((c, i) =>
      prisma.category.upsert({
        where: { slug: slug(c.name) },
        update: {},
        create: {
          name: c.name,
          slug: slug(c.name),
          icon: c.icon,
          color: c.color,
          displayOrder: i,
          description: `${c.name} services`,
        },
      }),
    ),
  );
  console.log(`  ✓ categories: ${categories.map((c) => c.name).join(", ")}`);

  // -------------------------------------------------------------------------
  // 3. Customers (5)
  // -------------------------------------------------------------------------
  const customers = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      upsertUser({
        email: `customer${i + 1}@lsf.local`,
        name: `Customer ${i + 1}`,
        role: UserRole.CUSTOMER,
        phone: `+25470000010${i}`,
        passwordHash,
        emailVerified: true,
      }),
    ),
  );
  console.log(`  ✓ customers: ${customers.length}`);

  // -------------------------------------------------------------------------
  // 4. Providers (5, each verified, with primary category + availability)
  // -------------------------------------------------------------------------
  const providerSpecs = [
    { name: "John Mwangi", category: 0, rate: 1500, location: "Nairobi, Westlands" },
    { name: "Aisha Otieno", category: 1, rate: 2000, location: "Nairobi, Karen" },
    { name: "Peter Kamau", category: 2, rate: 800, location: "Nairobi, Kilimani" },
    { name: "Grace Wanjiru", category: 3, rate: 1800, location: "Mombasa, Nyali" },
    { name: "Daniel Kiprop", category: 4, rate: 1200, location: "Eldoret, Town" },
  ];

  const providers = [];
  for (let i = 0; i < providerSpecs.length; i++) {
    const spec = providerSpecs[i];
    const user = await upsertUser({
      email: `provider${i + 1}@lsf.local`,
      name: spec.name,
      role: UserRole.PROVIDER,
      phone: `+25471100020${i}`,
      passwordHash,
      emailVerified: true,
    });

    const provider = await prisma.provider.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        bio: `Experienced ${categories[spec.category].name.toLowerCase()} professional`,
        hourlyRate: spec.rate,
        yearsExperience: 3 + i,
        location: spec.location,
        latitude: -1.2921 + i * 0.01,
        longitude: 36.8219 + i * 0.01,
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: admin.id,
        isActive: true,
      },
    });

    await prisma.providerCategory.upsert({
      where: {
        providerId_categoryId: {
          providerId: provider.id,
          categoryId: categories[spec.category].id,
        },
      },
      update: {},
      create: {
        providerId: provider.id,
        categoryId: categories[spec.category].id,
        isPrimary: true,
      },
    });

    // Availability: next 7 days, 9:00-17:00 in 1h slots
    for (let d = 1; d <= 7; d++) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() + d);

      const availability = await prisma.availability.upsert({
        where: {
          providerId_date: {
            providerId: provider.id,
            date,
          },
        },
        update: {},
        create: {
          providerId: provider.id,
          date,
          isAvailable: true,
        },
      });

      const existingSlots = await prisma.timeSlot.count({
        where: { availabilityId: availability.id },
      });
      if (existingSlots === 0) {
        for (let h = 9; h < 17; h++) {
          const start = new Date(`1970-01-01T${String(h).padStart(2, "0")}:00:00Z`);
          const end = new Date(`1970-01-01T${String(h + 1).padStart(2, "0")}:00:00Z`);
          await prisma.timeSlot.create({
            data: {
              availabilityId: availability.id,
              startTime: start,
              endTime: end,
              isAvailable: true,
            },
          });
        }
      }
    }

    providers.push(provider);
  }
  console.log(`  ✓ providers: ${providers.length} (each with 7-day availability)`);

  // -------------------------------------------------------------------------
  // 5. Sample bookings (one per customer-provider pair, varying statuses)
  // -------------------------------------------------------------------------
  const sampleBookings = [
    { status: BookingStatus.COMPLETED, daysAgo: 14, amount: 3000 },
    { status: BookingStatus.CONFIRMED, daysAgo: -2, amount: 2500 },
    { status: BookingStatus.PENDING, daysAgo: -5, amount: 1800 },
  ];

  for (let i = 0; i < sampleBookings.length; i++) {
    const spec = sampleBookings[i];
    const customer = customers[i];
    const provider = providers[i];
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - spec.daysAgo);

    const bookingNumber = `LSF-${Date.now()}-${i}`;

    const exists = await prisma.booking.findUnique({
      where: { bookingNumber },
    });
    if (exists) continue;

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        customerId: customer.id,
        providerId: provider.id,
        scheduledDate: date,
        scheduledStartTime: new Date("1970-01-01T10:00:00Z"),
        scheduledEndTime: new Date("1970-01-01T12:00:00Z"),
        serviceAddress: "Customer's address, Nairobi",
        problemDescription: "Sample seeded booking for development",
        status: spec.status,
        finalAmount:
          spec.status === BookingStatus.COMPLETED ? spec.amount : null,
        paymentStatus:
          spec.status === BookingStatus.COMPLETED
            ? PaymentStatus.PAID
            : PaymentStatus.UNPAID,
        paymentMethod:
          spec.status === BookingStatus.COMPLETED ? "cash" : null,
        paidAt: spec.status === BookingStatus.COMPLETED ? new Date() : null,
        createdById: customer.id,
      },
    });

    // Review for completed booking
    if (spec.status === BookingStatus.COMPLETED) {
      const existingReview = await prisma.review.findUnique({
        where: {
          customerId_providerId: {
            customerId: customer.id,
            providerId: provider.id,
          },
        },
      });
      if (!existingReview) {
        await prisma.review.create({
          data: {
            bookingId: booking.id,
            customerId: customer.id,
            providerId: provider.id,
            rating: 5,
            title: "Great service",
            comment: "Punctual and professional. Would book again.",
          },
        });
        await prisma.provider.update({
          where: { id: provider.id },
          data: {
            rating: 5,
            reviewCount: { increment: 1 },
            completedBookings: { increment: 1 },
            totalBookings: { increment: 1 },
          },
        });
      }
    }
  }
  console.log(`  ✓ bookings: ${sampleBookings.length}`);

  // -------------------------------------------------------------------------
  // 6. Notification preferences for every user
  // -------------------------------------------------------------------------
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const u of allUsers) {
    await prisma.notificationPreference.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id },
    });
  }
  console.log(`  ✓ notification preferences: ${allUsers.length}`);

  console.log("\n✅ seed complete");
  console.log(`   Login any seeded account with password: ${PASSWORD}`);
  console.log(`   Admin:    admin@lsf.local`);
  console.log(`   Customer: customer1@lsf.local … customer5@lsf.local`);
  console.log(`   Provider: provider1@lsf.local … provider5@lsf.local`);
}

main()
  .catch((e) => {
    console.error("\n❌ seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
