-- CreateEnum
CREATE TYPE "Testament" AS ENUM ('OLD', 'NEW');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "TimingState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LISTENER');

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licenseNote" TEXT,
    "providerKey" TEXT NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL,
    "osis" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "testament" "Testament" NOT NULL,
    "chapterCount" INTEGER NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "translationId" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verseStart" INTEGER NOT NULL,
    "endChapter" INTEGER NOT NULL,
    "verseEnd" INTEGER NOT NULL,
    "genreId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Default',
    "arrangementNo" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RecordingStatus" NOT NULL DEFAULT 'DRAFT',
    "originalAssetId" TEXT NOT NULL,
    "publishedTimingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "peaksKey" TEXT,
    "derivativeKey" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimingSet" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" "TimingState" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "basedOnId" TEXT,

    CONSTRAINT "TimingSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseTiming" (
    "id" TEXT NOT NULL,
    "timingSetId" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verse" INTEGER NOT NULL,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "ackGap" BOOLEAN NOT NULL DEFAULT false,
    "ackOverlap" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "VerseTiming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditSession" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "timingSetId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "EditSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'LISTENER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Translation_code_key" ON "Translation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Book_osis_key" ON "Book"("osis");

-- CreateIndex
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_originalAssetId_key" ON "Recording"("originalAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_publishedTimingId_key" ON "Recording"("publishedTimingId");

-- CreateIndex
CREATE INDEX "Recording_translationId_bookId_chapter_verseStart_idx" ON "Recording"("translationId", "bookId", "chapter", "verseStart");

-- CreateIndex
CREATE INDEX "Recording_genreId_idx" ON "Recording"("genreId");

-- CreateIndex
CREATE INDEX "Recording_status_idx" ON "Recording"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AudioAsset_storageKey_key" ON "AudioAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "TimingSet_recordingId_version_key" ON "TimingSet"("recordingId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "VerseTiming_timingSetId_chapter_verse_key" ON "VerseTiming"("timingSetId", "chapter", "verse");

-- CreateIndex
CREATE INDEX "EditSession_recordingId_savedAt_idx" ON "EditSession"("recordingId", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "Translation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_originalAssetId_fkey" FOREIGN KEY ("originalAssetId") REFERENCES "AudioAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_publishedTimingId_fkey" FOREIGN KEY ("publishedTimingId") REFERENCES "TimingSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimingSet" ADD CONSTRAINT "TimingSet_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimingSet" ADD CONSTRAINT "TimingSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimingSet" ADD CONSTRAINT "TimingSet_basedOnId_fkey" FOREIGN KEY ("basedOnId") REFERENCES "TimingSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseTiming" ADD CONSTRAINT "VerseTiming_timingSetId_fkey" FOREIGN KEY ("timingSetId") REFERENCES "TimingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditSession" ADD CONSTRAINT "EditSession_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditSession" ADD CONSTRAINT "EditSession_timingSetId_fkey" FOREIGN KEY ("timingSetId") REFERENCES "TimingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
