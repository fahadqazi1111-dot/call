-- ============================================================
-- CALL — full MySQL dump (schema + data) for phpMyAdmin import
-- Generated 2026-11-20T21:45:33.442Z
-- All DateTime values are UTC.
-- ============================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- Drop existing tables (re-import safe)
DROP TABLE IF EXISTS `User`, `Otp`, `EmailOtp`, `Contact`, `Conversation`, `Message`, `MessageHide`, `ConversationState`, `UserBlock`, `UserReport`, `Call`, `Wallet`, `LedgerEntry`, `CoinWallet`, `CoinLedgerEntry`, `Payment`, `Gift`, `GiftSend`, `BankAccount`, `Withdrawal`, `Story`, `StoryView`, `StoryReaction`, `VoiceRoom`, `RoomParticipant`, `RoomMessage`, `LiveSession`, `LiveComment`, `Battle`, `BattleParticipant`, `Group`, `GroupMember`, `GroupMessage`, `Notification`, `AiConversation`, `AiMessage`, `AiUsage`, `AdminSetting`, `AdPackage`, `Ad`, `AdEvent`, `Broadcast`, `BroadcastDelivery`;

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
    `senderId` VARCHAR(191) NOT NULL,
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
    `reporterId` VARCHAR(191) NOT NULL,
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
CREATE TABLE `CoinWallet` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `coins` INTEGER NOT NULL DEFAULT 0,
    `totalPurchased` INTEGER NOT NULL DEFAULT 0,
    `totalConverted` INTEGER NOT NULL DEFAULT 0,
    `totalSpent` INTEGER NOT NULL DEFAULT 0,
    `totalReceived` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoinWallet_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoinLedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` TEXT NOT NULL,
    `direction` TEXT NOT NULL,
    `amount` INTEGER NOT NULL,
    `coinsAfter` INTEGER NOT NULL,
    `refType` TEXT NULL,
    `refId` TEXT NULL,
    `note` TEXT NOT NULL DEFAULT '',
    `idempotencyKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CoinLedgerEntry_idempotencyKey_key`(`idempotencyKey`),
    INDEX `CoinLedgerEntry_userId_createdAt_idx`(`userId`, `createdAt`),
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
    `priceCoins` INTEGER NOT NULL DEFAULT 0,
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
    `giftId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `context` TEXT NOT NULL,
    `roomId` VARCHAR(191) NULL,
    `liveId` VARCHAR(191) NULL,
    `battleId` TEXT NULL,
    `battleSide` INTEGER NULL,
    `grossAmount` DOUBLE NOT NULL,
    `grossCoins` INTEGER NOT NULL DEFAULT 0,
    `commission` DOUBLE NOT NULL DEFAULT 0,
    `feeAmount` DOUBLE NOT NULL DEFAULT 0,
    `netAmount` DOUBLE NOT NULL DEFAULT 0,
    `currency` TEXT NOT NULL DEFAULT 'USD',
    `paymentMethod` TEXT NOT NULL DEFAULT 'card',
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
    `hostId` VARCHAR(191) NOT NULL,
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
    `hostId` VARCHAR(191) NOT NULL,
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
    `ownerId` VARCHAR(191) NOT NULL,
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
    `senderId` VARCHAR(191) NOT NULL,
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
    `packageId` VARCHAR(191) NULL,
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
    `senderId` VARCHAR(191) NOT NULL,
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

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- ============================================================
-- DATA
-- ============================================================

START TRANSACTION;

