// prisma/seed.js
// Seeds the database with demo data — multi-company per user

import { PrismaClient } from '@prisma/client';
import bcrypt           from 'bcryptjs';

const prisma = new PrismaClient();

// ── Emission factors (must match carbonCalculator.js) ────────────────────────
const KE_ELEC = 0.15;   // Kenya grid
const SA_ELEC = 0.90;   // South Africa grid
const DIESEL  = 2.68;
const PETROL  = 2.31;
const LANDFILL = 0.58;
const RECYCLED = 0.02;
const FLIGHT_S = 0.15;
const FLIGHT_L = 0.12;

function calc(e, country = 'kenya') {
  const gridFactor = country === 'southAfrica' ? SA_ELEC : KE_ELEC;
  const scope2 = (e.elec || 0) * gridFactor;
  const scope1 = (e.fuel || 0) * (e.fuelType === 'PETROL' ? PETROL : DIESEL);
  const wasteF = e.wasteType === 'RECYCLED' ? RECYCLED : LANDFILL;
  const scope3Waste  = (e.waste || 0) * wasteF;
  const scope3Flight = (e.flight || 0) * ((e.flight || 0) > 1500 ? FLIGHT_L : FLIGHT_S);
  const scope3 = scope3Waste + scope3Flight;
  const total  = scope1 + scope2 + scope3;
  return {
    scope1Emissions: Math.round(scope1 * 100) / 100,
    scope2Emissions: Math.round(scope2 * 100) / 100,
    scope3Emissions: Math.round(scope3 * 100) / 100,
    totalEmissions:  Math.round(total  * 100) / 100,
  };
}

