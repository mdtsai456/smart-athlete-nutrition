# Athlete nutrition MVP v9

本版是目前 16-table MVP 範圍的 Production Schema。SQL、command API 與最小權限配置共同構成上線基準。適用於飲食記錄、AI 分析、人工確認、營養攝取 snapshot、營養目標及食物限制。Full 的 Team、Menu、Dish、Allergen 與指派營養師模組未納入本次修改。

## 七項修正

| 項目 | 落實方式 |
|---|---|
| 1. 建立者不可改 | MealRecord 的 athlete_id、created_by_account_id、created_at 由 trigger 鎖定。修改時驗證本次 actor，不重新驗證歷史 creator 的現況。 |
| 2. 確認資料完整 | confirmed 必須有 Food、正重量、weight_source、confirmer、confirmed_at；pending/rejected 的確認欄位全部 NULL。 |
| 3. active 權限 | 新建立者、本次操作者、新指派 staff 必須 active；既有已停用 staff 的期間仍可縮短或關閉。 |
| 4. 餐點狀態機 | draft → submitted → reviewed；reviewed → submitted 只能由 active 同組織營養師透過 reopen，並提供原因。 |
| 5. AI lifecycle | queued → running → succeeded/failed，並允許 queued → failed 處理排程失敗；CHECK 與 triggers 控制結果、錯誤與時間；重試建立新 analysis。 |
| 6. 原子 snapshot | MealItem BEFORE/AFTER triggers 在同一交易內驗證來源、建立或清除全部營養列、檢查筆數；public command 管理 commit/rollback。 |
| 7. 驗證 | 真實 MariaDB 測試涵蓋跨 org、停權、期間重疊、併發、時區/DST、權限、rollback、snapshot 與升級保護。 |

表數仍為 16。MealRecord 增加三個最新狀態轉換欄位；MealItem 增加 snapshot_nutrient_count。DBML 也列出 SQL 原本就存在的兩個 generated 欄位 active_email、source_scope_id。CHECK sections 使用新版 DBML 語法，已用 @dbml/core 的 dbmlv2 parser 驗證；legacy parser 不支援 checks。

## 餐點操作

| 狀態 | 操作 |
|---|---|
| draft | 本人及同組織 active nutritionist 可編輯、增刪圖片/項目、排 AI、確認或拒絕。 |
| draft → submitted | 至少一個項目；全部 confirmed/rejected；沒有 queued/running analysis；snapshot 筆數正確。 |
| submitted | athlete 不可再改；nutritionist 可修正。修正期間可以有待處理項目，review 時須全部重新解決。 |
| submitted → reviewed | 只限同組織 active nutritionist；再次驗證項目、AI 與 snapshot。 |
| reviewed | 餐點本體、圖片、AI、項目與 snapshot 均不得直接修改或刪除。 |
| reviewed → submitted | mvp_reopen_meal 要求 nutritionist 及非空白原因，先重新開啟，再修正，再審核。 |

status_changed_* 只保存最近一次狀態轉換，不是完整 audit history。需長期保留每次 reopen 原因的系統，應另外記錄 application audit events。不要把 creator 當最後修改者。

## 安裝

1. 使用 MariaDB 11.8.9，InnoDB，utf8mb4。先建立空 database。
2. 載入 MariaDB named timezone tables，確認 CONVERT_TZ('2026-10-05 17:00:00','+00:00','Asia/Taipei') 是 2026-10-06 01:00:00。
3. 以獨立 migration/schema owner，選定該空 database 後，用 mariadb CLI 執行 athlete_nutrition_mariadb.sql。不要對既有 database 重跑這份建立腳本。
4. 腳本會設定 database 與連線 collation 為 utf8mb4_unicode_ci，避免 routine 參數與表欄位的 collation 不同。DDL 及 routines 建立時採嚴格 SQL mode。
5. 啟用 binlog 的環境，migration owner 必須具有建立 function/trigger 的必要權限；測試使用 ROW binlog 且 log_bin_trust_function_creators=0。
6. 將 permissions.sql 的 __DATABASE__ 替換成實際 database 名稱，再配置專用 API 與 AI worker 使用者。schema owner 不應用作 API 登入帳號。
7. 連線使用 UTC。DATETIME 輸入值須已轉成 UTC；command 會依 IANA timezone 計算 local_date。

DELIMITER 是 mariadb CLI 指令。其他 migration runner 必須支援 routine 分隔，不可把 DELIMITER 當 server SQL 送出。

## Command API

所有 public command 自己開始交易並 commit/rollback。請使用 autocommit connection，在既有交易之外 CALL；若偵測 caller transaction，會在動到該交易之前拒絕。每個 command 使用 READ COMMITTED，按 parent meal → item → catalog 的順序取得主要鎖。1020 與 1213 會 rollback 後重試完整 command，最多三次；耗盡回傳 1213/40001。1205 或其他錯誤也會完整 rollback，由呼叫端按需求重試整個 command。