INSERT INTO `User` (`id`, `phone`, `email`, `emailVerified`, `passwordHash`, `googleId`, `role`, `isOfficial`, `blocked`, `name`, `username`, `usernameChangedAt`, `about`, `avatarKey`, `avatarUrl`, `allowNonContacts`, `createdAt`, `lastSeen`) VALUES
  ('cmwpeu4id0000r4vnatu9kolf', '0000000002', 'fahadqazi1111@gmail.com', 1, 'scrypt:b73fd6fefcf440feee0f45e68ebdb7dd:af7ba56866d825fd75613df6b4f38f9c95dd237dc03ce68449c69332f62a07c1', NULL, 'admin', 0, 0, 'Fahad Mazhar', 'fahadqazi', NULL, 'Available on CALL', 0, NULL, 0, '2026-11-20 20:06:59.414', '2026-11-20 21:43:53.368'),
  ('cmwpeury80003r4vnogm78ykk', '0309306009', 'test2a@example.com', 0, 'scrypt:93763f2ab089f8a984562ffbcc9e7349:8e3802f5a5c3f2d5577b8e22716b5d8ab2edb64efeddcfcfc5e8c1fd62a9adf7', NULL, 'user', 0, 0, 'Test User 2A', 'testuser2a', NULL, 'Available on CALL', 4, NULL, 0, '2026-11-20 20:07:29.793', '2026-11-20 20:07:29.793'),
  ('cmwpeuryh0006r4vnugwqnwr2', '0000000000', 'official@call.app', 0, NULL, NULL, 'user', 1, 0, 'CALL', 'official', NULL, 'The official CALL account. Messages from the CALL team are sent from here.', 0, NULL, 0, '2026-11-20 20:07:29.801', '2026-11-20 20:07:29.801'),
  ('cmwpfgjcw000kr4vn0tco3tb6', '923001234567', 'test@example.com', 1, 'scrypt:c2169b025d0cfc1043557e3c53db11d1:209fbc87121b00936b2e0802c352042a908e7202c8e5eb9128e178201130cdbc', NULL, 'user', 0, 0, 'Test User', 'testuser', NULL, 'Available on CALL', 6, NULL, 0, '2026-11-20 20:24:25.089', '2026-11-20 20:24:25.089'),
  ('cmwpgeywq000xr4vndvbk1ri6', '923009993909', 'test.google.534790@example.com', 1, NULL, 'google-sub-124957151', 'user', 0, 0, 'Google Tester', 'googletester', NULL, 'Available on CALL', 3, NULL, 0, '2026-11-20 20:51:11.546', '2026-11-20 20:51:11.546'),
  ('cmwph1l3k0017r4vnj727yf8y', '3009998888', 'gtest_1795208926712@gmail.com', 1, NULL, 'gflow_1795208926712', 'user', 0, 0, 'Google Flow', 'googleflow', NULL, 'Available on CALL', 6, NULL, 0, '2026-11-20 21:08:46.736', '2026-11-20 21:08:46.736');
INSERT INTO `Otp` (`id`, `phone`, `code`, `expiresAt`, `consumed`, `createdAt`) VALUES
  ('cmwpfg73h000ir4vnre77umc2', '923001234567', '935785', '2026-11-20 20:29:09.196', 1, '2026-11-20 20:24:09.197'),
  ('cmwpfhf4i000sr4vnu0avqwc4', '92300555444333', '203048', '2026-11-20 20:30:06.258', 0, '2026-11-20 20:25:06.259'),
  ('cmwpfnzao000tr4vn7lpe4a46', '923001234567', '474560', '2026-11-20 20:35:12.336', 1, '2026-11-20 20:30:12.337'),
  ('cmwpgeken000ur4vn2c0eulri', '923009990839', '366013', '2026-11-20 20:55:52.751', 0, '2026-11-20 20:50:52.751'),
  ('cmwpgeoz2000vr4vnb1toq81m', '923009999987', '408255', '2026-11-20 20:55:58.669', 1, '2026-11-20 20:50:58.670'),
  ('cmwpgeyot000wr4vngfhokmen', '923009993909', '346156', '2026-11-20 20:56:11.260', 1, '2026-11-20 20:51:11.261'),
  ('cmwpggwi90015r4vnnkt338ge', '923009995043', '527415', '2026-11-20 20:57:41.745', 0, '2026-11-20 20:52:41.746'),
  ('cmwph1kuo0016r4vnlehh3wqn', '3009998888', '220793', '2026-11-20 21:13:46.415', 1, '2026-11-20 21:08:46.416');
