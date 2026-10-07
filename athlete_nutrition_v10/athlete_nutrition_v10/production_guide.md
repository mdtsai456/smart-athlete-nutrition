# v10 Schema 設計與使用契約

此版交付已驗收的資料庫Schema基準，已在Zeabur MariaDB 12.3.3匯入並通過29項實際DB測試；尚未建立後端。乾淨應用資料庫為athlete_nutrition_v10。正式來源是athlete_nutrition_schema.sql；DBML、圖與欄位字典由同一份DDL產生。只適用全新空資料庫，不可直接覆蓋v9。舊資料轉換需要另訂策略，不能替舊餐捏造修改歷程。測試範圍見validation_report.md。

## 身分、教練與營養師

Account 保存 role、organization_id、status、email及password_hash。Athlete、Coach、Nutritionist各有唯一account_id與個人資料；不再次保存role或organization_id。每個Account只有一個角色；本版不加入尚無需求的複合角色模型。

AthleteCoach保存教練與球員的有效日期指派。營養師以AthleteNutritionTarget設定期間營養政策，以AthleteFoodRestriction設定期間食物政策。這兩張表直接連Nutritionist。每日計畫confirmed_by_account_id及餐點歷程actor_account_id連Account，commands驗證角色，所以無須再保存一份nutritionist_id。

同組織的active營養師可以管理球員餐點與計畫；球員只能修改自己的draft餐點。教練不能確認／修正營養分析或每日計畫。教練的讀取範圍應由未來後端依AthleteCoach有效日期限定。跨組織、停權帳號、停用組織均不能透過commands修改餐點。

permissions.sql只給後端服務帳號使用。p_actor必須來自已驗證的登入session，不接受F2e任意指定。SELECT grants不是列級授權，後端必須限制球員、教練、營養師與組織的查詢範圍；不能讓瀏覽器直接連DB。身份／目錄／期間政策維護走獨立可信管理連線，有效日期政策寫入必須使用明確交易；目前沒有實作HTTP endpoint。

## 減法驗證

| 需求 | 保留／新增 | 為何需要 | 移除或不新增 |
|---|---|---|---|
| 身分與角色 | 原有Account及三種profile | 登入、角色資料与教練指派用途不同 | 不新增Role、Permission、重複組織欄位 |
| 每日完整計畫 | 新增AthleteDailyNutritionPlan | 原期間target無法保存每日完整表單與版本 | 不新增計畫草稿表、四種macro子表 |
| 原始表單 | input_json一份 | 能還原Jenny表單 | 不再逐欄複製proteinKg、fatValue等輸入設定 |
| 已確認結果 | 計算體重、日期、day_type、四項目標 | 固定當次結果、搜尋與彙總；與輸入語意不同 | 不跟目前Athlete.weight_kg動態重算舊日 |
| 修正原因與歷程 | 新增MealRevision | current rows無法解釋被刪內容或改值原因 | 不新增每一餐點子表各自的audit表 |
| AI原始輸出 | 保留MealAnalysis | 比對AI與人工確認 | 不把人工更正寫回raw_result_json |
| 營養量 | FoodNutrient目錄＋MealItemNutrient快照 | 原始目錄與歷史攝取量用途不同 | 不再存一份可漂移的整餐總量 |
| 寫入介面 | 4個API commands＋2個worker commands | 統一版本、交易與歷程入口 | 合併同類人工操作的重複交易procedures |

整體保留原16表，只新增2表。歷程JSON是過去版本的證據；目前資料仍以MealRecord及子表為準，不同時維護兩份現況。audit schema_version=1；未來改結構須明確換版。

## F2e欄位適配

F2e維持camelCase與中文顯示，DB採snake_case；未來API adapter轉換，無須為了名稱重寫Jenny畫面。

依本次使用者指定，Meal／Food以v10為準，人物／角色／Target／限制依Jenny目前已實作語意適配。完整18表必要性與尚無介面的差異見jenny_f2e_alignment.md。球員體重CHECK現對齊10～350kg，未知NULL仍保留；新增／完整編輯仍須遵守F2e必填，DB的NULL支援不是放寬表單要求。

