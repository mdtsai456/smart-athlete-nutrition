# v10 實際資料庫驗收

日期：2026-10-06（Asia/Taipei）。結論：**v10完整18表、169欄通過本次Schema範圍的減法設計驗整及29項實際MariaDB測試。** 此結論不是第三方認證，也不代表尚未建立的後端與整個產品已可上線。

| 驗收條件 | 結構依據／實際驗證 | 結果 |
|---|---|---|
| 每張表服務現有需求 | 原16表＋DailyPlan版本、MealRevision歷程；真實DB含Coach/Nutritionist等全部18表 | 通過 |
| 同用途只有一個目前資料來源 | 唯一input_json、final targets、parent revision；不另存整餐總量；frozen體重與攝取view測試 | 通過 |
| 保留必要歷史，避免漂移 | 目錄與食用快照用途不同；更正、停用食物metadata-only、AI原始結果保留測試 | 通過 |
| 最少必要寫入入口 | 4個API＋2個worker；實際帳號完成核准操作並拒絕raw DML/helper/跨角色command | 通過 |
| 失敗與並行有明確正確性 | 空目錄／快照溢位rollback、並行重送、同日計畫競爭、transient retry | 通過 |
| 文件與資料庫同源 | DB逐欄型別/unsigned/NULL及30個FK端點皆與DDL相符；SQL產生DBML/完整圖/字典 | 通過 |

每日原始input與已確認結果、目前餐點與歷史JSON、食物目錄與食用快照，各有不同用途。沒有新增通用權限、AI服務、計畫草稿、每個子表的audit表或另一份餐點總量。

## 執行結果

- 服務：Zeabur使用者提供的MariaDB，實際版本 **12.3.3-MariaDB-ubu2404**。
- TLS：TLS_AES_256_GCM_SHA384；IANA Asia/Taipei轉換成功。
- 第一輪21項：19通過、2個測試程式錯誤。實際歷程的nutrient_id為字串，測試卻比整數；CREATE USER參數的百分號被PyMySQL誤認格式符號。修正測試，沒有改动已正確的快照數值。
- 修正後21/21通過；再補快照溢位rollback、並行相同提交、攝取量draft/submitted/reviewed、有效期間政策提醒，擴充後 **25/25通過，14.730秒**。
- 前次由v10交付檔匯入重跑，25/25通過、16.533秒；新增AI失敗不可覆寫、但可手動完成餐點的案例後，26/26通過、16.553秒。
- 前次對齊球員體重10～350kg並保留NULL；新增邊界／背號0／自述不升格政策的Mock案例，先失敗後通過，27/27通過、17.681秒。
- 最終逐欄審查將Athlete.gender改名sex並同步CHECK；新增NULL／四種性別代碼及身高、體脂、訓練、目標、背號約束案例。最終DDL重新匯入，28/28通過、17.023秒。
- 再明確定義食物限量為每個當地日總量，欄位改max_daily_amount_g；同步CHECK與更新trigger，新增政策新增／修改及禁止不可帶限量案例。最終重新匯入DDL完整重跑 **29/29通過，17.922秒**，附檔為最後一輪完整輸出。
- API及worker實際登入完成核准操作，raw DML、內部helper及錯誤角色command皆拒絕；暫時帳號與角色已清除，殘留0。
- 離線artifact unittest：3/3通過；DBML/DOT/Mermaid/字典一致性檢查通過。
- Jenny F2e現有球員資料／營養計算／每日計畫自動化測試：**24/24通過**；這些是現有Mock API與服務測試，不是已串接MariaDB的端到端測試。
- 新增可重複執行的唯讀`tests/check_live_schema.py`；本次在乾淨應用DB驗證18表、169欄、30FK、34個PK/unique索引及57個命名CHECK存在，型別/NULL/指定collation/FK刪除規則均相符。CHECK存在與CHECK每種輸入行為已測是不同證據，不混為一談。

## Automation Test、Mock Data與Manual Test

| 項目 | 測試方式／資料 | 本次結果 |
|---|---|---|
| DDL、ERD、DBML、欄位字典一致性 | Automation Test；正式DDL作來源 | 通過；3項離線測試與artifact一致性檢查 |
| Live DB結構與約束 | Automation Test；唯讀metadata比較，不改應用資料 | 通過；18表/169欄/30FK及索引/CHECK存在檢查 |
| 整餐保存、rollback、併發、重送、角色權限、日計畫、profile邊界 | Automation Test；合成fixtures及測試內Mock Data，但使用真實MariaDB交易與鎖定 | 29/29通過 |
| F2e球員資料、營養量、每日表單計算與保存 | Automation Test；現有Mock API／資料 | 24/24通過；沒有更改F2e |
| AI完成／失敗流程與原始結果保留 | Automation Test；Mock AI JSON及工作狀態，資料仍寫真實測試DB | 已含於29項DB案例；不是實際影像辨識準確率測試 |
| 每張表必要性、角色責任、欄位語意與歷程邊界 | Manual Review；逐表／逐關聯閱讀SQL、指南、ERD與測試 | 完成；設計判讀，不稱為真人使用者驗收 |
| Jenny畫面在真實後端完成上傳→分析→確認→審核 | 接線後可做Automation E2E；真實裝置體驗另做Manual Test | 尚未執行；後端尚未建立，Mock不能證明端到端串接 |
| 真實餐照識別品質、营養師判斷與實際工作習慣 | 實際樣本可支援自動評測，臨床／業務判斷與真人操作仍需Manual Test | 尚未执行；不納入本次Schema通過結論 |

