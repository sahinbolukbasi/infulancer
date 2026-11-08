

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "audienceAgeMax" INTEGER,
ADD COLUMN     "audienceAgeMin" INTEGER,
ADD COLUMN     "audienceGender" TEXT,
ADD COLUMN     "audienceInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contentPlan" JSONB,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "platforms" "Platform"[] DEFAULT ARRAY[]::"Platform"[],
ADD COLUMN     "shortlistInfluencerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "targetCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];
