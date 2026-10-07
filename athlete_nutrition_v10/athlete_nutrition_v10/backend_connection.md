# 後端連接架構準則

本文件定義後端如何連接 v10 資料庫與前端 API。
正式資料庫結構以 athlete_nutrition_schema.sql 為準。

瀏覽器不得直接連 MariaDB，也不得取得資料庫帳號。
後端依用途使用三組資料庫權限角色／連線池：

1. mvp_api
2. mvp_ai_worker
3. admin

## 架構

Browser
→ Backend API
→ Session / Authorization
→ mvp_api 或 admin

AI Worker
→ mvp_ai_worker

p_actor 僅由後端 session 取得。
Request body 不接受 account_id 作為 actor 身分來源。

## mvp_api

用途：
- 前端正常讀取
- 餐點人工操作
- 每日營養計畫

權限：
- SELECT：指定資料表，以及 mvp_current_daily_plan、mvp_daily_intake、mvp_snapshot_mismatch
- Account 只讀 account_id、organization_id、email、role、status
- Organization 只讀 organization_id、name、status
- EXECUTE：指定 stored procedures
- 不授予餐點核心表直接 INSERT / UPDATE / DELETE
- 讀模型由 API 組合。SELECT 不是列級權限，組織、本人與教練指派期間由 API 自己套

### Commands

mvp_create_meal
- 建立 MealRecord(draft)
- revision = 1
- 寫入 MealRevision，action = create
- 回傳 meal_record_id、revision

mvp_mutate_meal
- 修改餐點內容或狀態
- 回傳 meal_record_id、revision、resource_id
- 新項目、影像、分析使用 resource_id

內容：
edit
add_item
confirm
reject
delete_item
add_image
delete_image

分析：
queue_analysis

審核：
review
reopen

mvp_save_meal
- 只允許 draft 的第一次 submit
- 交易內依 items_json 套用每一筆
- item_id 為 NULL 的在這筆交易新建
- 已確認且食物、重量、來源相同的不重寫快照
- 沒列在 items_json 的既有項目不刪除
- 完成後不得仍有 pending，分析也不得仍在 queued 或 running
- 至少一個 confirmed item，且四項營養快照完整
- rejected 可留在這餐，之後不計入攝取
- draft → submitted
- 寫入 MealRevision，action = save
- request_id 做 idempotency
- 回傳 meal_record_id、revision、status、replayed

mvp_save_daily_plan
- 定位：athlete_id + local_date
- 傳入 expected_revision
- 儲存完整 input_json
- DB 重算 kcal / protein / carb / fat
- 不信任前端自行計算結果
- 回傳 daily_plan_id、revision

## mvp_ai_worker

只允許 AI Worker 使用。

可執行：
mvp_start_analysis
mvp_finish_analysis

前端不得直接呼叫。

## admin

管理型寫入使用 admin connection。

包括：
Organization
Account
Athlete
Coach
Nutritionist
AthleteCoach
Food
Nutrient
FoodNutrient
AthleteNutritionTarget
AthleteFoodRestriction

多表操作必須使用 transaction。
失敗必須 rollback。

## 授權原則

Athlete：
- 只能修改自己的 draft
- 可以 submit 自己的 draft

Coach：
- 只能讀取有效指派期間內的 athlete
- 不得修改 meal
- 不得修改 daily plan

Nutritionist：
- 只能操作同 organization 的 athlete
- 可修改該 athlete 的 draft 與 submitted meal
- 可 review / reopen
- 可儲存 daily plan

## 日期

每日統計使用 MealRecord.local_date。
consumed_at 使用 UTC，但不得直接用 UTC date 判定「今天」。

## 歷史資料

歷史營養使用 MealItemNutrient snapshot。
不可使用目前 Food / FoodNutrient 重新計算舊餐。

攝取讀 mvp_daily_intake。
只計入 submitted、reviewed 餐點中的 confirmed item。
draft、pending、rejected 不計入。
已送出仍計入，狀態顯示待營養師審核。

## ID

DB bigint 對 API 一律使用 string。
demo id 不可送入正式 DB API。

## Revision

create 的 revision 為 1，並寫下 MealRevision。
之後只有餐點內容或狀態真的改變，revision 才加 1，並再寫一筆 MealRevision。
相同的確認重送不加 revision，也不寫歷程。

Client 必須送 expectedRevision。
SQL 裡 expected_revision 必填，空值也是版本衝突。

procedure 丟出 Stale meal revision 這類錯誤時，HTTP 回：

409
code = REVISION_CONFLICT
message = Meal has been modified
currentRevision = 目前的 revision

前端重新 GET 最新資料，不自動覆蓋。

## Idempotency

第一次 submit 使用 request_id。
同一建立者底下這把 key 全表唯一，不能拿到另一餐重用。

同一 request_id + 同一 payload：
回傳第一次成功結果，replayed = true。

同一 request_id + 不同 payload：
拒絕。這是「這餐已經用另一份內容送出」，不是 REVISION_CONFLICT。

## Session

使用 HttpOnly Cookie。
Cookie：
HttpOnly
Secure
SameSite=Lax
Path=/api

所有 fetch：
credentials: include

寫入請求額外帶 CSRF token。

登入成功後必須 regenerate session。
Session cookie、密碼與 CSRF token 不寫入一般 application log。