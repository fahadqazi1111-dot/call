-- ============================================================================
-- CALL — Gift catalog restore patch (NO DATA LOSS)
-- ============================================================================
-- What this does:
--   * Re-adds the full 12-gift catalog (Rose → Galaxy) to the `Gift` table.
--   * Existing gifts (e.g. Rose, Crown) are only UPDATED (emoji, image,
--     animation, order, active=1). Their IDs, prices and ALL GiftSend
--     history are left untouched — admins may have re-priced them.
--   * Missing gifts are INSERTed with `WHERE NOT EXISTS` — running this
--     file twice is safe (idempotent), nothing is duplicated.
--   * No table is dropped, no row is deleted. Users, wallets, coins,
--     messages, live rooms — everything else is untouched.
--
-- How to run: phpMyAdmin -> your CALL database -> SQL tab -> paste -> Go.
-- Verify afterwards with the SELECT at the bottom (expect 12 rows).
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- active flag
UPDATE `Gift` SET `active` = 1 WHERE `name` IN (
  'Rose','Flower','Heart','Bouquet','Crown','Race Car',
  'Rocket','Fireworks','Dragon','Lion','Magic Castle','Galaxy'
);

-- ------------------------------------------------- refresh existing catalog rows
-- (keeps priceUsd / priceCoins exactly as the admin configured them)
UPDATE `Gift` SET `emoji`='🌹', `animKind`='rose', `sound`='gift',
  `imageUrl`='/gifts/rose.png', `durationMs`=2200, `sortOrder`=1, `active`=1,
  `description`='Rose gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_rose","ios":"call_gift_rose"}'
  WHERE `name`='Rose';

UPDATE `Gift` SET `emoji`='🌺', `animKind`='flower', `sound`='gift',
  `imageUrl`='/gifts/rose.png', `durationMs`=2200, `sortOrder`=2, `active`=1,
  `description`='Flower gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_flower","ios":"call_gift_flower"}'
  WHERE `name`='Flower';

UPDATE `Gift` SET `emoji`='❤️', `animKind`='heart', `sound`='gift',
  `imageUrl`='/gifts/heart.png', `durationMs`=2200, `sortOrder`=3, `active`=1,
  `description`='Heart gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_heart","ios":"call_gift_heart"}'
  WHERE `name`='Heart';

UPDATE `Gift` SET `emoji`='💐', `animKind`='flower', `sound`='gift',
  `imageUrl`='/gifts/rose.png', `durationMs`=2600, `sortOrder`=4, `active`=1,
  `description`='Bouquet gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_flower","ios":"call_gift_flower"}'
  WHERE `name`='Bouquet';

UPDATE `Gift` SET `emoji`='👑', `animKind`='crown', `sound`='gift',
  `imageUrl`='/gifts/crown.png', `durationMs`=2800, `sortOrder`=5, `active`=1,
  `description`='Crown gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_crown","ios":"call_gift_crown"}'
  WHERE `name`='Crown';

UPDATE `Gift` SET `emoji`='🏎️', `animKind`='car', `sound`='gift',
  `imageUrl`='/gifts/car.png', `durationMs`=3200, `sortOrder`=6, `active`=1,
  `description`='Race Car gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_car","ios":"call_gift_car"}'
  WHERE `name`='Race Car';

UPDATE `Gift` SET `emoji`='🚀', `animKind`='rocket', `sound`='gift_big',
  `imageUrl`='/gifts/rocket.png', `durationMs`=3500, `sortOrder`=7, `active`=1,
  `description`='Rocket gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_rocket","ios":"call_gift_rocket"}'
  WHERE `name`='Rocket';

UPDATE `Gift` SET `emoji`='🎆', `animKind`='fireworks', `sound`='gift_big',
  `imageUrl`='/gifts/fireworks.png', `durationMs`=4000, `sortOrder`=8, `active`=1,
  `description`='Fireworks gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_fireworks","ios":"call_gift_fireworks"}'
  WHERE `name`='Fireworks';

UPDATE `Gift` SET `emoji`='🐉', `animKind`='dragon', `sound`='gift_big',
  `imageUrl`='/gifts/dragon.png', `durationMs`=4000, `sortOrder`=9, `active`=1,
  `description`='Dragon gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_dragon","ios":"call_gift_dragon"}'
  WHERE `name`='Dragon';

