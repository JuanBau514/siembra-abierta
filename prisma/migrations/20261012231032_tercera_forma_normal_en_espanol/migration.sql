-- CreateEnum
CREATE TYPE "estado_verificacion" AS ENUM ('REPORTADO', 'CORROBORADO', 'VERIFICADO_EXPERTO');

-- CreateEnum
CREATE TYPE "estado_origen" AS ENUM ('NATIVA', 'INTRODUCIDA', 'INVASORA');

-- CreateEnum
CREATE TYPE "nivel_riesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "nivel_luz" AS ENUM ('SOL_PLENO', 'MEDIA_SOMBRA', 'SOMBRA');

-- DropForeignKey
ALTER TABLE "care_observations" DROP CONSTRAINT "care_observations_speciesId_fkey";

-- DropForeignKey
ALTER TABLE "common_names" DROP CONSTRAINT "common_names_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "common_names" DROP CONSTRAINT "common_names_speciesId_fkey";

-- DropForeignKey
ALTER TABLE "invasion_statuses" DROP CONSTRAINT "invasion_statuses_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "invasion_statuses" DROP CONSTRAINT "invasion_statuses_speciesId_fkey";

-- DropForeignKey
ALTER TABLE "species" DROP CONSTRAINT "species_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "species_countries" DROP CONSTRAINT "species_countries_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "species_countries" DROP CONSTRAINT "species_countries_speciesId_fkey";

-- DropTable
DROP TABLE "care_observations";

-- DropTable
DROP TABLE "common_names";

-- DropTable
DROP TABLE "invasion_statuses";

-- DropTable
DROP TABLE "sources";

-- DropTable
DROP TABLE "species";

-- DropTable
DROP TABLE "species_countries";

-- DropEnum
DROP TYPE "LightLevel";

-- DropEnum
DROP TYPE "OriginStatus";

-- DropEnum
DROP TYPE "RiskLevel";

-- DropEnum
DROP TYPE "VerificationStatus";

-- CreateTable
CREATE TABLE "idiomas" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "idiomas_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "paises" (
    "codigo_iso" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "paises_pkey" PRIMARY KEY ("codigo_iso")
);

