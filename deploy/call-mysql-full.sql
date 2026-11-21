-- ============================================================
-- CALL — full MySQL dump (schema + data) for phpMyAdmin import
-- Generated 2026-11-21T11:12:35.947Z
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
  ('cmwqb6d65000gkkfkb1f8g4vb', '0000000001', 'admin@call.app', 1, 'scrypt:db2f17b19beb3695abd06af793cb76e2:3702af69f4ad1b4287378d53c4070c27ea54ed498ffec4c32fb45b1c8b462a99', NULL, 'admin', 0, 0, 'CALL Admin', 'calladmin', NULL, 'Available on CALL', 0, NULL, 0, '2026-11-21 11:12:18.221', '2026-11-21 11:12:18.221'),
  ('cmwqb6d72000hkkfkb51r0t2x', '0000000002', 'fahadqazi1111@gmail.com', 1, 'scrypt:7803cc4453dd68bdd470b0982b9d0f49:b98cea9c3539a0fb287eee67aa306fe26627c8f3048818ebfc74a81e25f71094', NULL, 'admin', 0, 0, 'Fahad Mazhar', 'fahadqazi', NULL, 'Available on CALL', 0, NULL, 0, '2026-11-21 11:12:18.254', '2026-11-21 11:12:18.254');
INSERT INTO `AdminSetting` (`key`, `value`, `updatedAt`) VALUES
  ('finance', '{"currency":"USD","platformCommission":30,"roomHostPercent":70,"paymentFeePercent":2.9,"paymentFeeFixed":0.3,"minWithdrawal":25,"withdrawalMethods":["bank"]}', '2026-11-21 11:12:18.148'),
  ('rooms', '{"maxSpeakers":5,"maxEntryFee":50,"allowPaidRooms":true}', '2026-11-21 11:12:18.150'),
  ('live', '{"maxViewers":25,"battleDurations":[60,120,180],"allowBattles":true}', '2026-11-21 11:12:18.151'),
  ('calls', '{"maxConferenceParticipants":5}', '2026-11-21 11:12:18.152'),
  ('ai', '{"provider":"zai","defaultModel":"default","dailyTextLimit":100,"dailyImageLimit":10,"dailyVoiceLimit":40,"voiceReplies":true,"imageGen":true}', '2026-11-21 11:12:18.152'),
  ('ads', '{"enabled":true,"placements":["chats","rooms","profile"]}', '2026-11-21 11:12:18.153'),
  ('payments', '{"provider":"sandbox","stripeSecretKey":"","stripeWebhookSecret":""}', '2026-11-21 11:12:18.154'),
  ('adminSetupCode', '"CALL-ADMIN-2024"', '2026-11-21 11:12:18.155');
INSERT INTO `AdPackage` (`id`, `name`, `description`, `priceUsd`, `durationDays`, `placements`, `minBudget`, `active`, `order`) VALUES
  ('cmwqb6d4v000ckkfky739ogud', 'Starter', '3-day campaign across one placement of your choice.', 5, 3, 'chats,rooms,profile', 0, 1, 1),
  ('cmwqb6d4x000dkkfk6rx7u4kv', 'Growth', '7-day campaign, best for reaching new audiences.', 15, 7, 'chats,rooms,profile', 10, 1, 2),
  ('cmwqb6d4y000ekkfks7hlhfux', 'Pro', '14-day campaign with priority rotation.', 40, 14, 'chats,rooms,profile', 25, 1, 3),
  ('cmwqb6d50000fkkfkjvktop20', 'Premium', '30-day flagship campaign, maximum exposure.', 99, 30, 'chats,rooms,profile', 50, 1, 4);
