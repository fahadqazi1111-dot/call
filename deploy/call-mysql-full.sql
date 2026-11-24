-- ============================================================
-- CALL — full MySQL dump (schema + data) for phpMyAdmin import
-- Generated 2026-11-24T02:55:44.308Z
-- All DateTime values are UTC.
-- ============================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- Drop existing tables (re-import safe)
DROP TABLE IF EXISTS `User`, `Otp`, `EmailOtp`, `Contact`, `Conversation`, `Message`, `MessageHide`, `ConversationState`, `UserBlock`, `UserReport`, `Call`, `Wallet`, `LedgerEntry`, `CoinWallet`, `CoinLedgerEntry`, `Payment`, `Gift`, `GiftSend`, `BankAccount`, `Withdrawal`, `Story`, `StoryView`, `StoryReaction`, `VoiceRoom`, `RoomParticipant`, `RoomMessage`, `LiveSession`, `LiveComment`, `Battle`, `BattleParticipant`, `Group`, `GroupMember`, `GroupMessage`, `Notification`, `DeviceToken`, `AiConversation`, `AiMessage`, `AiUsage`, `AdminSetting`, `AdPackage`, `Ad`, `AdEvent`, `Broadcast`, `BroadcastDelivery`;

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
CREATE TABLE `DeviceToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `platform` TEXT NOT NULL DEFAULT 'web',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsed` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DeviceToken_token_key`(`token`),
    INDEX `DeviceToken_userId_idx`(`userId`),
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

-- AddForeignKey

-- ============================================================
-- DATA
-- ============================================================

START TRANSACTION;

INSERT INTO `User` (`id`, `phone`, `email`, `emailVerified`, `passwordHash`, `googleId`, `role`, `isOfficial`, `blocked`, `name`, `username`, `usernameChangedAt`, `about`, `avatarKey`, `avatarUrl`, `allowNonContacts`, `createdAt`, `lastSeen`) VALUES
  ('cmwtzu3g50000n7xfg2r02vgc', '923332560178', 'fahadqazi1111@gmail.com', 1, 'scrypt:9bc7fb58a8237a126eff592fe0488d17:32986ca92a466816144cc732eedd83d00f6bf339b78b2a796d32ca0774140c8c', NULL, 'admin', 0, 0, 'Fahad Mazhar', 'fahadqazi', NULL, 'Available on CALL', 0, NULL, 0, '2026-11-24 01:05:54.678', '2026-11-24 02:01:00.645'),
  ('cmwu0aszy0009n7xfhsw02ora', '0000000000', 'official@call.app', 0, NULL, NULL, 'user', 1, 0, 'CALL', 'official', NULL, 'The official CALL account. Messages from the CALL team are sent from here.', 0, NULL, 0, '2026-11-24 01:18:54.287', '2026-11-24 01:18:54.287');
INSERT INTO `Otp` (`id`, `phone`, `code`, `expiresAt`, `consumed`, `createdAt`) VALUES
  ('cmwu1wuqo001an7xfbs8gogte', '920000000002', '923885', '2026-11-24 02:09:02.591', 1, '2026-11-24 02:04:02.592'),
  ('cmwu1x67l001bn7xfc20rl8qy', '923332560178', '800813', '2026-11-24 02:09:17.456', 1, '2026-11-24 02:04:17.457');
INSERT INTO `Wallet` (`id`, `userId`, `available`, `reserved`, `totalReceived`, `totalEarned`, `totalWithdrawn`, `updatedAt`) VALUES
  ('cmwtzu3hb0002n7xf986h3ysf', 'cmwtzu3g50000n7xfg2r02vgc', 0, 0, 0, 0, 0, '2026-11-24 01:05:54.719');
INSERT INTO `CoinWallet` (`id`, `userId`, `coins`, `totalPurchased`, `totalConverted`, `totalSpent`, `totalReceived`, `updatedAt`) VALUES
  ('cmwtzu48o0004n7xfo0qfvwrb', 'cmwtzu3g50000n7xfg2r02vgc', 0, 0, 0, 0, 0, '2026-11-24 01:05:55.705');
INSERT INTO `VoiceRoom` (`id`, `hostId`, `title`, `description`, `coverUrl`, `isPaid`, `entryFee`, `status`, `createdAt`, `endedAt`) VALUES
  ('cmwtzug490006n7xfq5s3o5pd', 'cmwtzu3g50000n7xfg2r02vgc', 'dd', '', NULL, 0, 0, 'ended', '2026-11-24 01:06:11.097', '2026-11-24 01:06:28.454'),
  ('cmwu10v2j000bn7xfwvwifnut', 'cmwtzu3g50000n7xfg2r02vgc', 'TESTFLOW-1795484350013', '', NULL, 0, 0, 'ended', '2026-11-24 01:39:10.027', '2026-11-24 02:06:24.747'),
  ('cmwu13hks000fn7xftns9yfaz', 'cmwtzu3g50000n7xfg2r02vgc', 'TESTFLOW-1795484472496', '', NULL, 0, 0, 'live', '2026-11-24 01:41:12.508', NULL);
INSERT INTO `RoomParticipant` (`id`, `roomId`, `userId`, `role`, `muted`, `handRaised`, `stageInvite`, `invitedAt`, `blocked`, `entryPaid`, `joinedAt`, `leftAt`) VALUES
  ('cmwtzug4b0008n7xf08t01dx9', 'cmwtzug490006n7xfq5s3o5pd', 'cmwtzu3g50000n7xfg2r02vgc', 'host', 0, 0, 0, NULL, 0, 0, '2026-11-24 01:06:11.100', '2026-11-24 01:06:23.073'),
  ('cmwu10v2k000dn7xf6r8uan66', 'cmwu10v2j000bn7xfwvwifnut', 'cmwtzu3g50000n7xfg2r02vgc', 'host', 0, 0, 0, NULL, 0, 1, '2026-11-24 01:39:10.029', '2026-11-24 02:06:24.749'),
  ('cmwu13hkt000hn7xfkqoq63i5', 'cmwu13hks000fn7xftns9yfaz', 'cmwtzu3g50000n7xfg2r02vgc', 'host', 0, 0, 0, NULL, 0, 0, '2026-11-24 01:41:12.509', NULL);
INSERT INTO `AiConversation` (`id`, `userId`, `title`, `createdAt`, `updatedAt`) VALUES
  ('cmwu1w4kh0013n7xfkpx6xu0j', 'cmwtzu3g50000n7xfg2r02vgc', 'hi', '2026-11-24 02:03:28.674', '2026-11-24 02:03:28.674'),
  ('cmwu1w8ck0017n7xfn7kxtolj', 'cmwtzu3g50000n7xfg2r02vgc', 'hi', '2026-11-24 02:03:33.572', '2026-11-24 02:03:33.572');
INSERT INTO `AiUsage` (`id`, `userId`, `day`, `textCount`, `imageCount`, `voiceCount`, `updatedAt`) VALUES
  ('cmwu1w4kd0012n7xfh44amqay', 'cmwtzu3g50000n7xfg2r02vgc', '2026-11-24', 0, 0, 0, '2026-11-24 02:03:28.670');

COMMIT;

SET FOREIGN_KEY_CHECKS = 1;