INSERT INTO `EmailOtp` (`id`, `email`, `code`, `purpose`, `expiresAt`, `consumed`, `createdAt`) VALUES
  ('cmwpfgbxs000jr4vnxsx11lz4', 'test@example.com', '750567', 'verify', '2026-11-20 20:34:15.471', 1, '2026-11-20 20:24:15.472');
INSERT INTO `Contact` (`id`, `ownerId`, `name`, `phone`, `createdAt`) VALUES
  ('cmwpev7fo000hr4vn6ncxans9', 'cmwpeu4id0000r4vnatu9kolf', 'Test User 2A', '0309306009', '2026-11-20 20:07:49.861');
INSERT INTO `Conversation` (`id`, `userAId`, `userBId`, `lastMessageAt`) VALUES
  ('cmwpeuryi0008r4vnfa03uzmq', 'cmwpeury80003r4vnogm78ykk', 'cmwpeuryh0006r4vnugwqnwr2', '2026-11-20 20:07:29.805'),
  ('cmwpfgjd7000or4vnicnqmss4', 'cmwpeuryh0006r4vnugwqnwr2', 'cmwpfgjcw000kr4vn0tco3tb6', '2026-11-20 20:24:25.101'),
  ('cmwpgeyx00011r4vnzbsilrba', 'cmwpeuryh0006r4vnugwqnwr2', 'cmwpgeywq000xr4vndvbk1ri6', '2026-11-20 20:51:11.559'),
  ('cmwph1l3r001br4vn2wdxjakz', 'cmwpeuryh0006r4vnugwqnwr2', 'cmwph1l3k0017r4vnj727yf8y', '2026-11-20 21:08:46.745');
INSERT INTO `Message` (`id`, `conversationId`, `senderId`, `type`, `content`, `duration`, `createdAt`, `deliveredAt`, `readAt`, `deletedAt`, `forwarded`) VALUES
  ('cmwpeuryk000ar4vnw7dhcl68', 'cmwpeuryi0008r4vnfa03uzmq', 'cmwpeuryh0006r4vnugwqnwr2', 'text', 'Welcome to CALL, Test! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.', NULL, '2026-11-20 20:07:29.805', NULL, NULL, NULL, 0),
  ('cmwpfgjd9000qr4vnsqcqximc', 'cmwpfgjd7000or4vnicnqmss4', 'cmwpeuryh0006r4vnugwqnwr2', 'text', 'Welcome to CALL, Test! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.', NULL, '2026-11-20 20:24:25.101', NULL, NULL, NULL, 0),
  ('cmwpgeyx30013r4vnsvnbnlw5', 'cmwpgeyx00011r4vnzbsilrba', 'cmwpeuryh0006r4vnugwqnwr2', 'text', 'Welcome to CALL, Google! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.', NULL, '2026-11-20 20:51:11.559', NULL, NULL, NULL, 0),
  ('cmwph1l3s001dr4vnruvushfq', 'cmwph1l3r001br4vn2wdxjakz', 'cmwpeuryh0006r4vnugwqnwr2', 'text', 'Welcome to CALL, Google! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video calls. If you ever need help, this official account is where the CALL team will reach you.', NULL, '2026-11-20 21:08:46.745', NULL, NULL, NULL, 0);
