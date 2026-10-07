-- Professional Athlete Nutrition Management Platform - v10 schema baseline
-- Canonical schema. tools/build_erd.py generates DBML and diagrams.
-- Runtime validated: MariaDB 12.3.3 / InnoDB / utf8mb4, 29 integration cases.
-- Legacy MariaDB 11.8 target has not been runtime validated.
-- Store datetime(6) values in UTC.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Routine string parameters inherit the database collation at creation.
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';
SET SESSION sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE,NO_ENGINE_SUBSTITUTION';

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
  `sex` varchar(30),
  `weight_kg` decimal(6,2),
  `height_cm` decimal(6,2),
  `body_fat_percent` decimal(5,2),
  `sport` varchar(100),
  `weekly_training_count` tinyint unsigned,
  `primary_goal` varchar(30),
  `jersey_number` tinyint unsigned,
  `position` varchar(100),
  `dietary_restrictions_text` text,
  `allergies_text` text,
  `notes` text,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  CONSTRAINT `chk_athlete_height` CHECK (height_cm IS NULL OR height_cm BETWEEN 50 AND 260),
  CONSTRAINT `chk_athlete_body_fat` CHECK (body_fat_percent IS NULL OR (body_fat_percent > 0 AND body_fat_percent < 100)),
  CONSTRAINT `chk_athlete_training` CHECK (weekly_training_count IS NULL OR weekly_training_count <= 50),
  CONSTRAINT `chk_athlete_jersey` CHECK (jersey_number IS NULL OR jersey_number <= 99),
  CONSTRAINT `chk_athlete_goal` CHECK (primary_goal IS NULL OR primary_goal IN ('maintain','gain_muscle','lose_fat','competition')),
  CONSTRAINT `chk_athlete_sex` CHECK (sex IS NULL OR sex IN ('male','female','other','undisclosed')),
  CONSTRAINT `chk_athlete_weight` CHECK (weight_kg IS NULL OR weight_kg BETWEEN 10 AND 350)
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
  `status_changed_by_account_id` bigint,
  `status_changed_at` datetime(6),
  `status_change_reason` varchar(500),
  `revision` int unsigned NOT NULL DEFAULT 0,
  `submission_request_id` varchar(64) CHARACTER SET ascii COLLATE ascii_bin,
  `submission_request_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin,
  UNIQUE KEY `uq_meal_submission` (`created_by_account_id`, `submission_request_id`),
  CONSTRAINT `chk_submission_pair` CHECK ((submission_request_id IS NULL) = (submission_request_hash IS NULL)),
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  KEY `idx_mealrecord_athlete_id_consumed_at` (`athlete_id`, `consumed_at`),
  KEY `idx_mealrecord_athlete_id_local_date` (`athlete_id`, `local_date`),
  CONSTRAINT `chk_meal_record_meal_type` CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_training', 'post_training')),
  CONSTRAINT `chk_meal_record_status` CHECK (status IN ('draft', 'submitted', 'reviewed')),
  CONSTRAINT `chk_meal_status_metadata` CHECK ((status = 'draft' AND status_changed_by_account_id IS NULL AND status_changed_at IS NULL AND status_change_reason IS NULL) OR (status IN ('submitted', 'reviewed') AND status_changed_by_account_id IS NOT NULL AND status_changed_at IS NOT NULL)),
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
  `snapshot_nutrient_count` int unsigned NOT NULL DEFAULT 0,
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
  CONSTRAINT `chk_meal_item_confirmed_complete` CHECK ((confirmation_status = 'confirmed' AND confirmed_weight_g IS NOT NULL AND weight_source IS NOT NULL AND confirmed_by_account_id IS NOT NULL AND confirmed_at IS NOT NULL AND snapshot_nutrient_count > 0) OR (confirmation_status IN ('pending', 'rejected') AND confirmed_weight_g IS NULL AND weight_source IS NULL AND confirmed_by_account_id IS NULL AND confirmed_at IS NULL AND snapshot_nutrient_count = 0)),
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
  CONSTRAINT `chk_meal_analysis_status` CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  CONSTRAINT `chk_analysis_lifecycle` CHECK (
    (status = 'queued' AND started_at IS NULL AND completed_at IS NULL AND error_message IS NULL AND raw_result_json IS NULL) OR
    (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL AND error_message IS NULL AND raw_result_json IS NULL) OR
    (status = 'succeeded' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND error_message IS NULL AND raw_result_json IS NOT NULL) OR
    (status = 'failed' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND error_message IS NOT NULL AND CHAR_LENGTH(TRIM(error_message)) > 0 AND raw_result_json IS NULL)),
  CONSTRAINT `chk_analysis_time_order` CHECK ((started_at IS NULL OR started_at >= created_at) AND (completed_at IS NULL OR completed_at >= started_at))
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
  CONSTRAINT `chk_nutrition_target_non_negative` CHECK ((target_min IS NULL OR target_min >= 0) AND (target_max IS NULL OR target_max >= 0)),
  CONSTRAINT `chk_nutrition_target_range` CHECK (target_min IS NULL OR target_max IS NULL OR target_min <= target_max),
  CONSTRAINT `chk_nutrition_target_dates` CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AthleteFoodRestriction` (
  `restriction_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `athlete_id` bigint NOT NULL,
  `food_id` bigint,
  `nutritionist_id` bigint NOT NULL,
  `restriction_type` varchar(50) NOT NULL,
  `max_daily_amount_g` decimal(10,2),
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
  CONSTRAINT `chk_food_restriction_limit` CHECK (( restriction_type = 'limited' AND food_id IS NOT NULL AND max_daily_amount_g IS NOT NULL AND max_daily_amount_g > 0 ) OR (restriction_type = 'prohibited' AND max_daily_amount_g IS NULL)),
  CONSTRAINT `chk_food_restriction_dates` CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AthleteDailyNutritionPlan` (
  `daily_plan_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `athlete_id` bigint NOT NULL,
  `local_date` date NOT NULL,
  `revision` int unsigned NOT NULL,
  `calculation_weight_kg` decimal(6,2) NOT NULL,
  `day_type` varchar(20) NOT NULL,
  `input_json` json NOT NULL,
  `target_energy_kcal` decimal(12,4) NOT NULL,
  `target_protein_g` decimal(12,4) NOT NULL,
  `target_carbohydrate_g` decimal(12,4) NOT NULL,
  `target_fat_g` decimal(12,4) NOT NULL,
  `warnings_json` json NOT NULL,
  `warnings_acknowledged` tinyint NOT NULL,
  `confirmed_by_account_id` bigint NOT NULL,
  `confirmed_at` datetime(6) NOT NULL,
  `change_reason` varchar(500),
  UNIQUE KEY `uq_daily_plan_version` (`athlete_id`, `local_date`, `revision`),
  KEY `idx_daily_plan_confirmer` (`confirmed_by_account_id`),
  CONSTRAINT `chk_daily_plan_revision` CHECK (revision >= 1),
  CONSTRAINT `chk_daily_plan_weight` CHECK (calculation_weight_kg > 0),
  CONSTRAINT `chk_daily_plan_day` CHECK (day_type IN ('training','rest')),
  CONSTRAINT `chk_daily_plan_input` CHECK (JSON_TYPE(input_json) = 'OBJECT'),
  CONSTRAINT `chk_daily_plan_targets` CHECK (target_energy_kcal > 0 AND target_protein_g >= 0 AND target_carbohydrate_g >= 0 AND target_fat_g >= 0),
  CONSTRAINT `chk_daily_plan_energy` CHECK (ABS(ROUND(ROUND(target_protein_g*4 + target_carbohydrate_g*4 + target_fat_g*9,1) - target_energy_kcal,1)) <= 5),
  CONSTRAINT `chk_daily_plan_ack` CHECK (warnings_acknowledged IN (0,1)),
  CONSTRAINT `chk_daily_plan_warnings` CHECK (JSON_TYPE(warnings_json) = 'ARRAY' AND (JSON_LENGTH(warnings_json) = 0 OR warnings_acknowledged = 1)),
  CONSTRAINT `chk_daily_plan_reason` CHECK (revision = 1 OR NULLIF(TRIM(change_reason),'') IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `MealRevision` (
  `meal_revision_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `meal_record_id` bigint NOT NULL,
  `revision` int unsigned NOT NULL,
  `action` varchar(30) NOT NULL,
  `actor_account_id` bigint NOT NULL,
  `reason` varchar(500),
  `before_json` json,
  `after_json` json NOT NULL,
  `recorded_at` datetime(6) NOT NULL,
  UNIQUE KEY `uq_meal_revision` (`meal_record_id`, `revision`),
  KEY `idx_meal_revision_actor` (`actor_account_id`),
  CONSTRAINT `chk_meal_revision_number` CHECK (revision >= 1),
  CONSTRAINT `chk_meal_revision_action` CHECK (action IN ('create','edit','confirm','reject','add_item','delete_item','save','review','reopen','add_image','delete_image','queue_analysis')),
  CONSTRAINT `chk_meal_revision_before` CHECK ((action = 'create' AND before_json IS NULL) OR (action <> 'create' AND before_json IS NOT NULL AND JSON_TYPE(before_json) = 'OBJECT')),
  CONSTRAINT `chk_meal_revision_after` CHECK (JSON_TYPE(after_json) = 'OBJECT'),
  CONSTRAINT `chk_meal_revision_reason` CHECK (action NOT IN ('reject','delete_item','reopen') OR NULLIF(TRIM(reason),'') IS NOT NULL)
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

ALTER TABLE `MealRecord` ADD CONSTRAINT `fk_meal_status_actor` FOREIGN KEY (`status_changed_by_account_id`) REFERENCES `Account` (`account_id`);

ALTER TABLE `AthleteDailyNutritionPlan` ADD CONSTRAINT `fk_daily_plan_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `Athlete` (`athlete_id`) ON DELETE RESTRICT;
ALTER TABLE `AthleteDailyNutritionPlan` ADD CONSTRAINT `fk_daily_plan_confirmer` FOREIGN KEY (`confirmed_by_account_id`) REFERENCES `Account` (`account_id`) ON DELETE RESTRICT;
ALTER TABLE `MealRevision` ADD CONSTRAINT `fk_revision_meal` FOREIGN KEY (`meal_record_id`) REFERENCES `MealRecord` (`meal_record_id`) ON DELETE RESTRICT;
ALTER TABLE `MealRevision` ADD CONSTRAINT `fk_revision_actor` FOREIGN KEY (`actor_account_id`) REFERENCES `Account` (`account_id`) ON DELETE RESTRICT;

-- Integrity layer for athlete_nutrition_erd.dbml (v10 schema baseline, 18 tables).
-- Use a UTC connection/session time zone and load MariaDB named time-zone tables.
-- Run once as the schema owner through the mariadb CLI (DELIMITER is a client command).
-- Writes to the three effective-date tables must run in explicit transactions;
-- the overlap guard relies on InnoDB SELECT ... FOR UPDATE locks.
-- Snapshot creation, replacement and deletion run in MealItem triggers, atomically.
-- App accounts receive EXECUTE on public commands only, never raw meal DML.
-- See production_guide.md for installation, API authentication and migration. 

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
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  DECLARE v_athlete_account BIGINT DEFAULT NULL;
  DECLARE v_athlete_org BIGINT DEFAULT NULL;
  DECLARE v_org_status VARCHAR(30) DEFAULT NULL;
  SELECT organization_id, role, status INTO v_org, v_role, v_status
    FROM Account WHERE account_id = p_account LOCK IN SHARE MODE;
  SELECT p.account_id, a.organization_id INTO v_athlete_account, v_athlete_org
    FROM Athlete p JOIN Account a ON a.account_id=p.account_id
    WHERE p.athlete_id = p_athlete LOCK IN SHARE MODE;
  IF v_status IS NULL OR v_status <> 'active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Actor account is not active';
  END IF;
  IF v_org IS NULL OR v_athlete_org IS NULL OR v_org <> v_athlete_org THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account belongs to another organization';
  END IF;
  SELECT status INTO v_org_status FROM Organization WHERE organization_id=v_org LOCK IN SHARE MODE;
  IF v_org_status IS NULL OR v_org_status<>'active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Organization is not active';
  END IF;
  IF NOT (v_role = 'nutritionist' OR (v_role = 'athlete' AND p_account = v_athlete_account)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Actor must be the athlete or a nutritionist';
  END IF;
END$$

CREATE PROCEDURE mvp_assert_nutritionist(IN p_athlete BIGINT, IN p_account BIGINT)
BEGIN
  DECLARE v_role VARCHAR(30);
  CALL mvp_assert_actor(p_athlete,p_account);
  SELECT role INTO v_role FROM Account WHERE account_id=p_account LOCK IN SHARE MODE;
  IF v_role <> 'nutritionist' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active nutritionist required';
  END IF;
END$$

CREATE PROCEDURE mvp_assert_person_scope(
  IN p_athlete BIGINT, IN p_person BIGINT, IN p_kind VARCHAR(20))
BEGIN
  DECLARE v_org BIGINT DEFAULT NULL;
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  IF p_kind = 'coach' THEN
    SELECT a.organization_id, a.status INTO v_org, v_status
      FROM Coach p JOIN Account a ON a.account_id = p.account_id
      WHERE p.coach_id = p_person LOCK IN SHARE MODE;
  ELSEIF p_kind = 'nutritionist' THEN
    SELECT a.organization_id, a.status INTO v_org, v_status
      FROM Nutritionist p JOIN Account a ON a.account_id = p.account_id
      WHERE p.nutritionist_id = p_person LOCK IN SHARE MODE;
  END IF;
  IF v_status IS NULL OR v_status <> 'active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Assigned staff account is not active';
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
-- The overlap query uses LOCK IN SHARE MODE on its own trigger table.
-- A stale RR read view may produce 1020; callers must retry the whole transaction.
CREATE PROCEDURE mvp_assert_period(
  IN p_kind VARCHAR(20), IN p_row_id BIGINT, IN p_athlete BIGINT,
  IN p_peer BIGINT, IN p_start DATE, IN p_end DATE)
BEGIN
  DECLARE v_locked BIGINT DEFAULT NULL;
  DECLARE v_conflict BIGINT DEFAULT NULL;
  IF @@in_transaction = 0 AND @@autocommit = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Effective date write requires explicit transaction';
  END IF;
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
        LIMIT 1 LOCK IN SHARE MODE;
    ELSEIF p_kind = 'target' THEN
      SELECT target_id INTO v_conflict FROM AthleteNutritionTarget
        WHERE athlete_id = p_athlete AND nutrient_id = p_peer
          AND target_id <> IFNULL(p_row_id, 0)
          AND start_date <= IFNULL(p_end, '9999-12-31')
          AND IFNULL(end_date, '9999-12-31') >= p_start
        LIMIT 1 LOCK IN SHARE MODE;
    ELSEIF p_kind = 'restriction' THEN
      SELECT restriction_id INTO v_conflict FROM AthleteFoodRestriction
        WHERE athlete_id = p_athlete AND food_id = p_peer
          AND restriction_id <> IFNULL(p_row_id, 0)
          AND start_date <= IFNULL(p_end, '9999-12-31')
          AND IFNULL(end_date, '9999-12-31') >= p_start
        LIMIT 1 LOCK IN SHARE MODE;
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
  IF OLD.nutrient_code IS NOT NULL AND NOT(NEW.nutrient_code <=> OLD.nutrient_code) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Established nutrient code is immutable';
  END IF;
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
  -- Closing an existing period is allowed after staff disablement.
  IF NOT ((NEW.coach_id <=> OLD.coach_id) AND (NEW.start_date <=> OLD.start_date)
    AND NEW.end_date IS NOT NULL AND NEW.end_date <= IFNULL(OLD.end_date,'9999-12-31')) THEN
    CALL mvp_assert_person_scope(NEW.athlete_id, NEW.coach_id, 'coach');
  END IF;
  CALL mvp_assert_period('coach', NEW.athlete_coach_id, NEW.athlete_id,
                         NEW.coach_id, NEW.start_date, NEW.end_date);
END$$

-- Parent locking serializes all meal commands and child writes with review.
CREATE PROCEDURE mvp_lock_editable_meal(IN p_meal BIGINT)
BEGIN
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  SELECT status INTO v_status FROM MealRecord WHERE meal_record_id=p_meal FOR UPDATE;
  IF v_status IS NULL OR v_status = 'reviewed' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Meal missing or reviewed; explicit reopen required';
  END IF;
END$$

CREATE PROCEDURE mvp_lock_meal_actor(IN p_meal BIGINT, IN p_actor BIGINT, IN p_edit BOOLEAN)
BEGIN
  DECLARE v_athlete BIGINT DEFAULT NULL;
  DECLARE v_status VARCHAR(30);
  SELECT athlete_id,status INTO v_athlete,v_status FROM MealRecord
    WHERE meal_record_id=p_meal FOR UPDATE;
  CALL mvp_assert_actor(v_athlete,p_actor);
  IF p_edit THEN
    IF v_status='reviewed' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reviewed meal requires explicit reopen';
    END IF;
    IF v_status='submitted' THEN
      CALL mvp_assert_nutritionist(v_athlete,p_actor);
    END IF;
  END IF;
END$$

CREATE PROCEDURE mvp_assert_resolved_meal(IN p_meal BIGINT)
BEGIN
  DECLARE v_items BIGINT;
  DECLARE v_pending BIGINT;
  DECLARE v_confirmed BIGINT;
  DECLARE v_analysis BIGINT;
  DECLARE v_mismatch BIGINT;
  SELECT COUNT(*),COALESCE(SUM(confirmation_status='pending'),0),COALESCE(SUM(confirmation_status='confirmed'),0)
    INTO v_items,v_pending,v_confirmed FROM MealItem WHERE meal_record_id=p_meal FOR UPDATE;
  SELECT COUNT(*) INTO v_analysis FROM MealAnalysis WHERE meal_record_id=p_meal
    AND status IN ('queued','running') FOR UPDATE;
  SELECT COUNT(*) INTO v_mismatch FROM MealItem mi WHERE meal_record_id=p_meal
    AND ((mi.confirmation_status='confirmed' AND mi.snapshot_nutrient_count <>
      (SELECT COUNT(*) FROM MealItemNutrient n WHERE n.meal_item_id=mi.meal_item_id))
    OR (mi.confirmation_status<>'confirmed' AND EXISTS
      (SELECT 1 FROM MealItemNutrient n WHERE n.meal_item_id=mi.meal_item_id))) FOR UPDATE;
  IF v_items=0 OR v_confirmed=0 OR v_pending>0 OR v_analysis>0 OR v_mismatch>0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Meal needs resolved items, completed analyses and complete snapshots';
  END IF;
END$$

CREATE TRIGGER mvp_meal_bi BEFORE INSERT ON MealRecord FOR EACH ROW
BEGIN
  IF NEW.status <> 'draft' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'New meal must be draft';
  END IF;
  CALL mvp_assert_actor(NEW.athlete_id, NEW.created_by_account_id);
  CALL mvp_assert_meal_date(NEW.consumed_at, NEW.timezone, NEW.local_date);
END$$
CREATE TRIGGER mvp_meal_bu BEFORE UPDATE ON MealRecord FOR EACH ROW
BEGIN
  IF NEW.athlete_id <> OLD.athlete_id OR NEW.created_by_account_id <> OLD.created_by_account_id
     OR NEW.created_at <> OLD.created_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Meal athlete, creator and created_at are immutable';
  END IF;
  IF NEW.status <> OLD.status THEN
    IF NOT ((OLD.status='draft' AND NEW.status='submitted') OR
      (OLD.status='submitted' AND NEW.status='reviewed') OR
      (OLD.status='reviewed' AND NEW.status='submitted')) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid meal status transition';
    END IF;
    IF NEW.status_changed_by_account_id IS NULL OR NEW.status_changed_at IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Status transition requires actor and timestamp';
    END IF;
    CALL mvp_assert_actor(NEW.athlete_id,NEW.status_changed_by_account_id);
    IF NEW.status='reviewed' OR OLD.status='reviewed' THEN
      CALL mvp_assert_nutritionist(NEW.athlete_id,NEW.status_changed_by_account_id);
    END IF;
    IF OLD.status='reviewed' THEN
      IF NULLIF(TRIM(NEW.status_change_reason),'') IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reopen requires a reason';
      END IF;
      IF NOT (NEW.consumed_at <=> OLD.consumed_at) OR NOT (NEW.timezone <=> OLD.timezone)
        OR NOT (NEW.local_date <=> OLD.local_date) OR NOT (NEW.meal_type <=> OLD.meal_type)
        OR NOT (NEW.note <=> OLD.note) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reopen first, then edit content';
      END IF;
    ELSE
      CALL mvp_assert_resolved_meal(OLD.meal_record_id);
    END IF;
  ELSE
    IF OLD.status='reviewed' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reviewed meal is immutable';
    END IF;
    IF NOT (NEW.status_changed_by_account_id <=> OLD.status_changed_by_account_id)
      OR NOT (NEW.status_changed_at <=> OLD.status_changed_at)
      OR NOT (NEW.status_change_reason <=> OLD.status_change_reason) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transition metadata changes only with status';
    END IF;
  END IF;
  -- Do not re-authorize a historic creator on updates.
  CALL mvp_assert_meal_date(NEW.consumed_at, NEW.timezone, NEW.local_date);
END$$
CREATE TRIGGER mvp_meal_bd BEFORE DELETE ON MealRecord FOR EACH ROW
BEGIN
  IF OLD.status <> 'draft' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only draft meals can be deleted';
  END IF;
END$$

CREATE TRIGGER mvp_analysis_bi BEFORE INSERT ON MealAnalysis FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(NEW.meal_record_id);
  IF NEW.status <> 'queued' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'New analysis must be queued';
  END IF;
END$$
CREATE TRIGGER mvp_analysis_bu BEFORE UPDATE ON MealAnalysis FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(OLD.meal_record_id);
  IF NEW.meal_record_id <> OLD.meal_record_id OR NEW.created_at <> OLD.created_at
    OR NEW.model_name <> OLD.model_name OR NOT (NEW.model_version <=> OLD.model_version) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Analysis identity and model are immutable';
  END IF;
  IF NOT ((OLD.status='queued' AND NEW.status IN ('running','failed')) OR
    (OLD.status='running' AND NEW.status IN ('succeeded','failed'))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid analysis transition; retries create a new analysis';
  END IF;
  IF OLD.started_at IS NOT NULL AND NOT (NEW.started_at <=> OLD.started_at) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Analysis start time is immutable';
  END IF;
END$$
CREATE TRIGGER mvp_analysis_bd BEFORE DELETE ON MealAnalysis FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(OLD.meal_record_id);
  IF OLD.status <> 'queued' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Started analyses retain their history';
  END IF;
END$$

-- Lock catalog parent; catalog writers take the same lock.
CREATE PROCEDURE mvp_prepare_snapshot(IN p_food BIGINT, OUT p_count INT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  SELECT status INTO v_status FROM Food WHERE food_id=p_food FOR UPDATE;
  IF v_status IS NULL OR v_status <> 'active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Confirmation requires active food';
  END IF;
  SELECT COUNT(*) INTO p_count FROM FoodNutrient WHERE food_id=p_food FOR UPDATE;
  IF (SELECT COUNT(*) FROM FoodNutrient fn JOIN Nutrient n ON n.nutrient_id=fn.nutrient_id
      WHERE fn.food_id=p_food AND ((n.nutrient_code='energy' AND n.unit='kcal')
      OR (n.nutrient_code IN ('protein','carbohydrate','fat') AND n.unit='g'))) <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Food needs energy kcal and protein/carbohydrate/fat g rows';
  END IF;
  IF p_count=0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Food without nutrients cannot be confirmed';
  END IF;
END$$
CREATE TRIGGER mvp_item_bi BEFORE INSERT ON MealItem FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(NEW.meal_record_id);
  CALL mvp_assert_item(NEW.meal_record_id,NEW.meal_analysis_id,NEW.food_id,NEW.confirmed_by_account_id);
  IF NEW.confirmation_status='confirmed' THEN
    CALL mvp_prepare_snapshot(NEW.food_id,NEW.snapshot_nutrient_count);
  ELSE
    SET NEW.snapshot_nutrient_count=0;
  END IF;
END$$
CREATE TRIGGER mvp_item_bu BEFORE UPDATE ON MealItem FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(OLD.meal_record_id);
  IF NEW.meal_record_id <> OLD.meal_record_id OR NEW.created_at <> OLD.created_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MealItem parent and created_at are immutable';
  END IF;
  CALL mvp_assert_item(NEW.meal_record_id,NEW.meal_analysis_id,NEW.food_id,
    IF(NOT (NEW.confirmed_by_account_id <=> OLD.confirmed_by_account_id)
       OR NOT (NEW.confirmed_at <=> OLD.confirmed_at)
       OR NOT (NEW.food_id <=> OLD.food_id)
       OR NOT (NEW.confirmed_weight_g <=> OLD.confirmed_weight_g)
       OR NEW.confirmation_status <> OLD.confirmation_status,NEW.confirmed_by_account_id,NULL));
  IF NEW.confirmation_status='confirmed' THEN
    IF OLD.confirmation_status<>'confirmed' OR NOT (NEW.food_id <=> OLD.food_id)
      OR NOT (NEW.confirmed_weight_g <=> OLD.confirmed_weight_g) THEN
      CALL mvp_prepare_snapshot(NEW.food_id,NEW.snapshot_nutrient_count);
    ELSE
      SET NEW.snapshot_nutrient_count=OLD.snapshot_nutrient_count;
    END IF;
  ELSE
    SET NEW.snapshot_nutrient_count=0;
  END IF;
END$$
CREATE TRIGGER mvp_item_bd BEFORE DELETE ON MealItem FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(OLD.meal_record_id);
END$$

CREATE PROCEDURE mvp_build_snapshot(IN p_item BIGINT, IN p_food BIGINT,
  IN p_weight DECIMAL(10,2), IN p_time DATETIME(6), IN p_expected INT UNSIGNED)
BEGIN
  DECLARE v_count INT;
  DELETE FROM MealItemNutrient WHERE meal_item_id=p_item;
  INSERT INTO MealItemNutrient(meal_item_id,nutrient_id,amount,calculated_at)
    SELECT p_item,nutrient_id,ROUND(amount_per_100g*p_weight/100,4),p_time
    FROM FoodNutrient WHERE food_id=p_food;
  SET v_count=ROW_COUNT();
  IF v_count <> p_expected THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Incomplete nutrient snapshot';
  END IF;
END$$
CREATE TRIGGER mvp_item_ai AFTER INSERT ON MealItem FOR EACH ROW
BEGIN
  IF NEW.confirmation_status='confirmed' THEN
    CALL mvp_build_snapshot(NEW.meal_item_id,NEW.food_id,NEW.confirmed_weight_g,NEW.confirmed_at,NEW.snapshot_nutrient_count);
  END IF;
END$$
CREATE TRIGGER mvp_item_au AFTER UPDATE ON MealItem FOR EACH ROW
BEGIN
  IF NEW.confirmation_status<>'confirmed' THEN
    DELETE FROM MealItemNutrient WHERE meal_item_id=NEW.meal_item_id;
  ELSEIF OLD.confirmation_status<>'confirmed' OR NOT (NEW.food_id <=> OLD.food_id)
    OR NOT (NEW.confirmed_weight_g <=> OLD.confirmed_weight_g) THEN
    CALL mvp_build_snapshot(NEW.meal_item_id,NEW.food_id,NEW.confirmed_weight_g,NEW.confirmed_at,NEW.snapshot_nutrient_count);
  END IF;
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
  -- Closing an existing period is allowed after staff disablement.
  IF NOT ((NEW.nutritionist_id <=> OLD.nutritionist_id) AND (NEW.nutrient_id <=> OLD.nutrient_id) AND (NEW.start_date <=> OLD.start_date) AND (NEW.target_basis <=> OLD.target_basis) AND (NEW.target_min <=> OLD.target_min) AND (NEW.target_max <=> OLD.target_max)
    AND NEW.end_date IS NOT NULL AND NEW.end_date <= IFNULL(OLD.end_date,'9999-12-31')) THEN
    CALL mvp_assert_person_scope(NEW.athlete_id, NEW.nutritionist_id, 'nutritionist');
  END IF;
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
  -- Closing an existing period is allowed after staff disablement.
  IF NOT ((NEW.nutritionist_id <=> OLD.nutritionist_id) AND (NEW.food_id <=> OLD.food_id) AND (NEW.start_date <=> OLD.start_date) AND (NEW.restriction_type <=> OLD.restriction_type) AND (NEW.max_daily_amount_g <=> OLD.max_daily_amount_g) AND (NEW.description <=> OLD.description) AND (NEW.note <=> OLD.note)
    AND NEW.end_date IS NOT NULL AND NEW.end_date <= IFNULL(OLD.end_date,'9999-12-31')) THEN
    CALL mvp_assert_person_scope(NEW.athlete_id, NEW.nutritionist_id, 'nutritionist');
  END IF;
  CALL mvp_assert_food_scope(NEW.athlete_id, NEW.food_id);
  CALL mvp_assert_period('restriction', NEW.restriction_id, NEW.athlete_id,
                         NEW.food_id, NEW.start_date, NEW.end_date);
END$$

CREATE TRIGGER mvp_image_bi BEFORE INSERT ON MealImage FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(NEW.meal_record_id);
END$$
CREATE TRIGGER mvp_image_bu BEFORE UPDATE ON MealImage FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(NEW.meal_record_id);
  IF NEW.meal_record_id <> OLD.meal_record_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Child parent is immutable';
  END IF;
END$$
CREATE TRIGGER mvp_image_bd BEFORE DELETE ON MealImage FOR EACH ROW
BEGIN
  CALL mvp_lock_editable_meal(OLD.meal_record_id);
END$$
CREATE TRIGGER mvp_snapshot_bi BEFORE INSERT ON MealItemNutrient FOR EACH ROW
BEGIN
  DECLARE v_meal BIGINT;
  SELECT meal_record_id INTO v_meal FROM MealItem WHERE meal_item_id=NEW.meal_item_id;
  CALL mvp_lock_editable_meal(v_meal);
END$$
CREATE TRIGGER mvp_snapshot_bu BEFORE UPDATE ON MealItemNutrient FOR EACH ROW
BEGIN
  DECLARE v_meal BIGINT;
  SELECT meal_record_id INTO v_meal FROM MealItem WHERE meal_item_id=NEW.meal_item_id;
  CALL mvp_lock_editable_meal(v_meal);
  IF NEW.meal_item_id <> OLD.meal_item_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Child parent is immutable';
  END IF;
END$$
CREATE TRIGGER mvp_snapshot_bd BEFORE DELETE ON MealItemNutrient FOR EACH ROW
BEGIN
  DECLARE v_meal BIGINT;
  SELECT meal_record_id INTO v_meal FROM MealItem WHERE meal_item_id=OLD.meal_item_id;
  CALL mvp_lock_editable_meal(v_meal);
END$$
CREATE TRIGGER mvp_foodnutrient_bi BEFORE INSERT ON FoodNutrient FOR EACH ROW
BEGIN
  DECLARE v_food BIGINT;
  SELECT food_id INTO v_food FROM Food WHERE food_id=NEW.food_id FOR UPDATE;
END$$
CREATE TRIGGER mvp_foodnutrient_bu BEFORE UPDATE ON FoodNutrient FOR EACH ROW
BEGIN
  DECLARE v_food BIGINT;
  SELECT food_id INTO v_food FROM Food WHERE food_id=NEW.food_id FOR UPDATE;
  IF NEW.food_id <> OLD.food_id OR NEW.nutrient_id <> OLD.nutrient_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Catalog nutrient identity is immutable';
  END IF;
END$$
CREATE TRIGGER mvp_foodnutrient_bd BEFORE DELETE ON FoodNutrient FOR EACH ROW
BEGIN
  DECLARE v_food BIGINT;
  SELECT food_id INTO v_food FROM Food WHERE food_id=OLD.food_id FOR UPDATE;
END$$

DELIMITER ;

-- Counts are captured at confirmation. Catalog changes do not invalidate history.
CREATE VIEW mvp_snapshot_mismatch AS
  SELECT mi.meal_item_id,'snapshot_count_mismatch' AS problem
    FROM MealItem mi WHERE mi.confirmation_status='confirmed'
    AND (mi.snapshot_nutrient_count=0 OR mi.snapshot_nutrient_count <>
      (SELECT COUNT(*) FROM MealItemNutrient n WHERE n.meal_item_id=mi.meal_item_id))
  UNION ALL
  SELECT mi.meal_item_id,'snapshot_without_confirmation'
    FROM MealItem mi WHERE mi.confirmation_status<>'confirmed'
    AND EXISTS (SELECT 1 FROM MealItemNutrient n WHERE n.meal_item_id=mi.meal_item_id);

-- v10: only public commands own transactions; helpers below never commit.
DELIMITER $$

CREATE TRIGGER mvp_daily_plan_bi BEFORE INSERT ON AthleteDailyNutritionPlan FOR EACH ROW
BEGIN
  CALL mvp_assert_nutritionist(NEW.athlete_id,NEW.confirmed_by_account_id);
END$$
CREATE TRIGGER mvp_daily_plan_bu BEFORE UPDATE ON AthleteDailyNutritionPlan FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Confirmed plans are immutable; create a new revision'; END$$
CREATE TRIGGER mvp_daily_plan_bd BEFORE DELETE ON AthleteDailyNutritionPlan FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Confirmed plans retain their history'; END$$
CREATE TRIGGER mvp_revision_bu BEFORE UPDATE ON MealRevision FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meal history is append-only'; END$$
CREATE TRIGGER mvp_revision_bd BEFORE DELETE ON MealRevision FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meal history is append-only'; END$$

CREATE PROCEDURE mvp_json_number(IN p_json LONGTEXT, IN p_key VARCHAR(40), OUT p_value DECIMAL(30,10))
BEGIN
  DECLARE v_text LONGTEXT;
  DECLARE v_type VARCHAR(20);
  SET v_type=JSON_TYPE(JSON_EXTRACT(p_json,CONCAT('$.',p_key)));
  SET v_text=JSON_UNQUOTE(JSON_EXTRACT(p_json,CONCAT('$.',p_key)));
  IF v_type IS NULL OR v_type NOT IN ('INTEGER','DOUBLE','STRING')
    OR v_text IS NULL OR v_text NOT REGEXP '^-?[0-9]+([.][0-9]+)?$' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing or invalid numeric input';
  END IF;
  SET p_value=CAST(v_text AS DECIMAL(30,10));
  IF p_value=0 AND v_text REGEXP '[1-9]' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Numeric input is below supported precision';
  END IF;
END$$

CREATE PROCEDURE mvp_capture_meal(IN p_meal BIGINT, OUT p_json LONGTEXT)
BEGIN
  DECLARE v_done BOOLEAN DEFAULT FALSE;
  DECLARE v_id BIGINT;
  DECLARE v_analysis BIGINT;
  DECLARE v_food BIGINT;
  DECLARE v_name VARCHAR(150);
  DECLARE v_label VARCHAR(255);
  DECLARE v_estimated DECIMAL(10,2);
  DECLARE v_weight DECIMAL(10,2);
  DECLARE v_source VARCHAR(50);
  DECLARE v_status VARCHAR(30);
  DECLARE v_actor BIGINT;
  DECLARE v_time DATETIME(6);
  DECLARE v_items LONGTEXT DEFAULT '[]';
  DECLARE v_images LONGTEXT DEFAULT '[]';
  DECLARE v_nutrients LONGTEXT;
  DECLARE v_analyses LONGTEXT DEFAULT '[]';
  DECLARE v_model VARCHAR(150);
  DECLARE v_model_version VARCHAR(100);
  DECLARE v_key VARCHAR(500);
  DECLARE v_mime VARCHAR(100);
  DECLARE items CURSOR FOR SELECT mi.meal_item_id,mi.meal_analysis_id,mi.food_id,f.food_name,
    mi.detected_label,mi.estimated_weight_g,mi.confirmed_weight_g,mi.weight_source,
    mi.confirmation_status,mi.confirmed_by_account_id,mi.confirmed_at
    FROM MealItem mi LEFT JOIN Food f ON f.food_id=mi.food_id
    WHERE mi.meal_record_id=p_meal ORDER BY mi.meal_item_id;
  DECLARE images CURSOR FOR SELECT meal_image_id,object_key,mime_type,uploaded_at
    FROM MealImage WHERE meal_record_id=p_meal ORDER BY meal_image_id;
  DECLARE analyses CURSOR FOR SELECT meal_analysis_id,model_name,model_version,status,created_at
    FROM MealAnalysis WHERE meal_record_id=p_meal ORDER BY meal_analysis_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
  OPEN items;
  item_loop: LOOP
    FETCH items INTO v_id,v_analysis,v_food,v_name,v_label,v_estimated,v_weight,v_source,v_status,v_actor,v_time;
    IF v_done THEN LEAVE item_loop; END IF;
    SET v_nutrients='[]';
    BEGIN
      DECLARE n_done BOOLEAN DEFAULT FALSE;
      DECLARE n_id BIGINT;
      DECLARE n_unit VARCHAR(30);
      DECLARE n_amount DECIMAL(12,4);
      DECLARE n_time DATETIME(6);
      DECLARE nutrients CURSOR FOR SELECT s.nutrient_id,n.unit,s.amount,s.calculated_at
        FROM MealItemNutrient s JOIN Nutrient n ON n.nutrient_id=s.nutrient_id
        WHERE s.meal_item_id=v_id ORDER BY s.nutrient_id;
      DECLARE CONTINUE HANDLER FOR NOT FOUND SET n_done=TRUE;
      OPEN nutrients;
      nutrient_loop: LOOP
        FETCH nutrients INTO n_id,n_unit,n_amount,n_time;
        IF n_done THEN LEAVE nutrient_loop; END IF;
        SET v_nutrients=JSON_ARRAY_APPEND(v_nutrients,'$',JSON_OBJECT(
          'nutrient_id',n_id,'unit',n_unit,'amount',n_amount,'calculated_at',n_time));
      END LOOP;
      CLOSE nutrients;
    END;
    SET v_items=JSON_ARRAY_APPEND(v_items,'$',JSON_OBJECT('item_id',v_id,'analysis_id',v_analysis,
      'food_id',v_food,'food_name',v_name,'detected_label',v_label,'estimated_weight_g',v_estimated,
      'confirmed_weight_g',v_weight,'weight_source',v_source,'confirmation_status',v_status,
      'confirmed_by_account_id',v_actor,'confirmed_at',v_time,'nutrients',JSON_QUERY(v_nutrients,'$')));
  END LOOP;
  CLOSE items;
  SET v_done=FALSE;
  OPEN images;
  image_loop: LOOP
    FETCH images INTO v_id,v_key,v_mime,v_time;
    IF v_done THEN LEAVE image_loop; END IF;
    SET v_images=JSON_ARRAY_APPEND(v_images,'$',JSON_OBJECT('image_id',v_id,'object_key',v_key,'mime_type',v_mime,'uploaded_at',v_time));
  END LOOP;
  CLOSE images;
  SET v_done=FALSE;
  OPEN analyses;
  analysis_loop: LOOP
    FETCH analyses INTO v_id,v_model,v_model_version,v_status,v_time;
    IF v_done THEN LEAVE analysis_loop; END IF;
    SET v_analyses=JSON_ARRAY_APPEND(v_analyses,'$',JSON_OBJECT('analysis_id',v_id,'model_name',v_model,
      'model_version',v_model_version,'status',v_status,'created_at',v_time));
  END LOOP;
  CLOSE analyses;
  SELECT JSON_OBJECT('schema_version',1,'meal_record_id',meal_record_id,'athlete_id',athlete_id,
    'consumed_at',consumed_at,'local_date',local_date,'timezone',timezone,'meal_type',meal_type,
    'note',note,'status',status,'revision',revision,'items',JSON_QUERY(v_items,'$'),'images',JSON_QUERY(v_images,'$'),'analyses',JSON_QUERY(v_analyses,'$'))
    INTO p_json FROM MealRecord WHERE meal_record_id=p_meal;
  IF p_json IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meal not found'; END IF;
END$$

CREATE PROCEDURE mvp_record_revision(IN p_meal BIGINT, IN p_actor BIGINT, IN p_action VARCHAR(30),
  IN p_reason VARCHAR(500), IN p_before LONGTEXT)
BEGIN
  DECLARE v_after LONGTEXT;
  DECLARE v_revision INT UNSIGNED;
  CALL mvp_capture_meal(p_meal,v_after);
  SELECT revision INTO v_revision FROM MealRecord WHERE meal_record_id=p_meal;
  INSERT INTO MealRevision(meal_record_id,revision,action,actor_account_id,reason,before_json,after_json,recorded_at)
    VALUES(p_meal,v_revision,p_action,p_actor,p_reason,p_before,v_after,UTC_TIMESTAMP(6));
END$$

CREATE PROCEDURE mvp_require_reason(IN p_reason VARCHAR(500))
BEGIN
  IF NULLIF(TRIM(p_reason),'') IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='A correction reason is required';
  END IF;
END$$

-- Caller holds the parent meal lock. Return the existing/new item ID.
CREATE PROCEDURE mvp_apply_item(IN p_meal BIGINT, IN p_actor BIGINT, IN p_item BIGINT,
  IN p_decision VARCHAR(30), IN p_food BIGINT, IN p_weight DECIMAL(10,2),
  IN p_source VARCHAR(50), IN p_label VARCHAR(255), IN p_reason VARCHAR(500), OUT p_id BIGINT)
BEGIN
  DECLARE v_parent BIGINT DEFAULT NULL;
  DECLARE v_old_status VARCHAR(30);
  DECLARE v_old_food BIGINT;
  DECLARE v_old_weight DECIMAL(10,2);
  DECLARE v_old_source VARCHAR(50);
  DECLARE v_count INT UNSIGNED;
  IF p_decision IS NULL OR p_decision NOT IN ('confirmed','rejected') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Item decision must be confirmed or rejected';
  END IF;
  IF p_item IS NULL THEN
    IF p_decision='rejected' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot add a rejected item'; END IF;
    INSERT INTO MealItem(meal_record_id,food_id,detected_label,confirmation_status,created_at,updated_at)
      VALUES(p_meal,p_food,p_label,'pending',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
    SET p_id=LAST_INSERT_ID();
  ELSE
    SET p_id=p_item;
  END IF;
  SELECT meal_record_id,confirmation_status,food_id,confirmed_weight_g,weight_source
    INTO v_parent,v_old_status,v_old_food,v_old_weight,v_old_source
    FROM MealItem WHERE meal_item_id=p_id FOR UPDATE;
  IF v_parent IS NULL OR v_parent<>p_meal THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Item missing or belongs to another meal';
  END IF;
  IF p_decision='rejected' THEN
    CALL mvp_require_reason(p_reason);
    IF p_food IS NOT NULL OR p_weight IS NOT NULL OR p_source IS NOT NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rejected decision cannot contain confirmation values';
    END IF;
    UPDATE MealItem SET confirmation_status='rejected',confirmed_weight_g=NULL,weight_source=NULL,
      confirmed_by_account_id=NULL,confirmed_at=NULL,updated_at=UTC_TIMESTAMP(6) WHERE meal_item_id=p_id;
  ELSE
    IF p_food IS NULL OR p_weight IS NULL OR p_weight<=0 OR p_source IS NULL OR p_source NOT IN ('ai','measured','manual') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Confirmation needs food, positive weight and source';
    END IF;
    IF v_old_status='confirmed' AND v_old_food=p_food AND v_old_weight=p_weight AND v_old_source=p_source THEN
      SET p_id=p_id; -- Deliberate no-op; preserve confirmation metadata and snapshots.
    ELSE
      IF v_old_status='confirmed' THEN CALL mvp_require_reason(p_reason); END IF;
      IF v_old_status<>'confirmed' OR NOT(v_old_food<=>p_food) OR NOT(v_old_weight<=>p_weight) THEN
        CALL mvp_prepare_snapshot(p_food,v_count);
      END IF;
      UPDATE MealItem SET food_id=p_food,confirmed_weight_g=p_weight,weight_source=p_source,
        confirmation_status='confirmed',confirmed_by_account_id=p_actor,confirmed_at=UTC_TIMESTAMP(6),
        updated_at=UTC_TIMESTAMP(6) WHERE meal_item_id=p_id;
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM mvp_snapshot_mismatch WHERE meal_item_id=p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Snapshot verification failed';
  END IF;
END$$

CREATE PROCEDURE mvp_normalize_items(IN p_items LONGTEXT, OUT p_normal LONGTEXT)
BEGIN
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_object LONGTEXT;
  DECLARE v_seen LONGTEXT DEFAULT '[]';
  DECLARE v_sorted LONGTEXT DEFAULT '[]';
  DECLARE v_id BIGINT;
  DECLARE v_food BIGINT;
  DECLARE v_n DECIMAL(30,10);
  DECLARE v_weight DECIMAL(10,2);
  DECLARE v_decision VARCHAR(30);
  DECLARE v_source VARCHAR(50);
  DECLARE v_label VARCHAR(255);
  IF p_items IS NULL OR NOT JSON_VALID(p_items) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid items JSON';
  END IF;
  IF JSON_TYPE(p_items)<>'ARRAY' OR JSON_LENGTH(p_items)=0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Items must be a nonempty array';
  END IF;
  SET p_normal='[]';
  WHILE v_i<JSON_LENGTH(p_items) DO
    SET v_object=JSON_EXTRACT(p_items,CONCAT('$[',v_i,']'));
    IF JSON_TYPE(v_object)<>'OBJECT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Each item must be an object'; END IF;
    SET v_id=NULL; SET v_food=NULL; SET v_weight=NULL; SET v_source=NULL; SET v_label=NULL;
    IF COALESCE(JSON_TYPE(JSON_EXTRACT(v_object,'$.item_id')),'NULL')<>'NULL' THEN
      CALL mvp_json_number(v_object,'item_id',v_n);
      IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid item ID'; END IF;
      SET v_id=v_n;
      IF JSON_CONTAINS(v_seen,CAST(v_id AS CHAR),'$') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate item ID'; END IF;
      SET v_seen=JSON_ARRAY_APPEND(v_seen,'$',v_id);
    END IF;
    SET v_decision=JSON_UNQUOTE(JSON_EXTRACT(v_object,'$.decision'));
    IF v_decision IS NULL OR v_decision NOT IN ('confirmed','rejected') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing item decision';
    END IF;
    SET v_decision=LOWER(v_decision);
    IF v_decision='confirmed' THEN
      CALL mvp_json_number(v_object,'food_id',v_n);
      IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid food ID'; END IF;
      SET v_food=v_n;
      CALL mvp_json_number(v_object,'weight_g',v_n);
      SET v_weight=v_n;
      SET v_source=LOWER(JSON_UNQUOTE(JSON_EXTRACT(v_object,'$.weight_source')));
      IF v_weight<=0 OR v_source IS NULL OR v_source NOT IN ('ai','manual','measured') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid confirmation weight/source';
      END IF;
    ELSEIF v_id IS NULL OR COALESCE(JSON_TYPE(JSON_EXTRACT(v_object,'$.food_id')),'NULL')<>'NULL'
      OR COALESCE(JSON_TYPE(JSON_EXTRACT(v_object,'$.weight_g')),'NULL')<>'NULL'
      OR COALESCE(JSON_TYPE(JSON_EXTRACT(v_object,'$.weight_source')),'NULL')<>'NULL' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rejected item requires an existing ID and no confirmation fields';
    END IF;
    IF COALESCE(JSON_TYPE(JSON_EXTRACT(v_object,'$.detected_label')),'NULL')<>'NULL' THEN
      IF JSON_TYPE(JSON_EXTRACT(v_object,'$.detected_label'))<>'STRING' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Label must be text'; END IF;
      SET v_label=JSON_UNQUOTE(JSON_EXTRACT(v_object,'$.detected_label'));
    END IF;
    SET p_normal=JSON_ARRAY_APPEND(p_normal,'$',JSON_OBJECT('item_id',v_id,'decision',v_decision,
      'food_id',v_food,'weight_g',v_weight,'weight_source',v_source,'detected_label',v_label));
    SET v_i=v_i+1;
  END WHILE;
  -- Canonical order makes reordering the same input a safe retry.
  BEGIN
    DECLARE v_done BOOLEAN DEFAULT FALSE;
    DECLARE v_ord INT;
    DECLARE rows_cursor CURSOR FOR SELECT ord FROM JSON_TABLE(p_normal,'$[*]' COLUMNS(
      ord FOR ORDINALITY, item_id BIGINT PATH '$.item_id',food_id BIGINT PATH '$.food_id',
      weight_g DECIMAL(10,2) PATH '$.weight_g',source VARCHAR(50) PATH '$.weight_source',
      label VARCHAR(255) PATH '$.detected_label',decision VARCHAR(30) PATH '$.decision')) jt
      ORDER BY item_id IS NULL,item_id,food_id,weight_g,source,label,decision;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
    OPEN rows_cursor;
    sorted_loop: LOOP
      FETCH rows_cursor INTO v_ord;
      IF v_done THEN LEAVE sorted_loop; END IF;
      SET v_sorted=JSON_ARRAY_APPEND(v_sorted,'$',JSON_QUERY(JSON_EXTRACT(p_normal,CONCAT('$[',v_ord-1,']')),'$'));
    END LOOP;
    CLOSE rows_cursor;
  END;
  SET p_normal=v_sorted;
END$$

DELIMITER ;

CREATE VIEW mvp_current_daily_plan AS
 SELECT p.* FROM AthleteDailyNutritionPlan p WHERE NOT EXISTS
 (SELECT 1 FROM AthleteDailyNutritionPlan newer WHERE newer.athlete_id=p.athlete_id
  AND newer.local_date=p.local_date AND newer.revision>p.revision);

CREATE VIEW mvp_daily_intake AS
 SELECT m.athlete_id,m.local_date,s.nutrient_id,SUM(s.amount) AS amount
 FROM MealRecord m JOIN MealItem i ON i.meal_record_id=m.meal_record_id
 JOIN MealItemNutrient s ON s.meal_item_id=i.meal_item_id
 WHERE m.status IN ('submitted','reviewed') AND i.confirmation_status='confirmed'
 GROUP BY m.athlete_id,m.local_date,s.nutrient_id;


DELIMITER $$

CREATE PROCEDURE mvp_create_meal(IN p_athlete BIGINT, IN p_actor BIGINT, IN p_consumed DATETIME(6),
  IN p_timezone VARCHAR(50), IN p_type VARCHAR(50), IN p_note TEXT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_id BIGINT;
  -- Check before installing the rollback handler: never commit/rollback a caller transaction.
  IF @@in_transaction <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Command owns transaction; call outside an existing transaction';
  END IF;
  retry_command: LOOP
    SET v_attempt=v_attempt+1;
    SET v_retry=FALSE;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    command_tx: BEGIN
      DECLARE EXIT HANDLER FOR 1020,1213 BEGIN ROLLBACK; SET v_retry=TRUE; END;
      DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    CALL mvp_assert_actor(p_athlete,p_actor);
    INSERT INTO MealRecord(athlete_id,consumed_at,local_date,timezone,meal_type,note,status,
      created_by_account_id,revision,created_at,updated_at) VALUES
      (p_athlete,p_consumed,DATE(CONVERT_TZ(p_consumed,'+00:00',p_timezone)),p_timezone,p_type,p_note,
       'draft',p_actor,1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
    SET v_id=LAST_INSERT_ID();
    CALL mvp_record_revision(v_id,p_actor,'create',NULL,NULL);
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;
  SELECT v_id AS meal_record_id,1 AS revision;
END$$

CREATE PROCEDURE mvp_save_daily_plan(IN p_athlete BIGINT, IN p_actor BIGINT, IN p_date DATE, IN p_expected INT,
  IN p_input LONGTEXT, IN p_ack TINYINT, IN p_reason VARCHAR(500))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_id BIGINT;
  DECLARE v_lock BIGINT;
  DECLARE v_latest INT UNSIGNED;
  DECLARE v_weight DECIMAL(6,2);
  DECLARE v_energy DECIMAL(12,4);
  DECLARE v_protein DECIMAL(30,10);
  DECLARE v_carbs DECIMAL(30,10);
  DECLARE v_fat DECIMAL(30,10);
  DECLARE v_n DECIMAL(30,10);
  DECLARE v_protein_kg DECIMAL(30,10);
  DECLARE v_carb_kg DECIMAL(30,10);
  DECLARE v_fat_floor DECIMAL(30,10);
  DECLARE v_day VARCHAR(20);
  DECLARE v_fat_unit VARCHAR(20);
  DECLARE v_manual BOOLEAN;
  DECLARE v_warnings LONGTEXT;
  IF @@in_transaction <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Command owns transaction; call outside an existing transaction';
  END IF;
  retry_command: LOOP
    SET v_attempt=v_attempt+1;
    SET v_retry=FALSE;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    command_tx: BEGIN
      DECLARE EXIT HANDLER FOR 1020,1213 BEGIN ROLLBACK; SET v_retry=TRUE; END;
      DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
      SET v_lock=NULL;
      SELECT athlete_id INTO v_lock FROM Athlete WHERE athlete_id=p_athlete FOR UPDATE;
      IF v_lock IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Athlete not found'; END IF;
      CALL mvp_assert_nutritionist(p_athlete,p_actor);
      IF p_expected IS NULL OR p_expected<0 OR p_date IS NULL OR p_ack IS NULL OR p_ack NOT IN (0,1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid plan date/version/acknowledgement';
      END IF;
      IF p_input IS NULL OR NOT JSON_VALID(p_input) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid plan JSON'; END IF;
      IF JSON_TYPE(p_input)<>'OBJECT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Plan input must be an object'; END IF;
      SELECT COALESCE(MAX(revision),0) INTO v_latest FROM AthleteDailyNutritionPlan WHERE athlete_id=p_athlete AND local_date=p_date;
      IF v_latest<>p_expected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Stale daily plan revision'; END IF;
      IF v_latest>0 THEN CALL mvp_require_reason(p_reason); END IF;
      CALL mvp_json_number(p_input,'weight',v_n);
      IF v_n<=0 OR v_n<>ROUND(v_n,2) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Calculation weight must be positive with at most two decimals'; END IF;
      SET v_weight=v_n;
      CALL mvp_json_number(p_input,'calories',v_n); SET v_energy=v_n;
      CALL mvp_json_number(p_input,'proteinKg',v_protein_kg);
      CALL mvp_json_number(p_input,'carbMinimum',v_carb_kg);
      CALL mvp_json_number(p_input,'fatValue',v_n);
      IF v_energy<=0 OR v_protein_kg<=0 OR v_carb_kg<0 OR v_n<=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid plan allocation values'; END IF;
      SET v_day=CASE JSON_UNQUOTE(JSON_EXTRACT(p_input,'$.training')) WHEN '訓練日' THEN 'training' WHEN '休息日' THEN 'rest' ELSE NULL END;
      SET v_fat_unit=JSON_UNQUOTE(JSON_EXTRACT(p_input,'$.fatUnit'));
      IF v_day IS NULL OR v_fat_unit IS NULL OR v_fat_unit NOT IN ('kg','percent') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid day or fat unit'; END IF;
      IF v_fat_unit='percent' AND v_n>100 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fat percent exceeds 100'; END IF;
      SET v_fat_floor=IF(v_fat_unit='kg',v_weight*v_n,v_energy*v_n/100/9);
      IF COALESCE(JSON_TYPE(JSON_EXTRACT(p_input,'$.manual')),'NULL')<>'BOOLEAN' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='manual must be a JSON boolean'; END IF;
      SET v_manual=JSON_UNQUOTE(JSON_EXTRACT(p_input,'$.manual'))='true';
      IF v_manual THEN
        CALL mvp_json_number(p_input,'protein',v_protein);
        CALL mvp_json_number(p_input,'carbs',v_carbs);
        CALL mvp_json_number(p_input,'fat',v_fat);
      ELSE
        SET v_protein=v_weight*v_protein_kg;
        SET v_fat=v_fat_floor;
        SET v_carbs=(v_energy-v_weight*v_protein_kg*4-v_fat_floor*9)/4;
      END IF;
      IF v_protein<0 OR v_carbs<0 OR v_fat<0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unrounded final targets must be nonnegative';
      END IF;
      SET v_protein=ROUND(v_protein,1); SET v_carbs=ROUND(v_carbs,1); SET v_fat=ROUND(v_fat,1);
      IF ABS(ROUND(ROUND(v_protein*4+v_carbs*4+v_fat*9,1)-v_energy,1))>5 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Negative or inconsistent final nutrition targets';
      END IF;
      SET v_warnings='[]';
      IF v_carbs+0.1<v_weight*v_carb_kg THEN SET v_warnings=JSON_ARRAY_APPEND(v_warnings,'$','carbohydrate_below_input'); END IF;
      IF v_fat+0.1<v_fat_floor THEN SET v_warnings=JSON_ARRAY_APPEND(v_warnings,'$','fat_below_input'); END IF;
      IF v_manual AND v_protein+0.1<v_weight*v_protein_kg THEN SET v_warnings=JSON_ARRAY_APPEND(v_warnings,'$','protein_below_input'); END IF;
      BEGIN
        DECLARE v_done BOOLEAN DEFAULT FALSE;
        DECLARE v_code VARCHAR(50);
        DECLARE v_basis VARCHAR(20);
        DECLARE v_min DECIMAL(12,4);
        DECLARE v_max DECIMAL(12,4);
        DECLARE v_value DECIMAL(30,10);
        DECLARE policies CURSOR FOR SELECT n.nutrient_code,t.target_basis,t.target_min,t.target_max
          FROM AthleteNutritionTarget t JOIN Nutrient n ON n.nutrient_id=t.nutrient_id
          WHERE t.athlete_id=p_athlete AND t.start_date<=p_date AND (t.end_date IS NULL OR t.end_date>=p_date)
          AND n.nutrient_code IN ('energy','protein','carbohydrate','fat') ORDER BY t.target_id;
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
        OPEN policies;
        policy_loop: LOOP
          FETCH policies INTO v_code,v_basis,v_min,v_max;
          IF v_done THEN LEAVE policy_loop; END IF;
          SET v_value=CASE v_code WHEN 'energy' THEN v_energy WHEN 'protein' THEN v_protein WHEN 'carbohydrate' THEN v_carbs ELSE v_fat END;
          IF v_basis='per_kg_bw' THEN SET v_value=v_value/v_weight; END IF;
          IF (v_min IS NOT NULL AND v_value<v_min) OR (v_max IS NOT NULL AND v_value>v_max) THEN
            SET v_warnings=JSON_ARRAY_APPEND(v_warnings,'$',CONCAT('policy_range:',v_code));
          END IF;
        END LOOP;
        CLOSE policies;
      END;
      IF JSON_LENGTH(v_warnings)>0 AND p_ack<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Plan warnings require acknowledgement'; END IF;
      INSERT INTO AthleteDailyNutritionPlan(athlete_id,local_date,revision,calculation_weight_kg,day_type,input_json,
        target_energy_kcal,target_protein_g,target_carbohydrate_g,target_fat_g,warnings_json,warnings_acknowledged,
        confirmed_by_account_id,confirmed_at,change_reason)
        VALUES(p_athlete,p_date,v_latest+1,v_weight,v_day,p_input,v_energy,v_protein,v_carbs,v_fat,v_warnings,p_ack,p_actor,UTC_TIMESTAMP(6),p_reason);
      SET v_id=LAST_INSERT_ID();
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt>=3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213, MESSAGE_TEXT='Concurrent write retry exhausted';
    END IF;
  END LOOP;
  SELECT v_id AS daily_plan_id,v_latest+1 AS revision;
END$$

CREATE PROCEDURE mvp_mutate_meal(IN p_meal BIGINT, IN p_actor BIGINT, IN p_expected INT, IN p_action VARCHAR(30),
  IN p_payload LONGTEXT, IN p_reason VARCHAR(500))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_before LONGTEXT;
  DECLARE v_after LONGTEXT;
  DECLARE v_revision INT UNSIGNED;
  DECLARE v_athlete BIGINT;
  DECLARE v_status VARCHAR(30);
  DECLARE v_item BIGINT;
  DECLARE v_food BIGINT;
  DECLARE v_analysis BIGINT;
  DECLARE v_result BIGINT;
  DECLARE v_n DECIMAL(30,10);
  DECLARE v_weight DECIMAL(10,2);
  DECLARE v_parent BIGINT;
  DECLARE v_source VARCHAR(50);
  DECLARE v_label VARCHAR(255);
  DECLARE v_key VARCHAR(500);
  DECLARE v_model VARCHAR(150);
  DECLARE v_consumed DATETIME(6);
  DECLARE v_zone VARCHAR(50);
  DECLARE v_new_type VARCHAR(50);
  IF @@in_transaction <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Command owns transaction; call outside an existing transaction';
  END IF;
  retry_command: LOOP
    SET v_attempt=v_attempt+1;
    SET v_retry=FALSE;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    command_tx: BEGIN
      DECLARE EXIT HANDLER FOR 1020,1213 BEGIN ROLLBACK; SET v_retry=TRUE; END;
      DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
      IF p_action IS NULL OR p_action NOT IN ('edit','confirm','reject','add_item','delete_item','review','reopen','add_image','delete_image','queue_analysis') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unsupported meal action';
      END IF;
      IF p_payload IS NULL OR NOT JSON_VALID(p_payload) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid action payload'; END IF;
      IF JSON_TYPE(p_payload)<>'OBJECT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Action payload must be an object'; END IF;
      SET v_athlete=NULL; SET v_result=NULL; SET v_item=NULL; SET v_food=NULL; SET v_analysis=NULL; SET v_parent=NULL;
      CALL mvp_lock_meal_actor(p_meal,p_actor,p_action<>'reopen');
      SELECT athlete_id,status,revision INTO v_athlete,v_status,v_revision FROM MealRecord WHERE meal_record_id=p_meal FOR UPDATE;
      IF p_expected IS NULL OR v_revision<>p_expected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Stale meal revision'; END IF;
      CALL mvp_capture_meal(p_meal,v_before);
      IF p_action IN ('review','reopen') THEN
        CALL mvp_assert_nutritionist(v_athlete,p_actor);
        IF (p_action='review' AND v_status<>'submitted') OR (p_action='reopen' AND v_status<>'reviewed') THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected review/reopen state';
        END IF;
        IF p_action='reopen' THEN CALL mvp_require_reason(p_reason); END IF;
        UPDATE MealRecord SET status=IF(p_action='review','reviewed','submitted'),
          status_changed_by_account_id=p_actor,status_changed_at=UTC_TIMESTAMP(6),
          status_change_reason=IF(p_action='reopen',p_reason,NULL),revision=revision+1,updated_at=UTC_TIMESTAMP(6)
          WHERE meal_record_id=p_meal;
      ELSE
        CASE p_action
        WHEN 'edit' THEN
          SET v_consumed=CAST(JSON_VALUE(p_payload,'$.consumed_at') AS DATETIME(6));
          SET v_zone=JSON_VALUE(p_payload,'$.timezone');
          SET v_new_type=JSON_VALUE(p_payload,'$.meal_type');
          IF v_status='submitted' THEN CALL mvp_require_reason(p_reason); END IF;
          UPDATE MealRecord SET consumed_at=v_consumed,timezone=v_zone,local_date=DATE(CONVERT_TZ(v_consumed,'+00:00',v_zone)),
            meal_type=v_new_type,note=JSON_VALUE(p_payload,'$.note') WHERE meal_record_id=p_meal;
        WHEN 'add_item' THEN
          IF COALESCE(JSON_TYPE(JSON_EXTRACT(p_payload,'$.food_id')),'NULL')<>'NULL' THEN
            CALL mvp_json_number(p_payload,'food_id',v_n); IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid food ID'; END IF; SET v_food=v_n;
          END IF;
          IF COALESCE(JSON_TYPE(JSON_EXTRACT(p_payload,'$.analysis_id')),'NULL')<>'NULL' THEN
            CALL mvp_json_number(p_payload,'analysis_id',v_n); IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid analysis ID'; END IF; SET v_analysis=v_n;
          END IF;
          SET v_label=JSON_VALUE(p_payload,'$.detected_label');
          SET v_weight=NULL;
          IF COALESCE(JSON_TYPE(JSON_EXTRACT(p_payload,'$.estimated_weight_g')),'NULL')<>'NULL' THEN CALL mvp_json_number(p_payload,'estimated_weight_g',v_n); SET v_weight=v_n; END IF;
          IF v_status='submitted' THEN CALL mvp_require_reason(p_reason); END IF;
          INSERT INTO MealItem(meal_record_id,food_id,detected_label,estimated_weight_g,meal_analysis_id,confirmation_status,created_at,updated_at)
            VALUES(p_meal,v_food,v_label,v_weight,v_analysis,'pending',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
          SET v_result=LAST_INSERT_ID();
        WHEN 'confirm' THEN
          CALL mvp_json_number(p_payload,'item_id',v_n); IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid item ID'; END IF; SET v_item=v_n;
          CALL mvp_json_number(p_payload,'food_id',v_n); IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid food ID'; END IF; SET v_food=v_n;
          CALL mvp_json_number(p_payload,'weight_g',v_n); SET v_weight=v_n;
          SET v_source=LOWER(JSON_VALUE(p_payload,'$.weight_source'));
          CALL mvp_apply_item(p_meal,p_actor,v_item,'confirmed',v_food,v_weight,v_source,NULL,p_reason,v_result);
        WHEN 'reject' THEN
          CALL mvp_json_number(p_payload,'item_id',v_n); IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid item ID'; END IF; SET v_item=v_n;
          CALL mvp_apply_item(p_meal,p_actor,v_item,'rejected',NULL,NULL,NULL,NULL,p_reason,v_result);
        WHEN 'delete_item' THEN
          CALL mvp_require_reason(p_reason);
          CALL mvp_json_number(p_payload,'item_id',v_n); IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid item ID'; END IF; SET v_item=v_n;
          SELECT meal_record_id INTO v_parent FROM MealItem WHERE meal_item_id=v_item FOR UPDATE;
          IF v_parent IS NULL OR v_parent<>p_meal THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Item missing or belongs to another meal'; END IF;
          DELETE FROM MealItem WHERE meal_item_id=v_item;
        WHEN 'add_image' THEN
          SET v_key=JSON_VALUE(p_payload,'$.object_key');
          IF NULLIF(TRIM(v_key),'') IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Image object key required'; END IF;
          IF v_status='submitted' THEN CALL mvp_require_reason(p_reason); END IF;
          INSERT INTO MealImage(meal_record_id,object_key,mime_type,uploaded_at)
            VALUES(p_meal,v_key,JSON_VALUE(p_payload,'$.mime_type'),UTC_TIMESTAMP(6));
          SET v_result=LAST_INSERT_ID();
        WHEN 'delete_image' THEN
          CALL mvp_require_reason(p_reason);
          CALL mvp_json_number(p_payload,'image_id',v_n); IF v_n<=0 OR v_n<>FLOOR(v_n) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid image ID'; END IF; SET v_item=v_n;
          SELECT meal_record_id INTO v_parent FROM MealImage WHERE meal_image_id=v_item FOR UPDATE;
          IF v_parent IS NULL OR v_parent<>p_meal THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Image missing or belongs to another meal'; END IF;
          DELETE FROM MealImage WHERE meal_image_id=v_item;
        WHEN 'queue_analysis' THEN
          SET v_model=JSON_VALUE(p_payload,'$.model_name');
          IF NULLIF(TRIM(v_model),'') IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Model name required'; END IF;
          IF v_status='submitted' THEN CALL mvp_require_reason(p_reason); END IF;
          INSERT INTO MealAnalysis(meal_record_id,model_name,model_version,status,created_at)
            VALUES(p_meal,v_model,JSON_VALUE(p_payload,'$.model_version'),'queued',UTC_TIMESTAMP(6));
          SET v_result=LAST_INSERT_ID();
        END CASE;
        CALL mvp_capture_meal(p_meal,v_after);
        -- True no-op retries don't create fake history events.
        IF BINARY v_before<>BINARY v_after THEN
          UPDATE MealRecord SET revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE meal_record_id=p_meal;
        END IF;
      END IF;
      CALL mvp_capture_meal(p_meal,v_after);
      IF BINARY v_before<>BINARY v_after THEN CALL mvp_record_revision(p_meal,p_actor,p_action,p_reason,v_before); END IF;
      SELECT revision INTO v_revision FROM MealRecord WHERE meal_record_id=p_meal;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt>=3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213, MESSAGE_TEXT='Concurrent write retry exhausted';
    END IF;
  END LOOP;
  SELECT p_meal AS meal_record_id,v_revision AS revision,v_result AS resource_id;
END$$

CREATE PROCEDURE mvp_save_meal(IN p_meal BIGINT, IN p_actor BIGINT, IN p_expected INT, IN p_key VARCHAR(64),
  IN p_items LONGTEXT, IN p_reason VARCHAR(500))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_normal LONGTEXT;
  DECLARE v_hash CHAR(64);
  DECLARE v_old_key VARCHAR(64);
  DECLARE v_old_hash CHAR(64);
  DECLARE v_revision INT UNSIGNED;
  DECLARE v_status VARCHAR(30);
  DECLARE v_before LONGTEXT;
  DECLARE v_i INT;
  DECLARE v_object LONGTEXT;
  DECLARE v_item BIGINT;
  DECLARE v_food BIGINT;
  DECLARE v_parent BIGINT;
  DECLARE v_weight DECIMAL(10,2);
  DECLARE v_source VARCHAR(50);
  DECLARE v_label VARCHAR(255);
  DECLARE v_decision VARCHAR(30);
  DECLARE v_result BIGINT;
  DECLARE v_replayed BOOLEAN;
  IF @@in_transaction <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Command owns transaction; call outside an existing transaction';
  END IF;
  retry_command: LOOP
    SET v_attempt=v_attempt+1;
    SET v_retry=FALSE;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    command_tx: BEGIN
      DECLARE EXIT HANDLER FOR 1020,1213 BEGIN ROLLBACK; SET v_retry=TRUE; END;
      DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
      SET v_replayed=FALSE; SET v_old_key=NULL; SET v_old_hash=NULL;
      CALL mvp_lock_meal_actor(p_meal,p_actor,FALSE);
      CALL mvp_normalize_items(p_items,v_normal);
      IF p_key IS NULL OR p_key NOT REGEXP BINARY '^[A-Za-z0-9_-]{1,64}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request key must be 1-64 ASCII letters/digits/underscore/hyphen';
      END IF;
      SET v_hash=SHA2(JSON_COMPACT(JSON_OBJECT('meal',p_meal,'actor',p_actor,'items',JSON_QUERY(v_normal,'$'),
        'reason',NULLIF(TRIM(p_reason),''))),256);
      SELECT status,revision,submission_request_id,submission_request_hash INTO v_status,v_revision,v_old_key,v_old_hash
        FROM MealRecord WHERE meal_record_id=p_meal FOR UPDATE;
      IF v_old_key IS NOT NULL THEN
        IF BINARY v_old_key<>BINARY p_key OR v_old_hash<>v_hash THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meal already saved with a different request'; END IF;
        SELECT revision INTO v_revision FROM MealRevision WHERE meal_record_id=p_meal AND action='save';
        SET v_replayed=TRUE;
      ELSE
        IF v_status<>'draft' OR p_expected IS NULL OR v_revision<>p_expected THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected meal state or stale revision for save';
        END IF;
        CALL mvp_capture_meal(p_meal,v_before);
        -- Lock all existing items before any catalog parent, in stable order.
        SET v_i=0;
        WHILE v_i<JSON_LENGTH(v_normal) DO
          SET v_object=JSON_EXTRACT(v_normal,CONCAT('$[',v_i,']'));
          SET v_item=JSON_VALUE(v_object,'$.item_id');
          IF v_item IS NOT NULL THEN
            SET v_parent=NULL;
            SELECT meal_record_id INTO v_parent FROM MealItem WHERE meal_item_id=v_item FOR UPDATE;
            IF v_parent IS NULL OR v_parent<>p_meal THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Item missing or belongs to another meal'; END IF;
          END IF;
          SET v_i=v_i+1;
        END WHILE;
        BEGIN
          DECLARE v_done BOOLEAN DEFAULT FALSE;
          DECLARE v_lock BIGINT;
          DECLARE foods CURSOR FOR SELECT DISTINCT food_id FROM JSON_TABLE(v_normal,'$[*]' COLUMNS(food_id BIGINT PATH '$.food_id')) jt
            WHERE food_id IS NOT NULL ORDER BY food_id;
          DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
          OPEN foods;
          food_loop: LOOP
            FETCH foods INTO v_food;
            IF v_done THEN LEAVE food_loop; END IF;
            SET v_lock=NULL;
            SELECT food_id INTO v_lock FROM Food WHERE food_id=v_food FOR UPDATE;
            IF v_lock IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Food not found'; END IF;
          END LOOP;
          CLOSE foods;
        END;
        SET v_i=0;
        WHILE v_i<JSON_LENGTH(v_normal) DO
          SET v_object=JSON_EXTRACT(v_normal,CONCAT('$[',v_i,']'));
          SET v_item=JSON_VALUE(v_object,'$.item_id'); SET v_food=JSON_VALUE(v_object,'$.food_id');
          SET v_weight=JSON_VALUE(v_object,'$.weight_g'); SET v_source=JSON_VALUE(v_object,'$.weight_source');
          SET v_label=JSON_VALUE(v_object,'$.detected_label'); SET v_decision=JSON_VALUE(v_object,'$.decision');
          CALL mvp_apply_item(p_meal,p_actor,v_item,v_decision,v_food,v_weight,v_source,v_label,p_reason,v_result);
          SET v_i=v_i+1;
        END WHILE;
        CALL mvp_assert_resolved_meal(p_meal);
        UPDATE MealRecord SET status='submitted',status_changed_by_account_id=p_actor,status_changed_at=UTC_TIMESTAMP(6),
          status_change_reason=NULL,revision=revision+1,submission_request_id=p_key,submission_request_hash=v_hash,
          updated_at=UTC_TIMESTAMP(6) WHERE meal_record_id=p_meal;
        CALL mvp_record_revision(p_meal,p_actor,'save',p_reason,v_before);
        SELECT revision INTO v_revision FROM MealRecord WHERE meal_record_id=p_meal;
      END IF;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt>=3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213, MESSAGE_TEXT='Concurrent write retry exhausted';
    END IF;
  END LOOP;
  SELECT p_meal AS meal_record_id,v_revision AS revision,'submitted' AS status,v_replayed AS replayed;
END$$

CREATE PROCEDURE mvp_start_analysis(IN p_analysis BIGINT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_meal BIGINT DEFAULT NULL;
  DECLARE v_locked BIGINT DEFAULT NULL;
  -- Check before installing the rollback handler: never commit/rollback a caller transaction.
  IF @@in_transaction <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Command owns transaction; call outside an existing transaction';
  END IF;
  retry_command: LOOP
    SET v_attempt=v_attempt+1;
    SET v_retry=FALSE;
    SET v_meal=NULL;
    SET v_locked=NULL;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    command_tx: BEGIN
      DECLARE EXIT HANDLER FOR 1020,1213 BEGIN ROLLBACK; SET v_retry=TRUE; END;
      DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    SELECT meal_record_id INTO v_meal FROM MealAnalysis WHERE meal_analysis_id=p_analysis;
    CALL mvp_lock_editable_meal(v_meal);
    SELECT meal_analysis_id INTO v_locked FROM MealAnalysis WHERE meal_analysis_id=p_analysis FOR UPDATE;
    IF v_locked IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Analysis not found';
    END IF;
    UPDATE MealAnalysis SET status='running',started_at=UTC_TIMESTAMP(6) WHERE meal_analysis_id=p_analysis;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_finish_analysis(IN p_analysis BIGINT, IN p_status VARCHAR(30), IN p_result LONGTEXT, IN p_error TEXT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_meal BIGINT DEFAULT NULL;
  DECLARE v_locked BIGINT DEFAULT NULL;
  -- Check before installing the rollback handler: never commit/rollback a caller transaction.
  IF @@in_transaction <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Command owns transaction; call outside an existing transaction';
  END IF;
  retry_command: LOOP
    SET v_attempt=v_attempt+1;
    SET v_retry=FALSE;
    SET v_meal=NULL;
    SET v_locked=NULL;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    command_tx: BEGIN
      DECLARE EXIT HANDLER FOR 1020,1213 BEGIN ROLLBACK; SET v_retry=TRUE; END;
      DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    SELECT meal_record_id INTO v_meal FROM MealAnalysis WHERE meal_analysis_id=p_analysis;
    CALL mvp_lock_editable_meal(v_meal);
    SELECT meal_analysis_id INTO v_locked FROM MealAnalysis WHERE meal_analysis_id=p_analysis FOR UPDATE;
    IF v_locked IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Analysis not found';
    END IF;
    IF p_status IS NULL OR p_status NOT IN ('succeeded','failed') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Finish status must be succeeded or failed';
    END IF;
    UPDATE MealAnalysis SET status=p_status,raw_result_json=p_result,error_message=p_error,
      started_at=COALESCE(started_at,UTC_TIMESTAMP(6)),completed_at=UTC_TIMESTAMP(6)
      WHERE meal_analysis_id=p_analysis;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

DELIMITER ;
