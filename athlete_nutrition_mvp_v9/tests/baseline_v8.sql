-- Professional Athlete Nutrition Management Platform - MVP v8
-- Generated from athlete_nutrition_erd.dbml.
-- Target: MariaDB / InnoDB / utf8mb4.
-- Store datetime(6) values in UTC.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE `Organization` (
  `organization_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(150) NOT NULL UNIQUE,
  `status` varchar(30) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  CONSTRAINT `chk_organization_status` CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Account` (
  `account_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(30) NOT NULL,
  `status` varchar(30) NOT NULL,
  `last_login_at` datetime(6),
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  KEY `idx_account_organization_id` (`organization_id`),
  KEY `idx_account_email` (`email`),
  CONSTRAINT `chk_account_role` CHECK (role IN ('athlete', 'nutritionist', 'coach', 'admin')),
  CONSTRAINT `chk_account_status` CHECK (status IN ('active', 'suspended', 'disabled')),
  CONSTRAINT `chk_account_organization_required` CHECK (role = 'admin' OR organization_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Athlete` (
  `athlete_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `account_id` bigint NOT NULL UNIQUE,
  `name` varchar(100) NOT NULL,
  `birth_date` date,
  `gender` varchar(30),
  `weight_kg` decimal(6,2),
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  CONSTRAINT `chk_athlete_weight_positive` CHECK (weight_kg IS NULL OR weight_kg > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Nutritionist` (
  `nutritionist_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `account_id` bigint NOT NULL UNIQUE,
  `name` varchar(100) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Coach` (
  `coach_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `account_id` bigint NOT NULL UNIQUE,
  `name` varchar(100) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AthleteCoach` (
  `athlete_coach_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `athlete_id` bigint NOT NULL,
  `coach_id` bigint NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date,
  KEY `idx_athletecoach_coach_id` (`coach_id`),
  UNIQUE KEY `uq_athletecoach_athlete_id_coach_id_start_date` (`athlete_id`, `coach_id`, `start_date`),
  CONSTRAINT `chk_athlete_coach_dates` CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Food` (
  `food_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint,
  `food_name` varchar(150) NOT NULL,
  `brand` varchar(150),
  `food_type` varchar(100),
  `description` text,
  `source` varchar(100),
  `source_food_code` varchar(100),
  `density_g_per_ml` decimal(8,4),
  `status` varchar(30) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  KEY `idx_food_organization_id` (`organization_id`),
  KEY `idx_food_food_name` (`food_name`),
  CONSTRAINT `chk_food_source_pair` CHECK ((source IS NULL) = (source_food_code IS NULL)),
  CONSTRAINT `chk_food_density_positive` CHECK (density_g_per_ml IS NULL OR density_g_per_ml > 0),
  CONSTRAINT `chk_food_status` CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Nutrient` (
  `nutrient_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `nutrient_code` varchar(50) UNIQUE,
  `nutrient_name` varchar(100) NOT NULL UNIQUE,
  `unit` varchar(30) NOT NULL,
  `status` varchar(30) NOT NULL,
  CONSTRAINT `chk_nutrient_status` CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `FoodNutrient` (
  `food_nutrient_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `food_id` bigint NOT NULL,
  `nutrient_id` bigint NOT NULL,
  `amount_per_100g` decimal(12,4) NOT NULL,
  `source` varchar(255),
  `source_version` varchar(100),
  `calculation_method` varchar(255),
  `updated_at` datetime(6) NOT NULL,
  KEY `idx_foodnutrient_nutrient_id` (`nutrient_id`),
  UNIQUE KEY `uq_foodnutrient_food_id_nutrient_id` (`food_id`, `nutrient_id`),
  CONSTRAINT `chk_food_nutrient_amount_non_negative` CHECK (amount_per_100g >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `MealRecord` (
  `meal_record_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `athlete_id` bigint NOT NULL,
  `consumed_at` datetime(6) NOT NULL,
  `local_date` date NOT NULL,
  `timezone` varchar(50) NOT NULL,
  `meal_type` varchar(50) NOT NULL,
  `note` text,
  `status` varchar(30) NOT NULL,
  `created_by_account_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  KEY `idx_mealrecord_athlete_id_consumed_at` (`athlete_id`, `consumed_at`),
  KEY `idx_mealrecord_athlete_id_local_date` (`athlete_id`, `local_date`),
  CONSTRAINT `chk_meal_record_meal_type` CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_training', 'post_training')),
  CONSTRAINT `chk_meal_record_status` CHECK (status IN ('draft', 'submitted', 'reviewed')),
  CONSTRAINT `chk_meal_record_timezone_iana` CHECK (timezone LIKE '%/%' OR timezone = 'UTC')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `MealImage` (
  `meal_image_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `meal_record_id` bigint NOT NULL,
  `object_key` varchar(500) NOT NULL,
  `mime_type` varchar(100),
  `uploaded_at` datetime(6) NOT NULL,
  KEY `idx_mealimage_meal_record_id` (`meal_record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `MealItem` (
  `meal_item_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `meal_record_id` bigint NOT NULL,
  `meal_analysis_id` bigint,
  `food_id` bigint,
  `detected_label` varchar(255),
  `estimated_weight_g` decimal(10,2),
  `confirmed_weight_g` decimal(10,2),
  `weight_source` varchar(50),
  `confirmation_status` varchar(30) NOT NULL,
  `confirmed_by_account_id` bigint,
  `confirmed_at` datetime(6),
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  KEY `idx_mealitem_meal_record_id` (`meal_record_id`),
  KEY `idx_mealitem_meal_analysis_id` (`meal_analysis_id`),
  KEY `idx_mealitem_food_id` (`food_id`),
  CONSTRAINT `chk_meal_item_food_or_label` CHECK (food_id IS NOT NULL OR detected_label IS NOT NULL),
  CONSTRAINT `chk_meal_item_confirmed_food` CHECK (confirmation_status <> 'confirmed' OR food_id IS NOT NULL),
  CONSTRAINT `chk_meal_item_confirmation_status` CHECK (confirmation_status IN ('pending', 'confirmed', 'rejected')),
  CONSTRAINT `chk_meal_item_weight_source` CHECK (weight_source IS NULL OR weight_source IN ('ai', 'measured', 'manual')),
  CONSTRAINT `chk_meal_item_confirmed_complete` CHECK (confirmation_status <> 'confirmed' OR ( confirmed_weight_g IS NOT NULL AND confirmed_by_account_id IS NOT NULL AND confirmed_at IS NOT NULL )),
  CONSTRAINT `chk_meal_item_estimated_weight_positive` CHECK (estimated_weight_g IS NULL OR estimated_weight_g > 0),
  CONSTRAINT `chk_meal_item_confirmed_weight_positive` CHECK (confirmed_weight_g IS NULL OR confirmed_weight_g > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `MealItemNutrient` (
  `meal_item_nutrient_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `meal_item_id` bigint NOT NULL,
  `nutrient_id` bigint NOT NULL,
  `amount` decimal(12,4) NOT NULL,
  `calculated_at` datetime(6) NOT NULL,
  KEY `idx_mealitemnutrient_nutrient_id` (`nutrient_id`),
  UNIQUE KEY `uq_mealitemnutrient_meal_item_id_nutrient_id` (`meal_item_id`, `nutrient_id`),
  CONSTRAINT `chk_meal_item_nutrient_amount_non_negative` CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `MealAnalysis` (
  `meal_analysis_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `meal_record_id` bigint NOT NULL,
  `model_name` varchar(150) NOT NULL,
  `model_version` varchar(100),
  `status` varchar(30) NOT NULL,
  `raw_result_json` json,
  `error_message` text,
  `started_at` datetime(6),
  `completed_at` datetime(6),
  `created_at` datetime(6) NOT NULL,
  KEY `idx_mealanalysis_meal_record_id` (`meal_record_id`),
  KEY `idx_mealanalysis_status` (`status`),
  CONSTRAINT `chk_meal_analysis_status` CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AthleteNutritionTarget` (
  `target_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `athlete_id` bigint NOT NULL,
  `nutritionist_id` bigint NOT NULL,
  `nutrient_id` bigint NOT NULL,
  `target_basis` varchar(20) NOT NULL,
  `target_min` decimal(12,4),
  `target_max` decimal(12,4),
  `start_date` date NOT NULL,
  `end_date` date,
  KEY `idx_athletenutritiontarget_nutritionist_id` (`nutritionist_id`),
  KEY `idx_athletenutritiontarget_nutrient_id` (`nutrient_id`),
  UNIQUE KEY `uq_athletenutritiontarget_athlete_id_nutrient_id_start_date` (`athlete_id`, `nutrient_id`, `start_date`),
  CONSTRAINT `chk_nutrition_target_basis` CHECK (target_basis IN ('absolute', 'per_kg_bw')),
  CONSTRAINT `chk_nutrition_target_has_value` CHECK (target_min IS NOT NULL OR target_max IS NOT NULL),
  CONSTRAINT `chk_nutrition_target_range` CHECK (target_min IS NULL OR target_max IS NULL OR target_min <= target_max),
  CONSTRAINT `chk_nutrition_target_dates` CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AthleteFoodRestriction` (
  `restriction_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `athlete_id` bigint NOT NULL,
  `food_id` bigint,
  `nutritionist_id` bigint NOT NULL,
  `restriction_type` varchar(50) NOT NULL,
  `max_amount_g` decimal(10,2),
  `description` text,
  `note` text,
  `start_date` date NOT NULL,
  `end_date` date,
  KEY `idx_athletefoodrestriction_food_id` (`food_id`),
  KEY `idx_athletefoodrestriction_nutritionist_id` (`nutritionist_id`),
  UNIQUE KEY `uq_athletefoodrestriction_athlete_id_food_id_start_date` (`athlete_id`, `food_id`, `start_date`),
  CONSTRAINT `chk_food_restriction_target` CHECK (food_id IS NOT NULL OR NULLIF(TRIM(description), '') IS NOT NULL),
  CONSTRAINT `chk_food_restriction_free_text_type` CHECK (food_id IS NOT NULL OR restriction_type = 'prohibited'),
  CONSTRAINT `chk_food_restriction_type` CHECK (restriction_type IN ('prohibited', 'limited')),
  CONSTRAINT `chk_food_restriction_limit` CHECK (( restriction_type = 'limited' AND food_id IS NOT NULL AND max_amount_g IS NOT NULL AND max_amount_g > 0 ) OR (restriction_type = 'prohibited' AND max_amount_g IS NULL)),
  CONSTRAINT `chk_food_restriction_dates` CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Foreign keys

ALTER TABLE `Account` ADD CONSTRAINT `fk_account_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `Organization` (`organization_id`);
ALTER TABLE `Athlete` ADD CONSTRAINT `fk_athlete_account_id` FOREIGN KEY (`account_id`) REFERENCES `Account` (`account_id`);
ALTER TABLE `Nutritionist` ADD CONSTRAINT `fk_nutritionist_account_id` FOREIGN KEY (`account_id`) REFERENCES `Account` (`account_id`);
ALTER TABLE `Coach` ADD CONSTRAINT `fk_coach_account_id` FOREIGN KEY (`account_id`) REFERENCES `Account` (`account_id`);
ALTER TABLE `AthleteCoach` ADD CONSTRAINT `fk_athletecoach_athlete_id` FOREIGN KEY (`athlete_id`) REFERENCES `Athlete` (`athlete_id`);
ALTER TABLE `AthleteCoach` ADD CONSTRAINT `fk_athletecoach_coach_id` FOREIGN KEY (`coach_id`) REFERENCES `Coach` (`coach_id`);
ALTER TABLE `Food` ADD CONSTRAINT `fk_food_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `Organization` (`organization_id`);
ALTER TABLE `FoodNutrient` ADD CONSTRAINT `fk_foodnutrient_food_id` FOREIGN KEY (`food_id`) REFERENCES `Food` (`food_id`);
ALTER TABLE `FoodNutrient` ADD CONSTRAINT `fk_foodnutrient_nutrient_id` FOREIGN KEY (`nutrient_id`) REFERENCES `Nutrient` (`nutrient_id`);
ALTER TABLE `MealRecord` ADD CONSTRAINT `fk_mealrecord_athlete_id` FOREIGN KEY (`athlete_id`) REFERENCES `Athlete` (`athlete_id`);
ALTER TABLE `MealRecord` ADD CONSTRAINT `fk_mealrecord_created_by_account_id` FOREIGN KEY (`created_by_account_id`) REFERENCES `Account` (`account_id`);
ALTER TABLE `MealImage` ADD CONSTRAINT `fk_mealimage_meal_record_id` FOREIGN KEY (`meal_record_id`) REFERENCES `MealRecord` (`meal_record_id`) ON DELETE CASCADE;
ALTER TABLE `MealItem` ADD CONSTRAINT `fk_mealitem_meal_record_id` FOREIGN KEY (`meal_record_id`) REFERENCES `MealRecord` (`meal_record_id`) ON DELETE CASCADE;
ALTER TABLE `MealItem` ADD CONSTRAINT `fk_mealitem_meal_analysis_id` FOREIGN KEY (`meal_analysis_id`) REFERENCES `MealAnalysis` (`meal_analysis_id`) ON DELETE SET NULL;
ALTER TABLE `MealItem` ADD CONSTRAINT `fk_mealitem_food_id` FOREIGN KEY (`food_id`) REFERENCES `Food` (`food_id`);
ALTER TABLE `MealItem` ADD CONSTRAINT `fk_mealitem_confirmed_by_account_id` FOREIGN KEY (`confirmed_by_account_id`) REFERENCES `Account` (`account_id`);
ALTER TABLE `MealItemNutrient` ADD CONSTRAINT `fk_mealitemnutrient_meal_item_id` FOREIGN KEY (`meal_item_id`) REFERENCES `MealItem` (`meal_item_id`) ON DELETE CASCADE;
ALTER TABLE `MealItemNutrient` ADD CONSTRAINT `fk_mealitemnutrient_nutrient_id` FOREIGN KEY (`nutrient_id`) REFERENCES `Nutrient` (`nutrient_id`);
ALTER TABLE `MealAnalysis` ADD CONSTRAINT `fk_mealanalysis_meal_record_id` FOREIGN KEY (`meal_record_id`) REFERENCES `MealRecord` (`meal_record_id`) ON DELETE CASCADE;
ALTER TABLE `AthleteNutritionTarget` ADD CONSTRAINT `fk_athletenutritiontarget_athlete_id` FOREIGN KEY (`athlete_id`) REFERENCES `Athlete` (`athlete_id`);
ALTER TABLE `AthleteNutritionTarget` ADD CONSTRAINT `fk_athletenutritiontarget_nutritionist_id` FOREIGN KEY (`nutritionist_id`) REFERENCES `Nutritionist` (`nutritionist_id`);
ALTER TABLE `AthleteNutritionTarget` ADD CONSTRAINT `fk_athletenutritiontarget_nutrient_id` FOREIGN KEY (`nutrient_id`) REFERENCES `Nutrient` (`nutrient_id`);
ALTER TABLE `AthleteFoodRestriction` ADD CONSTRAINT `fk_athletefoodrestriction_athlete_id` FOREIGN KEY (`athlete_id`) REFERENCES `Athlete` (`athlete_id`);
ALTER TABLE `AthleteFoodRestriction` ADD CONSTRAINT `fk_athletefoodrestriction_food_id` FOREIGN KEY (`food_id`) REFERENCES `Food` (`food_id`);
ALTER TABLE `AthleteFoodRestriction` ADD CONSTRAINT `fk_athletefoodrestriction_nutritionist_id` FOREIGN KEY (`nutritionist_id`) REFERENCES `Nutritionist` (`nutritionist_id`);

-- Integrity layer for athlete_nutrition_erd.dbml (MVP v8, 16 tables).
-- Use a UTC connection/session time zone and load MariaDB named time-zone tables.
-- Run once as the schema owner through the mariadb CLI (DELIMITER is a client command).
-- Writes to the three effective-date tables must run in explicit transactions;
-- the overlap guard relies on InnoDB SELECT ... FOR UPDATE locks.
-- MealItemNutrient snapshots are written by the application (see view at end).

-- Email is unique among non-disabled accounts only.
-- Player transfer: disable the old account (history stays with the old
-- organization), then create a new account with the same email.
ALTER TABLE Account
  ADD COLUMN active_email VARCHAR(255)
    GENERATED ALWAYS AS (IF(status = 'disabled', NULL, email)) PERSISTENT,
  ADD UNIQUE KEY uq_account_active_email (active_email);

ALTER TABLE Food
  ADD COLUMN source_scope_id BIGINT
    GENERATED ALWAYS AS (IFNULL(organization_id, 0)) PERSISTENT,
  ADD UNIQUE KEY uq_food_scope_source_code
    (source_scope_id, source, source_food_code);

DELIMITER $$

CREATE PROCEDURE mvp_assert_profile(IN p_account BIGINT, IN p_role VARCHAR(30))
BEGIN
  DECLARE v_org BIGINT DEFAULT NULL;
  DECLARE v_role VARCHAR(30) DEFAULT NULL;
  SELECT organization_id, role INTO v_org, v_role
    FROM Account WHERE account_id = p_account;
  IF v_org IS NULL OR v_role <> p_role THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Profile account role or organization mismatch';
  END IF;
END$$

CREATE FUNCTION mvp_athlete_org(p_athlete BIGINT) RETURNS BIGINT
READS SQL DATA
BEGIN
  DECLARE v_org BIGINT DEFAULT NULL;
  SELECT a.organization_id INTO v_org
    FROM Athlete p JOIN Account a ON a.account_id = p.account_id
    WHERE p.athlete_id = p_athlete;
  RETURN v_org;
END$$

-- Writers of athlete data: the athlete themself or a same-org nutritionist.
-- Coaches are read-only; admins manage accounts, not athlete data.
CREATE PROCEDURE mvp_assert_actor(IN p_athlete BIGINT, IN p_account BIGINT)
BEGIN
  DECLARE v_org BIGINT DEFAULT NULL;
  DECLARE v_role VARCHAR(30) DEFAULT NULL;
  DECLARE v_athlete_account BIGINT DEFAULT NULL;
  SELECT organization_id, role INTO v_org, v_role
    FROM Account WHERE account_id = p_account;
  SELECT account_id INTO v_athlete_account
    FROM Athlete WHERE athlete_id = p_athlete;
  IF v_org IS NULL OR v_org <> mvp_athlete_org(p_athlete) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account belongs to another organization';
  END IF;
  IF NOT (v_role = 'nutritionist' OR (v_role = 'athlete' AND p_account = v_athlete_account)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Actor must be the athlete or a nutritionist';
  END IF;
END$$

CREATE PROCEDURE mvp_assert_person_scope(
  IN p_athlete BIGINT, IN p_person BIGINT, IN p_kind VARCHAR(20))
BEGIN
  DECLARE v_org BIGINT DEFAULT NULL;
  IF p_kind = 'coach' THEN
    SELECT a.organization_id INTO v_org
      FROM Coach p JOIN Account a ON a.account_id = p.account_id
      WHERE p.coach_id = p_person;
  ELSEIF p_kind = 'nutritionist' THEN
    SELECT a.organization_id INTO v_org
      FROM Nutritionist p JOIN Account a ON a.account_id = p.account_id
      WHERE p.nutritionist_id = p_person;
  END IF;
  IF v_org IS NULL OR v_org <> mvp_athlete_org(p_athlete) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Person belongs to another organization';
  END IF;
END$$

CREATE PROCEDURE mvp_assert_food_scope(IN p_athlete BIGINT, IN p_food BIGINT)
BEGIN
  DECLARE v_org BIGINT DEFAULT NULL;
  DECLARE v_found BIGINT DEFAULT NULL;
  IF p_food IS NOT NULL THEN
    SELECT food_id, organization_id INTO v_found, v_org
      FROM Food WHERE food_id = p_food;
    IF v_found IS NULL OR
      (v_org IS NOT NULL AND v_org <> mvp_athlete_org(p_athlete)) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Food belongs to another organization';
    END IF;
  END IF;
END$$

CREATE PROCEDURE mvp_assert_meal_date(
  IN p_consumed_utc DATETIME(6), IN p_timezone VARCHAR(50), IN p_local_date DATE)
BEGIN
  DECLARE v_local DATETIME(6) DEFAULT NULL;
  SET v_local = CONVERT_TZ(p_consumed_utc, '+00:00', p_timezone);
  IF v_local IS NULL OR DATE(v_local) <> p_local_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid timezone or local_date';
  END IF;
END$$

-- Locking the Athlete row serializes interval writes for one athlete.
-- The overlap query is a locking read, so it sees committed changes after the lock wait.
CREATE PROCEDURE mvp_assert_period(
  IN p_kind VARCHAR(20), IN p_row_id BIGINT, IN p_athlete BIGINT,
  IN p_peer BIGINT, IN p_start DATE, IN p_end DATE)
BEGIN
  DECLARE v_locked BIGINT DEFAULT NULL;
  DECLARE v_conflict BIGINT DEFAULT NULL;
  SELECT athlete_id INTO v_locked FROM Athlete
    WHERE athlete_id = p_athlete FOR UPDATE;
  IF v_locked IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Athlete not found';
  END IF;
  period_check: BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_conflict = NULL;
    IF p_kind = 'restriction' AND p_peer IS NULL THEN
      LEAVE period_check;
    END IF;
    IF p_kind = 'coach' THEN
      SELECT athlete_coach_id INTO v_conflict FROM AthleteCoach
        WHERE athlete_id = p_athlete AND coach_id = p_peer
          AND athlete_coach_id <> IFNULL(p_row_id, 0)
          AND start_date <= IFNULL(p_end, '9999-12-31')
          AND IFNULL(end_date, '9999-12-31') >= p_start
        LIMIT 1 FOR UPDATE;
    ELSEIF p_kind = 'target' THEN
      SELECT target_id INTO v_conflict FROM AthleteNutritionTarget
        WHERE athlete_id = p_athlete AND nutrient_id = p_peer
          AND target_id <> IFNULL(p_row_id, 0)
          AND start_date <= IFNULL(p_end, '9999-12-31')
          AND IFNULL(end_date, '9999-12-31') >= p_start
        LIMIT 1 FOR UPDATE;
    ELSEIF p_kind = 'restriction' THEN
      SELECT restriction_id INTO v_conflict FROM AthleteFoodRestriction
        WHERE athlete_id = p_athlete AND food_id = p_peer
          AND restriction_id <> IFNULL(p_row_id, 0)
          AND start_date <= IFNULL(p_end, '9999-12-31')
          AND IFNULL(end_date, '9999-12-31') >= p_start
        LIMIT 1 FOR UPDATE;
    END IF;
  END;
  IF v_conflict IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Effective date periods overlap';
  END IF;
END$$

CREATE PROCEDURE mvp_assert_item(
  IN p_meal BIGINT, IN p_analysis BIGINT, IN p_food BIGINT,
  IN p_confirmer BIGINT)
BEGIN
  DECLARE v_athlete BIGINT DEFAULT NULL;
  DECLARE v_analysis_meal BIGINT DEFAULT NULL;
  SELECT athlete_id INTO v_athlete FROM MealRecord WHERE meal_record_id = p_meal;
  IF v_athlete IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Meal not found';
  END IF;
  CALL mvp_assert_food_scope(v_athlete, p_food);
  IF p_analysis IS NOT NULL THEN
    SELECT meal_record_id INTO v_analysis_meal
      FROM MealAnalysis WHERE meal_analysis_id = p_analysis;
    IF v_analysis_meal IS NULL OR v_analysis_meal <> p_meal THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Analysis belongs to another meal';
    END IF;
  END IF;
  IF p_confirmer IS NOT NULL THEN
    CALL mvp_assert_actor(v_athlete, p_confirmer);
  END IF;
END$$

CREATE TRIGGER mvp_account_bu BEFORE UPDATE ON Account FOR EACH ROW
BEGIN
  IF NOT (NEW.organization_id <=> OLD.organization_id) OR NOT (NEW.role <=> OLD.role) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account role and organization are immutable';
  END IF;
END$$

CREATE TRIGGER mvp_athlete_bi BEFORE INSERT ON Athlete FOR EACH ROW
BEGIN
  CALL mvp_assert_profile(NEW.account_id, 'athlete');
END$$
CREATE TRIGGER mvp_athlete_bu BEFORE UPDATE ON Athlete FOR EACH ROW
BEGIN
  IF NEW.account_id <> OLD.account_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Athlete account_id is immutable';
  END IF;
END$$
CREATE TRIGGER mvp_nutritionist_bi BEFORE INSERT ON Nutritionist FOR EACH ROW
BEGIN
  CALL mvp_assert_profile(NEW.account_id, 'nutritionist');
END$$
CREATE TRIGGER mvp_nutritionist_bu BEFORE UPDATE ON Nutritionist FOR EACH ROW
BEGIN
  IF NEW.account_id <> OLD.account_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nutritionist account_id is immutable';
  END IF;
END$$
CREATE TRIGGER mvp_coach_bi BEFORE INSERT ON Coach FOR EACH ROW
BEGIN
  CALL mvp_assert_profile(NEW.account_id, 'coach');
END$$
CREATE TRIGGER mvp_coach_bu BEFORE UPDATE ON Coach FOR EACH ROW
BEGIN
  IF NEW.account_id <> OLD.account_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Coach account_id is immutable';
  END IF;
END$$

CREATE TRIGGER mvp_food_bu BEFORE UPDATE ON Food FOR EACH ROW
BEGIN
  IF NOT (NEW.organization_id <=> OLD.organization_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Food organization_id is immutable';
  END IF;
END$$
CREATE TRIGGER mvp_nutrient_bu BEFORE UPDATE ON Nutrient FOR EACH ROW
BEGIN
  IF NEW.unit <> OLD.unit THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nutrient unit is immutable';
  END IF;
END$$


CREATE TRIGGER mvp_athlete_coach_bi BEFORE INSERT ON AthleteCoach FOR EACH ROW
BEGIN
  CALL mvp_assert_person_scope(NEW.athlete_id, NEW.coach_id, 'coach');
  CALL mvp_assert_period('coach', NULL, NEW.athlete_id, NEW.coach_id,
                         NEW.start_date, NEW.end_date);
END$$
CREATE TRIGGER mvp_athlete_coach_bu BEFORE UPDATE ON AthleteCoach FOR EACH ROW
BEGIN
  IF NEW.athlete_id <> OLD.athlete_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AthleteCoach athlete_id is immutable';
  END IF;
  CALL mvp_assert_person_scope(NEW.athlete_id, NEW.coach_id, 'coach');
  CALL mvp_assert_period('coach', NEW.athlete_coach_id, NEW.athlete_id,
                         NEW.coach_id, NEW.start_date, NEW.end_date);
END$$

CREATE TRIGGER mvp_meal_bi BEFORE INSERT ON MealRecord FOR EACH ROW
BEGIN
  CALL mvp_assert_actor(NEW.athlete_id, NEW.created_by_account_id);
  CALL mvp_assert_meal_date(NEW.consumed_at, NEW.timezone, NEW.local_date);
END$$
CREATE TRIGGER mvp_meal_bu BEFORE UPDATE ON MealRecord FOR EACH ROW
BEGIN
  IF NEW.athlete_id <> OLD.athlete_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MealRecord athlete_id is immutable';
  END IF;
  CALL mvp_assert_actor(NEW.athlete_id, NEW.created_by_account_id);
  CALL mvp_assert_meal_date(NEW.consumed_at, NEW.timezone, NEW.local_date);
END$$
CREATE TRIGGER mvp_analysis_bu BEFORE UPDATE ON MealAnalysis FOR EACH ROW
BEGIN
  IF NEW.meal_record_id <> OLD.meal_record_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MealAnalysis meal_record_id is immutable';
  END IF;
END$$

CREATE TRIGGER mvp_item_bi BEFORE INSERT ON MealItem FOR EACH ROW
BEGIN
  CALL mvp_assert_item(NEW.meal_record_id, NEW.meal_analysis_id,
                       NEW.food_id, NEW.confirmed_by_account_id);
END$$
CREATE TRIGGER mvp_item_bu BEFORE UPDATE ON MealItem FOR EACH ROW
BEGIN
  IF NEW.meal_record_id <> OLD.meal_record_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MealItem meal_record_id is immutable';
  END IF;
  CALL mvp_assert_item(NEW.meal_record_id, NEW.meal_analysis_id,
                       NEW.food_id, NEW.confirmed_by_account_id);
END$$

CREATE TRIGGER mvp_target_bi BEFORE INSERT ON AthleteNutritionTarget FOR EACH ROW
BEGIN
  CALL mvp_assert_person_scope(NEW.athlete_id, NEW.nutritionist_id, 'nutritionist');
  CALL mvp_assert_period('target', NULL, NEW.athlete_id, NEW.nutrient_id,
                         NEW.start_date, NEW.end_date);
END$$
CREATE TRIGGER mvp_target_bu BEFORE UPDATE ON AthleteNutritionTarget FOR EACH ROW
BEGIN
  IF NEW.athlete_id <> OLD.athlete_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Target athlete_id is immutable';
  END IF;
  CALL mvp_assert_person_scope(NEW.athlete_id, NEW.nutritionist_id, 'nutritionist');
  CALL mvp_assert_period('target', NEW.target_id, NEW.athlete_id,
                         NEW.nutrient_id, NEW.start_date, NEW.end_date);
END$$

CREATE TRIGGER mvp_restriction_bi BEFORE INSERT ON AthleteFoodRestriction FOR EACH ROW
BEGIN
  CALL mvp_assert_person_scope(NEW.athlete_id, NEW.nutritionist_id, 'nutritionist');
  CALL mvp_assert_food_scope(NEW.athlete_id, NEW.food_id);
  CALL mvp_assert_period('restriction', NULL, NEW.athlete_id, NEW.food_id,
                         NEW.start_date, NEW.end_date);
END$$
CREATE TRIGGER mvp_restriction_bu BEFORE UPDATE ON AthleteFoodRestriction FOR EACH ROW
BEGIN
  IF NEW.athlete_id <> OLD.athlete_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Restriction athlete_id is immutable';
  END IF;
  CALL mvp_assert_person_scope(NEW.athlete_id, NEW.nutritionist_id, 'nutritionist');
  CALL mvp_assert_food_scope(NEW.athlete_id, NEW.food_id);
  CALL mvp_assert_period('restriction', NEW.restriction_id, NEW.athlete_id,
                         NEW.food_id, NEW.start_date, NEW.end_date);
END$$

DELIMITER ;

-- Snapshot consistency check (run daily; alert when non-empty).
-- The application writes / deletes MealItemNutrient in the same transaction
-- as the MealItem confirmation change; this view catches missed writes.
CREATE VIEW mvp_snapshot_mismatch AS
  SELECT mi.meal_item_id, 'confirmed_without_snapshot' AS problem
    FROM MealItem mi
    WHERE mi.confirmation_status = 'confirmed'
      AND NOT EXISTS (SELECT 1 FROM MealItemNutrient n
                        WHERE n.meal_item_id = mi.meal_item_id)
  UNION ALL
  SELECT mi.meal_item_id, 'snapshot_without_confirmation'
    FROM MealItem mi
    WHERE mi.confirmation_status <> 'confirmed'
      AND EXISTS (SELECT 1 FROM MealItemNutrient n
                    WHERE n.meal_item_id = mi.meal_item_id);
