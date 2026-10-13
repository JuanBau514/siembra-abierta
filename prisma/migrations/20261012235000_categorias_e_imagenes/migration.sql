-- Categorías de uso (frutas, hortalizas, cultivos, flores) e imágenes con licencia por foto.

-- CreateTable
CREATE TABLE "categorias" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "especies_categorias" (
    "especie_id" TEXT NOT NULL,
    "categoria_codigo" TEXT NOT NULL,
    "fuente_id" TEXT NOT NULL,

    CONSTRAINT "especies_categorias_pkey" PRIMARY KEY ("especie_id","categoria_codigo")
);

-- CreateTable
CREATE TABLE "imagenes" (
    "id" TEXT NOT NULL,
    "especie_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "url_miniatura" TEXT,
    "url_origen" TEXT,
    "autor" TEXT NOT NULL,
    "licencia_codigo" TEXT NOT NULL,
    "pais_codigo" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fuente_id" TEXT NOT NULL,
    "importada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "especies_categorias_categoria_codigo_idx" ON "especies_categorias"("categoria_codigo");

-- CreateIndex
CREATE INDEX "imagenes_especie_id_orden_idx" ON "imagenes"("especie_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "imagenes_especie_id_url_key" ON "imagenes"("especie_id", "url");

-- AddForeignKey
ALTER TABLE "especies_categorias" ADD CONSTRAINT "especies_categorias_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especies_categorias" ADD CONSTRAINT "especies_categorias_categoria_codigo_fkey" FOREIGN KEY ("categoria_codigo") REFERENCES "categorias"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especies_categorias" ADD CONSTRAINT "especies_categorias_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_especie_id_fkey" FOREIGN KEY ("especie_id") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_licencia_codigo_fkey" FOREIGN KEY ("licencia_codigo") REFERENCES "licencias"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_pais_codigo_fkey" FOREIGN KEY ("pais_codigo") REFERENCES "paises"("codigo_iso") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Datos de referencia
INSERT INTO "categorias" ("codigo", "nombre", "descripcion") VALUES
  ('FRUTA', 'Frutas', 'Plantas cultivadas por su fruto comestible: mango, lulo, uchuva, maracuyá.'),
  ('HORTALIZA', 'Hortalizas y verduras', 'Plantas de huerta cuyas hojas, raíces, tallos o frutos se comen: tomate, lechuga, zanahoria, hierbas culinarias.'),
  ('CULTIVO', 'Cultivos', 'Cultivos agrícolas de campo: café, cacao, papa, maíz, plátano, caña.'),
  ('FLOR', 'Flores', 'Flores de corte y plantas ornamentales de jardín y maceta: rosas, claveles, orquídeas.');

INSERT INTO "licencias" ("codigo", "nombre", "url") VALUES
  ('ODbL-1.0', 'Open Database License 1.0 (datos curados por Siembra Abierta)', 'https://opendatacommons.org/licenses/odbl/1-0/');