合成資料來自tests/fixtures.sql及test_integration.py，包括兩個組織、球員／營養師／教練、共用與跨組織食物、空營養目錄、0值、溢位、有效期間政策、合成AI JSON。測試資料僅進專屬可丟棄test DB；乾淨athlete_nutrition_v10不加入fixtures。不Mock資料庫transaction、鎖定或授權機制。

## Jenny適配及再次減法核對

Meal／Food維持使用者v10設計；人物／角色／Target／限制逐一對照Jenny現有程式。調整既有weight CHECK、gender→sex及max_amount_g→max_daily_amount_g命名，未增加表或欄位。完整18表必要性、目前F2e尚無真實身份／期間政策介面的差異與adapter規則，見[jenny_f2e_alignment.md](jenny_f2e_alignment.md)。不把固定demo目標當作已確認計畫，不把球員自述當作營養師禁止政策，不為展示隊名增加Team表。範圍政策不可任取一端變成F2e的單一目標。

調整後重跑真實MariaDB29項、現有F2e24項及離線3項，重新產生DBML／字典／完整Mermaid並核對應用DB。Manual Review完成18表與169欄型別、必要性、冗餘及命名。欄位字典每欄均附判讀；Automation只驗證全部169欄有覆蓋，業務必要性由設計審查判斷。Live checker另核對全部collation、預設值、generated flags及auto_increment。真人操作及實際後端串接的Manual Test仍未執行。

| 使用者最終四項要求 | 逐欄結論與證據 |
|---|---|
| Data Type | 通過本次設計審查；169欄逐欄核對真實MariaDB型別、unsigned、NULL、collation、default、generated及auto_increment；DECIMAL不改浮點 |
| 必要性 | 通過本次需求範圍判讀；欄位字典逐欄列保留用途，選填不等於無用途。原Food目錄的來源／版本／密度仍保留，不因Mock未用就刪除 |
| 冗餘 | 無未說明的同用途可寫副本；保留歷史證據、DB衍生索引鍵、受控查詢投影及快照完整性期望值，字典列明維護來源 |
| 命名 | gender已改為sex，max_amount_g已改為明確當地日上限max_daily_amount_g；snake_case命名全數自動檢查，數量標示單位或明確引用Nutrient/target_basis，通用name/status以表限定 |

這不是全部輸入組合均已測完的宣稱。varchar長度邊界、每種CHECK組合與大規模效能未全面測試。食物限制目前是政策儲存，未實作自動判定；max_daily_amount_g已明確定義為每個當地日上限；Schema約束驗證政策形狀，沒有假稱已完成餐點限量自動判定。後端及真人Manual Test的待驗項目見下方適用範圍。

## 前次文件審閱覆蓋

依Compound Engineering文件審閱，完成五個本地角色的唯讀審閱：一致性、可行性、安全界線、範圍控制、對驗收結論的反向核對。唯一文件修正是讓本次執行秒數與最新log相符，沒有修改Schema。Claude跨模型補充審閱因自動审批拒絕內部報告外傳，未啟動，沒有將它算入已完成覆蓋。Superpowers完成前驗證則以本次重新執行的命令及輸出為準。

完整輸出：[integration_result_2026-10-06.txt](tests/integration_result_2026-10-06.txt)。資料庫證據：[runtime_evidence.json](runtime_evidence.json)。帳號密碼未寫入交付檔或測試log。

## 已建立資料庫

| 用途 | 資料庫 | 狀態 |
|---|---|---|
| 乾淨v10應用Schema基準 | athlete_nutrition_v10 | 18表、169欄、30FK、40triggers、26routines；資料列0，不含fixtures |
| 本次可丟棄驗證資料庫 | mvp_test_v10_20261006_7d9f3e | 保留測試資料供追查；不得當應用資料庫 |
| 使用者原資料庫 | zeabur | 未寫入或覆蓋；前後表數皆0 |

本次建立乾淨應用Schema，沒有執行v9資料遷移；永久API/worker使用者及後端部署尚未設定。v10交付目錄與SQL/圖檔名稱已移除MVP，命名不代表整個產品已上線。

## 適用範圍

此驗收只對本次29案例、DDL一致性及此服務上的MariaDB 12.3.3負責。原11.8目標／compose環境沒有執行；服務log_bin=0，所以binlog開啟情境沒有驗證。尚未完成整體壓力／效能測量、備份還原、後端session與組織查詢隔離、Jenny F2e端到端串接。SELECT grants本身不是列級授權，p_actor仍需可信後端確認；這些不能靠ERD或本次SQL測試推定完成。