-- CreateTable
CREATE TABLE "licencias" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "licencias_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "fuentes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT,
    "licencia_codigo" TEXT NOT NULL,
    "cita" TEXT,
    "id_externo" TEXT,
    "registrada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "familias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "familias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "familia_id" TEXT,

    CONSTRAINT "generos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especies" (
    "id" TEXT NOT NULL,
    "genero_id" TEXT NOT NULL,
    "epiteto" TEXT NOT NULL,
    "autoria" TEXT,
    "nombre_normalizado" TEXT NOT NULL,
    "clave_gbif" INTEGER,
    "amenazada" BOOLEAN NOT NULL DEFAULT false,
    "fuente_id" TEXT,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "especies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especies_paises" (
    "especie_id" TEXT NOT NULL,
    "pais_codigo" TEXT NOT NULL,
    "num_registros" INTEGER NOT NULL,
    "altitud_min_m" INTEGER,
    "altitud_max_m" INTEGER,
    "tamano_muestra_altitud" INTEGER,
    "fuente_id" TEXT NOT NULL,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "especies_paises_pkey" PRIMARY KEY ("especie_id","pais_codigo")
);

-- CreateTable
CREATE TABLE "nombres_comunes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "idioma_codigo" TEXT NOT NULL DEFAULT 'es',
    "pais_codigo" TEXT,
    "region" TEXT,
    "especie_id" TEXT NOT NULL,
    "fuente_id" TEXT NOT NULL,

    CONSTRAINT "nombres_comunes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_invasion" (
    "id" TEXT NOT NULL,
    "estado" "estado_origen" NOT NULL,
    "nivel_riesgo" "nivel_riesgo",
    "pais_codigo" TEXT NOT NULL,
    "region" TEXT,
    "altitud_min_m" INTEGER,
    "altitud_max_m" INTEGER,
    "impacto" TEXT,
    "manejo" TEXT,
    "verificacion" "estado_verificacion" NOT NULL DEFAULT 'REPORTADO',
    "especie_id" TEXT NOT NULL,
    "fuente_id" TEXT NOT NULL,

    CONSTRAINT "estados_invasion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observaciones_cuidado" (
    "id" TEXT NOT NULL,
    "pais_codigo" TEXT NOT NULL,
    "region" TEXT,
    "altitud_m" INTEGER,
    "zona" TEXT,
    "es_interior" BOOLEAN,
    "luz" "nivel_luz",
    "temperatura_media_c" DOUBLE PRECISION,
    "humedad_media" DOUBLE PRECISION,
    "riego_cada_dias" INTEGER,
    "sustrato" TEXT,
    "prospero" BOOLEAN,
    "notas" TEXT,
    "verificacion" "estado_verificacion" NOT NULL DEFAULT 'REPORTADO',
    "observada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "especie_id" TEXT NOT NULL,

    CONSTRAINT "observaciones_cuidado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fuentes_id_externo_key" ON "fuentes"("id_externo");

-- CreateIndex
CREATE UNIQUE INDEX "familias_nombre_key" ON "familias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "generos_nombre_key" ON "generos"("nombre");

-- CreateIndex
CREATE INDEX "generos_familia_id_idx" ON "generos"("familia_id");

-- CreateIndex
CREATE UNIQUE INDEX "especies_clave_gbif_key" ON "especies"("clave_gbif");

-- CreateIndex
CREATE INDEX "especies_nombre_normalizado_idx" ON "especies"("nombre_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "especies_genero_id_epiteto_key" ON "especies"("genero_id", "epiteto");

-- CreateIndex
CREATE INDEX "especies_paises_pais_codigo_idx" ON "especies_paises"("pais_codigo");

-- CreateIndex
CREATE INDEX "nombres_comunes_nombre_normalizado_idx" ON "nombres_comunes"("nombre_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "nombres_comunes_especie_id_nombre_normalizado_idioma_codigo_key" ON "nombres_comunes"("especie_id", "nombre_normalizado", "idioma_codigo", "fuente_id");

-- CreateIndex
CREATE INDEX "estados_invasion_pais_codigo_estado_idx" ON "estados_invasion"("pais_codigo", "estado");

-- CreateIndex
CREATE INDEX "observaciones_cuidado_especie_id_pais_codigo_idx" ON "observaciones_cuidado"("especie_id", "pais_codigo");

-- AddForeignKey
ALTER TABLE "fuentes" ADD CONSTRAINT "fuentes_licencia_codigo_fkey" FOREIGN KEY ("licencia_codigo") REFERENCES "licencias"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generos" ADD CONSTRAINT "generos_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "familias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especies" ADD CONSTRAINT "especies_genero_id_fkey" FOREIGN KEY ("genero_id") REFERENCES "generos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especies" ADD CONSTRAINT "especies_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especies_paises" ADD CONSTRAINT "especies_paises_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especies_paises" ADD CONSTRAINT "especies_paises_pais_codigo_fkey" FOREIGN KEY ("pais_codigo") REFERENCES "paises"("codigo_iso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especies_paises" ADD CONSTRAINT "especies_paises_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nombres_comunes" ADD CONSTRAINT "nombres_comunes_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nombres_comunes" ADD CONSTRAINT "nombres_comunes_idioma_codigo_fkey" FOREIGN KEY ("idioma_codigo") REFERENCES "idiomas"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nombres_comunes" ADD CONSTRAINT "nombres_comunes_pais_codigo_fkey" FOREIGN KEY ("pais_codigo") REFERENCES "paises"("codigo_iso") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nombres_comunes" ADD CONSTRAINT "nombres_comunes_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estados_invasion" ADD CONSTRAINT "estados_invasion_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estados_invasion" ADD CONSTRAINT "estados_invasion_pais_codigo_fkey" FOREIGN KEY ("pais_codigo") REFERENCES "paises"("codigo_iso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estados_invasion" ADD CONSTRAINT "estados_invasion_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones_cuidado" ADD CONSTRAINT "observaciones_cuidado_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones_cuidado" ADD CONSTRAINT "observaciones_cuidado_pais_codigo_fkey" FOREIGN KEY ("pais_codigo") REFERENCES "paises"("codigo_iso") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Datos de referencia (tablas pequeñas y estables)
INSERT INTO "idiomas" ("codigo", "nombre") VALUES
  ('es', 'Español'),
  ('en', 'Inglés'),
  ('pt', 'Portugués');

INSERT INTO "paises" ("codigo_iso", "nombre") VALUES
  ('CO', 'Colombia'),
  ('EC', 'Ecuador'),
  ('PA', 'Panamá'),
  ('VE', 'Venezuela');

INSERT INTO "licencias" ("codigo", "nombre", "url") VALUES
  ('CC0-1.0', 'Creative Commons Cero 1.0 (dominio público)', 'https://creativecommons.org/publicdomain/zero/1.0/'),
  ('CC-BY-4.0', 'Creative Commons Atribución 4.0', 'https://creativecommons.org/licenses/by/4.0/');
