-- CreateTable
CREATE TABLE "provinces" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "name_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "province_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "name_en" TEXT,
    "is_province_capital" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "rfqs" ADD COLUMN "delivery_province_id" TEXT;
ALTER TABLE "rfqs" ADD COLUMN "delivery_city_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "provinces_code_key" ON "provinces"("code");
CREATE UNIQUE INDEX "provinces_name_fa_key" ON "provinces"("name_fa");
CREATE INDEX "provinces_is_active_sort_order_idx" ON "provinces"("is_active", "sort_order");
CREATE UNIQUE INDEX "cities_province_id_code_key" ON "cities"("province_id", "code");
CREATE UNIQUE INDEX "cities_province_id_name_fa_key" ON "cities"("province_id", "name_fa");
CREATE INDEX "cities_province_id_is_active_sort_order_idx" ON "cities"("province_id", "is_active", "sort_order");
CREATE INDEX "rfqs_delivery_province_id_delivery_city_id_idx" ON "rfqs"("delivery_province_id", "delivery_city_id");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_delivery_province_id_fkey" FOREIGN KEY ("delivery_province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_delivery_city_id_fkey" FOREIGN KEY ("delivery_city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