async function main() {
  console.log('🌱 Seeding EcoTrack database (multi-company)…');

  // ── Demo user ──────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Demo@1234', 12);

  const user = await prisma.user.upsert({
    where:  { email: 'demo@ecotrack.com' },
    update: {},
    create: {
      firstName:    'Demo',
      lastName:     'User',
      email:        'demo@ecotrack.com',
      passwordHash: hash,
      role:         'USER',
    },
  });
  console.log('✅ Demo user:', user.email);

  // ── Company 1: XYZ Traders (Retail, Kenya) ─────────────────────────────────
  let company1 = await prisma.company.findFirst({ where: { userId: user.id, businessName: 'XYZ Traders' } });
  if (!company1) {
    company1 = await prisma.company.create({
      data: {
        userId:             user.id,
        businessName:       'XYZ Traders',
        industryType:       'RETAIL',
        location:           'Nairobi, Kenya',
        country:            'kenya',
        numberOfEmployees:  50,
        registrationNumber: 'BN/2024/12345',
        contactEmail:       'contact@xyztraders.com',
        contactPhone:       '+254 712 345 678',
        businessDescription:'Leading retail business specialising in sustainable consumer goods.',
        yearEstablished:    '2019',
      },
    });
  }
  console.log('✅ Company 1:', company1.businessName);

  // ── Company 2: GreenTech Solutions (Tech, Kenya) ───────────────────────────
  let company2 = await prisma.company.findFirst({ where: { userId: user.id, businessName: 'GreenTech Solutions' } });
  if (!company2) {
    company2 = await prisma.company.create({
      data: {
        userId:             user.id,
        businessName:       'GreenTech Solutions',
        industryType:       'TECHNOLOGY',
        location:           'Mombasa, Kenya',
        country:            'kenya',
        numberOfEmployees:  25,
        registrationNumber: 'IT/2022/98765',
        contactEmail:       'info@greentech.co.ke',
        contactPhone:       '+254 722 987 654',
        businessDescription:'Software and IoT solutions for environmental monitoring.',
        yearEstablished:    '2022',
      },
    });
  }
  console.log('✅ Company 2:', company2.businessName);

  // ── Company 3: Savanna Hospitality (Hotel, SA) ─────────────────────────────
  let company3 = await prisma.company.findFirst({ where: { userId: user.id, businessName: 'Savanna Hospitality' } });
  if (!company3) {
    company3 = await prisma.company.create({
      data: {
        userId:             user.id,
        businessName:       'Savanna Hospitality',
        industryType:       'HOSPITALITY',
        location:           'Cape Town, South Africa',
        country:            'southAfrica',
        numberOfEmployees:  120,
        registrationNumber: 'SA/2018/55321',
        contactEmail:       'reservations@savannahotel.co.za',
        contactPhone:       '+27 21 555 0100',
        businessDescription:'Eco-conscious boutique hotel chain across southern Africa.',
        yearEstablished:    '2018',
      },
    });
  }
  console.log('✅ Company 3:', company3.businessName);

  const year = new Date().getFullYear();

  // ── Seed 12 months for Company 1 ──────────────────────────────────────────
  const c1Data = [
    { month:1,  elec:2100, fuel:180, waste:320, flight:0 },
    { month:2,  elec:1950, fuel:165, waste:295, flight:500 },
    { month:3,  elec:2300, fuel:190, waste:340, flight:0 },
    { month:4,  elec:2050, fuel:155, waste:310, flight:800 },
    { month:5,  elec:1900, fuel:170, waste:280, flight:0 },
    { month:6,  elec:2200, fuel:185, waste:330, flight:1200 },
    { month:7,  elec:2400, fuel:200, waste:350, flight:0 },
    { month:8,  elec:2100, fuel:175, waste:305, flight:600 },
    { month:9,  elec:1980, fuel:160, waste:290, flight:0 },
    { month:10, elec:2250, fuel:195, waste:325, flight:900 },
    { month:11, elec:2350, fuel:205, waste:345, flight:0 },
    { month:12, elec:2500, fuel:220, waste:370, flight:1500 },
  ];

  for (const d of c1Data) {
    const calculated = calc({ elec: d.elec, fuel: d.fuel, waste: d.waste, flight: d.flight }, 'kenya');
    await prisma.emissionEntry.upsert({
      where:  { companyId_month_year: { companyId: company1.id, month: d.month, year } },
      update: {},
      create: {
        userId: user.id, companyId: company1.id,
        month: d.month, year,
        electricityKwh: d.elec, fuelType: 'DIESEL', fuelQuantity: d.fuel,
        wasteKg: d.waste, wasteType: 'LANDFILL', flightKm: d.flight,
        ...calculated,
      },
    });
  }
  console.log('✅ 12 months seeded for XYZ Traders');

  // ── Seed 12 months for Company 2 ──────────────────────────────────────────
  const c2Data = [
    { month:1,  elec:800, fuel:40,  waste:80,  flight:0 },
    { month:2,  elec:750, fuel:38,  waste:75,  flight:300 },
    { month:3,  elec:900, fuel:45,  waste:90,  flight:0 },
    { month:4,  elec:820, fuel:42,  waste:82,  flight:0 },
    { month:5,  elec:780, fuel:39,  waste:78,  flight:600 },
    { month:6,  elec:860, fuel:43,  waste:86,  flight:0 },
    { month:7,  elec:940, fuel:47,  waste:94,  flight:0 },
    { month:8,  elec:810, fuel:40,  waste:81,  flight:1800 },
    { month:9,  elec:770, fuel:38,  waste:77,  flight:0 },
    { month:10, elec:850, fuel:42,  waste:85,  flight:0 },
    { month:11, elec:920, fuel:46,  waste:92,  flight:400 },
    { month:12, elec:960, fuel:48,  waste:96,  flight:0 },
  ];

  for (const d of c2Data) {
    const calculated = calc({ elec: d.elec, fuel: d.fuel, waste: d.waste, flight: d.flight, fuelType: 'PETROL' }, 'kenya');
    await prisma.emissionEntry.upsert({
      where:  { companyId_month_year: { companyId: company2.id, month: d.month, year } },
      update: {},
      create: {
        userId: user.id, companyId: company2.id,
        month: d.month, year,
        electricityKwh: d.elec, fuelType: 'PETROL', fuelQuantity: d.fuel,
        wasteKg: d.waste, wasteType: 'RECYCLED', flightKm: d.flight,
        ...calculated,
      },
    });
  }
  console.log('✅ 12 months seeded for GreenTech Solutions');

  // ── Seed 12 months for Company 3 ──────────────────────────────────────────
  const c3Data = [
    { month:1,  elec:5200, fuel:380, waste:620, flight:2000 },
    { month:2,  elec:4900, fuel:360, waste:590, flight:1500 },
    { month:3,  elec:5500, fuel:410, waste:650, flight:0 },
    { month:4,  elec:5100, fuel:370, waste:610, flight:3000 },
    { month:5,  elec:4800, fuel:350, waste:580, flight:0 },
    { month:6,  elec:5300, fuel:390, waste:630, flight:2500 },
    { month:7,  elec:5800, fuel:430, waste:680, flight:0 },
    { month:8,  elec:5400, fuel:400, waste:640, flight:1800 },
    { month:9,  elec:5000, fuel:365, waste:600, flight:0 },
    { month:10, elec:5250, fuel:385, waste:625, flight:2200 },
    { month:11, elec:5600, fuel:415, waste:660, flight:0 },
    { month:12, elec:6000, fuel:450, waste:700, flight:4000 },
  ];

  for (const d of c3Data) {
    const calculated = calc({ elec: d.elec, fuel: d.fuel, waste: d.waste, flight: d.flight }, 'southAfrica');
    await prisma.emissionEntry.upsert({
      where:  { companyId_month_year: { companyId: company3.id, month: d.month, year } },
      update: {},
      create: {
        userId: user.id, companyId: company3.id,
        month: d.month, year,
        electricityKwh: d.elec, fuelType: 'DIESEL', fuelQuantity: d.fuel,
        wasteKg: d.waste, wasteType: 'LANDFILL', flightKm: d.flight,
        ...calculated,
      },
    });
  }
  console.log('✅ 12 months seeded for Savanna Hospitality');

  console.log('');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('   Demo credentials:');
  console.log('   Email:    demo@ecotrack.com');
  console.log('   Password: Demo@1234');
  console.log('');
  console.log('   3 companies pre-loaded:');
  console.log('   1. XYZ Traders          (Retail, Kenya)');
  console.log('   2. GreenTech Solutions  (Technology, Kenya)');
  console.log('   3. Savanna Hospitality  (Hospitality, South Africa)');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