| Jenny F2e | DB | 轉換規則 |
|---|---|---|
| role=player | Account.role=athlete | 僅角色代碼轉換 |
| player.id | Athlete.athlete_id | DB bigint在API以字串傳送，避免JS精度損失；現有demo id不能直接當DB id |
| birthDate、sex | birth_date、sex | 生理性別中文轉male/female/other/undisclosed；未填NULL；DB已修正原gender命名 |
| height、weight、bodyFat | height_cm、weight_kg、body_fat_percent | 單位明確；空值NULL |
| sport、weeklyTraining | sport、weekly_training_count | 訓練次數為整數 |
| goal | primary_goal | 維持→maintain、增肌→gain_muscle、減脂→lose_fat、比賽準備→competition |
| number、position | jersey_number、position | 背號0合法，空值NULL |
| dietaryRestrictions、allergies、notes | dietary_restrictions_text、allergies_text、notes | 自述文字；營養師確認政策另存原政策表 |
| nutritionPlans[date].input | AthleteDailyNutritionPlan.input_json | 原表單整份保存；manual使用JSON boolean |
| input.training | day_type | 訓練日→training、休息日→rest |
| target.calories/protein/carbs/fat | 四個target_*欄位 | DB重新計算並確認，避免信任caller自填總量 |
| reviewed、warnings、confirmedAt | warnings_acknowledged、warnings_json、confirmed_at | reviewed在此代表提醒確認，不是餐點審核狀態；提醒代碼在adapter轉中文 |
| food nutrition／meal nutrition | FoodNutrient／MealItemNutrient | 目錄每100g；歷史餐點讀已確認快照 |

現有F2e用目前食物目錄重算歷史餐點，接DB時應改讀MealItemNutrient。日期應以MealRecord.local_date為準；consumed_at是UTC，不能直接以UTC日期分組。圖片object_key需由後端換成可讀取URL。登入、假資料ID、查詢授權與上傳/AI服務仍待後端接線。

每日表單使用weight、calories、proteinKg、fatUnit、fatValue、carbMinimum、training、manual，manual=true時另帶protein/carbs/fat。計算先檢查未四捨五入的值不得為負，再將三大營養素取小數1位；熱量差依F2e取小數1位且容許±5 kcal。體重最多2位小數；計算使用DECIMAL，拒絕非數字、NaN、Infinity、科學記號及低於支援精度的值；DB欄位上限比JS有限，adapter應提示範圍错误。正常UI輸入可適配，不宣稱所有JS Number邊界與DB完全等價。

## 每日計畫與攝取量

mvp_current_daily_plan取每個athlete/local_date最大revision。讀取策略：已有日計畫先採日計畫；沒有則採當日有效期間政策。per_kg_bw政策需要明確體重基準；缺項表示未設定，不補成0，不虛構完整計畫。這個fallback由未來後端組合，view本身只提供已確認日計畫。單一精確政策可用min=max表達；範圍政策不可任選上下限轉成F2e的單一target，須由營養師確認日計畫後提供顯示值。F2e新增球員的範例target不是已確認計畫。保存日計畫時DB也檢查當日有效四項政策，超出範圍保存提醒並要求ack。

mvp_daily_intake只計入submitted/reviewed餐點中的confirmed項目。draft、pending、rejected不計入。提交即計入攝取量且顯示「待營養師審核」；reviewed仍計入。修改reviewed餐點必須先由營養師reopen，狀態回submitted而不是draft；需要原因與歷程。食物限制是有效政策資料，尚無自動限制判定或過敏配對服務；自由文字不得當成機器可判定規則。max_daily_amount_g明確定義為有效期間內每個當地日的該食物總重量g上限，按MealRecord.local_date彙總submitted/reviewed餐點的confirmed項目；不是單餐或整段期間共用配額。這是Schema政策契約，尚未實作自動判定服務。

## Command契約

所有人工commands自行開啟交易，不可包在caller未完成的交易內。expected_revision是前次讀取的版本；衝突要重新讀取並處理，不能自動覆蓋。可重試的1020／1213錯誤整筆rollback，最多3次。

