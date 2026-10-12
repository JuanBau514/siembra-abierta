-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('REPORTED', 'CORROBORATED', 'EXPERT_VERIFIED');

-- CreateEnum
CREATE TYPE "OriginStatus" AS ENUM ('NATIVE', 'INTRODUCED', 'INVASIVE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LightLevel" AS ENUM ('FULL_SUN', 'PARTIAL_SHADE', 'SHADE');

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "license" TEXT NOT NULL,
    "citation" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "species" (
    "id" TEXT NOT NULL,
    "scientificName" TEXT NOT NULL,
    "genus" TEXT,
    "family" TEXT,
    "gbifKey" INTEGER,
    "minElevationM" INTEGER,
    "maxElevationM" INTEGER,
    "isThreatened" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_names" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es',
    "countryIso" TEXT,
    "region" TEXT,
    "speciesId" TEXT NOT NULL,
    "sourceId" TEXT,

    CONSTRAINT "common_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invasion_statuses" (
    "id" TEXT NOT NULL,
    "status" "OriginStatus" NOT NULL,
    "riskLevel" "RiskLevel",
    "countryIso" TEXT NOT NULL,
    "region" TEXT,
    "minElevationM" INTEGER,
    "maxElevationM" INTEGER,
    "impact" TEXT,
    "management" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'REPORTED',
    "speciesId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "invasion_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_observations" (
    "id" TEXT NOT NULL,
    "countryIso" TEXT NOT NULL,
    "region" TEXT,
    "elevationM" INTEGER,
    "zoneCode" TEXT,
    "isIndoor" BOOLEAN,
    "light" "LightLevel",
    "avgTempC" DOUBLE PRECISION,
    "avgHumidity" DOUBLE PRECISION,
    "wateringEveryDays" INTEGER,
    "substrate" TEXT,
    "thrived" BOOLEAN,
    "notes" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'REPORTED',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "speciesId" TEXT NOT NULL,

    CONSTRAINT "care_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "species_scientificName_key" ON "species"("scientificName");

-- CreateIndex
CREATE UNIQUE INDEX "species_gbifKey_key" ON "species"("gbifKey");

-- CreateIndex
CREATE INDEX "species_genus_idx" ON "species"("genus");

-- CreateIndex
CREATE INDEX "species_family_idx" ON "species"("family");

-- CreateIndex
CREATE INDEX "common_names_name_idx" ON "common_names"("name");

-- CreateIndex
CREATE UNIQUE INDEX "common_names_speciesId_name_language_countryIso_region_key" ON "common_names"("speciesId", "name", "language", "countryIso", "region");

-- CreateIndex
CREATE INDEX "invasion_statuses_countryIso_status_idx" ON "invasion_statuses"("countryIso", "status");

-- CreateIndex
CREATE INDEX "care_observations_speciesId_countryIso_idx" ON "care_observations"("speciesId", "countryIso");

-- AddForeignKey
ALTER TABLE "species" ADD CONSTRAINT "species_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_names" ADD CONSTRAINT "common_names_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_names" ADD CONSTRAINT "common_names_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invasion_statuses" ADD CONSTRAINT "invasion_statuses_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invasion_statuses" ADD CONSTRAINT "invasion_statuses_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_observations" ADD CONSTRAINT "care_observations_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;
