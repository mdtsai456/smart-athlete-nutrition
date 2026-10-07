# 完整18表 ERD

完整圖包含Coach與Nutritionist；線條只表示實際FK，角色限制另由SQL驗證。

```mermaid
erDiagram
    Organization |o--o{ Account : organization_id
    Account ||--o| Athlete : account_id
    Account ||--o| Nutritionist : account_id
    Account ||--o| Coach : account_id
    Athlete ||--o{ AthleteCoach : athlete_id
    Coach ||--o{ AthleteCoach : coach_id
    Organization |o--o{ Food : organization_id
    Food ||--o{ FoodNutrient : food_id
    Nutrient ||--o{ FoodNutrient : nutrient_id
    Athlete ||--o{ MealRecord : athlete_id
    Account ||--o{ MealRecord : created_by_account_id
    MealRecord ||--o{ MealImage : meal_record_id
    MealRecord ||--o{ MealItem : meal_record_id
    MealAnalysis |o--o{ MealItem : meal_analysis_id
    Food |o--o{ MealItem : food_id
    Account |o--o{ MealItem : confirmed_by_account_id
    MealItem ||--o{ MealItemNutrient : meal_item_id
    Nutrient ||--o{ MealItemNutrient : nutrient_id
    MealRecord ||--o{ MealAnalysis : meal_record_id
    Athlete ||--o{ AthleteNutritionTarget : athlete_id
    Nutritionist ||--o{ AthleteNutritionTarget : nutritionist_id
    Nutrient ||--o{ AthleteNutritionTarget : nutrient_id
    Athlete ||--o{ AthleteFoodRestriction : athlete_id
    Food |o--o{ AthleteFoodRestriction : food_id
    Nutritionist ||--o{ AthleteFoodRestriction : nutritionist_id
    Account |o--o{ MealRecord : status_changed_by_account_id
    Athlete ||--o{ AthleteDailyNutritionPlan : athlete_id
    Account ||--o{ AthleteDailyNutritionPlan : confirmed_by_account_id
    MealRecord ||--o{ MealRevision : meal_record_id
    Account ||--o{ MealRevision : actor_account_id
```

Account與每個角色profile是1對0..1；每個profile必須有一個Account。

Nutritionist → Account → AthleteDailyNutritionPlan 表示營養師以共用帳號確認。營養師仍直接連AthleteNutritionTarget及AthleteFoodRestriction。
