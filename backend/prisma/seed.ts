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
import { Pool } from "pg";
import * as bcrypt from "bcrypt";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PASSWORD = "Password123!";

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
    update: { 
      name: opts.name, 
      phone: opts.phone, 
      profileImage: opts.profileImage 
    },
    create: {
      email: opts.email,
      password: opts.passwordHash,
      name: opts.name,
      role: opts.role,
      phone: opts.phone,
      profileImage: opts.profileImage,
      emailVerifiedAt: opts.emailVerified ? new Date() : null,
      phoneVerifiedAt: opts.emailVerified ? new Date() : null,
      lastLoginAt: new Date(),
      lastLoginIp: "192.168.1.1",
      loginCount: Math.floor(Math.random() * 20) + 1,
    },
  });
}

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
      fileSize: 1024,
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

// Exact Coordinates map (Heavy focus on Cape Coast + others)
const LOCATIONS: Record<string, { lat: number; lng: number }> = {
  // Cape Coast
  "Cape Coast, UCC Campus": { lat: 5.1155, lng: -1.2891 },
  "Cape Coast, Abura": { lat: 5.1325, lng: -1.2721 },
  "Cape Coast, Pedu": { lat: 5.1221, lng: -1.2662 },
  "Cape Coast, Elmina": { lat: 5.0833, lng: -1.3500 },
  "Cape Coast, Kakumdo": { lat: 5.1250, lng: -1.2900 },
  "Cape Coast, Ola": { lat: 5.1065, lng: -1.2589 },
  "Cape Coast, Kotokuraba": { lat: 5.1054, lng: -1.2466 },
  "Cape Coast, Essaman": { lat: 5.0990, lng: -1.3321 },
  // Accra
  "Accra, East Legon": { lat: 5.6353, lng: -0.1541 },
  "Accra, Cantonments": { lat: 5.5861, lng: -0.1694 },
  "Accra, Madina": { lat: 5.6667, lng: -0.1667 },
  "Accra, Osu": { lat: 5.5500, lng: -0.1833 },
  "Accra, Spintex": { lat: 5.6359, lng: -0.0988 },
  "Accra, Dansoman": { lat: 5.5413, lng: -0.2608 },
  // Kumasi
  "Kumasi, Bantama": { lat: 6.7027, lng: -1.6318 },
  "Kumasi, Adum": { lat: 6.6908, lng: -1.6231 },
  "Kumasi, Asokwa": { lat: 6.6781, lng: -1.6025 },
  "Kumasi, Santasi": { lat: 6.6660, lng: -1.6420 },
  // Tema
  "Tema, Community 2": { lat: 5.6429, lng: -0.0050 },
  "Tema, Community 22": { lat: 5.7100, lng: -0.0400 },
  // Others
  "Ho, Civic": { lat: 6.6019, lng: 0.4708 },
  "Sunyani, Town": { lat: 7.3392, lng: -2.3265 },
  "Koforidua, Central": { lat: 6.0941, lng: -0.2591 },
  "Tamale, Central": { lat: 9.4035, lng: -0.8424 },
  "Takoradi, Market Circle": { lat: 4.8845, lng: -1.7554 },
};

function coordsFor(location: string) {
  const base = LOCATIONS[location];
  if (base) {
    // Add tiny jitter (approx 100 meters) so pins don't overlap perfectly
    return {
      latitude: base.lat + (Math.random() - 0.5) * 0.002,
      longitude: base.lng + (Math.random() - 0.5) * 0.002,
    };
  }
  // Fallback to Cape Coast Kotokuraba
  const fallback = LOCATIONS["Cape Coast, Kotokuraba"];
  return {
    latitude: fallback.lat + (Math.random() - 0.5) * 0.002,
    longitude: fallback.lng + (Math.random() - 0.5) * 0.002,
  };
}

