# 運動員營養管理平台

原生 HTML、CSS、JavaScript ES Modules，無框架或建置依賴。深藍頂部列、白色側欄與雙欄介面。

## 專案狀態

目前是可操作的**前端原型**，使用 Mock API 與瀏覽器儲存模擬後端。啟動不需要資料庫、API Key、攝影機或 AI 模型，也不需要設定 `.env`。

技術：HTML、CSS、原生 JavaScript ES Modules。**不需要 `npm install`，也沒有 build 步驟。**

## 快速啟動

### 1. 下載專案

先安裝 Git，在終端機執行：

```sh
git clone https://github.com/mdtsai456/smart-athlete-nutrition.git
cd smart-athlete-nutrition
```

也可以在 GitHub 點選 **Code → Download ZIP**，解壓縮後在專案資料夾開啟終端機。執行下列指令時，目前目錄應包含 `index.html` 與 `package.json`。

### 2. 啟動本機網頁伺服器

只看前端畫面需要 **Python 3** 與現代瀏覽器；**Node.js 22 以上及 npm** 用於 npm 指令與自動測試。

**macOS / Linux：**

```sh
python3 --version
python3 -m http.server 5173 --bind 127.0.0.1
```

**Windows（PowerShell / CMD）：**

```powershell
py --version
py -m http.server 5173 --bind 127.0.0.1
```

Windows 若沒有 `py` 指令，但已安裝 Python 3，可改用：

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

若已安裝 Node.js、npm 與可用的 `python3`，也可使用現有捷徑：

```sh
npm start
```

`npm start` 實際執行 `python3 -m http.server 5173`，因此仍需要 Python；它不是 Node.js 伺服器。Python 預設監聽所有介面，只需本機預覽時可優先使用上面的 `--bind 127.0.0.1` 指令。

### 3. 開啟網站