INSERT INTO `Wallet` (`id`, `userId`, `available`, `reserved`, `totalReceived`, `totalEarned`, `totalWithdrawn`, `updatedAt`) VALUES
  ('cmwpeu4jm0002r4vnnrggd9b6', 'cmwpeu4id0000r4vnatu9kolf', 0, 0, 0, 0, 0, '2026-11-20 20:06:59.458'),
  ('cmwpeurya0005r4vnf5d6bu5b', 'cmwpeury80003r4vnogm78ykk', 0, 0, 0, 0, 0, '2026-11-20 20:07:29.795'),
  ('cmwpfgjcz000mr4vn19uil1g8', 'cmwpfgjcw000kr4vn0tco3tb6', 0, 0, 0, 0, 0, '2026-11-20 20:24:25.091'),
  ('cmwpgeywt000zr4vnln92ngvb', 'cmwpgeywq000xr4vndvbk1ri6', 0, 0, 0, 0, 0, '2026-11-20 20:51:11.549'),
  ('cmwph1l3m0019r4vns1s5r4js', 'cmwph1l3k0017r4vnj727yf8y', 0, 0, 0, 0, 0, '2026-11-20 21:08:46.739');
INSERT INTO `Notification` (`id`, `userId`, `kind`, `title`, `body`, `refType`, `refId`, `read`, `createdAt`) VALUES
  ('cmwpeuryn000br4vnbziyh779', 'cmwpeury80003r4vnogm78ykk', 'message', 'CALL', 'Welcome to CALL, Test! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video c', 'chat', 'cmwpeuryh0006r4vnugwqnwr2', 0, '2026-11-20 20:07:29.807'),
  ('cmwpfgjdd000rr4vnn1c259is', 'cmwpfgjcw000kr4vn0tco3tb6', 'message', 'CALL', 'Welcome to CALL, Test! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video c', 'chat', 'cmwpeuryh0006r4vnugwqnwr2', 0, '2026-11-20 20:24:25.105'),
  ('cmwpgeyx50014r4vnmhftimf6', 'cmwpgeywq000xr4vndvbk1ri6', 'message', 'CALL', 'Welcome to CALL, Google! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video', 'chat', 'cmwpeuryh0006r4vnugwqnwr2', 0, '2026-11-20 20:51:11.562'),
  ('cmwph1l3v001er4vni0ujui4l', 'cmwph1l3k0017r4vnj727yf8y', 'message', 'CALL', 'Welcome to CALL, Google! Your account is ready and calling is completely free. Add contacts, start chats and enjoy unlimited voice and video', 'chat', 'cmwpeuryh0006r4vnugwqnwr2', 0, '2026-11-20 21:08:46.747');
INSERT INTO `AdminSetting` (`key`, `value`, `updatedAt`) VALUES
  ('otp', '{"smsProvider":"twilio","twilioAccountSid":"AC123","twilioAuthToken":"secrettoken123","twilioFromNumber":"+15555555555","whatsappApiKey":"EAAGnew"}', '2026-11-20 20:24:51.241');
INSERT INTO `CoinWallet` (`id`, `userId`, `coins`, `totalPurchased`, `totalConverted`, `totalSpent`, `totalReceived`, `updatedAt`) VALUES
  ('cmwpibidj0001r42wmjkoewy6', 'cmwpeu4id0000r4vnatu9kolf', 0, 0, 0, 0, 0, '2026-11-20 21:44:29.383');
INSERT INTO `Gift` (`id`, `name`, `emoji`, `imageUrl`, `description`, `animKind`, `sound`, `category`, `priceUsd`, `priceCoins`, `currency`, `platformMap`, `durationMs`, `active`, `sortOrder`) VALUES
  ('cmwpicb1c0000r46mc8c8jl8w', 'Rose', '🌹', NULL, '', 'rose', 'gift', 'both', 0.99, 100, 'USD', '{"android":null,"ios":null}', 2200, 1, 99),
  ('cmwpicb220001r46mv6197jxh', 'Crown', '👑', NULL, '', 'crown', 'gift', 'both', 9.99, 1000, 'USD', '{"android":null,"ios":null}', 2200, 1, 99);

COMMIT;

SET FOREIGN_KEY_CHECKS = 1;
