-- DropForeignKey
ALTER TABLE "common_names" DROP CONSTRAINT "common_names_sourceId_fkey";

-- DropIndex
DROP INDEX "common_names_name_idx";

-- DropIndex
DROP INDEX "common_names_speciesId_name_language_countryIso_region_key";

-- DropIndex
DROP INDEX "species_scientificName_key";

-- AlterTable
ALTER TABLE "common_names" ADD COLUMN     "nameNormalized" TEXT NOT NULL,
ALTER COLUMN "sourceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "sources" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "licenseUrl" TEXT;

-- AlterTable
ALTER TABLE "species" DROP COLUMN "maxElevationM",
DROP COLUMN "minElevationM",
ADD COLUMN     "canonicalName" TEXT NOT NULL,
ADD COLUMN     "nameNormalized" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "species_countries" (
    "speciesId" TEXT NOT NULL,
    "countryIso" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL,
    "minElevationM" INTEGER,
    "maxElevationM" INTEGER,
    "elevationSampleSize" INTEGER,
    "sourceId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "species_countries_pkey" PRIMARY KEY ("speciesId","countryIso")
);

-- CreateIndex
CREATE INDEX "species_countries_countryIso_idx" ON "species_countries"("countryIso");

-- CreateIndex
CREATE INDEX "common_names_nameNormalized_idx" ON "common_names"("nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "common_names_speciesId_nameNormalized_language_sourceId_key" ON "common_names"("speciesId", "nameNormalized", "language", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "sources_externalId_key" ON "sources"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "species_canonicalName_key" ON "species"("canonicalName");

-- CreateIndex
CREATE INDEX "species_nameNormalized_idx" ON "species"("nameNormalized");

-- AddForeignKey
ALTER TABLE "species_countries" ADD CONSTRAINT "species_countries_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "species_countries" ADD CONSTRAINT "species_countries_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_names" ADD CONSTRAINT "common_names_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