瀏覽器開啟 **[http://localhost:5173](http://localhost:5173)**。

保持終端機執行中；結束時按 **Ctrl + C**。修改 HTML、CSS 或 JS 後重新整理瀏覽器即可，沒有自動重新載入功能。

> 請勿直接雙擊 `index.html` 或以 `file://` 開啟。專案使用 ES Modules，需要透過 HTTP 伺服器載入。

## 第一次操作

1. 進入登入頁，選擇「營養師」「教練」或「球員」，點選「進入示意頁」。帳密是唯讀示範，不需註冊。
2. 右上角可切換角色。球員視角目前固定對應示範球員 `p1`，不是多人登入系統。
3. 預設示範日期為 **2026-11-16**，先使用此日期查看既有飲食紀錄；切換日期可能沒有紀錄。
4. 可依序體驗以下流程：
   - 球員 → 個人資料 → 更新訓練次數或飲食限制 → 儲存。
   - 營養師 → 每日營養目標 → 選擇球員 → 調整目標 → 驗算並儲存。
   - 球員 → 食物攝影機 → 開始記錄 → 模擬攝影機辨識 → 確認並儲存。
   - 教練 → 查看球員資料、飲食紀錄與營養分析。

營養不足提醒需要先調整數值，或勾選已檢查提醒，才能儲存；熱量驗算不通過則必須修正。

## 測試

測試需要 **Node.js 22 以上及 npm**，不需要啟動網頁伺服器，也不需要安裝套件：

```sh
node --version
npm --version
npm test
```

測試涵蓋營養計算、輸入驗證、球員與日期資料隔離、攝影機模擬結果及個人資料更新。`tests/` 不會載入前端頁面。

## 常見問題

| 問題 | 處理方式 |
| --- | --- |
| `python3` 或 `py` 找不到 | 安裝 Python 3，重新開啟終端機；Windows 可試 `python`。 |
| `npm` 找不到 | 只看畫面可直接使用 Python 指令；要執行測試再安裝 Node.js 與 npm。 |
| `Address already in use` / 5173 已被占用 | 將啟動指令的 `5173` 改成 `5174`，並開啟 `http://localhost:5174`。 |
| 看到資料夾清單、404 或空白頁 | 確認伺服器從含 `index.html` 的專案根目錄啟動，且使用 HTTP 網址。 |
| 修改程式後畫面沒更新 | 強制重新整理：Windows / Linux 用 Ctrl + Shift + R，macOS 用 Command + Shift + R。 |
| 換日期後飲食紀錄消失 | 紀錄依日期篩選，切回 `2026-11-16` 查看初始範例。 |
| 換瀏覽器、電腦或連接埠後資料不同 | Mock 資料僅存於該瀏覽器及網站來源，不會跨裝置同步；`localhost` 與 `127.0.0.1` 也分開儲存。 |

### 重置範例資料

重置會刪除**目前網站來源內自行新增或修改的 Mock 資料**。需要保留的內容請先備份。

在瀏覽器開發者工具的 **Application / Storage → Local Storage** 找到目前網址，只刪除 `fuelform-demo-v1`，再重新整理頁面。系統會重新載入 `js/api/seed.js` 的初始資料；不需要清除其他網站資料。

## 現行流程

- 營養師：登入示範 → 每日營養目標 → 選擇球員與日期 → 訓練日／休息日與分配條件 → 驗算 → 確認儲存。
- 球員：填寫個人資料；食物攝影機 → 辨識食物與重量 → 依每 100 g 營養資料表自動計算 → 確認儲存。原型使用模擬結果，結果有誤可重新拍攝。
- 教練：檢視飲食紀錄率、營養達成率與每日目標／實際飲食。
- 餐秤站：從登入頁「現場餐秤站（設備）」或 `#kiosk` 獨立入口進入，不放在三角色工作選單中；選擇身分 → 確認餐點 → 儲存後 3 秒回到選擇畫面。

**已移除菜單管理、菜單建立與分配**。球員不再選擇菜色或手動新增餐點，改由食物攝影機辨識後記錄。

## 營養目標

統一流程：**總熱量 → 蛋白質 → 脂肪底線 → 剩餘碳水 → 檢查需求 → 確認**，不再區分分配模式。

- 蛋白質 = 體重 × g/kg。
- 脂肪底線以 g/kg 或總熱量 % 設定。
- 剩餘熱量 ÷ 4 自動換算為碳水。
- 當日類型僅有「訓練日、休息日」，按球員與日期儲存。切換帶入可編輯的碳水需求示範值：訓練日 6、休息日 4 g/kg；重新開啟保留已儲存的自訂值。右側顯示需求克數與不足差額，實際碳水仍依剩餘熱量計算。這是產品起始值，由營養師按實際負荷與恢復需求調整。
- 起始值參考活動量分級（輕量 3–5、中等 5–7 g/kg/day）：[Better Health Channel](https://www.betterhealth.vic.gov.au/health/healthyliving/sporting-performance-and-food)。

起始值為 UI 示範。系統不自行估計 BMR 或運動消耗；計算體重保存在當日計畫中，不會改寫球員基本資料。舊版日別標籤會在開啟草稿時整理成兩類；舊版運動表現計畫保留已確認的營養素，以手動調整方式載入，避免變更既有目標，重新確認儲存後使用新格式。

所有營養素保留一位小數，最終以 `蛋白質×4 + 碳水×4 + 脂肪×9` 驗算，允許 ±5 kcal 取整差。手動微調同樣執行驗算；修改分配條件後回到自動計算。負值、非有效數字或熱量不吻合時阻止儲存；碳水／脂肪低於設定需求時需調整，或勾選已檢查提醒後確認。

目標以 `Player.nutritionPlans[YYYY-MM-DD]` 儲存，包含輸入、最終目標、提醒確認與時間。查詢當天時使用該日目標；未設定的日期使用 Player.target 作為示範基準。不同球員與日期不互相覆蓋。右側顯示為草稿，按下確認後才儲存。

範例：70 kg、2,800 kcal、蛋白質 1.6 g/kg、脂肪 1 g/kg → 蛋白質 112 g、脂肪 70 g、碳水 430.5 g（6.2 g/kg），合計 2,800 kcal。

## 模組分層

- `js/api/client.js`：唯一 transport，集中 baseURL、fetch、Mock 與 localStorage。
- `js/api/seed.js`：示範球員、菜色與紀錄，預設日期 2026-11-16。
- `js/services/platform.js`：資料載入與持久化、當日目標查詢及儲存。
- `js/services/planner.js`：純營養分配、驗算、底線檢查及確認驗證。
- `js/services/nutrition.js`：食物份量換算、個人達成率。
- `platform.recognizeMeal`：攝影機辨識 API、營養資料表對應、重量驗證及營養加總。
- `js/services/workspace.js`：飲食日誌 view models。
- `js/pages/targets.js`：營養目標表單與區域事件控制，無 fetch／API URL。
- `js/pages/camera.js`：食物攝影機入口；`workflows.js`：登入、球員及教練頁；`views.js`：頁面組合。
- `js/components/ui.js`：共用元件；`shell.js`：外框與角色導覽。
- `js/app.js`：路由、表單協調與飲食紀錄流程。
- `css/`：base、workspace、forms、responsive、planner；由 styles.css 載入。

## 後端接入

切換 `client.js` 的 `config.mode` 為 `http`，設定 baseURL，依以下契約實作，或在 Service 層適配正式 schema：

| Endpoint       | 方法        | 回傳                            |
| -------------- | ----------- | ------------------------------- |
| `/players`     | GET / POST  | Player[] / Player               |
| `/players/:id` | GET / PATCH | Player（含當日 nutritionPlans） |
| `/foods`       | GET / POST  | Food[] / Food                   |
| `/records`     | GET / POST  | MealRecord[] / MealRecord       |
| `/camera/recognitions` | POST | 辨識識別碼、食物 ID、重量及模型資訊 |

POST/PATCH 回傳更新後資源。正式後端可將每日計畫拆成 NutritionTarget 表並提供獨立 endpoint，在平台 Service 轉換即可。後端需實作身分驗證、角色授權、營養輸入驗證、去重及併發版本控制；前端角色切換只是展示。

## Mock 限制

資料保存在瀏覽器 localStorage 的 `fuelform-demo-v1`，清除此 key 可重置。舊版本留下的 menus 資料不再載入或使用，其餘紀錄保留。

AI、攝影機串流、RGB-D 與磅秤均未串接。模擬辨識回傳固定食物與重量，結果唯讀；有誤時重新拍攝。紀錄保留原始辨識結果，modelVersion 為 null。

攝影機目前回傳模擬辨識資料，尚無真實影像；正式版影像應由設備 Service／物件儲存提供。介面使用系統字體，無外部字型依賴。

球員名單統一集中在「營養分析 → 個人營養表現」，提供姓名／背號搜尋及營養師新增球員入口。已移除獨立球員管理頁，舊 `#players` 連結會轉到 `#analysis`。

營養師的全隊總覽已合併至「營養分析」，統一呈現全隊統計、營養達成圖表與個人營養表現。營養師開啟舊 `#dashboard` 連結時會轉到 `#analysis`；球員首頁與教練監督頁維持各自的角色流程。

### 攝影機串接
`POST /camera/recognitions` 接收 `{playerId, date}`，回傳 `{recognitionId, source, modelVersion, items: [{foodId, grams, confidence}]}`。設備需提供對應資料表的食物 ID 與每項食物重量；單靠食物名稱無法計算該餐營養。尚未對應的食物或無效重量會阻止儲存。每項營養 = 資料表每 100 g 數值 × grams / 100；全餐加總於 Service 層完成。Mock 回應位於 API 層，正式設備協定於 API / Service 層適配。

### 運動員基本資料
營養師可在「營養分析 → 個人營養表現 → 球員詳情」新增／編輯資料，也可從每日營養目標的資料區編輯。教練的球員詳情可查看完整資料，目標對照區顯示運動項目、每週訓練、主要目標、飲食限制、過敏與備註。

Player 新增 birthDate、sex、bodyFat（null 表示未填）、sport、weeklyTraining、goal、dietaryRestrictions、allergies、notes；保留 name、height、weight 及既有背號／位置。新增與更新由 athleteProfile Service 驗證，透過 POST /players、PATCH /players/:id 儲存。舊資料的新欄位不自動補造，介面顯示「未填寫」。新目標以目前體重開始，已確認計畫保留當時計算體重，避免改變歷史目標。Mock 資料仍存於瀏覽器。

### 球員自行維護資料
球員「個人資料」分頁與首頁捷徑可填寫、更新同一份 Player 資料，儲存後教練與營養師讀取更新。此頁不按日期建立新紀錄，既有飲食紀錄與已確認營養計畫保持不變。updateMyProfile 在 Mock 階段固定更新示範登入球員 p1，不採用表單傳入的 playerId；正式串接須由後端驗證登入身分，改用 /me 或等效 API。

## 維護範圍
Mock API、seed 與角色切換是目前前端流程的必要依賴，待正式後端與登入完成再替換。tests/ 是獨立的回歸測試，不會載入網頁；保留資料隔離、輸入驗證及營養計算檢查。舊網址轉向及舊營養計畫轉換保留，以免既有瀏覽器資料失效。