INSERT INTO `Gift` (`id`, `name`, `emoji`, `imageUrl`, `description`, `animKind`, `sound`, `category`, `priceUsd`, `priceCoins`, `currency`, `platformMap`, `durationMs`, `active`, `sortOrder`) VALUES
  ('cmwqb6d4c0000kkfk07o3zlgw', 'Rose', '🌹', '/gifts/rose.png', 'Rose gift — delivered with a real-time animation.', 'rose', 'gift', 'both', 0.6, 60, 'USD', '{"android":"call_gift_rose","ios":"call_gift_rose"}', 2200, 1, 1),
  ('cmwqb6d4e0001kkfke0qn7lwb', 'Flower', '🌺', '/gifts/rose.png', 'Flower gift — delivered with a real-time animation.', 'flower', 'gift', 'both', 1, 100, 'USD', '{"android":"call_gift_flower","ios":"call_gift_flower"}', 2200, 1, 2),
  ('cmwqb6d4f0002kkfkma3kitf9', 'Heart', '❤️', '/gifts/heart.png', 'Heart gift — delivered with a real-time animation.', 'heart', 'gift', 'both', 1.5, 150, 'USD', '{"android":"call_gift_heart","ios":"call_gift_heart"}', 2200, 1, 3),
  ('cmwqb6d4g0003kkfkpm6jkk6h', 'Bouquet', '💐', '/gifts/rose.png', 'Bouquet gift — delivered with a real-time animation.', 'flower', 'gift', 'both', 2.5, 250, 'USD', '{"android":"call_gift_flower","ios":"call_gift_flower"}', 2600, 1, 4),
  ('cmwqb6d4i0004kkfk8htk0xpj', 'Crown', '👑', '/gifts/crown.png', 'Crown gift — delivered with a real-time animation.', 'crown', 'gift', 'both', 5, 500, 'USD', '{"android":"call_gift_crown","ios":"call_gift_crown"}', 2800, 1, 5),
  ('cmwqb6d4l0005kkfktrbpmqz1', 'Race Car', '🏎️', '/gifts/car.png', 'Race Car gift — delivered with a real-time animation.', 'car', 'gift', 'both', 8, 800, 'USD', '{"android":"call_gift_car","ios":"call_gift_car"}', 3200, 1, 6),
  ('cmwqb6d4n0006kkfk2hselmd9', 'Rocket', '🚀', '/gifts/rocket.png', 'Rocket gift — delivered with a real-time animation.', 'rocket', 'gift_big', 'both', 10, 1000, 'USD', '{"android":"call_gift_rocket","ios":"call_gift_rocket"}', 3500, 1, 7),
  ('cmwqb6d4o0007kkfk0mde47j8', 'Fireworks', '🎆', '/gifts/fireworks.png', 'Fireworks gift — delivered with a real-time animation.', 'fireworks', 'gift_big', 'both', 15, 1500, 'USD', '{"android":"call_gift_fireworks","ios":"call_gift_fireworks"}', 4000, 1, 8),
  ('cmwqb6d4q0008kkfkgu9zu5d4', 'Dragon', '🐉', '/gifts/dragon.png', 'Dragon gift — delivered with a real-time animation.', 'dragon', 'gift_big', 'both', 20, 2000, 'USD', '{"android":"call_gift_dragon","ios":"call_gift_dragon"}', 4000, 1, 9),
  ('cmwqb6d4r0009kkfkgdoala1v', 'Lion', '🦁', '/gifts/lion.png', 'Lion gift — delivered with a real-time animation.', 'lion', 'gift_big', 'both', 30, 3000, 'USD', '{"android":"call_gift_lion","ios":"call_gift_lion"}', 4200, 1, 10),
  ('cmwqb6d4s000akkfkeuvo4kbj', 'Magic Castle', '🏰', '/gifts/castle.png', 'Magic Castle gift — delivered with a real-time animation.', 'castle', 'gift_big', 'both', 50, 5000, 'USD', '{"android":"call_gift_castle","ios":"call_gift_castle"}', 5000, 1, 11),
  ('cmwqb6d4t000bkkfkhcxg3i1l', 'Galaxy', '🌌', '/gifts/galaxy.png', 'Galaxy gift — delivered with a real-time animation.', 'superlion', 'gift_big', 'both', 99, 9900, 'USD', '{"android":"call_gift_superlion","ios":"call_gift_superlion"}', 5200, 1, 12);

COMMIT;

SET FOREIGN_KEY_CHECKS = 1;
