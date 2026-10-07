# SDD ledger — plan: docs/superpowers/plans/2026-10-06-nutrition-schema-v10.md

日期：2026-10-06。使用者授權「該補的都補一補，但是要符合減法驗證設計標準」，範圍是Schema／ERD；不建立後端、不修改F2e。

## Rulings

- Ruling: 保留v9另建v10 — 避免覆蓋既有工作與假造歷史 — 代價是v9到v10資料遷移仍需另訂。
- Ruling: 使用input_json作唯一原始每日表單，取消五個重複輸入欄位 — 符合減法且直接還原Jenny表單 — 代價是個別输入需command驗證、單項查詢需JSON提取。
- Ruling: 保留可搜尋的計算體重、日期、day_type及四項final targets — 它們是固定結果／查詢契約，與原始表單用途不同 — 代價是command須確保兩者一致，runtime不授予raw DML。
- Ruling: 人工操作合併成mvp_mutate_meal，保留create/save/daily及兩個worker入口 — 減少重複交易與權限授予 — 代價是action/payload契約需adapter轉換，不沿用舊procedures。
- Ruling: Actor連Account，角色profile及期間政策沿用既有設計 — 不新增重複nutritionist FK或泛用權限模型 — 代價是角色／組織限制由SQL helpers驗證。
- Ruling: 同組織active營養師有管理權，Coach以有效AthleteCoach指派讀取 — 沿用現有MVP範圍 — 若未來要限制營養師只看指派球員，再設計實際指派需求。
- Ruling: submitted/reviewed已確認快照即計入攝取量 — 適配目前F2e，submitted標示待審 — 代價是介面必須清楚呈現審核狀態。
- Ruling: 日計畫優先、期間政策fallback由未來服務組合 — 避免強行把範圍政策轉成不存在的完整四項計畫 — 代價是當缺項時返回未設定。
- Ruling: 不安裝或下載資料庫 — 遵守使用者先前決定與本次設計範圍 — 代價是real DB測試先交付，不能宣稱runtime已通過。
- Ruling: 將測試集中在test_integration.py、用同一DDL產生ERD與字典，不加CI自動下載流程 — 減少重複fixture及獨立維護來源 — 代價是只在使用者已準備的測試server執行。
- Ruling: 不建立Git worktree／commit／push — 包含大量既有未提交工作，交付目錄與v9隔離，這次未要求Git發布 — 代價是需使用者自行版本控制。

## Tasks

Task 1: complete within Schema scope。DailyPlan版本、完整F2e欄位、frozen targets與warnings已通過實際DB案例；有效期間政策提醒也已驗證。後端fallback組合不在本次範圍。

Task 2: complete within Schema scope。MealRevision只追加、完整before/after、Account actor、原因、AI原始資料保留、metadata-only不重算snapshot及review/reopen均有實際通過案例。

Task 3: complete within Schema scope。原子保存、錯誤及溢位rollback、並行相同提交、成功重送、ID驗證、完整macro及transient retry均通過。

Task 4: complete within Schema scope。全部圖/DBML/字典一致；乾淨DB逐欄型別/NULL/FK一致；實際API/worker帳號驗證通過並已清除。25/25實際DB測試、3/3離線測試通過。

## Review and fixes

依executing-plans要求，派一位全新脈絡reviewer做靜態審閱，沒有另派實作者。修正shared request key導致測試互相衝突；修正負值在四捨五入前驗證；拆開pending與running分析阻擋案例；熱量差精度對齊F2e；補組織active驗證与至少一筆confirmed項目守門，加入對應實際DB回歸案例。沒有用靜態審閱替代MariaDB驗證。

離線generator測試初次紅燈是尚未建立module，建立後3/3通過。最初沒有server，所以當時未宣稱SQL已驗證。使用者其後明確授權自行興建並提供Zeabur連線；依此安裝專案限定PyMySQL、建立獨立test DB並驗證。第一輪19/21，修正兩個測試程式錯誤後21/21；擴充後25/25。精確结果與適用範圍見validation_report.md。

Ruling: 依最新授權使用提供的服務建立athlete_nutrition_v10乾淨應用DB與專屬test DB — 不改動zeabur、不混入fixtures — 代價是後端與永久服務使用者仍需日後接線。

Ruling: 以12.3.3實際版本限定驗收，移除v10交付檔名MVP但不宣稱整個產品已上線 — 與真實证據及使用者命名偏好一致 — 原11.8與binlog開啟環境未驗證。

本次再確認：25/25 DB、24/24現有F2e Mock API／服務測試、3/3離線測試通過。新增可重跑唯讀live schema checker，驗證18表/169欄/30FK/34個PK或unique索引/57個命名CHECK存在。自動化測試使用合成資料而不模擬DB本身；設計語意採Manual Review，真實使用者／影像／端到端接線Manual Test尚未執行。五個本地CE審阅角色已完成；Claude外傳補充因自动审批拒絕未啟動，沒有繞過。結果在既有validation_report.md集中維護，不另增一份驗收狀態來源。

新增AI失敗終態與手動完成餐點案例後，最終26/26實際DB測試通過（16.553秒）；其餘24項F2e、3項離線與Live Schema比較結果不變。

## 依Jenny現有F2e重新適配

使用者指定Meal／Food以v10為準，人物／角色／Target／限制以Jenny目前F2e為準。逐讀profile、platform、planner、view與seed，對齊既有體重CHECK為NULL或10～350kg，改名chk_athlete_weight；不新增欄位或表。新Mock邊界測試在舊DB紅燈，修正後綠燈。乾淨應用DB確認18表均無資料後，只ALTER此CHECK，不匯入fixtures。最終DDL重建test DB後27/27通過、17.681秒；現有F2e24/24、離線3/3及live metadata皆通過。

新增jenny_f2e_alignment.md集中記錄權威來源、18表責任及差異；驗收狀態仍集中validation_report.md。範例target不升格已確認計畫、球員自述不升格政策、期間範圍不任選端點變精確目標、假隊名不催生Team表。未修改Jenny程式或建立後端。

## 最終169欄審查

逐欄核對Data Type、必要性、冗餘與命名，保留18表／169欄／30FK。Athlete.gender改sex對齊Jenny生理性別；限制max_amount_g改max_daily_amount_g定義每日當地日食物總重量上限，未新增第二欄或自動判定服務。CHECK與更新trigger同步；乾淨應用DB確認無資料後僅作窄幅ALTER。欄位字典加入每欄型別理由與必要性／冗餘／命名判讀，生成器與離線checker確認169欄全覆蓋。Live checker擴充全部collation/default/generated/auto_increment核對。最終DB29/29通過、17.922秒；F2e24/24、離線3/3通過；圖及文件重新生成。真人操作與後端端到端Manual Test仍未執行。
