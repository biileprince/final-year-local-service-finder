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
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
    { name: "Painting", icon: "paintbrush", color: "#F97316" },
    { name: "HVAC", icon: "wind", color: "#22C55E" },
    { name: "Handyman", icon: "tool", color: "#0F766E" },
    { name: "Laundry", icon: "shirt", color: "#3B82F6" },
    { name: "Pest Control", icon: "bug", color: "#E11D48" },
    { name: "Appliance Repair", icon: "settings", color: "#64748B" },
    { name: "Moving", icon: "truck", color: "#A855F7" },
    { name: "Gardening", icon: "leaf", color: "#16A34A" },
    { name: "Catering", icon: "utensils", color: "#FB923C" },
    { name: "Event Planning", icon: "calendar", color: "#0EA5E9" },
    { name: "Security", icon: "shield", color: "#334155" },
    { name: "Auto Repair", icon: "car", color: "#4F46E5" },
    { name: "Car Wash", icon: "droplets", color: "#38BDF8" },
    { name: "Beauty & Hair", icon: "scissors", color: "#EC4899" },
    { name: "Photography", icon: "camera", color: "#7C3AED" },
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
  // 3. Customers (12)
  // -------------------------------------------------------------------------
  const customerCount = 20;
  const customers = await Promise.all(
    Array.from({ length: customerCount }, (_, i) =>
      upsertUser({
        email: `customer${i + 1}@lsf.local`,
        name: `Customer ${i + 1}`,
        role: UserRole.CUSTOMER,
        phone: `+23320000010${i}`,
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
    {
      name: "John Mensah",
      category: 0,
      rate: 1500,
      location: "Accra, East Legon",
    },
    { name: "Aisha Boateng", category: 1, rate: 2000, location: "Accra, Osu" },
    {
      name: "Peter Asare",
      category: 2,
      rate: 800,
      location: "Tema, Community 2",
    },
    {
      name: "Grace Owusu",
      category: 3,
      rate: 1800,
      location: "Kumasi, Bantama",
    },
    {
      name: "Daniel Adu",
      category: 4,
      rate: 1200,
      location: "Cape Coast, Central",
    },
    {
      name: "Akosua Serwaa",
      category: 5,
      rate: 1400,
      location: "Accra, Madina",
    },
    { name: "Kwame Antwi", category: 6, rate: 2100, location: "Kumasi, Adum" },
    {
      name: "Esi Appiah",
      category: 7,
      rate: 1100,
      location: "Takoradi, Market Circle",
    },
    { name: "Kojo Badu", category: 8, rate: 900, location: "Ho, Civic" },
    {
      name: "Adjoa Mensimah",
      category: 9,
      rate: 1600,
      location: "Sunyani, Town",
    },
    {
      name: "Yaw Osei",
      category: 10,
      rate: 1700,
      location: "Koforidua, Central",
    },
    {
      name: "Martha Nyame",
      category: 11,
      rate: 1900,
      location: "Tamale, Central",
    },
    {
      name: "Abena Kusi",
      category: 12,
      rate: 1300,
      location: "Accra, Spintex",
    },
    {
      name: "Kwaku Dapaah",
      category: 13,
      rate: 2500,
      location: "Accra, Airport",
    },
    {
      name: "Yaa Nyarko",
      category: 14,
      rate: 2200,
      location: "Kumasi, Asokwa",
    },
    {
      name: "Nana Addo",
      category: 15,
      rate: 2000,
      location: "Accra, Roman Ridge",
    },
    {
      name: "Samuel Kofi",
      category: 16,
      rate: 1800,
      location: "Tema, Community 22",
    },
    {
      name: "Afia Boadu",
      category: 17,
      rate: 900,
      location: "Accra, Dansoman",
    },
    {
      name: "Linda Tetteh",
      category: 18,
      rate: 1600,
      location: "Kumasi, Santasi",
    },
    {
      name: "Prosper Kumi",
      category: 19,
      rate: 1700,
      location: "Takoradi, New Takoradi",
    },
  ];

  const specialtyByCategory: Record<string, string[]> = {
    Plumbing: ["Leak repair", "Pipe installation", "Water heater"],
    Electrical: ["Wiring", "Lighting", "Safety checks"],
    Cleaning: ["Deep cleaning", "Regular cleaning", "Move-out"],
    Carpentry: ["Furniture", "Doors", "Shelves"],
    Tutoring: ["Math", "English", "Science"],
    Painting: ["Interior painting", "Exterior painting", "Touch-ups"],
    HVAC: ["AC servicing", "Installation", "Gas refill"],
    Handyman: ["Small repairs", "Assembly", "Mounting"],
    Laundry: ["Wash & fold", "Dry cleaning", "Ironing"],
    "Pest Control": ["Inspection", "Treatment", "Follow-up"],
    "Appliance Repair": ["Fridge repair", "Washer repair", "Microwave fix"],
    Moving: ["Packing", "Transport", "Unpacking"],
    Gardening: ["Lawn care", "Hedge trimming", "Garden cleanup"],
    Catering: ["Home catering", "Events", "Small parties"],
    "Event Planning": ["Decor", "Coordination", "Rentals"],
    Security: ["Guards", "Event security", "Patrols"],
    "Auto Repair": ["Engine check", "Brakes", "Oil change"],
    "Car Wash": ["Exterior wash", "Interior cleaning", "Polish"],
    "Beauty & Hair": ["Hair styling", "Braiding", "Makeup"],
    Photography: ["Events", "Portraits", "Product shots"],
  };

  const providers = [];
  for (let i = 0; i < providerSpecs.length; i++) {
    const spec = providerSpecs[i];
    const user = await upsertUser({
      email: `provider${i + 1}@lsf.local`,
      name: spec.name,
      role: UserRole.PROVIDER,
      phone: `+23350100020${i}`,
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

    const primaryCategory = categories[spec.category];

    await prisma.providerCategory.upsert({
      where: {
        providerId_categoryId: {
          providerId: provider.id,
          categoryId: primaryCategory.id,
        },
      },
      update: {},
      create: {
        providerId: provider.id,
        categoryId: primaryCategory.id,
        isPrimary: true,
      },
    });

    const secondaryIndex = (spec.category + 1) % categories.length;
    const secondaryCategory = categories[secondaryIndex];
    if (secondaryCategory.id !== primaryCategory.id) {
      await prisma.providerCategory.upsert({
        where: {
          providerId_categoryId: {
            providerId: provider.id,
            categoryId: secondaryCategory.id,
          },
        },
        update: {},
        create: {
          providerId: provider.id,
          categoryId: secondaryCategory.id,
          isPrimary: false,
        },
      });
    }

    const specialties = specialtyByCategory[primaryCategory.name] ?? [
      "General service",
      "Repairs",
      "Installations",
    ];
    for (const specialty of specialties) {
      await prisma.providerSpecialty.upsert({
        where: {
          providerId_specialty: {
            providerId: provider.id,
            specialty,
          },
        },
        update: {},
        create: {
          providerId: provider.id,
          specialty,
        },
      });
    }

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
          const start = new Date(
            `1970-01-01T${String(h).padStart(2, "0")}:00:00Z`,
          );
          const end = new Date(
            `1970-01-01T${String(h + 1).padStart(2, "0")}:00:00Z`,
          );
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
  console.log(
    `  ✓ providers: ${providers.length} (each with 7-day availability)`,
  );

  // -------------------------------------------------------------------------
  // 5. Sample bookings (one per customer-provider pair, varying statuses)
  // -------------------------------------------------------------------------
  const sampleBookings = [
    { status: BookingStatus.COMPLETED, daysAgo: 14, amount: 3000 },
    { status: BookingStatus.CONFIRMED, daysAgo: -2, amount: 2500 },
    { status: BookingStatus.PENDING, daysAgo: -5, amount: 1800 },
    { status: BookingStatus.IN_PROGRESS, daysAgo: -1, amount: 2200 },
    { status: BookingStatus.CANCELLED, daysAgo: -3, amount: 0 },
    { status: BookingStatus.COMPLETED, daysAgo: 21, amount: 4200 },
    { status: BookingStatus.CONFIRMED, daysAgo: -6, amount: 1600 },
    { status: BookingStatus.PENDING, daysAgo: -8, amount: 1300 },
    { status: BookingStatus.COMPLETED, daysAgo: 30, amount: 5100 },
    { status: BookingStatus.CONFIRMED, daysAgo: -10, amount: 1400 },
    { status: BookingStatus.PENDING, daysAgo: -12, amount: 900 },
    { status: BookingStatus.IN_PROGRESS, daysAgo: -4, amount: 2000 },
  ];

  for (let i = 0; i < sampleBookings.length; i++) {
    const spec = sampleBookings[i];
    const customer = customers[i];
    const provider = providers[i];
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - spec.daysAgo);

    const bookingNumber = `LSF-${Date.now()}-${i}-${customer.id.slice(0, 4)}`;

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
        serviceAddress: "Customer's address, Accra",
        problemDescription: "Sample seeded booking for development",
        status: spec.status,
        finalAmount:
          spec.status === BookingStatus.COMPLETED ? spec.amount : null,
        paymentStatus:
          spec.status === BookingStatus.COMPLETED
            ? PaymentStatus.PAID
            : PaymentStatus.UNPAID,
        paymentMethod: spec.status === BookingStatus.COMPLETED ? "cash" : null,
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
  console.log(
    `   Customer: customer1@lsf.local … customer${customers.length}@lsf.local`,
  );
  console.log(
    `   Provider: provider1@lsf.local … provider${providers.length}@lsf.local`,
  );
}

main()
  .catch((e) => {
    console.error("\n❌ seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
