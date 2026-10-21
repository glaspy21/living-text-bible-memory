-- AlterTable
ALTER TABLE "TimingSet" ADD COLUMN     "audioAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "TimingSet" ADD CONSTRAINT "TimingSet_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
