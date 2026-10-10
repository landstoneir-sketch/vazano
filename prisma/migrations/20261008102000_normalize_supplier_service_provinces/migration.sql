-- CreateTable
CREATE TABLE "supplier_service_provinces" (
    "supplier_profile_id" TEXT NOT NULL,
    "province_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_service_provinces_pkey" PRIMARY KEY ("supplier_profile_id", "province_id")
);

-- Preserve legacy exact-name coverage when reference data already exists.
INSERT INTO "supplier_service_provinces" ("supplier_profile_id", "province_id")
SELECT sp."id", p."id"
FROM "supplier_profiles" sp
CROSS JOIN LATERAL unnest(sp."service_provinces") AS province_name
JOIN "provinces" p ON p."name_fa" = province_name
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "supplier_service_provinces_province_id_idx" ON "supplier_service_provinces"("province_id");

-- AddForeignKey
ALTER TABLE "supplier_service_provinces" ADD CONSTRAINT "supplier_service_provinces_supplier_profile_id_fkey" FOREIGN KEY ("supplier_profile_id") REFERENCES "supplier_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_service_provinces" ADD CONSTRAINT "supplier_service_provinces_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
