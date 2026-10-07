# MVP v9 ERD

此圖依最新版 athlete_nutrition_erd.dbml 產生，包含 16 張表、131 個欄位及 26 個外鍵關係，與本次 Production Schema 修正版相同。

athlete_nutrition_mvp_v9_erd 是完整欄位圖；_overview 是只顯示 PK/FK 的關聯總覽。SVG 與 PDF 可放大；PNG 供直接預覽；DOT 是可重新排版的繪圖來源。

PK 為主鍵，FK 為外鍵，UQ 為單欄唯一鍵，G 為 SQL generated column，NN 為 NOT NULL。複合索引、CHECK、trigger 及 transaction 規則請閱讀 DBML、SQL 與 production_guide.md。橘色虛線表示操作者／狀態稽核帳號關係。Crow-foot 表示多筆、圈表示可無對應、双直線表示恰好一筆。

圖上連線連接表格邊界，完整 FK 欄位可在 SVG 的連線 tooltip 與 DBML 查閱。這份 ERD 是 MVP 版本，不含 Full 的 Team/Menu/Dish/Allergen 模組。
