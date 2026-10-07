-- Replace __DATABASE__ with the selected database identifier before execution.
-- Use dedicated server-side DB users. Never give these roles to browser clients.
CREATE ROLE IF NOT EXISTS mvp_api;
CREATE ROLE IF NOT EXISTS mvp_ai_worker;

GRANT SELECT ON `__DATABASE__`.`Athlete` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`Nutritionist` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`Coach` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`AthleteCoach` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`Food` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`Nutrient` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`FoodNutrient` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`MealRecord` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`MealImage` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`MealItem` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`MealItemNutrient` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`MealAnalysis` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`AthleteNutritionTarget` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`AthleteFoodRestriction` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`mvp_snapshot_mismatch` TO mvp_api;
GRANT SELECT (account_id,organization_id,email,role,status) ON `__DATABASE__`.`Account` TO mvp_api;
GRANT SELECT (organization_id,name,status) ON `__DATABASE__`.`Organization` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_create_meal` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_edit_meal` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_add_item` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_confirm_item` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_reject_item` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_delete_item` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_submit_meal` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_review_meal` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_reopen_meal` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_add_image` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_delete_image` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_queue_analysis` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`MealAnalysis` TO mvp_ai_worker;
GRANT SELECT ON `__DATABASE__`.`MealImage` TO mvp_ai_worker;
GRANT SELECT (meal_record_id,status) ON `__DATABASE__`.`MealRecord` TO mvp_ai_worker;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_start_analysis` TO mvp_ai_worker;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_finish_analysis` TO mvp_ai_worker;

-- After creating your own users with your credential system:
-- GRANT mvp_api TO 'your_api_user'@'your_api_host';
-- SET DEFAULT ROLE mvp_api FOR 'your_api_user'@'your_api_host';
-- GRANT mvp_ai_worker TO 'your_worker_user'@'your_worker_host';
-- SET DEFAULT ROLE mvp_ai_worker FOR 'your_worker_user'@'your_worker_host';
-- Do not grant database-wide EXECUTE: it would expose internal helper routines.
-- Do not also grant raw DML, CREATE, TRIGGER, ALTER, SUPER or role administration.
-- Catalog/identity/effective-date administration uses a separate trusted service role.