async function main() {
  console.log("🌱 seeding database (Ghana/Cape Coast edition)...");
  const passwordHash = await hash(PASSWORD);

  // 1. Admin
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

  // 2. Categories (with header images)
  const categoryDefs = [
    { name: "Plumbing", icon: "wrench", color: "#0EA5E9", image: "1607472586893-edb57bdc0e39", description: "Leak repairs, pipe installation, water heater servicing, drain unblocking." },
    { name: "Electrical", icon: "zap", color: "#F59E0B", image: "1558618666-fcd25c85cd64", description: "House wiring, lighting installation, ECG meter work, safety inspections." },
    { name: "Cleaning", icon: "sparkles", color: "#10B981", image: "1581578731548-c64695cc6952", description: "Home cleaning, move-out deep cleans, office janitorial services." },
    { name: "Carpentry", icon: "hammer", color: "#8B5CF6", image: "1572177812156-58036aae439c", description: "Custom furniture, doors and frames, wardrobes, kitchen cabinets." },
    { name: "Tutoring", icon: "graduation-cap", color: "#EF4444", image: "1577896851231-70ef18881754", description: "BECE, WASSCE and university subjects, home and online lessons." },
    { name: "Painting", icon: "paintbrush", color: "#F97316", image: "1562259949-e8e7689d7828", description: "Interior and exterior painting, decorative finishes, waterproofing." },
    { name: "HVAC", icon: "wind", color: "#22C55E", image: "1631545308456-38a8bff89232", description: "Air-conditioner servicing, gas refill, installation and faultfinding." },
    { name: "Handyman", icon: "tool", color: "#0F766E", image: "1581094794329-c8112a89af12", description: "Small home repairs, fixture mounting, assembly and odd jobs." },
    { name: "Laundry", icon: "shirt", color: "#3B82F6", image: "1582735689369-4fe89db7114c", description: "Wash and fold, dry cleaning, ironing and pickup/delivery." },
    { name: "Pest Control", icon: "bug", color: "#E11D48", image: "1632935190509-9b25a37c39b1", description: "Termite, cockroach, rodent and mosquito control with follow-up visits." },
    { name: "Appliance Repair", icon: "settings", color: "#64748B", image: "1581092921461-eab98f08e2c2", description: "Fridge, washing machine, microwave and gas cooker repair." },
    { name: "Moving", icon: "truck", color: "#A855F7", image: "1600518464441-9154a4dea21b", description: "Local and intra-city moves, packing, loading and unloading." },
    { name: "Gardening", icon: "leaf", color: "#16A34A", image: "1416879595882-3373a0480b5b", description: "Lawn mowing, hedge trimming, planting and yard cleanup." },
    { name: "Catering", icon: "utensils", color: "#FB923C", image: "1555244162-803834f70033", description: "Local and continental dishes for events, parties and home meals." },
    { name: "Event Planning", icon: "calendar", color: "#0EA5E9", image: "1519671482749-fd09be7ccebf", description: "Weddings, birthdays, corporate events — decor, coordination, vendors." },
    { name: "Security", icon: "shield", color: "#334155", image: "1582139329536-e7284fece509", description: "Property guards, event security, patrols and access control." },
    { name: "Auto Repair", icon: "car", color: "#4F46E5", image: "1487754180451-c456f719a1fc", description: "Engine diagnostics, brakes, suspension, AC and general servicing." },
    { name: "Car Wash", icon: "droplets", color: "#38BDF8", image: "1605618826115-fb4ab8ec1e96", description: "Exterior wash, interior detailing, vacuum and polishing." },
    { name: "Beauty & Hair", icon: "scissors", color: "#EC4899", image: "1560066984-138dadb4c035", description: "Braids, locs, weaves, makeup and home salon services." },
    { name: "Photography", icon: "camera", color: "#7C3AED", image: "1606983340126-99ab4feaa64a", description: "Weddings, portraits, events and product photography." },
    { name: "IT & Computer Repair", icon: "laptop", color: "#06B6D4", image: "1588508065161-40fa4d173b22", description: "Laptop repairs, software installation, networking and virus removal." },
    { name: "Tailoring & Fashion", icon: "scissors", color: "#F43F5E", image: "1556905055-8f358a7a47b2", description: "Custom dresses, suits, alterations and traditional wear." },
    { name: "Masonry & Tiling", icon: "hammer", color: "#78716C", image: "1503387762-cd7e4d6a1e21", description: "Block laying, plastering, floor and wall tiling." },
    { name: "Welding & Fabrication", icon: "tool", color: "#B45309", image: "1504917595497-814bfb228b3b", description: "Metal gates, burglar proofs, welding repairs and custom ironworks." },
    { name: "Graphic Design", icon: "pen-tool", color: "#D946EF", image: "1572044162444-fd14e8c1b35b", description: "Logos, flyers, business cards and branding materials." },
    { name: "Fitness Training", icon: "activity", color: "#14B8A6", image: "1534438327276-14e5300c3a48", description: "Personal training, home workouts, gym coaching and fitness planning." },
  ];

  const categories = [];
  for (let i = 0; i < categoryDefs.length; i++) {
    const c = categoryDefs[i];
    const image = await upsertFile({
      uploadedById: admin.id,
      storageKey: `seed/category/${slug(c.name)}`,
      url: unsplash(c.image, 1200, 600),
      context: FileContext.AVATAR,
      originalName: `${slug(c.name)}.jpg`,
      width: 1200,
      height: 600,
    });
    const category = await prisma.category.upsert({
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
    categories.push(category);
  }
  console.log(`  ✓ categories: ${categories.length} with images`);

  // 3. Customers
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
  ];

  const customers = [];
  for (let i = 0; i < customerSpecs.length; i++) {
    const c = customerSpecs[i];
    const customer = await upsertUser({
      email: `customer${i + 1}@lsf.local`,
      name: c.name,
      role: UserRole.CUSTOMER,
      phone: `+233244${String(100000 + i).padStart(6, "0")}`,
      passwordHash,
      profileImage: unsplash(c.avatar, 200, 200),
      emailVerified: true,
    });
    customers.push(customer);
  }
  console.log(`  ✓ customers: ${customers.length}`);

  // 4. Providers - HEAVY CAPE COAST FOCUS
  const providerSpecs = [
    {
      name: "Daniel Aidoo",
      email: "danielaidoo@gmail.com",
      category: 0, // Plumbing
      rate: 80,
      location: "Cape Coast, UCC Campus",
      avatar: "1568602471122-7832951cc4c5",
      gallery: ["1607472586893-edb57bdc0e39", "1585704032915-c3400ca199e7", "1605152276897-4f618f831968"],
      bio: "Licensed plumber serving Cape Coast, especially UCC and environs. Leak detection, pipe replacement and water heater installation.",
    },
    {
      name: "Akosua Anane",
      email: "akosuaanane@gmail.com",
      category: 1, // Electrical
      rate: 95,
      location: "Cape Coast, Pedu",
      avatar: "1573496359142-b8d87734a5a2",
      gallery: ["1558618666-fcd25c85cd64", "1517048676732-d65bc937f952", "1545208974-8ab97e7c8b3f"],
      bio: "Electrical contractor for homes and small offices in Pedu and Abura. ECG-approved meter work, inverter installation.",
    },
    {
      name: "Kwabena Sefa",
      email: "kwabenasefa@gmail.com",
      category: 2, // Cleaning
      rate: 50,
      location: "Cape Coast, Abura",
      avatar: "1531427186611-ecfd6d936c79",
      gallery: ["1581578731548-c64695cc6952", "1527515637462-cff94eecc1ac", "1583947582886-f40ec95dd752"],
      bio: "Residential cleaning team based in Abura. Move-in/move-out deep cleans, weekly maintenance. Same-day bookings available.",
    },
    {
      name: "Grace Owusu-Ansah",
      email: "graceowusuansah@gmail.com",
      category: 3, // Carpentry
      rate: 110,
      location: "Cape Coast, Kakumdo",
      avatar: "1580489944761-15a19d654956",
      gallery: ["1572177812156-58036aae439c", "1601564921647-b446839a013f", "1631679706909-1844bbd07221"],
      bio: "Carpenter and furniture maker based in Kakumdo. Custom wardrobes, kitchen cabinets, doors and TV stands.",
    },
    {
      name: "Daniel Adu-Boahen",
      email: "danieladuboahen@gmail.com",
      category: 4, // Tutoring
      rate: 70,
      location: "Cape Coast, Ola",
      avatar: "1542178243-bc20204b769f",
      gallery: ["1577896851231-70ef18881754", "1503676260728-1c00da094a0b", "1509062522246-3755977927d7"],
      bio: "WASSCE Mathematics and Physics tutor with 8 years' track record. Home tuition in Cape Coast and online lessons nationwide.",
    },
    {
      name: "Akosua Serwaa",
      email: "akosuaserwaa@gmail.com",
      category: 5, // Painting
      rate: 75,
      location: "Cape Coast, Elmina",
      avatar: "1551836022-d5d88e9218df",
      gallery: ["1562259949-e8e7689d7828", "1589939705384-5185137a7f0f", "1503387762-cd7e4d6a1e21"],
      bio: "Interior and exterior painting service for Elmina and Cape Coast. Specialises in textured finishes and waterproof coatings.",
    },
    {
      name: "Kwame Antwi",
      email: "kwameantwi@gmail.com",
      category: 6, // HVAC
      rate: 120,
      location: "Cape Coast, Kotokuraba",
      avatar: "1564564321837-a57b7070ac4f",
      gallery: ["1631545308456-38a8bff89232", "1581094794329-c8112a89af12", "1607400201515-c2c41c07d307"],
      bio: "AC technician serving Cape Coast metropolis. Gas refill, split unit installation and routine servicing for homes and offices.",
    },
    {
      name: "Esi Appiah",
      email: "esiappiah@gmail.com",
      category: 7, // Handyman
      rate: 60,
      location: "Takoradi, Market Circle",
      avatar: "1531746020798-e6953c6e8e04",
      gallery: ["1581094794329-c8112a89af12", "1584824486509-112e4181ff6b", "1556909114-f6e7ad7d3136"],
      bio: "Handyman for Takoradi and Sekondi area. Mounting TVs, assembling flat-pack furniture, fixing doors.",
    },
    {
      name: "Kojo Badu",
      email: "kojobadu@gmail.com",
      category: 8, // Laundry
      rate: 45,
      location: "Accra, East Legon",
      avatar: "1558203728-00f45181dd84",
      gallery: ["1582735689369-4fe89db7114c", "1545173168-9f1947eebb7f", "1610984993730-d4d8a25c6dee"],
      bio: "Premium laundry and dry-cleaning pickup service across East Legon.",
    },
    {
      name: "Adjoa Mensimah",
      email: "adjoamensimah@gmail.com",
      category: 9, // Pest Control
      rate: 90,
      location: "Kumasi, Bantama",
      avatar: "1521252659862-eec69941b71f",
      gallery: ["1632935190509-9b25a37c39b1", "1632935198687-734bf6cb6f59", "1581094794329-c8112a89af12"],
      bio: "Pest control specialist for Kumasi. Termite treatment, cockroach control and rodent management.",
    },
    {
      name: "Yaw Osei",
      email: "yawosei@gmail.com",
      category: 10, // Appliance Repair
      rate: 85,
      location: "Tema, Community 2",
      avatar: "1506794778202-cad84cf45f1d",
      gallery: ["1581092921461-eab98f08e2c2", "1581092582372-6a5b04b8a988", "1581092583536-7fae4a45acb1"],
      bio: "Appliance repair tech in Tema. Refrigerators, washing machines, gas cookers and microwaves.",
    },
    {
      name: "Martha Nyame",
      email: "marthanyame@gmail.com",
      category: 11, // Moving
      rate: 100,
      location: "Cape Coast, Pedu",
      avatar: "1573497019940-1c28c88b4f3e",
      gallery: ["1600518464441-9154a4dea21b", "1605127059442-1a3247b7d869", "1530124566582-a618bc2615dc"],
      bio: "Moving and relocation service across Cape Coast and Central Region. Packing materials provided.",
    },
    {
      name: "Abena Kusi",
      email: "abenakusi@gmail.com",
      category: 12, // Gardening
      rate: 65,
      location: "Accra, Spintex",
      avatar: "1494790108377-be9c29b29330",
      gallery: ["1416879595882-3373a0480b5b", "1599629954294-14df9ec8bc03", "1592722432683-bc5dd6e8137f"],
      bio: "Garden maintenance for homes and offices along Spintex Road.",
    },
    {
      name: "Kwaku Dapaah",
      email: "kwakudapaah@gmail.com",
      category: 13, // Catering
      rate: 150,
      location: "Accra, Cantonments",
      avatar: "1539571696857-5a6c8e1a4d28",
      gallery: ["1555244162-803834f70033", "1567620905732-2d1ec7ab7445", "1547573854-74f2207d7d6f"],
      bio: "Caterer specialising in Ghanaian and continental menus. Birthdays, weddings.",
    },
    {
      name: "Yaa Nyarko",
      email: "yaanyarko@gmail.com",
      category: 14, // Event Planning
      rate: 130,
      location: "Cape Coast, UCC Campus",
      avatar: "1502685104226-ee32379fefbe",
      gallery: ["1519671482749-fd09be7ccebf", "1464366400600-7168b8af9bc3", "1530023367847-a683933f4172"],
      bio: "Event planner and decorator for Central Region. Weddings, naming ceremonies and corporate events.",
    },
    {
      name: "Kwasi Mensah",
      email: "kwasimensah@gmail.com",
      category: 15, // Security
      rate: 60,
      location: "Accra, Dansoman",
      avatar: "1545696968100-2f46ea508bc5",
      gallery: ["1582139329536-e7284fece509", "1508215885820-4585e56135c8", "1603502851410-a24fb35b6cd2"],
      bio: "Professional security guard services for homes and events in Accra. Vetted and well-trained.",
    },
    {
      name: "Kofi Owusu",
      email: "kofiowusu@gmail.com",
      category: 16, // Auto Repair
      rate: 140,
      location: "Kumasi, Santasi",
      avatar: "1581094794329-c8112a89af12",
      gallery: ["1487754180451-c456f719a1fc", "1517524008697-84bc1eb75791", "1504280590828-56dfd224b1bf"],
      bio: "Expert auto mechanic specialising in engine diagnostics, suspension and general servicing in Kumasi.",
    },
    {
      name: "Emmanuel Osei",
      email: "emmanuelosei@gmail.com",
      category: 17, // Car Wash
      rate: 40,
      location: "Tema, Community 22",
      avatar: "1530268729831-4b0b9e170218",
      gallery: ["1605618826115-fb4ab8ec1e96", "1580273916550-e323be2ae537", "1617066929944-8848fde29606"],
      bio: "Mobile car wash and interior detailing across Tema. We bring the water and power to you.",
    },
    {
      name: "Afia Pokua",
      email: "afiapokua@gmail.com",
      category: 18, // Beauty & Hair
      rate: 85,
      location: "Accra, Madina",
      avatar: "1508214751196-bcfd4ca60f91",
      gallery: ["1560066984-138dadb4c035", "1522337660859-02fbefca4702", "1516975080664-ed2fc6a32937"],
      bio: "Professional makeup artist and hairstylist. Available for weddings, photoshoots and home service.",
    },
    {
      name: "Kwadwo Asare",
      email: "kwadwoasare@gmail.com",
      category: 19, // Photography
      rate: 200,
      location: "Accra, Osu",
      avatar: "1487222477894-8943e31ef7b2",
      gallery: ["1606983340126-99ab4feaa64a", "1516035069371-29a1b244cc32", "1520390116642-d59f9126a462"],
      bio: "Event and portrait photographer based in Osu. Capturing your best moments with high-quality gear.",
    },
    {
      name: "Kweku Yeboah",
      email: "kwekuyeboah@gmail.com",
      category: 20, // IT & Computer Repair
      rate: 100,
      location: "Cape Coast, UCC Campus",
      avatar: "1531427186611-ecfd6d936c79",
      gallery: ["1588508065161-40fa4d173b22", "1593640408182-31c70c8268f5", "1519389953810-c103630c5e7b"],
      bio: "Professional IT and computer repair. We handle all laptop issues, software installations, and networking.",
    },
    {
      name: "Ama Serwaa",
      email: "amaserwaa@gmail.com",
      category: 21, // Tailoring & Fashion
      rate: 70,
      location: "Kumasi, Adum",
      avatar: "1551836022-d5d88e9218df",
      gallery: ["1556905055-8f358a7a47b2", "1576918349282-5fb663f73d84", "1515886657613-9f3515b0c78f"],
      bio: "Expert tailor in Adum. We make custom traditional wear, suits, and handle all clothing alterations.",
    },
    {
      name: "Kwame Ofori",
      email: "kwameofori@gmail.com",
      category: 22, // Masonry & Tiling
      rate: 90,
      location: "Accra, East Legon",
      avatar: "1506794778202-cad84cf45f1d",
      gallery: ["1503387762-cd7e4d6a1e21", "1581094794329-c8112a89af12", "1513694203232-719a280e022f"],
      bio: "Experienced mason and tiler. Quality block laying, plastering, and precise floor tiling.",
    },
    {
      name: "Yaw Kusi",
      email: "yawkusi@gmail.com",
      category: 23, // Welding & Fabrication
      rate: 110,
      location: "Tema, Community 2",
      avatar: "1564564321837-a57b7070ac4f",
      gallery: ["1504917595497-814bfb228b3b", "1581092582372-6a5b04b8a988", "1565514158-b65fba2629b3"],
      bio: "Expert welder for metal gates, burglar proofs, and custom ironworks in Tema.",
    },
    {
      name: "Abena Osei",
      email: "abenaosei@gmail.com",
      category: 24, // Graphic Design
      rate: 120,
      location: "Cape Coast, Ola",
      avatar: "1534528741775-53994a69daeb",
      gallery: ["1572044162444-fd14e8c1b35b", "1626785773579-c1735cb0d6cb", "1561070791266-2987178c74d8"],
      bio: "Freelance graphic designer. Branding materials, logos, and flyers to boost your business.",
    },
    {
      name: "Kojo Appiah",
      email: "kojoappiah@gmail.com",
      category: 25, // Fitness Training
      rate: 80,
      location: "Accra, Cantonments",
      avatar: "1500648767791-00dcc994a43e",
      gallery: ["1534438327276-14e5300c3a48", "1571019614242-c5c5dee9f50b", "1581009146145-b5ef050c2e1e"],
      bio: "Certified personal trainer. I offer gym coaching and tailored home workout plans to reach your fitness goals.",
    }
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
    "IT & Computer Repair": ["Laptop repair", "Virus removal", "Networking"],
    "Tailoring & Fashion": ["Custom dresses", "Suits", "Alterations"],
    "Masonry & Tiling": ["Block laying", "Plastering", "Tiling"],
    "Welding & Fabrication": ["Metal gates", "Burglar proofs", "Ironworks"],
    "Graphic Design": ["Logos", "Flyers", "Business cards"],
    "Fitness Training": ["Personal training", "Home workouts", "Gym coaching"],
  };

  const providers: { id: string; userId: string }[] = [];
  for (let i = 0; i < providerSpecs.length; i++) {
    const spec = providerSpecs[i];
    const user = await upsertUser({
      email: spec.email,
      name: spec.name,
      role: UserRole.PROVIDER,
      phone: `+233244${String(200000 + i).padStart(6, "0")}`,
      passwordHash,
      profileImage: unsplash(spec.avatar, 400, 400),
      emailVerified: true,
    });

    const coords = coordsFor(spec.location);

    // Dummy doc for Verification
    const docFile = await upsertFile({
      uploadedById: admin.id,
      storageKey: `seed/docs/${user.id}`,
      url: unsplash("1612012015049-74d6f8510c51", 800, 600), // A document-like image
      context: FileContext.VERIFICATION,
      originalName: `license-${i}.jpg`,
    });

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
        serviceRadiusKm: 20 + (i % 30),
        cancellationPolicy: "24 hours notice required for full refund.",
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: admin.id,
        idDocumentId: docFile.id,
        businessLicenseId: docFile.id,
        featured: i < 5,
        isActive: true,
        rating: 4.0 + (Math.random() * 1.0),
        trustScore: 85 + (Math.random() * 15),
        reviewCount: Math.floor(Math.random() * 50),
        totalBookings: Math.floor(Math.random() * 100),
        completedBookings: Math.floor(Math.random() * 90),
        responseRate: 90 + Math.random() * 10,
        avgResponseTimeMinutes: 10 + Math.floor(Math.random() * 50),
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

    for (const specialty of specialtyByCategory[primaryCategory.name] ?? []) {
      await prisma.providerSpecialty.upsert({
        where: {
          providerId_specialty: { providerId: provider.id, specialty },
        },
        update: {},
        create: { providerId: provider.id, specialty },
      });
    }

    // Seed Services
    await prisma.providerService.createMany({
      data: [
        {
          providerId: provider.id,
          categoryId: primaryCategory.id,
          name: `${primaryCategory.name} General Callout`,
          basePrice: spec.rate,
          durationMin: 60,
          description: "Standard service callout fee.",
          isActive: true,
        },
        {
          providerId: provider.id,
          categoryId: primaryCategory.id,
          name: `${primaryCategory.name} Comprehensive Service`,
          basePrice: spec.rate * 2.5,
          durationMin: 180,
          description: "Full comprehensive service offering.",
          isActive: true,
        }
      ]
    });

    // Seed Provider Hours (Mon-Fri 08:00 to 17:00)
    for (let day = 0; day <= 6; day++) {
      const isWeekend = day === 0 || day === 6;
      await prisma.providerHours.upsert({
        where: { providerId_dayOfWeek: { providerId: provider.id, dayOfWeek: day } },
        update: {},
        create: {
          providerId: provider.id,
          dayOfWeek: day,
          openMinutes: 480, // 08:00
          closeMinutes: 1020, // 17:00
          isClosed: isWeekend,
        }
      });
    }

    // Gallery
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

    // Availability
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
  console.log(`  ✓ providers: ${providers.length} (Cape Coast heavily featured, with Services & Hours)`);

  // 5. Sample bookings & Messages
  const bookingTemplates = [
    {
      status: BookingStatus.COMPLETED,
      daysAgo: 14,
      amount: 280,
      address: "UCC Science Market, Cape Coast",
      problem: "Kitchen sink leaking under the cabinet — water collecting on the floor.",
      review: { rating: 5, title: "Sorted it within an hour", comment: "Showed up on time, brought the right parts, explained what was wrong. Will book again." },
    },
    {
      status: BookingStatus.CONFIRMED,
      daysAgo: -2,
      amount: 350,
      address: "Abura, Cape Coast",
      problem: "Bedroom AC not cooling — needs gas refill and servicing.",
    },
    {
      status: BookingStatus.PENDING,
      daysAgo: -5,
      amount: 180,
      address: "Kakumdo, Cape Coast",
      problem: "Need a full home deep clean before tenants move in this weekend.",
    },
    {
      status: BookingStatus.IN_PROGRESS,
      daysAgo: -1,
      amount: 220,
      address: "Pedu Junction, Cape Coast",
      problem: "Building a custom 6ft wardrobe with sliding doors for the master bedroom.",
    },
    {
      status: BookingStatus.COMPLETED,
      daysAgo: 21,
      amount: 420,
      address: "East Legon, Accra",
      problem: "Interior repaint — living room, dining and corridor. Matte finish.",
      review: { rating: 5, title: "Clean finish", comment: "Used good-quality paint, masked off the furniture properly, finished a day early." },
    },
    {
      status: BookingStatus.CONFIRMED,
      daysAgo: -6,
      amount: 160,
      address: "Kotokuraba Market Area, Cape Coast",
      problem: "Mount 65-inch TV on the wall and tidy the cables. Bracket already bought.",
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

    const loc = LOCATIONS[spec.address] ?? LOCATIONS["Cape Coast, UCC Campus"];

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        customerId: customer.id,
        providerId: provider.id,
        scheduledDate: date,
        scheduledStartTime: new Date("1970-01-01T10:00:00Z"),
        scheduledEndTime: new Date("1970-01-01T12:00:00Z"),
        serviceAddress: spec.address,
        serviceLatitude: loc.lat,
        serviceLongitude: loc.lng,
        problemDescription: spec.problem,
        status: spec.status,
        finalAmount: spec.status === BookingStatus.COMPLETED ? spec.amount : null,
        paymentStatus: spec.status === BookingStatus.COMPLETED ? PaymentStatus.PAID : PaymentStatus.UNPAID,
        paymentMethod: spec.status === BookingStatus.COMPLETED ? "mobile_money" : null,
        paidAt: spec.status === BookingStatus.COMPLETED ? new Date() : null,
        createdById: customer.id,
      },
    });

    // Generate Conversation & Messages
    const conversation = await prisma.conversation.upsert({
      where: { customerId_providerId: { customerId: customer.id, providerId: provider.id } },
      update: { lastMessageAt: new Date(), lastMessagePreview: "Great, I'll be there." },
      create: {
        bookingId: booking.id,
        customerId: customer.id,
        providerId: provider.id,
        isActive: true,
        lastMessageAt: new Date(),
        lastMessagePreview: "Great, I'll be there.",
      }
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: customer.id,
        content: `Hi, I booked you for: ${spec.problem}`,
        messageType: "text",
      }
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: provider.userId,
        content: "Thanks! Great, I'll be there.",
        messageType: "text",
      }
    });

    if (spec.status === BookingStatus.COMPLETED && spec.review) {
      const existingReview = await prisma.review.findUnique({
        where: { customerId_providerId: { customerId: customer.id, providerId: provider.id } },
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
            providerResponse: "Thank you for trusting me with this job!",
            providerRespondedAt: new Date(),
          },
        });
      }
    }
  }
  console.log(`  ✓ bookings & messages: ${bookingTemplates.length}`);

  // 6. Favorites
  let favoritesCount = 0;
  for (const customer of customers) {
    if (Math.random() > 0.3) { // 70% chance to have a favorite
      await prisma.favorite.createMany({
        data: [
          { userId: customer.id, providerId: providers[Math.floor(Math.random() * providers.length)].id },
        ],
        skipDuplicates: true,
      });
      favoritesCount++;
    }
  }
  console.log(`  ✓ favorites: ${favoritesCount}`);

  // 7. Notification preferences for every user
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const u of allUsers) {
    await prisma.notificationPreference.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id },
    });
  }
  console.log(`  ✓ notification preferences: ${allUsers.length}`);

  console.log("\n✅ seed complete (Cape Coast heavy edition)");
  console.log(`   Login any seeded account with password: ${PASSWORD}`);
  console.log(`   Admin:    admin@lsf.local`);
  console.log(`   Customer: customer1@lsf.local … customer${customers.length}@lsf.local`);
  console.log(`   Provider: see providerSpecs in seed.ts for their exact emails`);
}

main()
  .catch((e) => {
    console.error("\n❌ seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