| Procedure | 參數順序 |
|---|---|
| mvp_create_meal | athlete, actor, consumed_utc, timezone, meal_type, note；回傳 meal_record_id |
| mvp_edit_meal | meal, actor, consumed_utc, timezone, meal_type, note |
| mvp_add_item | meal, actor, food_id 可 NULL, label 可 NULL, estimated_g 可 NULL, analysis_id 可 NULL；回傳 meal_item_id |
| mvp_confirm_item | item, actor, food, final_weight_g, weight_source |
| mvp_reject_item / mvp_delete_item | item, actor |
| mvp_submit_meal / mvp_review_meal | meal, actor |
| mvp_reopen_meal | meal, actor, reason |
| mvp_add_image | meal, actor, object_key, mime_type；回傳 image_id |
| mvp_delete_image | image, actor |
| mvp_queue_analysis | meal, actor, model_name, model_version；回傳 analysis_id |
| mvp_start_analysis | analysis_id；僅 worker |
| mvp_finish_analysis | analysis_id, succeeded/failed, result_json, error_message；僅 worker |

例如：

```sql
CALL mvp_confirm_item(123, 456, 789, 250.00, 'measured');
CALL mvp_submit_meal(12, 456);
CALL mvp_review_meal(12, 987);
CALL mvp_reopen_meal(12, 987, 'Correct recorded weight');
```

actor 必須由後端從已驗證的 session/token 取得，不能相信 request body 的 account_id。DB 確認傳入帳號的 role/org/status，但不會把每次 CALL 的參數自動綁定到 HTTP 使用者。API 的讀取查詢仍須套用 tenant 與教練有效指派範圍。這些 server-side DB credentials 不提供給終端使用者。

API role 只授權選定的 SELECT 和 public procedures，沒有餐點/snapshot DML 或內部 helper 的 EXECUTE。AI worker 只可讀所需分析資料、開始與完成 analysis。不要額外給 runtime database-wide EXECUTE、DML 或 DDL 權限。

## Snapshot 與 reporting

- 每個 FoodNutrient row 都寫入，包括零值及已 inactive 的 nutrient。報表選擇顯示哪些 nutrient 是讀取層的工作。
- amount = ROUND(amount_per_100g × confirmed_weight_g / 100, 4)。溢位或任何中途錯誤都使確認與 snapshot 一起 rollback。
- snapshot_nutrient_count 保存當時來源列數。mvp_snapshot_mismatch 應保持空集合；它能抓漏列，不能自行證明每個歷史數值的來源。
- 確認交易以 Food row lock 與 catalog writers 序列化。catalog 更新不修改歷史 snapshot。
- 重複確認相同 food/weight/source 會保留原 snapshot。改變最終 food/weight 才重新計算。這版不提供默默重算所有歷史資料的 command。
- intake 報表只讀 MealItemNutrient。不能每次重新套用現在的 FoodNutrient。
- Athlete.weight_kg 仍代表現在體重。此版的 per_kg_bw 只適用目前目標；無體重歷史時，不可把過往 per-kg compliance 報表標示為當時精確目標。若將這項納入 MVP，需另做體重歷史或每日目標 snapshot。

## Effective-date writes

AthleteCoach、AthleteNutritionTarget、AthleteFoodRestriction 必須用 explicit transaction，建議 READ COMMITTED。先 lock Athlete，再寫入政策。trigger 在相同 Athlete lock 下，以 LOCK IN SHARE MODE 查詢同表 overlap，避免原版 FOR UPDATE 在 trigger 內觸發 1442。

end_date 包含當日。2030-01-31 結束，下一筆須在 2030-02-01 或之後開始。free-text restriction 的描述相同不在 DB overlap key 範圍內。

READ COMMITTED 與鎖並不保證永遠沒有 deadlock。若 1020、1213、1205 出現，rollback 後重試整個交易，不要只重試最後 INSERT。測試也覆蓋較舊 REPEATABLE READ view 在另一筆期間提交後的安全拒絕及重新交易。

## 升級

migrations/v8_to_v9.sql 可以保留既有 identity、catalog、draft meals、未確認項目、圖片與 queued analyses。已測試這條升級路徑。

如果已有 confirmed intake、submitted/reviewed meals、已開始 AI 或不一致欄位，preflight 會在改表前拒絕。v8 沒有狀態轉換操作者與 snapshot expected count，不能憑空補 reviewer、weight_source 或歷史來源值。這種資料需先在 staging 做個別 backfill 及人工資料核對，再產生符合該資料集的 migration。

不要使用 CLI --force 跳過 preflight。MariaDB DDL 不是整份腳本原子交易；升級應在 maintenance window、備份與還原演練後執行。migration 失敗時按已完成的 DDL 步驟處理，不可任意重跑或假設 rollback 已還原所有表。

## 重跑驗證

```bash
python -m pip install -r requirements-test.txt
docker compose up -d --wait
MVP_DB_PASSWORD=integration-only python tests/run_integration.py
docker compose down -v
```

測試 runner 只接受 mvp_test 開頭的 database 名稱，會建立/清除測試 DB、test roles/users。只在獨立測試 server 上執行；migration tests 會使用 mvp_test_upgrade。不要將測試 runner 接到 production。

ci/mariadb_integration.yml 是可放入 repository 的 GitHub Actions 設定。此次實際驗證是在本機隔離 MariaDB server 執行，沒有宣稱已在你的 GitHub 上啟用或跑過 CI。

正式上線時仍由部署系統負責備份/還原、TLS、secret 管理、監控與 application authentication。這份交付完成 schema 與資料操作驗證，並未部署你的 production database。

## 官方參考

- [MariaDB 11.8.9 release notes](https://mariadb.com/docs/release-notes/community-server/11.8/11.8.9)
- [FOR UPDATE](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update)
- [LOCK IN SHARE MODE](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/lock-in-share-mode)
- [Stored function limitations](https://mariadb.com/docs/server/server-usage/stored-routines/stored-functions/stored-function-limitations)