| Command | 參數（依順序） | 回傳 |
|---|---|---|
| mvp_create_meal | athlete, actor, consumed_utc, timezone, meal_type, note | meal_record_id, revision |
| mvp_mutate_meal | meal, actor, expected_revision, action, payload_json, reason | meal_record_id, revision, resource_id |
| mvp_save_meal | meal, actor, expected_revision, request_id, items_json, reason | meal_record_id, revision, status, replayed |
| mvp_save_daily_plan | athlete, actor, local_date, expected_revision, input_json, warnings_acknowledged, reason | daily_plan_id, revision |
| mvp_start_analysis | analysis | 依SQL；worker專用 |
| mvp_finish_analysis | analysis, status, raw_result_json, error_message | 依SQL；worker專用 |

mutate action與payload：edit={consumed_at,timezone,meal_type,note}（完整metadata）；add_item={food_id?,analysis_id?,detected_label?,estimated_weight_g?}；confirm={item_id,food_id,weight_g,weight_source}；reject/delete_item={item_id}；add_image={object_key,mime_type?}；delete_image={image_id}；queue_analysis={model_name,model_version?}；review/reopen={}。實際欄位以SQL分支為準。初次confirm可無原因；已確認值改動、reject、delete_item、reopen及submitted餐點的內容變更需要原因。相同已確認值重送不造假事件。

save items是非空陣列，每筆包含item_id（新項目NULL）、decision=confirmed或rejected。confirmed帶food_id、weight_g、weight_source；新增項目可帶detected_label。rejected必須引用既有item_id且不帶確認值。ID不可重複、不可跨餐；未列出的既有項目不自動刪除，保存後不得仍有pending或尚未完成分析。已confirmed且未列出的項目保留。全餐需至少一筆confirmed項目與完整四項macro snapshot，0值合法。

request_id是ASCII識別碼，同建立者下不可重用於其他餐點；客戶端每次首次提交產生新key，斷線重送保留原key和payload。成功重送先比對已保存hash，再處理版本，回第一次提交版本；不重做項目確認。相同key不同payload拒絕。save只供draft首次提交；提交後修正走mutate。刪除原因、日期或source-only變動不能觸發重新取用新目錄值；改食物／重量才重建快照，停用食物不可重新計算。

建立draft、上傳物件與AI呼叫分開進行。save的DB交易涵蓋項目、快照、submitted、revision與MealRevision一起成功或一起rollback；外部上傳／AI不可能包含在此DB原子交易裡，失敗清理需由未來服務處理。AI完成狀態屬MealAnalysis，不另複製成每次人工MealRevision。

## 匯入與驗證

本次驗證MariaDB 12.3.3、InnoDB、UTF8、UTC session及IANA時區；原11.8／compose目標未執行。SQL檔包含DELIMITER，需用支援該client指令的工具或tests/run_integration.py的loader。先以schema owner匯入空DB，再以指定DB identifier替換permissions.sql的__DATABASE__並配置服務使用者。乾淨Schema已建立；永久後端服務使用者尚未配置。

離線驗證：`python -m unittest discover -s athlete_nutrition_v10/tests -p test_artifacts.py -v`。產圖與字典：`python athlete_nutrition_v10/tools/build_erd.py`及`python athlete_nutrition_v10/tools/build_docs.py`。

唯讀Live Schema驗證：以環境變數指定要核對的MVP_DB_NAME，執行`python athlete_nutrition_v10/tests/check_live_schema.py`。此命令不建立／刪除DB，也不寫入fixtures；核對欄位、FK刪除規則、PK/unique索引與命名CHECK存在。行為驗證仍須下方integration suite。

重跑DB驗證：設定MVP_DB_HOST/PORT/USER/PASSWORD/NAME及PYTHONPATH（本次PyMySQL放在專案.test-deps），執行`python athlete_nutrition_v10/tests/run_integration.py`。TLS連線設定MVP_DB_TLS=1。runner只接受mvp_test*資料庫名稱；預設拒絕覆蓋已有DB，僅在確認是自己建立的可丟棄DB後使用--reset重建。不得指定應用資料庫。權限測試建立隨機名稱與隨機密碼的暫時users/roles，完成後刪除；需要管理權限。compose.yaml是原11.8測試選項，本次未使用Docker。

歷程JSON中的bigint識別碼與DECIMAL數值可能是字串；adapter應保留識別碼字串並以decimal處理營養量，不假設所有JSON數字型別相同。連線密碼只透過環境變數提供，不寫入程式、交付檔或log。