UPDATE `Gift` SET `emoji`='🦁', `animKind`='lion', `sound`='gift_big',
  `imageUrl`='/gifts/lion.png', `durationMs`=4200, `sortOrder`=10, `active`=1,
  `description`='Lion gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_lion","ios":"call_gift_lion"}'
  WHERE `name`='Lion';

UPDATE `Gift` SET `emoji`='🏰', `animKind`='castle', `sound`='gift_big',
  `imageUrl`='/gifts/castle.png', `durationMs`=5000, `sortOrder`=11, `active`=1,
  `description`='Magic Castle gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_castle","ios":"call_gift_castle"}'
  WHERE `name`='Magic Castle';

UPDATE `Gift` SET `emoji`='🌌', `animKind`='superlion', `sound`='gift_big',
  `imageUrl`='/gifts/galaxy.png', `durationMs`=5200, `sortOrder`=12, `active`=1,
  `description`='Galaxy gift — delivered with a real-time animation.',
  `platformMap`='{"android":"call_gift_superlion","ios":"call_gift_superlion"}'
  WHERE `name`='Galaxy';

-- ----------------------------------------------------- insert missing gifts
-- priceCoins = priceUsd * 100 (coinsPerUsd = 100, getCoinSettings default)

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_flower','Flower','🌺','/gifts/rose.png','Flower gift — delivered with a real-time animation.','flower','gift','both',1.0,100,'USD','{"android":"call_gift_flower","ios":"call_gift_flower"}',2200,1,2
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Flower');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_heart','Heart','❤️','/gifts/heart.png','Heart gift — delivered with a real-time animation.','heart','gift','both',1.5,150,'USD','{"android":"call_gift_heart","ios":"call_gift_heart"}',2200,1,3
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Heart');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_bouquet','Bouquet','💐','/gifts/rose.png','Bouquet gift — delivered with a real-time animation.','flower','gift','both',2.5,250,'USD','{"android":"call_gift_flower","ios":"call_gift_flower"}',2600,1,4
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Bouquet');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_racecar','Race Car','🏎️','/gifts/car.png','Race Car gift — delivered with a real-time animation.','car','gift','both',8.0,800,'USD','{"android":"call_gift_car","ios":"call_gift_car"}',3200,1,6
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Race Car');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_rocket','Rocket','🚀','/gifts/rocket.png','Rocket gift — delivered with a real-time animation.','rocket','gift_big','both',10.0,1000,'USD','{"android":"call_gift_rocket","ios":"call_gift_rocket"}',3500,1,7
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Rocket');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_fireworks','Fireworks','🎆','/gifts/fireworks.png','Fireworks gift — delivered with a real-time animation.','fireworks','gift_big','both',15.0,1500,'USD','{"android":"call_gift_fireworks","ios":"call_gift_fireworks"}',4000,1,8
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Fireworks');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_dragon','Dragon','🐉','/gifts/dragon.png','Dragon gift — delivered with a real-time animation.','dragon','gift_big','both',20.0,2000,'USD','{"android":"call_gift_dragon","ios":"call_gift_dragon"}',4000,1,9
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Dragon');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_lion','Lion','🦁','/gifts/lion.png','Lion gift — delivered with a real-time animation.','lion','gift_big','both',30.0,3000,'USD','{"android":"call_gift_lion","ios":"call_gift_lion"}',4200,1,10
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Lion');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_castle','Magic Castle','🏰','/gifts/castle.png','Magic Castle gift — delivered with a real-time animation.','castle','gift_big','both',50.0,5000,'USD','{"android":"call_gift_castle","ios":"call_gift_castle"}',5000,1,11
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Magic Castle');

INSERT INTO `Gift` (`id`,`name`,`emoji`,`imageUrl`,`description`,`animKind`,`sound`,`category`,`priceUsd`,`priceCoins`,`currency`,`platformMap`,`durationMs`,`active`,`sortOrder`)
SELECT 'gift_galaxy','Galaxy','🌌','/gifts/galaxy.png','Galaxy gift — delivered with a real-time animation.','superlion','gift_big','both',99.0,9900,'USD','{"android":"call_gift_superlion","ios":"call_gift_superlion"}',5200,1,12
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `Gift` WHERE `name`='Galaxy');

-- ------------------------------------------------------------- verify (12 rows)
SELECT `sortOrder`, `emoji`, `name`, `priceUsd`, `priceCoins`, `active`
FROM `Gift` ORDER BY `sortOrder` ASC, `name` ASC;
