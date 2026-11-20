-- ============================================================
-- CALL — full MySQL dump (schema + data) for phpMyAdmin import
-- Generated 2026-11-20T13:54:13.120Z
-- All DateTime values are UTC.
-- ============================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `passwordHash` TEXT NULL,
    `googleId` VARCHAR(191) NULL,
    `role` TEXT NOT NULL DEFAULT 'user',
    `isOfficial` BOOLEAN NOT NULL DEFAULT false,
    `blocked` BOOLEAN NOT NULL DEFAULT false,
    `name` TEXT NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `usernameChangedAt` DATETIME(3) NULL,
    `about` TEXT NOT NULL DEFAULT 'Available on CALL',
    `avatarKey` INTEGER NOT NULL DEFAULT 0,
    `avatarUrl` TEXT NULL,
    `allowNonContacts` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_phone_key`(`phone`),
    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_googleId_key`(`googleId`),
    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Otp` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `code` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Otp_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailOtp` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `code` TEXT NOT NULL,
    `purpose` TEXT NOT NULL DEFAULT 'verify',
    `expiresAt` DATETIME(3) NOT NULL,
    `consumed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailOtp_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Contact_ownerId_phone_key`(`ownerId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `userAId` VARCHAR(191) NOT NULL,
    `userBId` VARCHAR(191) NOT NULL,
    `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Conversation_userAId_userBId_key`(`userAId`, `userBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `senderId` TEXT NOT NULL,
    `type` TEXT NOT NULL,
    `content` TEXT NOT NULL,
    `duration` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `forwarded` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Message_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageHide` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MessageHide_userId_idx`(`userId`),
    UNIQUE INDEX `MessageHide_userId_messageId_key`(`userId`, `messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationState` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `muted` BOOLEAN NOT NULL DEFAULT false,
    `restricted` BOOLEAN NOT NULL DEFAULT false,
    `clearedBeforeAt` DATETIME(3) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConversationState_conversationId_userId_key`(`conversationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBlock` (
    `id` VARCHAR(191) NOT NULL,
    `blockerId` VARCHAR(191) NOT NULL,
    `blockedId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserBlock_blockedId_idx`(`blockedId`),
    UNIQUE INDEX `UserBlock_blockerId_blockedId_key`(`blockerId`, `blockedId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserReport` (
    `id` VARCHAR(191) NOT NULL,
    `reporterId` TEXT NOT NULL,
    `reportedId` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `details` TEXT NULL,
    `messageId` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `adminNote` TEXT NULL,
    `resolvedBy` TEXT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserReport_status_idx`(`status`),
    INDEX `UserReport_reportedId_idx`(`reportedId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Call` (
    `id` VARCHAR(191) NOT NULL,
    `callerId` VARCHAR(191) NOT NULL,
    `calleeId` VARCHAR(191) NOT NULL,
    `type` TEXT NOT NULL,
    `status` TEXT NOT NULL,
    `durationSec` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    INDEX `Call_callerId_startedAt_idx`(`callerId`, `startedAt`),
    INDEX `Call_calleeId_startedAt_idx`(`calleeId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Wallet` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `available` DOUBLE NOT NULL DEFAULT 0,
    `reserved` DOUBLE NOT NULL DEFAULT 0,
    `totalReceived` DOUBLE NOT NULL DEFAULT 0,
    `totalEarned` DOUBLE NOT NULL DEFAULT 0,
    `totalWithdrawn` DOUBLE NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Wallet_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` TEXT NOT NULL,
    `direction` TEXT NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` TEXT NOT NULL DEFAULT 'USD',
    `availableAfter` DOUBLE NOT NULL,
    `reservedAfter` DOUBLE NOT NULL,
    `refType` TEXT NULL,
    `refId` TEXT NULL,
    `note` TEXT NOT NULL DEFAULT '',
    `idempotencyKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LedgerEntry_idempotencyKey_key`(`idempotencyKey`),
    INDEX `LedgerEntry_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` TEXT NOT NULL,
    `providerRef` TEXT NULL,
    `purpose` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `amount` DOUBLE NOT NULL,
    `currency` TEXT NOT NULL DEFAULT 'USD',
    `feeAmount` DOUBLE NOT NULL DEFAULT 0,
    `meta` TEXT NOT NULL DEFAULT '{}',
    `isTest` BOOLEAN NOT NULL DEFAULT false,
    `clientKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Payment_clientKey_key`(`clientKey`),
    INDEX `Payment_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Payment_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Gift` (
    `id` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `emoji` TEXT NOT NULL,
    `imageUrl` TEXT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `animKind` TEXT NOT NULL,
    `sound` TEXT NOT NULL DEFAULT 'gift',
    `category` TEXT NOT NULL DEFAULT 'both',
    `priceUsd` DOUBLE NOT NULL,
    `currency` TEXT NOT NULL DEFAULT 'USD',
    `platformMap` TEXT NULL,
    `durationMs` INTEGER NOT NULL DEFAULT 2200,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiftSend` (
    `id` VARCHAR(191) NOT NULL,
    `giftId` TEXT NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `context` TEXT NOT NULL,
    `roomId` VARCHAR(191) NULL,
    `liveId` VARCHAR(191) NULL,
    `battleId` TEXT NULL,
    `battleSide` INTEGER NULL,
    `grossAmount` DOUBLE NOT NULL,
    `commission` DOUBLE NOT NULL DEFAULT 0,
    `feeAmount` DOUBLE NOT NULL DEFAULT 0,
    `netAmount` DOUBLE NOT NULL DEFAULT 0,
    `currency` TEXT NOT NULL DEFAULT 'USD',
    `paymentId` TEXT NULL,
    `isTest` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GiftSend_recipientId_createdAt_idx`(`recipientId`, `createdAt`),
    INDEX `GiftSend_senderId_createdAt_idx`(`senderId`, `createdAt`),
    INDEX `GiftSend_roomId_createdAt_idx`(`roomId`, `createdAt`),
    INDEX `GiftSend_liveId_createdAt_idx`(`liveId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BankAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `holderName` TEXT NOT NULL,
    `bankName` TEXT NOT NULL,
    `accountNumber` TEXT NOT NULL,
    `iban` TEXT NULL,
    `swift` TEXT NULL,
    `countryCode` TEXT NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BankAccount_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Withdrawal` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` TEXT NOT NULL DEFAULT 'USD',
    `method` TEXT NOT NULL DEFAULT 'bank',
    `bankAccountId` TEXT NULL,
    `bankDetails` TEXT NOT NULL DEFAULT '{}',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `adminNote` TEXT NOT NULL DEFAULT '',
    `transferRef` TEXT NULL,
    `reviewedBy` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Withdrawal_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Withdrawal_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Story` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `clipIndex` INTEGER NOT NULL DEFAULT 0,
    `kind` TEXT NOT NULL,
    `mediaId` TEXT NULL,
    `text` TEXT NULL,
    `overlayJson` TEXT NULL,
    `bgColor` TEXT NOT NULL DEFAULT '#2F5BE0',
    `durationMs` INTEGER NOT NULL DEFAULT 5000,
    `privacy` TEXT NOT NULL DEFAULT 'contacts',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `Story_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `Story_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryView` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `viewerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StoryView_storyId_idx`(`storyId`),
    UNIQUE INDEX `StoryView_storyId_viewerId_key`(`storyId`, `viewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryReaction` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `emoji` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StoryReaction_storyId_userId_key`(`storyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceRoom` (
    `id` VARCHAR(191) NOT NULL,
    `hostId` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `coverUrl` TEXT NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `entryFee` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'live',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    INDEX `VoiceRoom_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` TEXT NOT NULL DEFAULT 'listener',
    `muted` BOOLEAN NOT NULL DEFAULT false,
    `handRaised` BOOLEAN NOT NULL DEFAULT false,
    `stageInvite` BOOLEAN NOT NULL DEFAULT false,
    `invitedAt` DATETIME(3) NULL,
    `blocked` BOOLEAN NOT NULL DEFAULT false,
    `entryPaid` BOOLEAN NOT NULL DEFAULT false,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    INDEX `RoomParticipant_roomId_idx`(`roomId`),
    UNIQUE INDEX `RoomParticipant_roomId_userId_key`(`roomId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomMessage` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `userId` TEXT NOT NULL,
    `name` TEXT NOT NULL,
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoomMessage_roomId_createdAt_idx`(`roomId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveSession` (
    `id` VARCHAR(191) NOT NULL,
    `hostId` TEXT NOT NULL,
    `title` TEXT NOT NULL DEFAULT 'Live',
    `status` VARCHAR(191) NOT NULL DEFAULT 'live',
    `mode` TEXT NOT NULL DEFAULT 'solo',
    `battleId` TEXT NULL,
    `viewerCount` INTEGER NOT NULL DEFAULT 0,
    `peakViewers` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    INDEX `LiveSession_status_startedAt_idx`(`status`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveComment` (
    `id` VARCHAR(191) NOT NULL,
    `liveId` VARCHAR(191) NOT NULL,
    `userId` TEXT NOT NULL,
    `name` TEXT NOT NULL,
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LiveComment_liveId_createdAt_idx`(`liveId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Battle` (
    `id` VARCHAR(191) NOT NULL,
    `mode` TEXT NOT NULL,
    `liveId` VARCHAR(191) NOT NULL,
    `status` TEXT NOT NULL DEFAULT 'inviting',
    `durationSec` INTEGER NOT NULL DEFAULT 120,
    `startedAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `winnerSide` INTEGER NULL,
    `sideAPoints` DOUBLE NOT NULL DEFAULT 0,
    `sideBPoints` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Battle_liveId_idx`(`liveId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BattleParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `battleId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `side` INTEGER NOT NULL,
    `slot` INTEGER NOT NULL,
    `name` TEXT NOT NULL,
    `avatarKey` INTEGER NOT NULL DEFAULT 0,
    `avatarUrl` TEXT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT false,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `connected` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `BattleParticipant_battleId_userId_key`(`battleId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Group` (
    `id` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `avatarKey` INTEGER NOT NULL DEFAULT 0,
    `avatarUrl` TEXT NULL,
    `ownerId` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Group_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` TEXT NOT NULL DEFAULT 'member',
    `lastReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `clearedBeforeAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `GroupMember_userId_idx`(`userId`),
    UNIQUE INDEX `GroupMember_groupId_userId_key`(`groupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMessage` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `senderId` TEXT NOT NULL,
    `type` TEXT NOT NULL DEFAULT 'text',
    `content` TEXT NOT NULL,
    `mediaId` TEXT NULL,
    `duration` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GroupMessage_groupId_createdAt_idx`(`groupId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `body` TEXT NOT NULL DEFAULT '',
    `refType` TEXT NULL,
    `refId` TEXT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_read_createdAt_idx`(`userId`, `read`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiConversation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` TEXT NOT NULL DEFAULT 'New conversation',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiConversation_userId_updatedAt_idx`(`userId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiMessage` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` TEXT NOT NULL,
    `kind` TEXT NOT NULL DEFAULT 'text',
    `text` TEXT NOT NULL DEFAULT '',
    `mediaId` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiUsage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `textCount` INTEGER NOT NULL DEFAULT 0,
    `imageCount` INTEGER NOT NULL DEFAULT 0,
    `voiceCount` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiUsage_userId_day_key`(`userId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdPackage` (
    `id` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `priceUsd` DOUBLE NOT NULL,
    `durationDays` INTEGER NOT NULL DEFAULT 7,
    `placements` TEXT NOT NULL DEFAULT 'chats,rooms,profile',
    `minBudget` DOUBLE NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ad` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NULL,
    `title` TEXT NOT NULL,
    `body` TEXT NOT NULL DEFAULT '',
    `imageUrl` TEXT NULL,
    `mediaKind` TEXT NOT NULL DEFAULT 'image',
    `linkUrl` TEXT NULL,
    `placements` TEXT NOT NULL DEFAULT 'chats',
    `packageId` TEXT NULL,
    `budget` DOUBLE NOT NULL DEFAULT 0,
    `totalCost` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `paymentId` TEXT NULL,
    `isUserAd` BOOLEAN NOT NULL DEFAULT false,
    `rejectionReason` TEXT NULL,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `lastServedAt` DATETIME(3) NULL,
    `serves` INTEGER NOT NULL DEFAULT 0,
    `reviewedBy` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Ad_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Ad_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdEvent` (
    `id` VARCHAR(191) NOT NULL,
    `adId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `viewerKey` VARCHAR(191) NOT NULL,
    `dayKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdEvent_adId_kind_createdAt_idx`(`adId`, `kind`, `createdAt`),
    UNIQUE INDEX `AdEvent_adId_kind_viewerKey_dayKey_key`(`adId`, `kind`, `viewerKey`, `dayKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Broadcast` (
    `id` VARCHAR(191) NOT NULL,
    `title` TEXT NOT NULL,
    `body` TEXT NOT NULL DEFAULT '',
    `senderId` TEXT NOT NULL,
    `createdBy` TEXT NOT NULL,
    `totalTargets` INTEGER NOT NULL DEFAULT 0,
    `deliveredCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `status` TEXT NOT NULL DEFAULT 'completed',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BroadcastDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `broadcastId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` TEXT NOT NULL DEFAULT 'sent',
    `error` TEXT NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BroadcastDelivery_broadcastId_userId_key`(`broadcastId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_userAId_fkey` FOREIGN KEY (`userAId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_userBId_fkey` FOREIGN KEY (`userBId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageHide` ADD CONSTRAINT `MessageHide_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageHide` ADD CONSTRAINT `MessageHide_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationState` ADD CONSTRAINT `ConversationState_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationState` ADD CONSTRAINT `ConversationState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBlock` ADD CONSTRAINT `UserBlock_blockerId_fkey` FOREIGN KEY (`blockerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBlock` ADD CONSTRAINT `UserBlock_blockedId_fkey` FOREIGN KEY (`blockedId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserReport` ADD CONSTRAINT `UserReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserReport` ADD CONSTRAINT `UserReport_reportedId_fkey` FOREIGN KEY (`reportedId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_callerId_fkey` FOREIGN KEY (`callerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_calleeId_fkey` FOREIGN KEY (`calleeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Wallet` ADD CONSTRAINT `Wallet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftSend` ADD CONSTRAINT `GiftSend_giftId_fkey` FOREIGN KEY (`giftId`) REFERENCES `Gift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftSend` ADD CONSTRAINT `GiftSend_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftSend` ADD CONSTRAINT `GiftSend_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankAccount` ADD CONSTRAINT `BankAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Withdrawal` ADD CONSTRAINT `Withdrawal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Story` ADD CONSTRAINT `Story_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryView` ADD CONSTRAINT `StoryView_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryView` ADD CONSTRAINT `StoryView_viewerId_fkey` FOREIGN KEY (`viewerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryReaction` ADD CONSTRAINT `StoryReaction_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceRoom` ADD CONSTRAINT `VoiceRoom_hostId_fkey` FOREIGN KEY (`hostId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomParticipant` ADD CONSTRAINT `RoomParticipant_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `VoiceRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomMessage` ADD CONSTRAINT `RoomMessage_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `VoiceRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveSession` ADD CONSTRAINT `LiveSession_hostId_fkey` FOREIGN KEY (`hostId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveComment` ADD CONSTRAINT `LiveComment_liveId_fkey` FOREIGN KEY (`liveId`) REFERENCES `LiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BattleParticipant` ADD CONSTRAINT `BattleParticipant_battleId_fkey` FOREIGN KEY (`battleId`) REFERENCES `Battle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMessage` ADD CONSTRAINT `GroupMessage_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMessage` ADD CONSTRAINT `GroupMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiMessage` ADD CONSTRAINT `AiMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `AiConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ad` ADD CONSTRAINT `Ad_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ad` ADD CONSTRAINT `Ad_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `AdPackage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdEvent` ADD CONSTRAINT `AdEvent_adId_fkey` FOREIGN KEY (`adId`) REFERENCES `Ad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Broadcast` ADD CONSTRAINT `Broadcast_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BroadcastDelivery` ADD CONSTRAINT `BroadcastDelivery_broadcastId_fkey` FOREIGN KEY (`broadcastId`) REFERENCES `Broadcast`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- DATA
-- ============================================================

START TRANSACTION;

INSERT INTO `User` (`id`, `phone`, `email`, `emailVerified`, `passwordHash`, `googleId`, `role`, `isOfficial`, `blocked`, `name`, `username`, `usernameChangedAt`, `about`, `avatarKey`, `avatarUrl`, `allowNonContacts`, `createdAt`, `lastSeen`) VALUES
  ('cmwosksb60001o2w9wqasni6u', '9203332560178', NULL, 0, NULL, NULL, 'user', 0, 0, 'fahad', 'fahad', NULL, 'Available on CALL', 6, NULL, 0, '2026-11-20 09:43:52.146', '2026-11-20 12:30:30.557'),
  ('cmwosksbf0004o2w9f4l6kggu', '0000000000', 'official@call.app', 0, NULL, NULL, 'user', 1, 0, 'CALL', 'official', NULL, 'The official CALL account. Messages from the CALL team are sent from here.', 0, NULL, 0, '2026-11-20 09:43:52.155', '2026-11-20 09:43:52.155'),
  ('cmwosl0pp000ao2w9m4prhh04', '0000000002', 'fahadqazi1111@gmail.com', 1, 'scrypt:c3aee78df9a5efd1f2449b075df9dffe:4f33c1b42b80f698660c9eb53d14f31d194fe37e8f322f8edf2f6bdf0b524302', NULL, 'admin', 0, 0, 'Fahad Mazhar', 'fahadqazi', NULL, 'Available on CALL', 0, NULL, 0, '2026-11-20 09:44:03.037', '2026-11-20 13:30:53.928'),
  ('cmwoswwzc000go2jlzw2vss18', '0000000001', 'admin@call.app', 1, 'scrypt:c736be7cf59ad708571021d2ffd1132f:b968a615a6042824ae7e7e66a45d848d8f960efc1b5073352fe02812ed372468', NULL, 'admin', 0, 0, 'CALL Admin', 'calladmin', NULL, 'Available on CALL', 0, NULL, 0, '2026-11-20 09:53:18.073', '2026-11-20 09:53:18.073'),
  ('cmwotbotq000wo2w9kfb0hh93', '923332560178', NULL, 0, NULL, NULL, 'user', 0, 0, 'Ali Raza', 'aliraza', NULL, 'Available on CALL', 3, NULL, 0, '2026-11-20 10:04:47.343', '2026-11-20 10:14:13.156'),
  ('cmwovuv5y0051o2w9ceau4d35', '920000000005', NULL, 0, NULL, NULL, 'user', 0, 0, 'Viewer Vicky', 'viewervicky', NULL, 'Available on CALL', 7, NULL, 0, '2026-11-20 11:15:41.255', '2026-11-20 11:15:41.255'),
  ('cmwoy3i0o0000o2dmli3fblmv', '0113871773', 'testviewer@call.app', 0, 'scrypt:8da4e82f58391495966b89b8b7be2b87:9424012406cc34122b682042838604df172d486cafe8d477a5976dbf596af36b', NULL, 'user', 0, 0, 'Test Viewer', 'testviewer103089', NULL, 'Available on CALL', 4, NULL, 0, '2026-11-20 12:18:23.353', '2026-11-20 12:26:01.145');
INSERT INTO `Otp` (`id`, `phone`, `code`, `expiresAt`, `consumed`, `createdAt`) VALUES
  ('cmwoskmsf0000o2w9vcx6y01r', '9203332560178', '565055', '2026-11-20 09:48:44.991', 1, '2026-11-20 09:43:44.992'),
  ('cmwotbag2000vo2w9n2fw3h1k', '923332560178', '633943', '2026-11-20 10:09:28.705', 1, '2026-11-20 10:04:28.706'),
  ('cmwotno1j0018o2w9kthrimgn', '923332560178', '830559', '2026-11-20 10:19:06.198', 1, '2026-11-20 10:14:06.199'),
  ('cmwovdayi002bo2w9yhqca0h1', '9203332560178', '423399', '2026-11-20 11:07:01.913', 1, '2026-11-20 11:02:01.914'),
  ('cmwovuqlx0050o2w9mzffrk2y', '920000000005', '372110', '2026-11-20 11:20:35.348', 1, '2026-11-20 11:15:35.349'),
  ('cmwoyiz4i000eo262c804pfhr', '9203332560178', '734499', '2026-11-20 12:35:25.361', 1, '2026-11-20 12:30:25.362');
INSERT INTO `Contact` (`id`, `ownerId`, `name`, `phone`, `createdAt`) VALUES
  ('cmwosld4r000eo2w9vg11cbyz', 'cmwosl0pp000ao2w9m4prhh04', 'fahad', '03332560178', '2026-11-20 09:44:19.132');
INSERT INTO `Conversation` (`id`, `userAId`, `userBId`, `lastMessageAt`) VALUES
  ('cmwosksbg0006o2w9wdfuw87c', 'cmwosksb60001o2w9wqasni6u', 'cmwosksbf0004o2w9f4l6kggu', '2026-11-20 09:43:52.157'),
  ('cmwoslfew000go2w93lc8j8u1', 'cmwosksb60001o2w9wqasni6u', 'cmwosl0pp000ao2w9m4prhh04', '2026-11-20 11:02:09.406'),
  ('cmwotboud0010o2w966yy28kr', 'cmwosksbf0004o2w9f4l6kggu', 'cmwotbotq000wo2w9kfb0hh93', '2026-11-20 10:04:47.368'),
  ('cmwovuv680055o2w90axc2az7', 'cmwosksbf0004o2w9f4l6kggu', 'cmwovuv5y0051o2w9ceau4d35', '2026-11-20 11:15:41.266'),
  ('cmwoy3i0w0004o2dmsz8dgcni', 'cmwosksbf0004o2w9f4l6kggu', 'cmwoy3i0o0000o2dmli3fblmv', '2026-11-20 12:18:23.364');
INSERT INTO `Message` (`id`, `conversationId`, `senderId`, `type`, `content`, `duration`, `createdAt`, `deliveredAt`, `readAt`, `deletedAt`, `forwarded`) VALUES
  ('cmwosksbh0008o2w97xnlao0v', 'cmwosksbg0006o2w9wdfuw87c', 'cmwosksbf0004o2w9f4l6kggu', 'text', 'Welcome to CALL, fahad! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.', NULL, '2026-11-20 09:43:52.157', NULL, '2026-11-20 11:11:54.023', NULL, 0),
  ('cmwoslhgt000ko2w9iv9ld1hb', 'cmwoslfew000go2w93lc8j8u1', 'cmwosl0pp000ao2w9m4prhh04', 'text', 'hi', NULL, '2026-11-20 09:44:24.749', '2026-11-20 09:44:25.185', '2026-11-20 11:02:05.858', NULL, 0),
  ('cmwoslq3j000qo2w9hncwokkx', 'cmwoslfew000go2w93lc8j8u1', 'cmwosl0pp000ao2w9m4prhh04', 'call', '{"callType":"voice","status":"declined","durationSec":0}', NULL, '2026-11-20 09:44:35.935', '2026-11-20 09:44:36.257', '2026-11-20 11:02:05.858', NULL, 0),
  ('cmwotboug0012o2w9kxcc3178', 'cmwotboud0010o2w966yy28kr', 'cmwosksbf0004o2w9f4l6kggu', 'text', 'Welcome to CALL, Ali! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.', NULL, '2026-11-20 10:04:47.368', NULL, NULL, NULL, 0),
  ('cmwovdgp8002lo2w9dzsyirrw', 'cmwoslfew000go2w93lc8j8u1', 'cmwosksb60001o2w9wqasni6u', 'call', '{"callType":"voice","status":"declined","durationSec":0}', NULL, '2026-11-20 11:02:09.356', '2026-11-20 11:02:09.744', '2026-11-20 12:23:04.116', NULL, 0),
  ('cmwovdgpu002ro2w97dnvpotm', 'cmwoslfew000go2w93lc8j8u1', 'cmwosksb60001o2w9wqasni6u', 'call', '{"callType":"voice","status":"declined","durationSec":0}', NULL, '2026-11-20 11:02:09.379', '2026-11-20 11:02:09.797', '2026-11-20 12:23:04.116', NULL, 0),
  ('cmwovdgq3002xo2w9vz1agcrm', 'cmwoslfew000go2w93lc8j8u1', 'cmwosksb60001o2w9wqasni6u', 'call', '{"callType":"voice","status":"declined","durationSec":0}', NULL, '2026-11-20 11:02:09.388', '2026-11-20 11:02:09.807', '2026-11-20 12:23:04.116', NULL, 0),
  ('cmwovdgqm0033o2w92khbzg1s', 'cmwoslfew000go2w93lc8j8u1', 'cmwosksb60001o2w9wqasni6u', 'call', '{"callType":"voice","status":"declined","durationSec":0}', NULL, '2026-11-20 11:02:09.406', '2026-11-20 11:02:10.888', '2026-11-20 12:23:04.116', NULL, 0),
  ('cmwovuv6a0057o2w9cnz5kmqk', 'cmwovuv680055o2w90axc2az7', 'cmwosksbf0004o2w9f4l6kggu', 'text', 'Welcome to CALL, Viewer! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.', NULL, '2026-11-20 11:15:41.266', NULL, NULL, NULL, 0),
  ('cmwoy3i100006o2dm548f5d4v', 'cmwoy3i0w0004o2dmsz8dgcni', 'cmwosksbf0004o2w9f4l6kggu', 'text', 'Welcome to CALL, Test! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.', NULL, '2026-11-20 12:18:23.364', NULL, NULL, NULL, 0);
INSERT INTO `Call` (`id`, `callerId`, `calleeId`, `type`, `status`, `durationSec`, `startedAt`, `endedAt`) VALUES
  ('cmwoslq3f000mo2w91jym0ihy', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'voice', 'declined', 0, '2026-11-20 09:44:35.932', '2026-11-20 09:44:35.931'),
  ('cmwovdgp5002ho2w90w5tmi6q', 'cmwosksb60001o2w9wqasni6u', 'cmwosl0pp000ao2w9m4prhh04', 'voice', 'declined', 0, '2026-11-20 11:02:09.354', '2026-11-20 11:02:09.353'),
  ('cmwovdgpr002no2w930xxnipp', 'cmwosksb60001o2w9wqasni6u', 'cmwosl0pp000ao2w9m4prhh04', 'voice', 'declined', 0, '2026-11-20 11:02:09.376', '2026-11-20 11:02:09.375'),
  ('cmwovdgq1002to2w9fut2zdgx', 'cmwosksb60001o2w9wqasni6u', 'cmwosl0pp000ao2w9m4prhh04', 'voice', 'declined', 0, '2026-11-20 11:02:09.386', '2026-11-20 11:02:09.385'),
  ('cmwovdgqk002zo2w97wq9pe0v', 'cmwosksb60001o2w9wqasni6u', 'cmwosl0pp000ao2w9m4prhh04', 'voice', 'declined', 0, '2026-11-20 11:02:09.404', '2026-11-20 11:02:09.403');
INSERT INTO `Wallet` (`id`, `userId`, `available`, `reserved`, `totalReceived`, `totalEarned`, `totalWithdrawn`, `updatedAt`) VALUES
  ('cmwosksb90003o2w9sxnfc702', 'cmwosksb60001o2w9wqasni6u', 260.4, 0, 393, 260.4, 0, '2026-11-20 12:32:37.304'),
  ('cmwosl0qv000co2w9154xu6mv', 'cmwosl0pp000ao2w9m4prhh04', 101, 0, 93.3, 62.45, 0, '2026-11-20 12:36:15.750'),
  ('cmwotbotx000yo2w91xiqqrq4', 'cmwotbotq000wo2w9kfb0hh93', 0, 0, 0, 0, 0, '2026-11-20 10:04:47.350'),
  ('cmwovuv630053o2w9ejfzgeyq', 'cmwovuv5y0051o2w9ceau4d35', 4.4, 0, 0, 0, 0, '2026-11-20 11:29:56.006'),
  ('cmwoy3i0r0002o2dm89eglv81', 'cmwoy3i0o0000o2dmli3fblmv', 574.03, 0, 396, 274.03, 0, '2026-11-20 12:36:15.758');
INSERT INTO `LedgerEntry` (`id`, `userId`, `kind`, `direction`, `amount`, `currency`, `availableAfter`, `reservedAfter`, `refType`, `refId`, `note`, `idempotencyKey`, `createdAt`) VALUES
  ('cmwotyld0001fo2w9vx3myx71', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 0.1, 'USD', 0.1, 0, 'gift_send', 'cmwotylcm001eo2w973rflfv3', 'Gift Rose from Ali Raza (test) — gross $0.60, commission $0.18, net $0.10', 'giftcredit:cmwotydup001co2w9brr16qr0', '2026-11-20 10:22:35.940'),
  ('cmwotzido001lo2w9temqhe8t', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 19.83, 'USD', 19.93, 0, 'gift_send', 'cmwotzidc001ko2w9caotdih7', 'Gift Lion from Ali Raza (test) — gross $30.00, commission $9.00, net $19.83', 'giftcredit:cmwotzfxz001io2w9pt6bong6', '2026-11-20 10:23:18.732'),
  ('cmwou2q87001ro2w9twxajlfv', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 3.06, 'USD', 22.99, 0, 'gift_send', 'cmwou2q7v001qo2w9zyvmisz7', 'Gift Crown from Ali Raza (test) — gross $5.00, commission $1.50, net $3.06', 'giftcredit:cmwou2ntn001oo2w95i3b0rv3', '2026-11-20 10:25:48.871'),
  ('cmwou7wd70027o2w9h6otlc5i', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 0.71, 'USD', 23.7, 0, 'gift_send', 'cmwou7wcx0026o2w9tzwy4fod', 'Gift Heart from Ali Raza (test) — gross $1.50, commission $0.45, net $0.71', 'giftcredit:cmwou7tzt0024o2w9pocamswi', '2026-11-20 10:29:50.108'),
  ('cmwovejl4003ao2w9gwhiw8ux', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 6.41, 'USD', 6.41, 0, 'gift_send', 'cmwovejky0039o2w9fclfz3bm', 'Gift Rocket from Fahad Mazhar (test) — gross $10.00, commission $3.00, net $6.41', 'giftcredit:cmwoveiqj0037o2w96au2i0rm', '2026-11-20 11:02:59.752'),
  ('cmwovewqh003go2w993p5bl2b', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 19.83, 'USD', 26.24, 0, 'gift_send', 'cmwovewq6003fo2w96w2ktxcv', 'Gift Lion from Fahad Mazhar (test) — gross $30.00, commission $9.00, net $19.83', 'giftcredit:cmwovevzk003do2w9wy6co85v', '2026-11-20 11:03:16.793'),
  ('cmwovf77o003mo2w90paz1cyr', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 33.25, 'USD', 59.49, 0, 'gift_send', 'cmwovf77i003lo2w9cw6cjtqz', 'Gift Magic Castle from Fahad Mazhar (test) — gross $50.00, commission $15.00, net $33.25', 'giftcredit:cmwovf6ao003jo2w9jv6gwkjn', '2026-11-20 11:03:30.373'),
  ('cmwovfm64003so2w9vcaw34iy', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 13.12, 'USD', 72.61, 0, 'gift_send', 'cmwovfm60003ro2w9xcwhuwan', 'Gift Dragon from Fahad Mazhar (test) — gross $20.00, commission $6.00, net $13.12', 'giftcredit:cmwovfl81003po2w97u16h4rw', '2026-11-20 11:03:49.757'),
  ('cmwovg1bx003yo2w9fm4whg5u', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 19.83, 'USD', 92.44, 0, 'gift_send', 'cmwovg1bs003xo2w9cjrw83fx', 'Gift Lion from Fahad Mazhar (test) — gross $30.00, commission $9.00, net $19.83', 'giftcredit:cmwovfysq003vo2w9qeixhbf6', '2026-11-20 11:04:09.405'),
  ('cmwovk5dx0044o2w9z35yo86w', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 6.41, 'USD', 98.85, 0, 'gift_send', 'cmwovk5dq0043o2w9hw0h88fp', 'Gift Rocket from Fahad Mazhar (test) — gross $10.00, commission $3.00, net $6.41', 'giftcredit:cmwovk4h40041o2w9awvi0ojx', '2026-11-20 11:07:21.286'),
  ('cmwovl5ni004go2w9ppnpu6uo', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 6.41, 'USD', 30.11, 0, 'gift_send', 'cmwovl5n2004fo2w9agvp4qgv', 'Gift Rocket from fahad (test) — gross $10.00, commission $3.00, net $6.41', 'giftcredit:cmwovl4qx004do2w9cdf9ei0i', '2026-11-20 11:08:08.287'),
  ('cmwovmgms004mo2w91tcwlikb', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 9.76, 'USD', 108.61, 0, 'gift_send', 'cmwovmgml004lo2w9zi7lclk1', 'Gift Fireworks from Fahad Mazhar (test) — gross $15.00, commission $4.50, net $9.76', 'giftcredit:cmwovmfms004jo2w9rnewovu1', '2026-11-20 11:09:09.173'),
  ('cmwovmsck004so2w97yg6dsja', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 66.13, 'USD', 174.74, 0, 'gift_send', 'cmwovmscd004ro2w9n0n9ghu2', 'Gift Galaxy from Fahad Mazhar (test) — gross $99.00, commission $29.70, net $66.13', 'giftcredit:cmwovmrib004po2w9e2y211ir', '2026-11-20 11:09:24.356'),
  ('cmwovvdq00059o2w9v4tewt2b', 'cmwovuv5y0051o2w9ceau4d35', 'admin_adjustment', 'credit', 50, 'USD', 50, 0, 'admin', 'cmwosl0pp000ao2w9m4prhh04', 'Credit by admin Fahad Mazhar: gift test balance', 'adminadj:cmwovuv5y0051o2w9ceau4d35:1795173365300:et2y6p', '2026-11-20 11:16:05.304'),
  ('cmwow7b31005no2w9udrp7ukw', 'cmwovuv5y0051o2w9ceau4d35', 'gift_sent', 'debit', 30, 'USD', 20, 0, 'gift_send', 'giftw:cmwoswwxw0009o2jlypsyyup1:cmwosl0pp000ao2w9m4prhh04:1795173921590:6u01k5', 'Gift Lion sent to Fahad Mazhar (room) — $30.00 from wallet balance', 'giftspend:giftw:cmwoswwxw0009o2jlypsyyup1:cmwosl0pp000ao2w9m4prhh04:1795173921590:6u01k5', '2026-11-20 11:25:21.757'),
  ('cmwow7b37005qo2w948ni4zag', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 21, 'USD', 51.11, 0, 'gift_send', 'cmwow7b33005po2w9stnin70z', 'Gift Lion from Viewer Vicky — gross $30.00, commission $9.00, net $21.00', 'giftcredit:wallet:giftw:cmwoswwxw0009o2jlypsyyup1:cmwosl0pp000ao2w9m4prhh04:1795173921590:6u01k5', '2026-11-20 11:25:21.763'),
  ('cmwow8qba005so2w9cfyekitg', 'cmwovuv5y0051o2w9ceau4d35', 'gift_sent', 'debit', 0.6, 'USD', 19.4, 0, 'gift_send', 'giftw:cmwoswwxj0000o2jl1hzbepcs:cmwosl0pp000ao2w9m4prhh04:1795173988122:xydhvy', 'Gift Rose sent to Fahad Mazhar (room) — $0.60 from wallet balance', 'giftspend:giftw:cmwoswwxj0000o2jl1hzbepcs:cmwosl0pp000ao2w9m4prhh04:1795173988122:xydhvy', '2026-11-20 11:26:28.150'),
  ('cmwow8qbf005vo2w9milce24u', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 0.42, 'USD', 51.53, 0, 'gift_send', 'cmwow8qbb005uo2w99kd6pb53', 'Gift Rose from Viewer Vicky — gross $0.60, commission $0.18, net $0.42', 'giftcredit:wallet:giftw:cmwoswwxj0000o2jl1hzbepcs:cmwosl0pp000ao2w9m4prhh04:1795173988122:xydhvy', '2026-11-20 11:26:28.155'),
  ('cmwowd6p4005zo2w9wvk0v8tf', 'cmwovuv5y0051o2w9ceau4d35', 'gift_sent', 'debit', 15, 'USD', 4.4, 0, 'gift_send', 'giftw:cmwoswwxu0007o2jlnhsa30gi:cmwosl0pp000ao2w9m4prhh04:1795174195971:ncimtw', 'Gift Fireworks sent to Fahad Mazhar (live) — $15.00 from wallet balance', 'giftspend:giftw:cmwoswwxu0007o2jlnhsa30gi:cmwosl0pp000ao2w9m4prhh04:1795174195971:ncimtw', '2026-11-20 11:29:56.009'),
  ('cmwowd6pf0062o2w9sxssqsnt', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 10.5, 'USD', 62.03, 0, 'gift_send', 'cmwowd6p80061o2w9ved06h06', 'Gift Fireworks from Viewer Vicky — gross $15.00, commission $4.50, net $10.50', 'giftcredit:wallet:giftw:cmwoswwxu0007o2jlnhsa30gi:cmwosl0pp000ao2w9m4prhh04:1795174195971:ncimtw', '2026-11-20 11:29:56.020'),
  ('cmwoy5ay40006o2nwyrzh160x', 'cmwoy3i0o0000o2dmli3fblmv', 'gift_sent', 'debit', 0.6, 'USD', 9.4, 0, 'gift_send', 'testgift1795177187447', 'Gift Rose sent to Fahad Mazhar (battle) — $0.60 from wallet balance', 'giftspend:testgift1795177187447', '2026-11-20 12:19:47.501'),
  ('cmwoy5ayc0009o2nw9yp502ef', 'cmwosl0pp000ao2w9m4prhh04', 'gift_received', 'credit', 0.42, 'USD', 62.45, 0, 'gift_send', 'cmwoy5ay70008o2nwati486h6', 'Gift Rose from Test Viewer — gross $0.60, commission $0.18, net $0.42', 'giftcredit:wallet:testgift1795177187447', '2026-11-20 12:19:47.508'),
  ('cmwoyfrcz0004o262frrhmmyb', 'cmwosl0pp000ao2w9m4prhh04', 'gift_sent', 'debit', 99, 'USD', 101, 0, 'gift_send', 'giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795177675262:8qi8el', 'Gift Galaxy sent to Test Viewer (live) — $99.00 from wallet balance', 'giftspend:giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795177675262:8qi8el', '2026-11-20 12:27:55.331'),
  ('cmwoyfrd70007o262z5az76he', 'cmwoy3i0o0000o2dmli3fblmv', 'gift_received', 'credit', 69.3, 'USD', 369.3, 0, 'gift_send', 'cmwoyfrd10006o262vcgfi2np', 'Gift Galaxy from Fahad Mazhar — gross $99.00, commission $29.70, net $69.30', 'giftcredit:wallet:giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795177675262:8qi8el', '2026-11-20 12:27:55.339'),
  ('cmwoygsu60009o26240ngsgrd', 'cmwosl0pp000ao2w9m4prhh04', 'gift_sent', 'debit', 99, 'USD', 2, 0, 'gift_send', 'giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795177723858:22kd5m', 'Gift Galaxy sent to Test Viewer (live) — $99.00 from wallet balance', 'giftspend:giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795177723858:22kd5m', '2026-11-20 12:28:43.902'),
  ('cmwoygsuh000co262e4zcx1zd', 'cmwoy3i0o0000o2dmli3fblmv', 'gift_received', 'credit', 69.3, 'USD', 438.6, 0, 'gift_send', 'cmwoygsua000bo262mhf9765i', 'Gift Galaxy from Fahad Mazhar — gross $99.00, commission $29.70, net $69.30', 'giftcredit:wallet:giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795177723858:22kd5m', '2026-11-20 12:28:43.913'),
  ('cmwoyjj24000jo2623oym8pu4', 'cmwoy3i0o0000o2dmli3fblmv', 'gift_received', 'credit', 66.13, 'USD', 504.73, 0, 'gift_send', 'cmwoyjj1v000io2622s4bdh8a', 'Gift Galaxy from fahad (test) — gross $99.00, commission $29.70, net $66.13', 'giftcredit:cmwoyjh7g000go262gdkqopjy', '2026-11-20 12:30:51.197'),
  ('cmwoyl1uv000ro2622h0p02oq', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 66.13, 'USD', 240.87, 0, 'gift_send', 'cmwoyl1un000qo262beptdq1d', 'Gift Galaxy from Fahad Mazhar (test) — gross $99.00, commission $29.70, net $66.13', 'giftcredit:cmwoyl0l4000oo262eioae8ow', '2026-11-20 12:32:02.215'),
  ('cmwoylffd000xo262wdkr60tn', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 6.41, 'USD', 247.28, 0, 'gift_send', 'cmwoylff6000wo262l3347i78', 'Gift Rocket from Fahad Mazhar (test) — gross $10.00, commission $3.00, net $6.41', 'giftcredit:cmwoyldqn000uo2624hejn2mr', '2026-11-20 12:32:19.802'),
  ('cmwoylsxm0013o262x57b26ss', 'cmwosksb60001o2w9wqasni6u', 'gift_received', 'credit', 13.12, 'USD', 260.4, 0, 'gift_send', 'cmwoylsxh0012o262hr9gmcth', 'Gift Dragon from Fahad Mazhar (test) — gross $20.00, commission $6.00, net $13.12', 'giftcredit:cmwoylrcd0010o2629ka2ab67', '2026-11-20 12:32:37.307'),
  ('cmwoyqhhl0015o2620himtkyt', 'cmwosl0pp000ao2w9m4prhh04', 'gift_sent', 'debit', 99, 'USD', 101, 0, 'gift_send', 'giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795178175724:fcbpye', 'Gift Galaxy sent to Test Viewer (live) — $99.00 from wallet balance', 'giftspend:giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795178175724:fcbpye', '2026-11-20 12:36:15.753'),
  ('cmwoyqhhs0018o2622j5ht9lw', 'cmwoy3i0o0000o2dmli3fblmv', 'gift_received', 'credit', 69.3, 'USD', 574.03, 0, 'gift_send', 'cmwoyqhhn0017o26260umn4n6', 'Gift Galaxy from Fahad Mazhar — gross $99.00, commission $29.70, net $69.30', 'giftcredit:wallet:giftw:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795178175724:fcbpye', '2026-11-20 12:36:15.761');
INSERT INTO `Payment` (`id`, `userId`, `provider`, `providerRef`, `purpose`, `status`, `amount`, `currency`, `feeAmount`, `meta`, `isTest`, `clientKey`, `createdAt`, `completedAt`) VALUES
  ('cmwotydup001co2w9brr16qr0', 'cmwotbotq000wo2w9kfb0hh93', 'sandbox', NULL, 'gift', 'successful', 0.6, 'USD', 0.32, '{"giftId":"cmwoswwxj0000o2jl1hzbepcs","giftName":"Rose","toUserId":"cmwosl0pp000ao2w9m4prhh04","context":"live","roomId":null,"liveId":"cmwotu31i001ao2w9rk63jyao","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxj0000o2jl1hzbepcs:cmwosl0pp000ao2w9m4prhh04:1795170145927:gw8rzk', '2026-11-20 10:22:26.209', '2026-11-20 10:22:35.897'),
  ('cmwotzfxz001io2w9pt6bong6', 'cmwotbotq000wo2w9kfb0hh93', 'sandbox', NULL, 'gift', 'successful', 30, 'USD', 1.17, '{"giftId":"cmwoswwxw0009o2jlypsyyup1","giftName":"Lion","toUserId":"cmwosl0pp000ao2w9m4prhh04","context":"live","roomId":null,"liveId":"cmwotu31i001ao2w9rk63jyao","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxw0009o2jlypsyyup1:cmwosl0pp000ao2w9m4prhh04:1795170195546:kppz1r', '2026-11-20 10:23:15.576', '2026-11-20 10:23:18.659'),
  ('cmwou2ntn001oo2w95i3b0rv3', 'cmwotbotq000wo2w9kfb0hh93', 'sandbox', NULL, 'gift', 'successful', 5, 'USD', 0.44, '{"giftId":"cmwoswwxp0004o2jl8f6tnlr7","giftName":"Crown","toUserId":"cmwosl0pp000ao2w9m4prhh04","context":"live","roomId":null,"liveId":"cmwotu31i001ao2w9rk63jyao","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxp0004o2jl8f6tnlr7:cmwosl0pp000ao2w9m4prhh04:1795170345724:llsaw5', '2026-11-20 10:25:45.756', '2026-11-20 10:25:48.852'),
  ('cmwou7tzt0024o2w9pocamswi', 'cmwotbotq000wo2w9kfb0hh93', 'sandbox', NULL, 'gift', 'successful', 1.5, 'USD', 0.34, '{"giftId":"cmwoswwxm0002o2jlmkgd0kjr","giftName":"Heart","toUserId":"cmwosl0pp000ao2w9m4prhh04","context":"room","roomId":"cmwou3tsw001wo2w98i0k2nfg","liveId":null,"battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxm0002o2jlmkgd0kjr:cmwosl0pp000ao2w9m4prhh04:1795170587007:p9z4pi', '2026-11-20 10:29:47.033', '2026-11-20 10:29:50.083'),
  ('cmwoveiqj0037o2w96au2i0rm', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 10, 'USD', 0.59, '{"giftId":"cmwoswwxt0006o2jl3itq62gj","giftName":"Rocket","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxt0006o2jl3itq62gj:cmwosksb60001o2w9wqasni6u:1795172578409:mr8iso', '2026-11-20 11:02:58.652', '2026-11-20 11:02:59.739'),
  ('cmwovevzk003do2w9wy6co85v', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 30, 'USD', 1.17, '{"giftId":"cmwoswwxw0009o2jlypsyyup1","giftName":"Lion","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxw0009o2jlypsyyup1:cmwosksb60001o2w9wqasni6u:1795172595567:crhjs5', '2026-11-20 11:03:15.825', '2026-11-20 11:03:16.774'),
  ('cmwovf6ao003jo2w9jv6gwkjn', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 50, 'USD', 1.75, '{"giftId":"cmwoswwxx000ao2jl96mgq4gw","giftName":"Magic Castle","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxx000ao2jl96mgq4gw:cmwosksb60001o2w9wqasni6u:1795172608959:71uyrl', '2026-11-20 11:03:29.184', '2026-11-20 11:03:30.358'),
  ('cmwovfl81003po2w97u16h4rw', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 20, 'USD', 0.88, '{"giftId":"cmwoswwxv0008o2jl9gxhmnil","giftName":"Dragon","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxv0008o2jl9gxhmnil:cmwosksb60001o2w9wqasni6u:1795172628288:1x51f9', '2026-11-20 11:03:48.530', '2026-11-20 11:03:49.746'),
  ('cmwovfysq003vo2w9qeixhbf6', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 30, 'USD', 1.17, '{"giftId":"cmwoswwxw0009o2jlypsyyup1","giftName":"Lion","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxw0009o2jlypsyyup1:cmwosksb60001o2w9wqasni6u:1795172645903:kchl4l', '2026-11-20 11:04:06.123', '2026-11-20 11:04:09.395'),
  ('cmwovk4h40041o2w9awvi0ojx', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 10, 'USD', 0.59, '{"giftId":"cmwoswwxt0006o2jl3itq62gj","giftName":"Rocket","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxt0006o2jl3itq62gj:cmwosksb60001o2w9wqasni6u:1795172839860:05cem8', '2026-11-20 11:07:20.105', '2026-11-20 11:07:21.269'),
  ('cmwovl4qx004do2w9cdf9ei0i', 'cmwosksb60001o2w9wqasni6u', 'sandbox', NULL, 'gift', 'successful', 10, 'USD', 0.59, '{"giftId":"cmwoswwxt0006o2jl3itq62gj","giftName":"Rocket","toUserId":"cmwosl0pp000ao2w9m4prhh04","context":"battle","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":"cmwovkmwf0046o2w9gsfhitbk","battleSide":1}', 1, 'gift:cmwoswwxt0006o2jl3itq62gj:cmwosl0pp000ao2w9m4prhh04:1795172887039:728f06', '2026-11-20 11:08:07.114', '2026-11-20 11:08:08.232'),
  ('cmwovmfms004jo2w9rnewovu1', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 15, 'USD', 0.74, '{"giftId":"cmwoswwxu0007o2jlnhsa30gi","giftName":"Fireworks","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxu0007o2jlnhsa30gi:cmwosksb60001o2w9wqasni6u:1795172947657:jv48ot', '2026-11-20 11:09:07.877', '2026-11-20 11:09:09.157'),
  ('cmwovmrib004po2w9e2y211ir', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 99, 'USD', 3.17, '{"giftId":"cmwoswwxz000bo2jlmeu9ze8t","giftName":"Galaxy","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwovdys50035o2w9jb42pkeg","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxz000bo2jlmeu9ze8t:cmwosksb60001o2w9wqasni6u:1795172963030:alqvys', '2026-11-20 11:09:23.267', '2026-11-20 11:09:24.341'),
  ('cmwoyjh7g000go262gdkqopjy', 'cmwosksb60001o2w9wqasni6u', 'sandbox', NULL, 'gift', 'successful', 99, 'USD', 3.17, '{"giftId":"cmwoswwxz000bo2jlmeu9ze8t","giftName":"Galaxy","toUserId":"cmwoy3i0o0000o2dmli3fblmv","context":"live","roomId":null,"liveId":"cmwoy6l4l0001o2ri05gnrg07","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxz000bo2jlmeu9ze8t:cmwoy3i0o0000o2dmli3fblmv:1795177848517:9bfgyz', '2026-11-20 12:30:48.796', '2026-11-20 12:30:51.154'),
  ('cmwoyl0l4000oo262eioae8ow', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 99, 'USD', 3.17, '{"giftId":"cmwoswwxz000bo2jlmeu9ze8t","giftName":"Galaxy","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwoyk341000mo262s6nyft82","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxz000bo2jlmeu9ze8t:cmwosksb60001o2w9wqasni6u:1795177920355:oqpety', '2026-11-20 12:32:00.568', '2026-11-20 12:32:02.198'),
  ('cmwoyldqn000uo2624hejn2mr', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 10, 'USD', 0.59, '{"giftId":"cmwoswwxt0006o2jl3itq62gj","giftName":"Rocket","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwoyk341000mo262s6nyft82","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxt0006o2jl3itq62gj:cmwosksb60001o2w9wqasni6u:1795177937388:ot4ykv', '2026-11-20 12:32:17.616', '2026-11-20 12:32:19.786'),
  ('cmwoylrcd0010o2629ka2ab67', 'cmwosl0pp000ao2w9m4prhh04', 'sandbox', NULL, 'gift', 'successful', 20, 'USD', 0.88, '{"giftId":"cmwoswwxv0008o2jl9gxhmnil","giftName":"Dragon","toUserId":"cmwosksb60001o2w9wqasni6u","context":"live","roomId":null,"liveId":"cmwoyk341000mo262s6nyft82","battleId":null,"battleSide":null}', 1, 'gift:cmwoswwxv0008o2jl9gxhmnil:cmwosksb60001o2w9wqasni6u:1795177955035:bczemz', '2026-11-20 12:32:35.246', '2026-11-20 12:32:37.295');
INSERT INTO `Gift` (`id`, `name`, `emoji`, `imageUrl`, `description`, `animKind`, `sound`, `category`, `priceUsd`, `currency`, `platformMap`, `durationMs`, `active`, `sortOrder`) VALUES
  ('cmwoswwxj0000o2jl1hzbepcs', 'Rose', '🌹', '/gifts/rose.png', 'Rose gift — delivered with a real-time animation.', 'rose', 'gift', 'both', 0.6, 'USD', '{"android":"call_gift_rose","ios":"call_gift_rose"}', 2200, 1, 1),
  ('cmwoswwxk0001o2jlhxkdg8ml', 'Flower', '🌺', '/gifts/rose.png', 'Flower gift — delivered with a real-time animation.', 'flower', 'gift', 'both', 1, 'USD', '{"android":"call_gift_flower","ios":"call_gift_flower"}', 2200, 1, 2),
  ('cmwoswwxm0002o2jlmkgd0kjr', 'Heart', '❤️', '/gifts/heart.png', 'Heart gift — delivered with a real-time animation.', 'heart', 'gift', 'both', 1.5, 'USD', '{"android":"call_gift_heart","ios":"call_gift_heart"}', 2200, 1, 3),
  ('cmwoswwxo0003o2jltaup56km', 'Bouquet', '💐', '/gifts/rose.png', 'Bouquet gift — delivered with a real-time animation.', 'flower', 'gift', 'both', 2.5, 'USD', '{"android":"call_gift_flower","ios":"call_gift_flower"}', 2600, 1, 4),
  ('cmwoswwxp0004o2jl8f6tnlr7', 'Crown', '👑', '/gifts/crown.png', 'Crown gift — delivered with a real-time animation.', 'crown', 'gift', 'both', 5, 'USD', '{"android":"call_gift_crown","ios":"call_gift_crown"}', 2800, 1, 5),
  ('cmwoswwxs0005o2jlgy1e0ndu', 'Race Car', '🏎️', '/gifts/car.png', 'Race Car gift — delivered with a real-time animation.', 'car', 'gift', 'both', 8, 'USD', '{"android":"call_gift_car","ios":"call_gift_car"}', 3200, 1, 6),
  ('cmwoswwxt0006o2jl3itq62gj', 'Rocket', '🚀', '/gifts/rocket.png', 'Rocket gift — delivered with a real-time animation.', 'rocket', 'gift_big', 'both', 10, 'USD', '{"android":"call_gift_rocket","ios":"call_gift_rocket"}', 3500, 1, 7),
  ('cmwoswwxu0007o2jlnhsa30gi', 'Fireworks', '🎆', '/gifts/fireworks.png', 'Fireworks gift — delivered with a real-time animation.', 'fireworks', 'gift_big', 'both', 15, 'USD', '{"android":"call_gift_fireworks","ios":"call_gift_fireworks"}', 4000, 1, 8),
  ('cmwoswwxv0008o2jl9gxhmnil', 'Dragon', '🐉', '/gifts/dragon.png', 'Dragon gift — delivered with a real-time animation.', 'dragon', 'gift_big', 'both', 20, 'USD', '{"android":"call_gift_dragon","ios":"call_gift_dragon"}', 4000, 1, 9),
  ('cmwoswwxw0009o2jlypsyyup1', 'Lion', '🦁', '/gifts/lion.png', 'Lion gift — delivered with a real-time animation.', 'lion', 'gift_big', 'both', 30, 'USD', '{"android":"call_gift_lion","ios":"call_gift_lion"}', 4200, 1, 10),
  ('cmwoswwxx000ao2jl96mgq4gw', 'Magic Castle', '🏰', '/gifts/castle.png', 'Magic Castle gift — delivered with a real-time animation.', 'castle', 'gift_big', 'both', 50, 'USD', '{"android":"call_gift_castle","ios":"call_gift_castle"}', 5000, 1, 11),
  ('cmwoswwxz000bo2jlmeu9ze8t', 'Galaxy', '🌌', '/gifts/galaxy.png', 'Galaxy gift — delivered with a real-time animation.', 'galaxy', 'gift_big', 'both', 99, 'USD', '{"android":"call_gift_superlion","ios":"call_gift_superlion"}', 5200, 1, 12);
INSERT INTO `GiftSend` (`id`, `giftId`, `senderId`, `recipientId`, `context`, `roomId`, `liveId`, `battleId`, `battleSide`, `grossAmount`, `commission`, `feeAmount`, `netAmount`, `currency`, `paymentId`, `isTest`, `createdAt`) VALUES
  ('cmwotylcm001eo2w973rflfv3', 'cmwoswwxj0000o2jl1hzbepcs', 'cmwotbotq000wo2w9kfb0hh93', 'cmwosl0pp000ao2w9m4prhh04', 'live', NULL, 'cmwotu31i001ao2w9rk63jyao', NULL, NULL, 0.6, 0.18, 0.32, 0.1, 'USD', 'cmwotydup001co2w9brr16qr0', 1, '2026-11-20 10:22:35.927'),
  ('cmwotzidc001ko2w9caotdih7', 'cmwoswwxw0009o2jlypsyyup1', 'cmwotbotq000wo2w9kfb0hh93', 'cmwosl0pp000ao2w9m4prhh04', 'live', NULL, 'cmwotu31i001ao2w9rk63jyao', NULL, NULL, 30, 9, 1.17, 19.83, 'USD', 'cmwotzfxz001io2w9pt6bong6', 1, '2026-11-20 10:23:18.720'),
  ('cmwou2q7v001qo2w9zyvmisz7', 'cmwoswwxp0004o2jl8f6tnlr7', 'cmwotbotq000wo2w9kfb0hh93', 'cmwosl0pp000ao2w9m4prhh04', 'live', NULL, 'cmwotu31i001ao2w9rk63jyao', NULL, NULL, 5, 1.5, 0.44, 3.06, 'USD', 'cmwou2ntn001oo2w95i3b0rv3', 1, '2026-11-20 10:25:48.859'),
  ('cmwou7wcx0026o2w9tzwy4fod', 'cmwoswwxm0002o2jlmkgd0kjr', 'cmwotbotq000wo2w9kfb0hh93', 'cmwosl0pp000ao2w9m4prhh04', 'room', 'cmwou3tsw001wo2w98i0k2nfg', NULL, NULL, NULL, 1.5, 0.45, 0.34, 0.71, 'USD', 'cmwou7tzt0024o2w9pocamswi', 1, '2026-11-20 10:29:50.097'),
  ('cmwovejky0039o2w9fclfz3bm', 'cmwoswwxt0006o2jl3itq62gj', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwovdys50035o2w9jb42pkeg', NULL, NULL, 10, 3, 0.59, 6.41, 'USD', 'cmwoveiqj0037o2w96au2i0rm', 1, '2026-11-20 11:02:59.747'),
  ('cmwovewq6003fo2w96w2ktxcv', 'cmwoswwxw0009o2jlypsyyup1', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwovdys50035o2w9jb42pkeg', NULL, NULL, 30, 9, 1.17, 19.83, 'USD', 'cmwovevzk003do2w9wy6co85v', 1, '2026-11-20 11:03:16.783'),
  ('cmwovf77i003lo2w9cw6cjtqz', 'cmwoswwxx000ao2jl96mgq4gw', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwovdys50035o2w9jb42pkeg', NULL, NULL, 50, 15, 1.75, 33.25, 'USD', 'cmwovf6ao003jo2w9jv6gwkjn', 1, '2026-11-20 11:03:30.366'),
  ('cmwovfm60003ro2w9xcwhuwan', 'cmwoswwxv0008o2jl9gxhmnil', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwovdys50035o2w9jb42pkeg', NULL, NULL, 20, 6, 0.88, 13.12, 'USD', 'cmwovfl81003po2w97u16h4rw', 1, '2026-11-20 11:03:49.752'),
  ('cmwovg1bs003xo2w9cjrw83fx', 'cmwoswwxw0009o2jlypsyyup1', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwovdys50035o2w9jb42pkeg', NULL, NULL, 30, 9, 1.17, 19.83, 'USD', 'cmwovfysq003vo2w9qeixhbf6', 1, '2026-11-20 11:04:09.401'),
  ('cmwovk5dq0043o2w9hw0h88fp', 'cmwoswwxt0006o2jl3itq62gj', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwovdys50035o2w9jb42pkeg', NULL, NULL, 10, 3, 0.59, 6.41, 'USD', 'cmwovk4h40041o2w9awvi0ojx', 1, '2026-11-20 11:07:21.279'),
  ('cmwovl5n2004fo2w9agvp4qgv', 'cmwoswwxt0006o2jl3itq62gj', 'cmwosksb60001o2w9wqasni6u', 'cmwosl0pp000ao2w9m4prhh04', 'battle', NULL, 'cmwovdys50035o2w9jb42pkeg', 'cmwovkmwf0046o2w9gsfhitbk', 1, 10, 3, 0.59, 6.41, 'USD', 'cmwovl4qx004do2w9cdf9ei0i', 1, '2026-11-20 11:08:08.271'),
  ('cmwovmgml004lo2w9zi7lclk1', 'cmwoswwxu0007o2jlnhsa30gi', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwovdys50035o2w9jb42pkeg', NULL, NULL, 15, 4.5, 0.74, 9.76, 'USD', 'cmwovmfms004jo2w9rnewovu1', 1, '2026-11-20 11:09:09.166'),
  ('cmwovmscd004ro2w9n0n9ghu2', 'cmwoswwxz000bo2jlmeu9ze8t', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwovdys50035o2w9jb42pkeg', NULL, NULL, 99, 29.7, 3.17, 66.13, 'USD', 'cmwovmrib004po2w9e2y211ir', 1, '2026-11-20 11:09:24.350'),
  ('cmwow7b33005po2w9stnin70z', 'cmwoswwxw0009o2jlypsyyup1', 'cmwovuv5y0051o2w9ceau4d35', 'cmwosl0pp000ao2w9m4prhh04', 'room', 'cmwovw2fw005co2w903am5p32', NULL, NULL, NULL, 30, 9, 0, 21, 'USD', NULL, 0, '2026-11-20 11:25:21.759'),
  ('cmwow8qbb005uo2w99kd6pb53', 'cmwoswwxj0000o2jl1hzbepcs', 'cmwovuv5y0051o2w9ceau4d35', 'cmwosl0pp000ao2w9m4prhh04', 'room', 'cmwovw2fw005co2w903am5p32', NULL, NULL, NULL, 0.6, 0.18, 0, 0.42, 'USD', NULL, 0, '2026-11-20 11:26:28.152'),
  ('cmwowd6p80061o2w9ved06h06', 'cmwoswwxu0007o2jlnhsa30gi', 'cmwovuv5y0051o2w9ceau4d35', 'cmwosl0pp000ao2w9m4prhh04', 'live', NULL, 'cmwowbxaq005yo2w9m5vr1v21', NULL, NULL, 15, 4.5, 0, 10.5, 'USD', NULL, 0, '2026-11-20 11:29:56.012'),
  ('cmwoy5ay70008o2nwati486h6', 'cmwoswwxj0000o2jl1hzbepcs', 'cmwoy3i0o0000o2dmli3fblmv', 'cmwosl0pp000ao2w9m4prhh04', 'battle', NULL, 'cmwowbxaq005yo2w9m5vr1v21', 'cmwoy5ahy0000o2nwd8elqnfg', NULL, 0.6, 0.18, 0, 0.42, 'USD', NULL, 0, '2026-11-20 12:19:47.504'),
  ('cmwoyfrd10006o262vcgfi2np', 'cmwoswwxz000bo2jlmeu9ze8t', 'cmwosl0pp000ao2w9m4prhh04', 'cmwoy3i0o0000o2dmli3fblmv', 'live', NULL, 'cmwoy6l4l0001o2ri05gnrg07', NULL, NULL, 99, 29.7, 0, 69.3, 'USD', NULL, 0, '2026-11-20 12:27:55.334'),
  ('cmwoygsua000bo262mhf9765i', 'cmwoswwxz000bo2jlmeu9ze8t', 'cmwosl0pp000ao2w9m4prhh04', 'cmwoy3i0o0000o2dmli3fblmv', 'live', NULL, 'cmwoy6l4l0001o2ri05gnrg07', NULL, NULL, 99, 29.7, 0, 69.3, 'USD', NULL, 0, '2026-11-20 12:28:43.906'),
  ('cmwoyjj1v000io2622s4bdh8a', 'cmwoswwxz000bo2jlmeu9ze8t', 'cmwosksb60001o2w9wqasni6u', 'cmwoy3i0o0000o2dmli3fblmv', 'live', NULL, 'cmwoy6l4l0001o2ri05gnrg07', NULL, NULL, 99, 29.7, 3.17, 66.13, 'USD', 'cmwoyjh7g000go262gdkqopjy', 1, '2026-11-20 12:30:51.187'),
  ('cmwoyl1un000qo262beptdq1d', 'cmwoswwxz000bo2jlmeu9ze8t', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwoyk341000mo262s6nyft82', NULL, NULL, 99, 29.7, 3.17, 66.13, 'USD', 'cmwoyl0l4000oo262eioae8ow', 1, '2026-11-20 12:32:02.207'),
  ('cmwoylff6000wo262l3347i78', 'cmwoswwxt0006o2jl3itq62gj', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwoyk341000mo262s6nyft82', NULL, NULL, 10, 3, 0.59, 6.41, 'USD', 'cmwoyldqn000uo2624hejn2mr', 1, '2026-11-20 12:32:19.794'),
  ('cmwoylsxh0012o262hr9gmcth', 'cmwoswwxv0008o2jl9gxhmnil', 'cmwosl0pp000ao2w9m4prhh04', 'cmwosksb60001o2w9wqasni6u', 'live', NULL, 'cmwoyk341000mo262s6nyft82', NULL, NULL, 20, 6, 0.88, 13.12, 'USD', 'cmwoylrcd0010o2629ka2ab67', 1, '2026-11-20 12:32:37.301'),
  ('cmwoyqhhn0017o26260umn4n6', 'cmwoswwxz000bo2jlmeu9ze8t', 'cmwosl0pp000ao2w9m4prhh04', 'cmwoy3i0o0000o2dmli3fblmv', 'live', NULL, 'cmwoy6l4l0001o2ri05gnrg07', NULL, NULL, 99, 29.7, 0, 69.3, 'USD', NULL, 0, '2026-11-20 12:36:15.756');
INSERT INTO `VoiceRoom` (`id`, `hostId`, `title`, `description`, `coverUrl`, `isPaid`, `entryFee`, `status`, `createdAt`, `endedAt`) VALUES
  ('cmwou3tsw001wo2w98i0k2nfg', 'cmwosl0pp000ao2w9m4prhh04', 'Friday Night Hangout', '', NULL, 0, 0, 'ended', '2026-11-20 10:26:40.161', '2026-11-20 10:36:44.742'),
  ('cmwovw2fw005co2w903am5p32', 'cmwosl0pp000ao2w9m4prhh04', 'Gift Sync Test Room', '', NULL, 0, 0, 'live', '2026-11-20 11:16:37.340', NULL);
INSERT INTO `RoomParticipant` (`id`, `roomId`, `userId`, `role`, `muted`, `handRaised`, `stageInvite`, `invitedAt`, `blocked`, `entryPaid`, `joinedAt`, `leftAt`) VALUES
  ('cmwou3tt0001yo2w9gifqxw3q', 'cmwou3tsw001wo2w98i0k2nfg', 'cmwosl0pp000ao2w9m4prhh04', 'host', 0, 0, 0, NULL, 0, 0, '2026-11-20 10:26:40.164', '2026-11-20 10:36:44.754'),
  ('cmwou51wl0020o2w90a7i8olc', 'cmwou3tsw001wo2w98i0k2nfg', 'cmwotbotq000wo2w9kfb0hh93', 'speaker', 0, 0, 0, NULL, 0, 0, '2026-11-20 10:27:37.318', '2026-11-20 10:36:44.754'),
  ('cmwovw2g2005eo2w9czftr21h', 'cmwovw2fw005co2w903am5p32', 'cmwosl0pp000ao2w9m4prhh04', 'host', 0, 0, 0, NULL, 0, 1, '2026-11-20 11:16:37.346', '2026-11-20 11:28:56.072'),
  ('cmwovwr88005go2w9bis7e706', 'cmwovw2fw005co2w903am5p32', 'cmwovuv5y0051o2w9ceau4d35', 'listener', 0, 0, 0, NULL, 0, 0, '2026-11-20 11:17:09.464', '2026-11-20 11:29:17.958');
INSERT INTO `RoomMessage` (`id`, `roomId`, `userId`, `name`, `text`, `createdAt`) VALUES
  ('cmwou6si70022o2w9273nkoe9', 'cmwou3tsw001wo2w98i0k2nfg', 'cmwotbotq000wo2w9kfb0hh93', 'Ali Raza', 'Hello host, love this room!', '2026-11-20 10:28:58.447');
INSERT INTO `LiveSession` (`id`, `hostId`, `title`, `status`, `mode`, `battleId`, `viewerCount`, `peakViewers`, `startedAt`, `endedAt`) VALUES
  ('cmwoslw2g000so2w9mldgktfl', 'cmwosksb60001o2w9wqasni6u', 'Live', 'ended', 'solo', NULL, 0, 0, '2026-11-20 09:44:43.672', '2026-11-20 10:04:55.835'),
  ('cmwosnfn6000uo2w978izm343', 'cmwosl0pp000ao2w9m4prhh04', 'Live', 'ended', 'solo', NULL, 0, 0, '2026-11-20 09:45:55.699', '2026-11-20 10:04:55.835'),
  ('cmwotkiz60015o2w9yiw1zimy', 'cmwosl0pp000ao2w9m4prhh04', 'Live', 'ended', 'solo', NULL, 0, 0, '2026-11-20 10:11:39.667', '2026-11-20 10:12:25.780'),
  ('cmwotmv7j0017o2w9r81iqb3s', 'cmwosl0pp000ao2w9m4prhh04', 'Live', 'ended', 'solo', NULL, 0, 0, '2026-11-20 10:13:28.832', '2026-11-20 10:14:18.887'),
  ('cmwotu31i001ao2w9rk63jyao', 'cmwosl0pp000ao2w9m4prhh04', 'Live', 'ended', 'solo', NULL, 0, 1, '2026-11-20 10:19:05.574', '2026-11-20 10:37:14.053'),
  ('cmwovdys50035o2w9jb42pkeg', 'cmwosksb60001o2w9wqasni6u', 'hi', 'ended', 'battle', 'cmwovkmwf0046o2w9gsfhitbk', 1, 1, '2026-11-20 11:02:32.790', '2026-11-20 11:11:47.961'),
  ('cmwowbxaq005yo2w9m5vr1v21', 'cmwosl0pp000ao2w9m4prhh04', 'Live Gift Sound Test', 'ended', 'battle', 'cmwoy5ahy0000o2nwd8elqnfg', 0, 1, '2026-11-20 11:28:57.171', '2026-11-20 12:20:47.348'),
  ('cmwoy6l4l0001o2ri05gnrg07', 'cmwoy3i0o0000o2dmli3fblmv', 'Galaxy Gift Test Live', 'ended', 'solo', NULL, 0, 0, '2026-11-20 12:26:56.592', '2026-11-20 12:37:02.316'),
  ('cmwoyk341000mo262s6nyft82', 'cmwosksb60001o2w9wqasni6u', 'Live', 'ended', 'solo', NULL, 1, 1, '2026-11-20 12:31:17.186', '2026-11-20 12:32:48.502');
INSERT INTO `LiveComment` (`id`, `liveId`, `userId`, `name`, `text`, `createdAt`) VALUES
  ('cmwou3892001uo2w98ya3b5g2', 'cmwotu31i001ao2w9rk63jyao', 'cmwotbotq000wo2w9kfb0hh93', 'Ali Raza', 'Hello from Ali! Great live', '2026-11-20 10:26:12.231');
INSERT INTO `Battle` (`id`, `mode`, `liveId`, `status`, `durationSec`, `startedAt`, `endsAt`, `endedAt`, `winnerSide`, `sideAPoints`, `sideBPoints`, `createdAt`) VALUES
  ('cmwovkmwf0046o2w9gsfhitbk', '1v1', 'cmwovdys50035o2w9jb42pkeg', 'ended', 120, '2026-11-20 11:07:47.483', NULL, '2026-11-20 11:09:56.673', 1, 0, 1000, '2026-11-20 11:07:43.984'),
  ('cmwoy3yul0000o2gu08uc9git', '1v1', 'cmwowbxaq005yo2w9m5vr1v21', 'live', 120, '2026-11-20 12:18:45.355', NULL, NULL, NULL, 3, 0, '2026-11-20 12:18:45.165'),
  ('cmwoy4u880000o2kjrrv8td7k', '1v1', 'cmwowbxaq005yo2w9m5vr1v21', 'live', 120, '2026-11-20 12:19:26.131', NULL, NULL, NULL, 3, 0, '2026-11-20 12:19:25.832'),
  ('cmwoy5ahy0000o2nwd8elqnfg', '1v1', 'cmwowbxaq005yo2w9m5vr1v21', 'live', 120, '2026-11-20 12:19:47.197', NULL, NULL, NULL, 63, 0, '2026-11-20 12:19:46.919');
INSERT INTO `BattleParticipant` (`id`, `battleId`, `userId`, `side`, `slot`, `name`, `avatarKey`, `avatarUrl`, `accepted`, `score`, `connected`) VALUES
  ('cmwovkmwg0048o2w93g1xvezf', 'cmwovkmwf0046o2w9gsfhitbk', 'cmwosksb60001o2w9wqasni6u', 0, 0, 'fahad', 6, NULL, 1, 0, 0),
  ('cmwovkmwj004ao2w9crtdv5gt', 'cmwovkmwf0046o2w9gsfhitbk', 'cmwosl0pp000ao2w9m4prhh04', 1, 0, 'Fahad Mazhar', 0, NULL, 1, 10, 0),
  ('cmwoy3yun0002o2gu9hoajfgx', 'cmwoy3yul0000o2gu08uc9git', 'cmwosl0pp000ao2w9m4prhh04', 0, 0, 'Fahad Mazhar', 0, NULL, 1, 0, 0),
  ('cmwoy3yup0004o2guycwnspa5', 'cmwoy3yul0000o2gu08uc9git', 'cmwoy3i0o0000o2dmli3fblmv', 1, 0, 'Test Viewer', 4, NULL, 1, 0, 0),
  ('cmwoy4u890002o2kjs9bmcpe0', 'cmwoy4u880000o2kjrrv8td7k', 'cmwosl0pp000ao2w9m4prhh04', 0, 0, 'Fahad Mazhar', 0, NULL, 1, 0, 0),
  ('cmwoy4u8c0004o2kjxgqgh6q2', 'cmwoy4u880000o2kjrrv8td7k', 'cmwoy3i0o0000o2dmli3fblmv', 1, 0, 'Test Viewer', 4, NULL, 1, 0, 0),
  ('cmwoy5ai00002o2nwe7jm0mrf', 'cmwoy5ahy0000o2nwd8elqnfg', 'cmwosl0pp000ao2w9m4prhh04', 0, 0, 'Fahad Mazhar', 0, NULL, 1, 0.6, 0),
  ('cmwoy5ai20004o2nwftryzpm1', 'cmwoy5ahy0000o2nwd8elqnfg', 'cmwoy3i0o0000o2dmli3fblmv', 1, 0, 'Test Viewer', 4, NULL, 1, 0, 0);
INSERT INTO `Notification` (`id`, `userId`, `kind`, `title`, `body`, `refType`, `refId`, `read`, `createdAt`) VALUES
  ('cmwosksbj0009o2w9k2vahu1n', 'cmwosksb60001o2w9wqasni6u', 'message', 'CALL', 'Welcome to CALL, fahad! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video ', 'chat', 'cmwosksbf0004o2w9f4l6kggu', 0, '2026-11-20 09:43:52.160'),
  ('cmwotbovb0013o2w90m8ub41r', 'cmwotbotq000wo2w9kfb0hh93', 'message', 'CALL', 'Welcome to CALL, Ali! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video ca', 'chat', 'cmwosksbf0004o2w9f4l6kggu', 0, '2026-11-20 10:04:47.400'),
  ('cmwotyld6001go2w96i780wah', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'Ali Raza sent you Rose 🌹', 'Gross $0.60 · commission $0.18 · you earned $0.10 (test payment)', 'live', 'cmwotu31i001ao2w9rk63jyao', 0, '2026-11-20 10:22:35.946'),
  ('cmwotzidt001mo2w93978lbnt', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'Ali Raza sent you Lion 🦁', 'Gross $30.00 · commission $9.00 · you earned $19.83 (test payment)', 'live', 'cmwotu31i001ao2w9rk63jyao', 0, '2026-11-20 10:23:18.737'),
  ('cmwou2q8q001so2w9dwnrdnnh', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'Ali Raza sent you Crown 👑', 'Gross $5.00 · commission $1.50 · you earned $3.06 (test payment)', 'live', 'cmwotu31i001ao2w9rk63jyao', 0, '2026-11-20 10:25:48.890'),
  ('cmwou7wde0028o2w90hxupj74', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'Ali Raza sent you Heart ❤️', 'Gross $1.50 · commission $0.45 · you earned $0.71 (test payment)', 'room', 'cmwou3tsw001wo2w98i0k2nfg', 0, '2026-11-20 10:29:50.114'),
  ('cmwovejl7003bo2w9aejktw8m', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Rocket 🚀', 'Gross $10.00 · commission $3.00 · you earned $6.41 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:02:59.755'),
  ('cmwovewqk003ho2w9wn1y753e', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Lion 🦁', 'Gross $30.00 · commission $9.00 · you earned $19.83 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:03:16.796'),
  ('cmwovf77s003no2w90uzpa6ug', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Magic Castle 🏰', 'Gross $50.00 · commission $15.00 · you earned $33.25 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:03:30.376'),
  ('cmwovfm66003to2w92ujn30tg', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Dragon 🐉', 'Gross $20.00 · commission $6.00 · you earned $13.12 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:03:49.759'),
  ('cmwovg1bz003zo2w98vy4tmms', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Lion 🦁', 'Gross $30.00 · commission $9.00 · you earned $19.83 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:04:09.407'),
  ('cmwovk5e10045o2w9v94aziod', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Rocket 🚀', 'Gross $10.00 · commission $3.00 · you earned $6.41 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:07:21.289'),
  ('cmwovkmwk004bo2w90mq45uof', 'cmwosl0pp000ao2w9m4prhh04', 'battle_invite', 'fahad invited you to a 1v1 live battle', '', 'battle', 'cmwovkmwf0046o2w9gsfhitbk', 0, '2026-11-20 11:07:43.988'),
  ('cmwovl5nt004ho2w996wg4kdb', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'fahad sent you Rocket 🚀', 'Gross $10.00 · commission $3.00 · you earned $6.41 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:08:08.297'),
  ('cmwovmgmv004no2w9re5cj95y', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Fireworks 🎆', 'Gross $15.00 · commission $4.50 · you earned $9.76 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:09:09.176'),
  ('cmwovmscn004to2w9pjhrgoz9', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Galaxy 🌌', 'Gross $99.00 · commission $29.70 · you earned $66.13 (test payment)', 'live', 'cmwovdys50035o2w9jb42pkeg', 0, '2026-11-20 11:09:24.360'),
  ('cmwovnhaa004uo2w9i9biq03d', 'cmwosksb60001o2w9wqasni6u', 'battle_result', 'Battle lost — better luck next time', 'Final points: 0 — 1000', 'battle', 'cmwovkmwf0046o2w9gsfhitbk', 0, '2026-11-20 11:09:56.675'),
  ('cmwovnhab004vo2w99qo0398j', 'cmwosl0pp000ao2w9m4prhh04', 'battle_result', 'You WON the battle! 🏆', 'Final points: 0 — 1000', 'battle', 'cmwovkmwf0046o2w9gsfhitbk', 0, '2026-11-20 11:09:56.676'),
  ('cmwovuv6d0058o2w9z1s6bsn6', 'cmwovuv5y0051o2w9ceau4d35', 'message', 'CALL', 'Welcome to CALL, Viewer! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video', 'chat', 'cmwosksbf0004o2w9f4l6kggu', 0, '2026-11-20 11:15:41.269'),
  ('cmwovvdq1005ao2w9ag75fpvu', 'cmwovuv5y0051o2w9ceau4d35', 'wallet', 'Balance credited — $50.00', 'gift test balance', 'wallet', NULL, 0, '2026-11-20 11:16:05.306'),
  ('cmwow7b39005ro2w99kw5a3ga', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'Viewer Vicky sent you Lion 🦁', 'Gross $30.00 · commission $9.00 · you earned $21.00', 'room', 'cmwovw2fw005co2w903am5p32', 0, '2026-11-20 11:25:21.766'),
  ('cmwow8qbh005wo2w9wqqyal4o', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'Viewer Vicky sent you Rose 🌹', 'Gross $0.60 · commission $0.18 · you earned $0.42', 'room', 'cmwovw2fw005co2w903am5p32', 0, '2026-11-20 11:26:28.158'),
  ('cmwowd6ph0063o2w9lnilpctc', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'Viewer Vicky sent you Fireworks 🎆', 'Gross $15.00 · commission $4.50 · you earned $10.50', 'live', 'cmwowbxaq005yo2w9m5vr1v21', 0, '2026-11-20 11:29:56.021'),
  ('cmwoy3i140007o2dmajv5ll0j', 'cmwoy3i0o0000o2dmli3fblmv', 'message', 'CALL', 'Welcome to CALL, Test! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video c', 'chat', 'cmwosksbf0004o2w9f4l6kggu', 0, '2026-11-20 12:18:23.368'),
  ('cmwoy3yuq0005o2gu434p1hxo', 'cmwoy3i0o0000o2dmli3fblmv', 'battle_invite', 'Fahad Mazhar invited you to a 1v1 live battle', '', 'battle', 'cmwoy3yul0000o2gu08uc9git', 0, '2026-11-20 12:18:45.170'),
  ('cmwoy4u8d0005o2kjrsasf6bl', 'cmwoy3i0o0000o2dmli3fblmv', 'battle_invite', 'Fahad Mazhar invited you to a 1v1 live battle', '', 'battle', 'cmwoy4u880000o2kjrrv8td7k', 0, '2026-11-20 12:19:25.838'),
  ('cmwoy5ai30005o2nwy4sztwmh', 'cmwoy3i0o0000o2dmli3fblmv', 'battle_invite', 'Fahad Mazhar invited you to a 1v1 live battle', '', 'battle', 'cmwoy5ahy0000o2nwd8elqnfg', 0, '2026-11-20 12:19:46.924'),
  ('cmwoy5ayi000ao2nwvheivch8', 'cmwosl0pp000ao2w9m4prhh04', 'gift', 'Test Viewer sent you Rose 🌹', 'Gross $0.60 · commission $0.18 · you earned $0.42', 'live', 'cmwowbxaq005yo2w9m5vr1v21', 0, '2026-11-20 12:19:47.514'),
  ('cmwoyfrd90008o262y4ef5z5t', 'cmwoy3i0o0000o2dmli3fblmv', 'gift', 'Fahad Mazhar sent you Galaxy 🌌', 'Gross $99.00 · commission $29.70 · you earned $69.30', 'live', 'cmwoy6l4l0001o2ri05gnrg07', 0, '2026-11-20 12:27:55.341'),
  ('cmwoygsuk000do262qnir9c4j', 'cmwoy3i0o0000o2dmli3fblmv', 'gift', 'Fahad Mazhar sent you Galaxy 🌌', 'Gross $99.00 · commission $29.70 · you earned $69.30', 'live', 'cmwoy6l4l0001o2ri05gnrg07', 0, '2026-11-20 12:28:43.917'),
  ('cmwoyjj28000ko262jnbq0cdz', 'cmwoy3i0o0000o2dmli3fblmv', 'gift', 'fahad sent you Galaxy 🌌', 'Gross $99.00 · commission $29.70 · you earned $66.13 (test payment)', 'live', 'cmwoy6l4l0001o2ri05gnrg07', 0, '2026-11-20 12:30:51.201'),
  ('cmwoyl1v2000so262zzr7491r', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Galaxy 🌌', 'Gross $99.00 · commission $29.70 · you earned $66.13 (test payment)', 'live', 'cmwoyk341000mo262s6nyft82', 0, '2026-11-20 12:32:02.223'),
  ('cmwoylffh000yo2628w68gdrc', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Rocket 🚀', 'Gross $10.00 · commission $3.00 · you earned $6.41 (test payment)', 'live', 'cmwoyk341000mo262s6nyft82', 0, '2026-11-20 12:32:19.805'),
  ('cmwoylsxo0014o262t2txsi24', 'cmwosksb60001o2w9wqasni6u', 'gift', 'Fahad Mazhar sent you Dragon 🐉', 'Gross $20.00 · commission $6.00 · you earned $13.12 (test payment)', 'live', 'cmwoyk341000mo262s6nyft82', 0, '2026-11-20 12:32:37.309'),
  ('cmwoyqhhx0019o262ujthxgar', 'cmwoy3i0o0000o2dmli3fblmv', 'gift', 'Fahad Mazhar sent you Galaxy 🌌', 'Gross $99.00 · commission $29.70 · you earned $69.30', 'live', 'cmwoy6l4l0001o2ri05gnrg07', 0, '2026-11-20 12:36:15.765');
INSERT INTO `AdminSetting` (`key`, `value`, `updatedAt`) VALUES
  ('app', '{"splashEnabled":false}', '2026-11-20 09:50:02.006'),
  ('finance', '{"currency":"USD","platformCommission":30,"roomHostPercent":70,"paymentFeePercent":2.9,"paymentFeeFixed":0.3,"minWithdrawal":25,"withdrawalMethods":["bank"]}', '2026-11-20 09:53:17.996'),
  ('rooms', '{"maxSpeakers":5,"maxEntryFee":50,"allowPaidRooms":true}', '2026-11-20 09:53:17.999'),
  ('live', '{"maxViewers":25,"battleDurations":[60,120,180],"allowBattles":true}', '2026-11-20 09:53:18.000'),
  ('calls', '{"maxConferenceParticipants":5}', '2026-11-20 09:53:18.000'),
  ('ai', '{"provider":"zai","defaultModel":"default","dailyTextLimit":100,"dailyImageLimit":10,"dailyVoiceLimit":40,"voiceReplies":true,"imageGen":true}', '2026-11-20 09:53:18.002'),
  ('ads', '{"enabled":true,"placements":["chats","rooms","profile"]}', '2026-11-20 09:53:18.002'),
  ('payments', '{"provider":"sandbox","stripeSecretKey":"","stripeWebhookSecret":""}', '2026-11-20 09:53:18.004'),
  ('adminSetupCode', '"CALL-ADMIN-2024"', '2026-11-20 09:53:18.005');
INSERT INTO `AdPackage` (`id`, `name`, `description`, `priceUsd`, `durationDays`, `placements`, `minBudget`, `active`, `order`) VALUES
  ('cmwoswwy1000co2jlbe2eo5b7', 'Starter', '3-day campaign across one placement of your choice.', 5, 3, 'chats,rooms,profile', 0, 1, 1),
  ('cmwoswwy3000do2jla51jizca', 'Growth', '7-day campaign, best for reaching new audiences.', 15, 7, 'chats,rooms,profile', 10, 1, 2),
  ('cmwoswwy4000eo2jlhzlpsov4', 'Pro', '14-day campaign with priority rotation.', 40, 14, 'chats,rooms,profile', 25, 1, 3),
  ('cmwoswwy5000fo2jliiiwml5h', 'Premium', '30-day flagship campaign, maximum exposure.', 99, 30, 'chats,rooms,profile', 50, 1, 4);

COMMIT;

SET FOREIGN_KEY_CHECKS = 1;
