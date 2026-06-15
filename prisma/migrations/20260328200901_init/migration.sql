-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('RETAIL', 'MANUFACTURING', 'TECHNOLOGY', 'HEALTHCARE', 'EDUCATION', 'HOSPITALITY', 'TRANSPORTATION', 'CONSTRUCTION', 'AGRICULTURE', 'ENERGY', 'FINANCIAL_SERVICES', 'CONSULTING', 'REAL_ESTATE', 'MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'KEROSENE', 'LNG', 'CNG', 'LPG', 'WOOD', 'COAL');

-- CreateEnum
CREATE TYPE "WasteType" AS ENUM ('LANDFILL', 'RECYCLED', 'COMPOSTED', 'INCINERATED', 'HAZARDOUS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "industryType" "IndustryType" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "country" TEXT NOT NULL DEFAULT 'kenya',
    "numberOfEmployees" INTEGER NOT NULL DEFAULT 1,
    "registrationNumber" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "businessDescription" TEXT,
    "yearEstablished" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fuelType" "FuelType",
    "fuelQuantity" DOUBLE PRECISION,
    "electricityKwh" DOUBLE PRECISION,
    "wasteKg" DOUBLE PRECISION,
    "wasteType" "WasteType" NOT NULL DEFAULT 'LANDFILL',
    "flightKm" DOUBLE PRECISION,
    "scope1Emissions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scope2Emissions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scope3Emissions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmissions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "emission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "companies_userId_idx" ON "companies"("userId");

-- CreateIndex
CREATE INDEX "emission_entries_userId_idx" ON "emission_entries"("userId");

-- CreateIndex
CREATE INDEX "emission_entries_companyId_idx" ON "emission_entries"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "emission_entries_companyId_month_year_key" ON "emission_entries"("companyId", "month", "year");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_entries" ADD CONSTRAINT "emission_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_entries" ADD CONSTRAINT "emission_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
