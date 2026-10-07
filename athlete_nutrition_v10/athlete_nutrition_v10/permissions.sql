-- Replace __DATABASE__ with an administrator-selected identifier.
-- Server-side roles only; the backend must authenticate actor and scope reads.
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
GRANT SELECT ON `__DATABASE__`.`AthleteDailyNutritionPlan` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`MealRevision` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`mvp_snapshot_mismatch` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`mvp_current_daily_plan` TO mvp_api;
GRANT SELECT ON `__DATABASE__`.`mvp_daily_intake` TO mvp_api;
GRANT SELECT (account_id,organization_id,email,role,status) ON `__DATABASE__`.`Account` TO mvp_api;
GRANT SELECT (organization_id,name,status) ON `__DATABASE__`.`Organization` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_create_meal` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_mutate_meal` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_save_meal` TO mvp_api;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_save_daily_plan` TO mvp_api;

GRANT SELECT ON `__DATABASE__`.`MealAnalysis` TO mvp_ai_worker;
GRANT SELECT ON `__DATABASE__`.`MealImage` TO mvp_ai_worker;
GRANT SELECT (meal_record_id,status) ON `__DATABASE__`.`MealRecord` TO mvp_ai_worker;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_start_analysis` TO mvp_ai_worker;
GRANT EXECUTE ON PROCEDURE `__DATABASE__`.`mvp_finish_analysis` TO mvp_ai_worker;

-- Bind these roles to dedicated DB users; never hand DB credentials to F2e.
-- Do not grant raw DML or database-wide EXECUTE to either role.
-- Identity/catalog/effective-policy administration requires a separate trusted
-- service connection. Effective-policy edits must use explicit transactions.
