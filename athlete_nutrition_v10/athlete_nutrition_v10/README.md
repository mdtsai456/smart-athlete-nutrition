# Athlete Nutrition v10

2026-10-06，依v9及Jenny目前F2e補齊設計。保留16表，只新增每日計畫版本與餐點修正歷程，共18表。Coach、Nutritionist、Account、Organization與AthleteCoach均在完整圖中。

- [完整ERD（Mermaid）](erd/full_erd.md)
- [關聯總覽（SVG）](erd/athlete_nutrition_v10_erd_overview.svg)
- [全部欄位ERD（SVG）](erd/athlete_nutrition_v10_erd.svg)
- [全部欄位ERD（PDF）](erd/athlete_nutrition_v10_erd.pdf)
- [169個欄位字典與逐欄審查](column_dictionary.md)
- [減法驗證、角色權限、F2e對照與寫入契約](production_guide.md)
- [依Jenny現有F2e重新核對與完整18表必要性](jenny_f2e_alignment.md)
- [正式SQL](athlete_nutrition_schema.sql)
- [DBML](athlete_nutrition_erd.dbml)
- [服務角色權限](permissions.sql)
- [驗證結果與限制](validation_report.md)
- [實作決策紀錄](implementation_notes.md)

v9保留，Jenny F2e未修改。已在Zeabur MariaDB 12.3.3建立乾淨的athlete_nutrition_v10資料庫，18表/169欄/30FK與DDL相符；29項實際DB測試及離線檢查通過。這是已驗收的Schema基準，沒有建立後端或執行v9資料遷移；適用範圍與限制請見validation_report.md。
