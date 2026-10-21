-- DropForeignKey
ALTER TABLE "TimingSet" DROP CONSTRAINT "TimingSet_audioAssetId_fkey";

-- AddForeignKey
ALTER TABLE "TimingSet" ADD CONSTRAINT "TimingSet_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
