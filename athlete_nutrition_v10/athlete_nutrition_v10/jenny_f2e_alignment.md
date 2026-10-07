# Jenny F2e 與 v10 適配驗證

2026-10-06。本次以工作區的 js/services/athlete.js、platform.js、planner.js、js/pages/views.js 與 js/api/seed.js 為依據。Meal／Food 以使用者 v10 設計為準；人物／角色／營養目標／限制沿用 Jenny 已實作的語意。未建立後端，也未修改 F2e。

## 實際調整

Athlete.weight_kg 原先只要求正值，現改為 NULL 或 10～350 kg，對齊 athleteProfile 的驗證。NULL 保留舊資料未知狀態；不把未填補成假體重。約束名稱為 chk_athlete_weight，未新增欄位或資料表。乾淨應用 DB 同步此 ALTER，未加入 fixtures。

新測試先在舊約束下失敗，證明 DB 接受 9.99 kg；修正後接受 NULL、10、350，拒絕 9.99 與 350.01。同時確認背號 0 合法，以及寫入自述限制不會自行產生營養師政策。

最終逐欄審查再將Athlete.gender改為sex，明確對齊Jenny的生理性別，沒有加第二欄；CHECK改名chk_athlete_sex，保留原四種代碼與NULL。新測試在舊DB因缺sex失敗，改後驗證全部代碼及球員範圍約束，性別案例擴充後28項DB測試通過。169欄的型別／必要性／冗餘／命名判讀收在column_dictionary.md。

另將限制欄位max_amount_g改為max_daily_amount_g，與每日計畫／攝取量一致，明確表示當地日总重量g上限。同步CHECK、更新trigger與乾淨應用DB，不新增第二欄。增加政策新增、修改與禁止不可帶限量案例後，最終29/29通過；自動限制判定服務仍未建立。

## 各領域的適配規則

| 領域 | Jenny 現有行為 | v10 對應／處理 |
|---|---|---|
| 球員資料 | 共同 athleteProfile 白名單，新增及編輯要求完整表單 | Athlete 沿用欄位意義與單位；舊資料可 NULL。新增／完整編輯的必填及非未來生日由未來 adapter 驗證，不能把 DB 可 NULL 誤當成表單可任意缺項 |
| 身高／體重／訓練 | 50～260 cm、10～350 kg、整數 0～50 次 | DB 對齊範圍；數值欄位有固定精度，adapter 須先驗證精度再寫入，不能先四捨五入讓越界值變合法 |
| 體脂／背號 | 體脂可留白、嚴格大於 0 小於 100；背號可留白、0～99 | NULL 表未知；背號 0 保留。不得用真假值判斷把 0 丟掉 |
| 生理性別／主要目標 | 中文選項四種，各自固定集合 | sex 與 primary_goal 以代碼存放，轉換見 production_guide；主要目標是個人意向，不是每日營養數值 |
| 三種角色 | nutritionist、coach、player，頁面以角色切換 | Account 存 nutritionist、coach、athlete；player 僅轉代碼。Coach／Nutritionist 是角色資料，不再存一份 role 或組織 |
| 身分／組織 | 畫面角色切換；p1 等 demo ID，固定隊名 | 不將這些假定成登入帳號、真實指派或組織。Account／Organization／AthleteCoach 保留既有設計供未來後端使用；不為固定展示字串新增 Team 表 |
| 每日完整計畫 | nutritionPlans[date].input、target、提醒確認；保留其他球員及日期 | AthleteDailyNutritionPlan 保存原表單與確認結果、日期版本；日計畫優先，不能更新 Athlete.primary_goal 或覆寫歷史版本 |
| 無日計畫時目標 | platform.load 使用 player.target | 未來 adapter 從有效期間政策組合 fallback。四項映射 energy→calories、protein→protein、carbohydrate→carbs、fat→fat；缺項為未設定，不能自動補 0 |
| 期間目標 | F2e 尚無期間、上下限、每 kg 政策編輯介面 | AthleteNutritionTarget 保留使用者已要求的營養師期間政策。單一精確目標可用 absolute 且 min=max 表達；任意範圍不能靜默挑一端冒充 Jenny 的單一 target。此種範圍須由營養師確認日計畫後再提供顯示值 |
| 範例預設目標 | addPlayer 自動帶 2800／150／374.5／78 | 這是 demo 預設，不能當成營養師已確認計畫，不能捏造確認人、確認時間或期間 |
| 飲食限制／過敏 | dietaryRestrictions、allergies 自由文字 | Athlete 的兩個 text 欄位保存自述，不自動轉 prohibited 或 limited |
| 營養師限制 | F2e 尚無結構化限制管理介面 | AthleteFoodRestriction 保留確認人、期間、具體食物或文字描述。文字政策不可假裝已完成自動過敏配對或限制判定 |
| Meal／Food | 平面 foods、records/items；歷史量以當前食物重算 | 以使用者 v10 為準。FoodNutrient 每 100g，MealItemNutrient 是當次快照；未來 adapter 讀快照回傳 F2e 顯示格式。不可為迎合 Mock 改回動態重算歷史 |

這次取得並核對的 Jenny 資料是現有 F2e 程式與 Mock 物件，並非已部署的 Jenny DB Schema。尚無真實 session、組織授權或期間政策表單，不能據此宣稱這些部分已完成端到端適配。

## 完整 18 表減法核對

| 表 | 唯一責任／保留理由 |
|---|---|
| Organization | 組織及啟用狀態，提供租戶邊界 |
| Account | 登入帳號、角色及組織，身分的共同來源 |
| Athlete | 球員個人資料及自述，承接 Jenny profile |
| Nutritionist | 營養師資料及政策制定者身分 |
| Coach | 教練資料，讀取責任與營養師不同 |
| AthleteCoach | 教練球員指派與有效期間，不是假隊名 |
| Food | 食物識別及目錄來源 |
| Nutrient | 營養素識別、代碼及單位 |
| FoodNutrient | 每 100g 目錄營養量 |
| MealRecord | 整餐、日期、狀態及版本 |
| MealImage | 一餐多張照片的物件參照 |
| MealAnalysis | 分析工作生命週期與不可覆寫原始結果 |
| MealItem | 餐內項目、估計與人工確認 |
| MealItemNutrient | 食用當下的歷史營養快照 |
| AthleteNutritionTarget | 營養師期間政策，與每日確認計畫不同 |
| AthleteFoodRestriction | 營養師確認的期間食物政策，與自述不同 |
| AthleteDailyNutritionPlan | 每日完整計畫與不可覆寫版本 |
| MealRevision | 人工變更前後證據、原因及操作者 |

保留 18 表、169 欄、30 FK，沒有新增 Team、Role、Permission、四項營養目標子表或整餐總量欄位。跨表 triggers 與 commands 負責版本、授權及歷程一致性；單欄範圍由 CHECK 負責。本次修正重用既有體重 CHECK，沒有新增另一套持久驗證資料。

結論是本次 Schema 範圍通過減法設計驗整。證據與 Manual Review／尚未執行的 Manual Test 分界見 validation_report.md；後端登入、查詢範圍、上傳與真實 AI 仍待接線驗收。
