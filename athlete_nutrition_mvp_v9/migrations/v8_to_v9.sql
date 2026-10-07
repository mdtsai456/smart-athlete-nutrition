-- MVP v8 -> v9 safe upgrade for databases without finalized intake history.
-- Maintenance window, backup and restore rehearsal required. NEVER use --force.
-- Historical confirmed/submitted/reviewed/started-analysis rows need a reviewed,
-- data-specific backfill; do not invent attribution or recalculate old snapshots.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone='+00:00';
SET SESSION sql_mode='STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE,NO_ENGINE_SUBSTITUTION';
DROP PROCEDURE IF EXISTS mvp_v9_preflight;
DELIMITER $$
CREATE PROCEDURE mvp_v9_preflight()
BEGIN
  IF EXISTS (SELECT 1 FROM MealRecord WHERE status<>'draft')
    OR EXISTS (SELECT 1 FROM MealItem WHERE confirmation_status='confirmed'
      OR confirmed_weight_g IS NOT NULL OR confirmed_by_account_id IS NOT NULL
      OR confirmed_at IS NOT NULL OR weight_source IS NOT NULL)
    OR EXISTS (SELECT 1 FROM MealItemNutrient)
    OR EXISTS (SELECT 1 FROM MealAnalysis WHERE status<>'queued' OR started_at IS NOT NULL
      OR completed_at IS NOT NULL OR raw_result_json IS NOT NULL OR error_message IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical or inconsistent data requires audited backfill before v9 upgrade';
  END IF;
END$$
DELIMITER ;
CALL mvp_v9_preflight();
DROP PROCEDURE mvp_v9_preflight;
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE MealRecord
  ADD COLUMN status_changed_by_account_id BIGINT,
  ADD COLUMN status_changed_at DATETIME(6),
  ADD COLUMN status_change_reason VARCHAR(500),
  ADD CONSTRAINT fk_meal_status_actor FOREIGN KEY(status_changed_by_account_id) REFERENCES Account(account_id);
ALTER TABLE MealItem ADD COLUMN snapshot_nutrient_count INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE MealItem DROP CONSTRAINT chk_meal_item_confirmed_complete;
ALTER TABLE MealRecord ADD CONSTRAINT `chk_meal_status_metadata` CHECK ((status = 'draft' AND status_changed_by_account_id IS NULL AND status_changed_at IS NULL AND status_change_reason IS NULL) OR (status IN ('submitted', 'reviewed') AND status_changed_by_account_id IS NOT NULL AND status_changed_at IS NOT NULL));
ALTER TABLE MealItem ADD CONSTRAINT `chk_meal_item_confirmed_complete` CHECK ((confirmation_status = 'confirmed' AND confirmed_weight_g IS NOT NULL AND weight_source IS NOT NULL AND confirmed_by_account_id IS NOT NULL AND confirmed_at IS NOT NULL AND snapshot_nutrient_count > 0) OR (confirmation_status IN ('pending', 'rejected') AND confirmed_weight_g IS NULL AND weight_source IS NULL AND confirmed_by_account_id IS NULL AND confirmed_at IS NULL AND snapshot_nutrient_count = 0));
ALTER TABLE MealAnalysis ADD CONSTRAINT `chk_analysis_lifecycle` CHECK (
    (status = 'queued' AND started_at IS NULL AND completed_at IS NULL AND error_message IS NULL AND raw_result_json IS NULL) OR
    (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL AND error_message IS NULL AND raw_result_json IS NULL) OR
    (status = 'succeeded' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND error_message IS NULL AND raw_result_json IS NOT NULL) OR
    (status = 'failed' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND error_message IS NOT NULL AND CHAR_LENGTH(TRIM(error_message)) > 0 AND raw_result_json IS NULL));
ALTER TABLE MealAnalysis ADD CONSTRAINT `chk_analysis_time_order` CHECK ((started_at IS NULL OR started_at >= created_at) AND (completed_at IS NULL OR completed_at >= started_at));
DROP TRIGGER IF EXISTS mvp_account_bu;
DROP TRIGGER IF EXISTS mvp_athlete_bi;
DROP TRIGGER IF EXISTS mvp_athlete_bu;
DROP TRIGGER IF EXISTS mvp_nutritionist_bi;
DROP TRIGGER IF EXISTS mvp_nutritionist_bu;
DROP TRIGGER IF EXISTS mvp_coach_bi;
DROP TRIGGER IF EXISTS mvp_coach_bu;
DROP TRIGGER IF EXISTS mvp_food_bu;
DROP TRIGGER IF EXISTS mvp_nutrient_bu;
DROP TRIGGER IF EXISTS mvp_athlete_coach_bi;
DROP TRIGGER IF EXISTS mvp_athlete_coach_bu;
DROP TRIGGER IF EXISTS mvp_meal_bi;
DROP TRIGGER IF EXISTS mvp_meal_bu;
DROP TRIGGER IF EXISTS mvp_meal_bd;
DROP TRIGGER IF EXISTS mvp_analysis_bi;
DROP TRIGGER IF EXISTS mvp_analysis_bu;
DROP TRIGGER IF EXISTS mvp_analysis_bd;
DROP TRIGGER IF EXISTS mvp_item_bi;
DROP TRIGGER IF EXISTS mvp_item_bu;
DROP TRIGGER IF EXISTS mvp_item_bd;
DROP TRIGGER IF EXISTS mvp_item_ai;
DROP TRIGGER IF EXISTS mvp_item_au;
DROP TRIGGER IF EXISTS mvp_target_bi;
DROP TRIGGER IF EXISTS mvp_target_bu;
DROP TRIGGER IF EXISTS mvp_restriction_bi;
DROP TRIGGER IF EXISTS mvp_restriction_bu;
DROP TRIGGER IF EXISTS mvp_image_bi;
DROP TRIGGER IF EXISTS mvp_image_bu;
DROP TRIGGER IF EXISTS mvp_image_bd;
DROP TRIGGER IF EXISTS mvp_snapshot_bi;
DROP TRIGGER IF EXISTS mvp_snapshot_bu;
DROP TRIGGER IF EXISTS mvp_snapshot_bd;
DROP TRIGGER IF EXISTS mvp_foodnutrient_bi;
DROP TRIGGER IF EXISTS mvp_foodnutrient_bu;
DROP TRIGGER IF EXISTS mvp_foodnutrient_bd;
DROP PROCEDURE IF EXISTS mvp_assert_profile;
DROP PROCEDURE IF EXISTS mvp_assert_actor;
DROP PROCEDURE IF EXISTS mvp_assert_nutritionist;
DROP PROCEDURE IF EXISTS mvp_assert_person_scope;
DROP PROCEDURE IF EXISTS mvp_assert_food_scope;
DROP PROCEDURE IF EXISTS mvp_assert_meal_date;
DROP PROCEDURE IF EXISTS mvp_assert_period;
DROP PROCEDURE IF EXISTS mvp_assert_item;
DROP PROCEDURE IF EXISTS mvp_lock_editable_meal;
DROP PROCEDURE IF EXISTS mvp_lock_meal_actor;
DROP PROCEDURE IF EXISTS mvp_assert_resolved_meal;
DROP PROCEDURE IF EXISTS mvp_prepare_snapshot;
DROP PROCEDURE IF EXISTS mvp_build_snapshot;
DROP PROCEDURE IF EXISTS mvp_create_meal;
DROP PROCEDURE IF EXISTS mvp_edit_meal;
DROP PROCEDURE IF EXISTS mvp_add_item;
DROP PROCEDURE IF EXISTS mvp_confirm_item;
DROP PROCEDURE IF EXISTS mvp_reject_item;
DROP PROCEDURE IF EXISTS mvp_delete_item;
DROP PROCEDURE IF EXISTS mvp_submit_meal;
DROP PROCEDURE IF EXISTS mvp_review_meal;
DROP PROCEDURE IF EXISTS mvp_reopen_meal;
DROP PROCEDURE IF EXISTS mvp_add_image;
DROP PROCEDURE IF EXISTS mvp_delete_image;
DROP PROCEDURE IF EXISTS mvp_queue_analysis;
DROP PROCEDURE IF EXISTS mvp_start_analysis;
DROP PROCEDURE IF EXISTS mvp_finish_analysis;
DROP FUNCTION IF EXISTS mvp_athlete_org;
DROP VIEW IF EXISTS mvp_snapshot_mismatch;
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
  DECLARE v_analysis BIGINT;
  DECLARE v_mismatch BIGINT;
  SELECT COUNT(*),COALESCE(SUM(confirmation_status='pending'),0)
    INTO v_items,v_pending FROM MealItem WHERE meal_record_id=p_meal FOR UPDATE;
  SELECT COUNT(*) INTO v_analysis FROM MealAnalysis WHERE meal_record_id=p_meal
    AND status IN ('queued','running') FOR UPDATE;
  SELECT COUNT(*) INTO v_mismatch FROM MealItem mi WHERE meal_record_id=p_meal
    AND ((mi.confirmation_status='confirmed' AND mi.snapshot_nutrient_count <>
      (SELECT COUNT(*) FROM MealItemNutrient n WHERE n.meal_item_id=mi.meal_item_id))
    OR (mi.confirmation_status<>'confirmed' AND EXISTS
      (SELECT 1 FROM MealItemNutrient n WHERE n.meal_item_id=mi.meal_item_id))) FOR UPDATE;
  IF v_items=0 OR v_pending>0 OR v_analysis>0 OR v_mismatch>0 THEN
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
      OR NOT (NEW.confirmed_weight_g <=> OLD.confirmed_weight_g)
      OR NOT (NEW.confirmed_at <=> OLD.confirmed_at) THEN
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
    OR NOT (NEW.confirmed_weight_g <=> OLD.confirmed_weight_g)
    OR NOT (NEW.confirmed_at <=> OLD.confirmed_at) THEN
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
  IF NOT ((NEW.nutritionist_id <=> OLD.nutritionist_id) AND (NEW.food_id <=> OLD.food_id) AND (NEW.start_date <=> OLD.start_date) AND (NEW.restriction_type <=> OLD.restriction_type) AND (NEW.max_amount_g <=> OLD.max_amount_g) AND (NEW.description <=> OLD.description) AND (NEW.note <=> OLD.note)
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

-- Public command API. Application grants only these routines.
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
      created_by_account_id,created_at,updated_at) VALUES
      (p_athlete,p_consumed,DATE(CONVERT_TZ(p_consumed,'+00:00',p_timezone)),p_timezone,p_type,p_note,
       'draft',p_actor,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
    SET v_id=LAST_INSERT_ID();
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;
  SELECT v_id AS meal_record_id;
END$$

CREATE PROCEDURE mvp_edit_meal(IN p_meal BIGINT, IN p_actor BIGINT, IN p_consumed DATETIME(6),
  IN p_timezone VARCHAR(50), IN p_type VARCHAR(50), IN p_note TEXT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;

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
    CALL mvp_lock_meal_actor(p_meal,p_actor,TRUE);
    UPDATE MealRecord SET consumed_at=p_consumed,timezone=p_timezone,
      local_date=DATE(CONVERT_TZ(p_consumed,'+00:00',p_timezone)),meal_type=p_type,note=p_note,
      updated_at=UTC_TIMESTAMP(6) WHERE meal_record_id=p_meal;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_add_item(IN p_meal BIGINT, IN p_actor BIGINT, IN p_food BIGINT,
  IN p_label VARCHAR(255), IN p_estimated DECIMAL(10,2), IN p_analysis BIGINT)
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
    CALL mvp_lock_meal_actor(p_meal,p_actor,TRUE);
    INSERT INTO MealItem(meal_record_id,food_id,detected_label,estimated_weight_g,meal_analysis_id,
      confirmation_status,created_at,updated_at) VALUES
      (p_meal,p_food,p_label,p_estimated,p_analysis,'pending',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
    SET v_id=LAST_INSERT_ID();
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;
  SELECT v_id AS meal_item_id;
END$$

CREATE PROCEDURE mvp_confirm_item(IN p_item BIGINT, IN p_actor BIGINT, IN p_food BIGINT,
  IN p_weight DECIMAL(10,2), IN p_source VARCHAR(50))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_meal BIGINT DEFAULT NULL;
  DECLARE v_locked BIGINT DEFAULT NULL;
  DECLARE v_source_count INT UNSIGNED;
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
    SELECT meal_record_id INTO v_meal FROM MealItem WHERE meal_item_id=p_item;
    CALL mvp_lock_meal_actor(v_meal,p_actor,TRUE);
    SELECT meal_item_id INTO v_locked FROM MealItem WHERE meal_item_id=p_item FOR UPDATE;
    IF v_locked IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meal item not found';
    END IF;
    IF p_food IS NULL OR p_weight IS NULL OR p_weight<=0 OR p_source IS NULL
      OR p_source NOT IN ('ai','manual','measured') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Confirmation needs food, positive weight and source';
    END IF;
    -- Identical retries retain the original snapshot even if the catalog later changed.
    IF NOT EXISTS (SELECT 1 FROM MealItem WHERE meal_item_id=p_item
      AND confirmation_status='confirmed' AND food_id=p_food
      AND confirmed_weight_g=p_weight AND weight_source=p_source) THEN
      -- Acquire catalog lock before the UPDATE statement establishes its read view.
      CALL mvp_prepare_snapshot(p_food,v_source_count);
      UPDATE MealItem SET food_id=p_food,confirmed_weight_g=p_weight,weight_source=p_source,
        confirmation_status='confirmed',confirmed_by_account_id=p_actor,
        confirmed_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE meal_item_id=p_item;
    END IF;
    IF EXISTS (SELECT 1 FROM mvp_snapshot_mismatch WHERE meal_item_id=p_item) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Snapshot verification failed';
    END IF;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_reject_item(IN p_item BIGINT, IN p_actor BIGINT)
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
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    command_tx: BEGIN
      DECLARE EXIT HANDLER FOR 1020,1213 BEGIN ROLLBACK; SET v_retry=TRUE; END;
      DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    SELECT meal_record_id INTO v_meal FROM MealItem WHERE meal_item_id=p_item;
    CALL mvp_lock_meal_actor(v_meal,p_actor,TRUE);
    SELECT meal_item_id INTO v_locked FROM MealItem WHERE meal_item_id=p_item FOR UPDATE;
    IF v_locked IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meal item not found';
    END IF;
    UPDATE MealItem SET confirmation_status='rejected',confirmed_weight_g=NULL,
      weight_source=NULL,confirmed_by_account_id=NULL,confirmed_at=NULL,updated_at=UTC_TIMESTAMP(6)
      WHERE meal_item_id=p_item;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_delete_item(IN p_item BIGINT, IN p_actor BIGINT)
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
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    command_tx: BEGIN
      DECLARE EXIT HANDLER FOR 1020,1213 BEGIN ROLLBACK; SET v_retry=TRUE; END;
      DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    SELECT meal_record_id INTO v_meal FROM MealItem WHERE meal_item_id=p_item;
    CALL mvp_lock_meal_actor(v_meal,p_actor,TRUE);
    SELECT meal_item_id INTO v_locked FROM MealItem WHERE meal_item_id=p_item FOR UPDATE;
    IF v_locked IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Meal item not found';
    END IF;
    DELETE FROM MealItem WHERE meal_item_id=p_item;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_submit_meal(IN p_meal BIGINT, IN p_actor BIGINT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_athlete BIGINT;
  DECLARE v_status VARCHAR(30);
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
    CALL mvp_lock_meal_actor(p_meal,p_actor,FALSE);
    SELECT athlete_id,status INTO v_athlete,v_status FROM MealRecord WHERE meal_record_id=p_meal FOR UPDATE;
    IF v_status <> 'draft' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected meal state for submit';
    END IF;
    UPDATE MealRecord SET status='submitted',status_changed_by_account_id=p_actor,
      status_changed_at=UTC_TIMESTAMP(6),status_change_reason=NULL,
      updated_at=UTC_TIMESTAMP(6) WHERE meal_record_id=p_meal;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_review_meal(IN p_meal BIGINT, IN p_actor BIGINT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_athlete BIGINT;
  DECLARE v_status VARCHAR(30);
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
    CALL mvp_lock_meal_actor(p_meal,p_actor,FALSE);
    SELECT athlete_id,status INTO v_athlete,v_status FROM MealRecord WHERE meal_record_id=p_meal FOR UPDATE;
    IF v_status <> 'submitted' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected meal state for review';
    END IF;
    CALL mvp_assert_nutritionist(v_athlete,p_actor);
    UPDATE MealRecord SET status='reviewed',status_changed_by_account_id=p_actor,
      status_changed_at=UTC_TIMESTAMP(6),status_change_reason=NULL,
      updated_at=UTC_TIMESTAMP(6) WHERE meal_record_id=p_meal;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_reopen_meal(IN p_meal BIGINT, IN p_actor BIGINT, IN p_reason VARCHAR(500))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_athlete BIGINT;
  DECLARE v_status VARCHAR(30);
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
    CALL mvp_lock_meal_actor(p_meal,p_actor,FALSE);
    SELECT athlete_id,status INTO v_athlete,v_status FROM MealRecord WHERE meal_record_id=p_meal FOR UPDATE;
    IF v_status <> 'reviewed' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected meal state for reopen';
    END IF;
    CALL mvp_assert_nutritionist(v_athlete,p_actor);
    UPDATE MealRecord SET status='submitted',status_changed_by_account_id=p_actor,
      status_changed_at=UTC_TIMESTAMP(6),status_change_reason=p_reason,
      updated_at=UTC_TIMESTAMP(6) WHERE meal_record_id=p_meal;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_add_image(IN p_meal BIGINT, IN p_actor BIGINT, IN p_key VARCHAR(500), IN p_mime VARCHAR(100))
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
    CALL mvp_lock_meal_actor(p_meal,p_actor,TRUE);
    IF NULLIF(TRIM(p_key),'') IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Object key required';
    END IF;
    INSERT INTO MealImage(meal_record_id,object_key,mime_type,uploaded_at)
      VALUES(p_meal,p_key,p_mime,UTC_TIMESTAMP(6));
    SET v_id=LAST_INSERT_ID();
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;
  SELECT v_id AS meal_image_id;
END$$

CREATE PROCEDURE mvp_delete_image(IN p_image BIGINT, IN p_actor BIGINT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_attempt INT DEFAULT 0;
  DECLARE v_retry BOOLEAN DEFAULT FALSE;
  DECLARE v_meal BIGINT DEFAULT NULL;
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
    SELECT meal_record_id INTO v_meal FROM MealImage WHERE meal_image_id=p_image;
    CALL mvp_lock_meal_actor(v_meal,p_actor,TRUE);
    DELETE FROM MealImage WHERE meal_image_id=p_image;
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;

END$$

CREATE PROCEDURE mvp_queue_analysis(IN p_meal BIGINT, IN p_actor BIGINT, IN p_model VARCHAR(150), IN p_version VARCHAR(100))
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
    CALL mvp_lock_meal_actor(p_meal,p_actor,TRUE);
    IF NULLIF(TRIM(p_model),'') IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Model name required';
    END IF;
    INSERT INTO MealAnalysis(meal_record_id,model_name,model_version,status,created_at)
      VALUES(p_meal,p_model,p_version,'queued',UTC_TIMESTAMP(6));
    SET v_id=LAST_INSERT_ID();
      COMMIT;
    END;
    IF NOT v_retry THEN LEAVE retry_command; END IF;
    IF v_attempt >= 3 THEN
      SIGNAL SQLSTATE '40001' SET MYSQL_ERRNO=1213,
        MESSAGE_TEXT='Concurrent write retry exhausted; retry the whole command';
    END IF;
  END LOOP;
  SELECT v_id AS meal_analysis_id;
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
