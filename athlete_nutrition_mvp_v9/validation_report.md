# MVP v9 validation report

日期：2026-10-06。判定：**認同本版為目前 16-table MVP 範圍的 Production Schema**，採用附帶的 public command API 與最小權限配置。未部署實際 production database。

實際測試為 MariaDB 11.8.9，InnoDB，UTC sessions，ROW binlog，log_bin_trust_function_creators=0，已載入 IANA timezone tables，Python 3.12 與 PyMySQL 1.1.2。完整 suite **49 tests，0 failures，0 errors**。完整輸出在 validation_11.8.9.txt。

| 證據 | 結果 |
|---|---|
| 原版問題重現 | 最初 10 個核心測試在 v8 有 8 個 failures、2 個既有 guard 通過；creator/time、狀態、active actor 與 snapshot 缺陷已重現。 |
| SQL 建立 | 實際空 DB 完整建立 tables、FK、CHECK、function、procedures、triggers 與 view 成功。 |
| Schema / ERD | SQL 與 DBML 均為 16 tables，欄位集合一致；@dbml/core 10.2.0 dbmlv2 parser 成功。最長 constraint/index identifier 59 字元。 |
| 權限及範圍 | same-org athlete/nutritionist 寫入；跨組織及 coach writer 拒絕；suspended actor 拒絕。已停權 creator 不阻擋 active nutritionist。 |
| Confirmation | pending/rejected 不留確認 metadata；confirmed 需要 source；250g fixture 的三個 snapshot 分別為 250.0000、25.0000、0.0000。 |
| 歷史 snapshot | source catalog 修改與新增 nutrient 不影響既有 snapshot；漏掉 protein row 會被 mismatch view 偵測。相同確認請求不重新計算。 |
| 原子性 | 缺少 FoodNutrient、計算溢位及 snapshot 寫入後注入的 transient error，均不留下半筆 confirmation 或半份 snapshot。 |
| 狀態機 | 禁止 draft 直接 reviewed；pending/未完成 AI 阻止送出；nutritionist review；reviewed 所有子資料不能直接修改；reopen 要有原因。 |
| AI | started/completed/result/error 規則、terminal 不可覆寫、retry 新 analysis，以及 queued dispatch failure 已驗證。 |
| Effective date | 三類 policy 的重疊、inclusive end-date、explicit transaction requirement 與舊 RR read view 下的競爭寫入已測試。 |
| 併發 | 期間競爭最多一筆可提交；catalog update 與 confirmation 產出完整一致 snapshot；review 等確認交易結束才看到完整資料。 |
| 重試 | transient 1020 發生在 snapshot 已寫後，rollback 整筆後重試成功；持續錯誤耗盡重試時保留原 pending 資料且沒有 snapshot。移除重試的對照版會使這兩個測試失敗。 |
| 時區 | Asia/Taipei 日期跨日、錯誤日期、未知 zone、America/New_York 春秋 DST UTC cases 已測試。 |
| DB roles | 以實際 API/worker DB users 驗證 command 可執行、raw meal/snapshot DML、內部 helper、password_hash 與不屬於各角色的 command 被拒絕。 |
| 升級 | v8 draft/pending 資料升級後保留且可正常確認；歷史 reviewed rows 使 preflight 在改表前拒絕。 |
| CI 交付 | Docker Compose 與 GitHub Actions YAML 語法解析成功。已附可重跑設定；尚未在使用者 GitHub 上執行。 |

執行測試也找出並修復兩個前次靜態 review 未發現的 MariaDB runtime 問題：database/table/routine 的 collation 混用，以及同表 trigger FOR UPDATE 的 1442。期間 overlap 改為 Athlete exclusive lock 加同表共享 locking read。Confirmation 在 UPDATE 前先取得 catalog parent lock。

Production 的使用邊界：HTTP authentication 與 read-side tenant filtering 由後端負責；actor 參數不能由客戶端任意指定。這版只保存最近狀態轉換，不具完整 audit history。per_kg_bw 仍使用目前體重，尚不支援歷史體重還原。既有 finalized 歷史資料的 migration 必須另做資料核對，不能自動補造 reviewer 或重新計算歷史 snapshot。

完整安裝、權限、command 參數、測試及升級條件見 production_guide.md。
