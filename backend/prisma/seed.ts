import "dotenv/config";
import {
  PrismaClient,
  UserRole,
  VerificationStatus,
  BookingStatus,
  PaymentStatus,
  FileType,
  FileContext,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "Password123!";

// Unsplash images are loaded with `?auto=format&fit=crop&w=...&q=80`. The
// frontend whitelists `images.unsplash.com` in next.config.mjs, so these URLs
// render through next/image without extra config.
function unsplash(id: string, w = 800, h = 600) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

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
  profileImage?: string;
  emailVerified?: boolean;
}) {
  return prisma.user.upsert({
    where: { email: opts.email },
    update: { name: opts.name, phone: opts.phone, profileImage: opts.profileImage },
    create: {
      email: opts.email,
      password: opts.passwordHash,
      name: opts.name,
      role: opts.role,
      phone: opts.phone,
      profileImage: opts.profileImage,
      emailVerifiedAt: opts.emailVerified ? new Date() : null,
    },
  });
}

// Create (or fetch) a File row pointing at a remote URL. Idempotent on
// storageKey so reruns don't duplicate.
async function upsertFile(opts: {
  uploadedById: string;
  storageKey: string;
  url: string;
  context: FileContext;
  originalName: string;
  width?: number;
  height?: number;
}) {
  const existing = await prisma.file.findFirst({
    where: { storageKey: opts.storageKey, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.file.create({
    data: {
      originalName: opts.originalName,
      fileName: opts.originalName,
      mimeType: "image/jpeg",
      fileSize: 0,
      fileType: FileType.IMAGE,
      storageProvider: "unsplash",
      storageKey: opts.storageKey,
      url: opts.url,
      thumbnailUrl: opts.url,
      context: opts.context,
      uploadedById: opts.uploadedById,
      width: opts.width ?? 800,
      height: opts.height ?? 600,
    },
  });
}

// ---------------------------------------------------------------------------
// Real Ghana city coordinates — used by providers
// ---------------------------------------------------------------------------
const GH_CITY: Record<string, { lat: number; lng: number }> = {
  Accra: { lat: 5.6037, lng: -0.187 },
  Tema: { lat: 5.6698, lng: 0.0166 },
  Kumasi: { lat: 6.6885, lng: -1.6244 },
  "Cape Coast": { lat: 5.1054, lng: -1.2466 },
  Takoradi: { lat: 4.8845, lng: -1.7554 },
  Tamale: { lat: 9.4035, lng: -0.8424 },
  Ho: { lat: 6.6019, lng: 0.4708 },
  Sunyani: { lat: 7.3392, lng: -2.3265 },
  Koforidua: { lat: 6.0941, lng: -0.2591 },
};

function coordsFor(location: string) {
  // Match the city prefix (everything before the comma).
  const city = location.split(",")[0].trim();
  const base = GH_CITY[city] ?? GH_CITY.Accra;
  // Jitter ±0.01° (~1km) so providers in the same city don't stack on the map.
  return {
    latitude: base.lat + (Math.random() - 0.5) * 0.02,
    longitude: base.lng + (Math.random() - 0.5) * 0.02,
  };
}

async function main() {
  console.log("🌱 seeding database (Ghana edition)...");
  const passwordHash = await hash(PASSWORD);

  // -------------------------------------------------------------------------
  // 1. Admin
  // -------------------------------------------------------------------------
  const admin = await upsertUser({
    email: "admin@lsf.local",
    name: "Kwesi Asare",
    role: UserRole.ADMIN,
    phone: "+233244000001",
    passwordHash,
    profileImage: unsplash("1573497019940-1c28c88b4f3e", 400, 400),
    emailVerified: true,
  });
  console.log(`  ✓ admin: ${admin.email}`);

  // -------------------------------------------------------------------------
  // 2. Categories (with header images)
  // -------------------------------------------------------------------------
  const categoryDefs = [
    {
      name: "Plumbing",
      icon: "wrench",
      color: "#0EA5E9",
      image: "1607472586893-edb57bdc0e39",
      description: "Leak repairs, pipe installation, water heater servicing, drain unblocking.",
    },
    {
      name: "Electrical",
      icon: "zap",
      color: "#F59E0B",
      image: "1558618666-fcd25c85cd64",
      description: "House wiring, lighting installation, ECG meter work, safety inspections.",
    },
    {
      name: "Cleaning",
      icon: "sparkles",
      color: "#10B981",
      image: "1581578731548-c64695cc6952",
      description: "Home cleaning, move-out deep cleans, office janitorial services.",
    },
    {
      name: "Carpentry",
      icon: "hammer",
      color: "#8B5CF6",
      image: "1572177812156-58036aae439c",
      description: "Custom furniture, doors and frames, wardrobes, kitchen cabinets.",
    },
    {
      name: "Tutoring",
      icon: "graduation-cap",
      color: "#EF4444",
      image: "1577896851231-70ef18881754",
      description: "BECE, WASSCE and university subjects, home and online lessons.",
    },
    {
      name: "Painting",
      icon: "paintbrush",
      color: "#F97316",
      image: "1562259949-e8e7689d7828",
      description: "Interior and exterior painting, decorative finishes, waterproofing.",
    },
    {
      name: "HVAC",
      icon: "wind",
      color: "#22C55E",
      image: "1631545308456-38a8bff89232",
      description: "Air-conditioner servicing, gas refill, installation and faultfinding.",
    },
    {
      name: "Handyman",
      icon: "tool",
      color: "#0F766E",
      image: "1581094794329-c8112a89af12",
      description: "Small home repairs, fixture mounting, assembly and odd jobs.",
    },
    {
      name: "Laundry",
      icon: "shirt",
      color: "#3B82F6",
      image: "1582735689369-4fe89db7114c",
      description: "Wash and fold, dry cleaning, ironing and pickup/delivery.",
    },
    {
      name: "Pest Control",
      icon: "bug",
      color: "#E11D48",
      image: "1632935190509-9b25a37c39b1",
      description: "Termite, cockroach, rodent and mosquito control with follow-up visits.",
    },
    {
      name: "Appliance Repair",
      icon: "settings",
      color: "#64748B",
      image: "1581092921461-eab98f08e2c2",
      description: "Fridge, washing machine, microwave and gas cooker repair.",
    },
    {
      name: "Moving",
      icon: "truck",
      color: "#A855F7",
      image: "1600518464441-9154a4dea21b",
      description: "Local and intra-city moves, packing, loading and unloading.",
    },
    {
      name: "Gardening",
      icon: "leaf",
      color: "#16A34A",
      image: "1416879595882-3373a0480b5b",
      description: "Lawn mowing, hedge trimming, planting and yard cleanup.",
    },
    {
      name: "Catering",
      icon: "utensils",
      color: "#FB923C",
      image: "1555244162-803834f70033",
      description: "Local and continental dishes for events, parties and home meals.",
    },
    {
      name: "Event Planning",
      icon: "calendar",
      color: "#0EA5E9",
      image: "1519671482749-fd09be7ccebf",
      description: "Weddings, birthdays, corporate events — decor, coordination, vendors.",
    },
    {
      name: "Security",
      icon: "shield",
      color: "#334155",
      image: "1582139329536-e7284fece509",
      description: "Property guards, event security, patrols and access control.",
    },
    {
      name: "Auto Repair",
      icon: "car",
      color: "#4F46E5",
      image: "1487754180451-c456f719a1fc",
      description: "Engine diagnostics, brakes, suspension, AC and general servicing.",
    },
    {
      name: "Car Wash",
      icon: "droplets",
      color: "#38BDF8",
      image: "1605618826115-fb4ab8ec1e96",
      description: "Exterior wash, interior detailing, vacuum and polishing.",
    },
    {
      name: "Beauty & Hair",
      icon: "scissors",
      color: "#EC4899",
      image: "1560066984-138dadb4c035",
      description: "Braids, locs, weaves, makeup and home salon services.",
    },
    {
      name: "Photography",
      icon: "camera",
      color: "#7C3AED",
      image: "1606983340126-99ab4feaa64a",
      description: "Weddings, portraits, events and product photography.",
    },
  ];

  const categories = await Promise.all(
    categoryDefs.map(async (c, i) => {
      const image = await upsertFile({
        uploadedById: admin.id,
        storageKey: `seed/category/${slug(c.name)}`,
        url: unsplash(c.image, 1200, 600),
        context: FileContext.AVATAR,
        originalName: `${slug(c.name)}.jpg`,
        width: 1200,
        height: 600,
      });
      return prisma.category.upsert({
        where: { slug: slug(c.name) },
        update: {
          description: c.description,
          icon: c.icon,
          color: c.color,
          imageId: image.id,
        },
        create: {
          name: c.name,
          slug: slug(c.name),
          icon: c.icon,
          color: c.color,
          displayOrder: i,
          description: c.description,
          imageId: image.id,
        },
      });
    }),
  );
  console.log(`  ✓ categories: ${categories.length} with images`);

  // -------------------------------------------------------------------------
  // 3. Customers — real Ghanaian names with avatars
  // -------------------------------------------------------------------------
  const customerSpecs = [
    { name: "Ama Owusu", avatar: "1494790108377-be9c29b29330" },
    { name: "Kofi Mensah", avatar: "1507003211169-0a1dd7228f2d" },
    { name: "Akua Boateng", avatar: "1438761681033-6461ffad8d80" },
    { name: "Kwame Asante", avatar: "1500648767791-00dcc994a43e" },
    { name: "Adwoa Sarpong", avatar: "1531123897727-8f129e1688ce" },
    { name: "Kojo Nkrumah", avatar: "1472099645785-5658abf4ff4e" },
    { name: "Esi Quartey", avatar: "1487412720507-e7ab37603c6f" },
    { name: "Yaw Darko", avatar: "1492562080023-ab3db95bfbce" },
    { name: "Abena Forson", avatar: "1534528741775-53994a69daeb" },
    { name: "Kwaku Tagoe", avatar: "1506794778202-cad84cf45f1d" },
    { name: "Afia Donkor", avatar: "1573497019940-1c28c88b4f3e" },
    { name: "Nana Yaa Pokuaa", avatar: "1517841905240-472988babdf9" },
    { name: "Ebo Yalley", avatar: "1463453091185-61582044d556" },
    { name: "Akosua Frimpong", avatar: "1502685104226-ee32379fefbe" },
    { name: "Komla Agyeman", avatar: "1539571696857-5a6c8e1a4d28" },
    { name: "Mawuli Kpodo", avatar: "1521119989659-a83eee488004" },
    { name: "Selasi Adzo", avatar: "1544005313-94ddf0286df2" },
    { name: "Doris Ofori", avatar: "1525134479668-1bee5c7c6845" },
    { name: "Patience Anokye", avatar: "1554151228-14d9def656e4" },
    { name: "Bright Acheampong", avatar: "1496345875659-11f7dd282d1d" },
  ];

  const customers = await Promise.all(
    customerSpecs.map((c, i) =>
      upsertUser({
        email: `customer${i + 1}@lsf.local`,
        name: c.name,
        role: UserRole.CUSTOMER,
        phone: `+233244${String(100000 + i).padStart(6, "0")}`,
        passwordHash,
        profileImage: unsplash(c.avatar, 200, 200),
        emailVerified: true,
      }),
    ),
  );
  console.log(`  ✓ customers: ${customers.length}`);

  // -------------------------------------------------------------------------
  // 4. Providers — real names, real locations, real bios, gallery photos
  // -------------------------------------------------------------------------
  const providerSpecs = [
    {
      name: "Daniel Aidoo",
      category: 0,
      rate: 80,
      location: "Accra, East Legon",
      avatar: "1568602471122-7832951cc4c5",
      gallery: ["1607472586893-edb57bdc0e39", "1585704032915-c3400ca199e7", "1605152276897-4f618f831968"],
      bio: "Licensed plumber with 12 years' experience across East Legon, Cantonments and Airport Residential. Specialist in leak detection, pipe replacement and water heater installation. NABCO certified.",
    },
    {
      name: "Akosua Anane",
      category: 1,
      rate: 95,
      location: "Accra, Osu",
      avatar: "1573496359142-b8d87734a5a2",
      gallery: ["1558618666-fcd25c85cd64", "1517048676732-d65bc937f952", "1545208974-8ab97e7c8b3f"],
      bio: "Electrical contractor working with homes and small offices in Osu, Cantonments and Labone. ECG-approved meter work, inverter installation and full house rewiring.",
    },
    {
      name: "Kwabena Sefa",
      category: 2,
      rate: 50,
      location: "Tema, Community 2",
      avatar: "1531427186611-ecfd6d936c79",
      gallery: ["1581578731548-c64695cc6952", "1527515637462-cff94eecc1ac", "1583947582886-f40ec95dd752"],
      bio: "Residential cleaning team for Tema and East Legon. Move-in/move-out deep cleans, weekly maintenance and post-construction cleanups. Same-day bookings available.",
    },
    {
      name: "Grace Owusu-Ansah",
      category: 3,
      rate: 110,
      location: "Kumasi, Bantama",
      avatar: "1580489944761-15a19d654956",
      gallery: ["1572177812156-58036aae439c", "1601564921647-b446839a013f", "1631679706909-1844bbd07221"],
      bio: "Carpenter and furniture maker based in Bantama. Custom wardrobes, kitchen cabinets, doors and TV stands using local hardwood. Delivers across Ashanti Region.",
    },
    {
      name: "Daniel Adu-Boahen",
      category: 4,
      rate: 70,
      location: "Cape Coast, Central",
      avatar: "1542178243-bc20204b769f",
      gallery: ["1577896851231-70ef18881754", "1503676260728-1c00da094a0b", "1509062522246-3755977927d7"],
      bio: "WASSCE Mathematics and Physics tutor with 8 years' track record. Home tuition in Cape Coast and online lessons nationwide. Group rates available.",
    },
    {
      name: "Akosua Serwaa",
      category: 5,
      rate: 75,
      location: "Accra, Madina",
      avatar: "1551836022-d5d88e9218df",
      gallery: ["1562259949-e8e7689d7828", "1589939705384-5185137a7f0f", "1503387762-cd7e4d6a1e21"],
      bio: "Interior and exterior painting service for Madina, Adenta and East Legon. Specialises in textured finishes and waterproof coatings for outdoor walls.",
    },
    {
      name: "Kwame Antwi",
      category: 6,
      rate: 120,
      location: "Kumasi, Adum",
      avatar: "1564564321837-a57b7070ac4f",
      gallery: ["1631545308456-38a8bff89232", "1581094794329-c8112a89af12", "1607400201515-c2c41c07d307"],
      bio: "AC technician serving Adum, Asokwa and surrounding Kumasi neighbourhoods. Gas refill, split unit installation and routine servicing for homes and offices.",
    },
    {
      name: "Esi Appiah",
      category: 7,
      rate: 60,
      location: "Takoradi, Market Circle",
      avatar: "1531746020798-e6953c6e8e04",
      gallery: ["1581094794329-c8112a89af12", "1584824486509-112e4181ff6b", "1556909114-f6e7ad7d3136"],
      bio: "Handyman for Takoradi and Sekondi area. Mounting TVs, assembling flat-pack furniture, fixing doors, hinges, locks and small electrical jobs.",
    },
    {
      name: "Kojo Badu",
      category: 8,
      rate: 45,
      location: "Ho, Civic",
      avatar: "1558203728-00f45181dd84",
      gallery: ["1582735689369-4fe89db7114c", "1545173168-9f1947eebb7f", "1610984993730-d4d8a25c6dee"],
      bio: "Premium laundry and dry-cleaning pickup service across Ho municipality. 48-hour turnaround, separate wash for whites and delicates, ironing included.",
    },
    {
      name: "Adjoa Mensimah",
      category: 9,
      rate: 90,
      location: "Sunyani, Town",
      avatar: "1521252659862-eec69941b71f",
      gallery: ["1632935190509-9b25a37c39b1", "1632935198687-734bf6cb6f59", "1581094794329-c8112a89af12"],
      bio: "Pest control specialist for Sunyani and Brong-Ahafo. Termite treatment, cockroach control and rodent management with 30-day follow-up guarantee.",
    },
    {
      name: "Yaw Osei",
      category: 10,
      rate: 85,
      location: "Koforidua, Central",
      avatar: "1506794778202-cad84cf45f1d",
      gallery: ["1581092921461-eab98f08e2c2", "1581092582372-6a5b04b8a988", "1581092583536-7fae4a45acb1"],
      bio: "Appliance repair tech in Koforidua. Refrigerators, washing machines, gas cookers and microwaves of all major brands. Spare parts sourced locally.",
    },
    {
      name: "Martha Nyame",
      category: 11,
      rate: 100,
      location: "Tamale, Central",
      avatar: "1573497019940-1c28c88b4f3e",
      gallery: ["1600518464441-9154a4dea21b", "1605127059442-1a3247b7d869", "1530124566582-a618bc2615dc"],
      bio: "Moving and relocation service from Tamale to anywhere in the country. Packing materials provided, careful handling of fragile items, insurance available.",
    },
    {
      name: "Abena Kusi",
      category: 12,
      rate: 65,
      location: "Accra, Spintex",
      avatar: "1494790108377-be9c29b29330",
      gallery: ["1416879595882-3373a0480b5b", "1599629954294-14df9ec8bc03", "1592722432683-bc5dd6e8137f"],
      bio: "Garden maintenance for homes and offices along Spintex Road. Lawn mowing, hedge trimming, planting and seasonal cleanup. Tools provided.",
    },
    {
      name: "Kwaku Dapaah",
      category: 13,
      rate: 150,
      location: "Accra, Airport",
      avatar: "1539571696857-5a6c8e1a4d28",
      gallery: ["1555244162-803834f70033", "1567620905732-2d1ec7ab7445", "1547573854-74f2207d7d6f"],
      bio: "Caterer specialising in Ghanaian and continental menus. Birthdays, weddings, corporate lunches. Booked solid most weekends — reserve early.",
    },
    {
      name: "Yaa Nyarko",
      category: 14,
      rate: 130,
      location: "Kumasi, Asokwa",
      avatar: "1502685104226-ee32379fefbe",
      gallery: ["1519671482749-fd09be7ccebf", "1464366400600-7168b8af9bc3", "1530023367847-a683933f4172"],
      bio: "Event planner and decorator for the Ashanti region. Weddings, naming ceremonies and corporate events. Network of trusted vendors for sound, photography and rentals.",
    },
    {
      name: "Nana Addo Boamah",
      category: 15,
      rate: 110,
      location: "Accra, Roman Ridge",
      avatar: "1500648767791-00dcc994a43e",
      gallery: ["1582139329536-e7284fece509", "1610552050890-fc99536c2615", "1559136555-9303baea8ebd"],
      bio: "Licensed private security service in Greater Accra. Property guards, event security, mobile patrols. All officers background-checked and uniformed.",
    },
    {
      name: "Samuel Kofi Boakye",
      category: 16,
      rate: 105,
      location: "Tema, Community 22",
      avatar: "1463453091185-61582044d556",
      gallery: ["1487754180451-c456f719a1fc", "1599256871679-6cda9389bff7", "1568605114967-8130f3a36994"],
      bio: "Mobile mechanic in Tema. Brake service, engine diagnostics with OBD scanner, AC repair and routine servicing — at your home or office.",
    },
    {
      name: "Afia Boadu",
      category: 17,
      rate: 40,
      location: "Accra, Dansoman",
      avatar: "1492562080023-ab3db95bfbce",
      gallery: ["1605618826115-fb4ab8ec1e96", "1601362840469-51e4d8d58785", "1583836631370-9d56b9d2c95a"],
      bio: "Mobile car wash for Dansoman and Mamprobi. Exterior wash, interior vacuum, dashboard treatment and polish. Bring your car or we come to you.",
    },
    {
      name: "Linda Tetteh",
      category: 18,
      rate: 85,
      location: "Kumasi, Santasi",
      avatar: "1487412720507-e7ab37603c6f",
      gallery: ["1560066984-138dadb4c035", "1522337360788-8b13dee7a37e", "1595476108010-b4d1f102b1b1"],
      bio: "Mobile hair stylist for Kumasi. Braids, twists, locs maintenance, weaves and natural-hair care. Home service across Santasi, Asokwa and Bantama.",
    },
    {
      name: "Prosper Kumi",
      category: 19,
      rate: 200,
      location: "Takoradi, New Takoradi",
      avatar: "1531427186611-ecfd6d936c79",
      gallery: ["1606983340126-99ab4feaa64a", "1502920917128-1aa500764cbd", "1554080353-a576cf803bda"],
      bio: "Wedding and event photographer based in the Western Region. Full-day coverage with second shooter available, edited gallery delivered within two weeks.",
    },
  ];

  const specialtyByCategory: Record<string, string[]> = {
    Plumbing: ["Leak detection", "Pipe installation", "Water heater service"],
    Electrical: ["House wiring", "Inverter install", "ECG meter work"],
    Cleaning: ["Deep cleaning", "Move-out", "Post-construction"],
    Carpentry: ["Wardrobes", "Doors and frames", "Kitchen cabinets"],
    Tutoring: ["WASSCE Maths", "Physics", "BECE prep"],
    Painting: ["Interior", "Exterior", "Waterproof coatings"],
    HVAC: ["AC servicing", "Gas refill", "Split unit install"],
    Handyman: ["Mounting", "Furniture assembly", "Small repairs"],
    Laundry: ["Wash & fold", "Dry cleaning", "Ironing"],
    "Pest Control": ["Termite treatment", "Cockroach", "Rodent control"],
    "Appliance Repair": ["Fridge", "Washing machine", "Gas cooker"],
    Moving: ["Packing", "Loading", "Intra-city transport"],
    Gardening: ["Lawn mowing", "Hedge trimming", "Planting"],
    Catering: ["Ghanaian dishes", "Continental", "Buffet setups"],
    "Event Planning": ["Weddings", "Decor", "Vendor coordination"],
    Security: ["Property guards", "Event security", "Patrols"],
    "Auto Repair": ["Brakes", "Engine diagnostics", "AC service"],
    "Car Wash": ["Exterior wash", "Interior detail", "Polish"],
    "Beauty & Hair": ["Braids", "Locs maintenance", "Natural hair"],
    Photography: ["Weddings", "Portraits", "Events"],
  };

  const providers: { id: string; userId: string }[] = [];
  for (let i = 0; i < providerSpecs.length; i++) {
    const spec = providerSpecs[i];
    const user = await upsertUser({
      email: `provider${i + 1}@lsf.local`,
      name: spec.name,
      role: UserRole.PROVIDER,
      phone: `+233244${String(200000 + i).padStart(6, "0")}`,
      passwordHash,
      profileImage: unsplash(spec.avatar, 400, 400),
      emailVerified: true,
    });

    const coords = coordsFor(spec.location);
    const provider = await prisma.provider.upsert({
      where: { userId: user.id },
      update: {
        bio: spec.bio,
        hourlyRate: spec.rate,
        location: spec.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
      create: {
        userId: user.id,
        bio: spec.bio,
        hourlyRate: spec.rate,
        yearsExperience: 3 + (i % 10),
        location: spec.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
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

    for (const specialty of specialtyByCategory[primaryCategory.name] ?? []) {
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

    // Gallery: 3 images per provider, linked through File rows
    for (let g = 0; g < spec.gallery.length; g++) {
      const photoId = spec.gallery[g];
      const file = await upsertFile({
        uploadedById: user.id,
        storageKey: `seed/provider/${user.id}/${g}`,
        url: unsplash(photoId, 1200, 800),
        context: FileContext.GALLERY,
        originalName: `${slug(spec.name)}-work-${g + 1}.jpg`,
        width: 1200,
        height: 800,
      });
      await prisma.providerGallery.upsert({
        where: {
          providerId_fileId: { providerId: provider.id, fileId: file.id },
        },
        update: { displayOrder: g, isFeatured: g === 0 },
        create: {
          providerId: provider.id,
          fileId: file.id,
          displayOrder: g,
          isFeatured: g === 0,
          title: `${primaryCategory.name} work sample ${g + 1}`,
        },
      });
    }
    await prisma.provider.update({
      where: { id: provider.id },
      data: { galleryCount: spec.gallery.length },
    });

    // Availability: next 7 days, 9:00-17:00 in 1h slots
    for (let d = 1; d <= 7; d++) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() + d);

      const availability = await prisma.availability.upsert({
        where: { providerId_date: { providerId: provider.id, date } },
        update: {},
        create: { providerId: provider.id, date, isAvailable: true },
      });

      const existingSlots = await prisma.timeSlot.count({
        where: { availabilityId: availability.id },
      });
      if (existingSlots === 0) {
        for (let h = 9; h < 17; h++) {
          await prisma.timeSlot.create({
            data: {
              availabilityId: availability.id,
              startTime: new Date(`1970-01-01T${String(h).padStart(2, "0")}:00:00Z`),
              endTime: new Date(`1970-01-01T${String(h + 1).padStart(2, "0")}:00:00Z`),
              isAvailable: true,
            },
          });
        }
      }
    }

    providers.push({ id: provider.id, userId: user.id });
  }
  console.log(`  ✓ providers: ${providers.length} (gallery + availability)`);

  // -------------------------------------------------------------------------
  // 5. Sample bookings — Ghana-themed descriptions
  // -------------------------------------------------------------------------
  const bookingTemplates = [
    {
      status: BookingStatus.COMPLETED,
      daysAgo: 14,
      amount: 280,
      address: "Plot 21, East Legon Hills, Accra",
      problem: "Kitchen sink leaking under the cabinet — water collecting on the floor.",
      review: { rating: 5, title: "Sorted it within an hour", comment: "Showed up on time, brought the right parts, explained what was wrong. Will book again." },
    },
    {
      status: BookingStatus.CONFIRMED,
      daysAgo: -2,
      amount: 350,
      address: "House No. 14, Cantonments, Accra",
      problem: "Bedroom AC not cooling — needs gas refill and servicing.",
    },
    {
      status: BookingStatus.PENDING,
      daysAgo: -5,
      amount: 180,
      address: "Block C, Spintex Road, Accra",
      problem: "Need a full home deep clean before tenants move in this weekend.",
    },
    {
      status: BookingStatus.IN_PROGRESS,
      daysAgo: -1,
      amount: 220,
      address: "Plot 7, Asokwa Road, Kumasi",
      problem: "Building a custom 6ft wardrobe with sliding doors for the master bedroom.",
    },
    {
      status: BookingStatus.CANCELLED,
      daysAgo: -3,
      amount: 0,
      address: "Adum, Kumasi",
      problem: "Maths tuition for SHS3 student preparing for WASSCE.",
    },
    {
      status: BookingStatus.COMPLETED,
      daysAgo: 21,
      amount: 420,
      address: "House 12, Dansoman, Accra",
      problem: "Interior repaint — living room, dining and corridor. Matte finish.",
      review: { rating: 5, title: "Clean finish", comment: "Used good-quality paint, masked off the furniture properly, finished a day early." },
    },
    {
      status: BookingStatus.CONFIRMED,
      daysAgo: -6,
      amount: 160,
      address: "Community 22, Tema",
      problem: "Mount 65-inch TV on the wall and tidy the cables. Bracket already bought.",
    },
    {
      status: BookingStatus.PENDING,
      daysAgo: -8,
      amount: 130,
      address: "Ho Civic Area",
      problem: "Weekly laundry pickup — 2 bags, mix of shirts, trousers and bedsheets.",
    },
    {
      status: BookingStatus.COMPLETED,
      daysAgo: 30,
      amount: 510,
      address: "Sunyani Estates, Sunyani",
      problem: "Severe cockroach infestation in the kitchen — need treatment and follow-up.",
      review: { rating: 4, title: "Big improvement", comment: "Saw a real drop after the first visit. Came back two weeks later for follow-up as agreed." },
    },
    {
      status: BookingStatus.CONFIRMED,
      daysAgo: -10,
      amount: 140,
      address: "Effiduase, Koforidua",
      problem: "Whirlpool fridge stopped cooling. Compressor making clicking sound.",
    },
    {
      status: BookingStatus.PENDING,
      daysAgo: -12,
      amount: 95,
      address: "Vittin, Tamale",
      problem: "Moving from a 2-bedroom apartment to a new place across town. About 12 boxes.",
    },
    {
      status: BookingStatus.IN_PROGRESS,
      daysAgo: -4,
      amount: 200,
      address: "Spintex residential, Accra",
      problem: "Monthly garden maintenance — lawn mowing, hedge trimming and weeding.",
    },
  ];

  for (let i = 0; i < bookingTemplates.length; i++) {
    const spec = bookingTemplates[i];
    const customer = customers[i];
    const provider = providers[i];
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - spec.daysAgo);

    const bookingNumber = `LSF-${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}-${i.toString().padStart(4, "0")}-${customer.id.slice(0, 4)}`;

    const exists = await prisma.booking.findUnique({ where: { bookingNumber } });
    if (exists) continue;

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        customerId: customer.id,
        providerId: provider.id,
        scheduledDate: date,
        scheduledStartTime: new Date("1970-01-01T10:00:00Z"),
        scheduledEndTime: new Date("1970-01-01T12:00:00Z"),
        serviceAddress: spec.address,
        problemDescription: spec.problem,
        status: spec.status,
        finalAmount:
          spec.status === BookingStatus.COMPLETED ? spec.amount : null,
        paymentStatus:
          spec.status === BookingStatus.COMPLETED
            ? PaymentStatus.PAID
            : PaymentStatus.UNPAID,
        paymentMethod:
          spec.status === BookingStatus.COMPLETED ? "mobile_money" : null,
        paidAt: spec.status === BookingStatus.COMPLETED ? new Date() : null,
        createdById: customer.id,
      },
    });

    if (spec.status === BookingStatus.COMPLETED && spec.review) {
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
            rating: spec.review.rating,
            title: spec.review.title,
            comment: spec.review.comment,
          },
        });
        await prisma.provider.update({
          where: { id: provider.id },
          data: {
            rating: spec.review.rating,
            reviewCount: { increment: 1 },
            completedBookings: { increment: 1 },
            totalBookings: { increment: 1 },
          },
        });
      }
    }
  }
  console.log(`  ✓ bookings: ${bookingTemplates.length}`);

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
  console.log(`   Customer: customer1@lsf.local … customer${customers.length}@lsf.local`);
  console.log(`   Provider: provider1@lsf.local … provider${providers.length}@lsf.local`);
}

main()
  .catch((e) => {
    console.error("\n❌ seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
