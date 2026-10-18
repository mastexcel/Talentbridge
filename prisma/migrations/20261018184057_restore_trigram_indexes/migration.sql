-- CreateIndex
CREATE INDEX "expert_profiles_headline_trgm" ON "expert_profiles" USING GIN ("headline" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "missions_title_trgm" ON "missions" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "tenders_title_trgm" ON "tenders" USING GIN ("title" gin_trgm_ops);
