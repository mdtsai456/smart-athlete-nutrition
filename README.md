# 運動員營養管理平台

原生 HTML、CSS、JavaScript ES Modules。沒有框架，也沒有建置步驟。

這是可操作的前端原型。資料放在瀏覽器的 Mock API。啟動不需要資料庫、API Key 或 `.env`。攝影機與辨識模型也不是啟動條件；沒有攝影機時，仍可用示範按鈕走完記錄流程。

## 快速啟動

### 1. 下載專案

```sh
git clone https://github.com/mdtsai456/smart-athlete-nutrition.git
cd smart-athlete-nutrition
```

也可以在 GitHub 點選 **Code → Download ZIP**。解壓縮後，在含有 `index.html` 與 `package.json` 的資料夾開啟終端機。

### 2. 啟動本機網頁伺服器

看畫面需要 Python 3 與現代瀏覽器。Node.js 22 以上只用於測試。

**macOS / Linux：**

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

**Windows（PowerShell / CMD）：**

```powershell
py -m http.server 5173 --bind 127.0.0.1
```

沒有 `py` 時，改用 `python -m http.server 5173 --bind 127.0.0.1`。

已安裝 Node.js、npm 與 `python3` 時，也可以執行 `npm start`。它實際執行 `python3 -m http.server 5173`，仍需要 Python，而且會監聽所有介面。只在本機預覽時，優先使用上面的 `--bind 127.0.0.1`。

### 3. 開啟網站

瀏覽器開啟 [http://127.0.0.1:5173](http://127.0.0.1:5173)。根目錄會轉到登入頁。

保持終端機執行。結束時按 **Ctrl + C**。修改 HTML、CSS 或 JS 後，用強制重新整理載入。這個伺服器沒有自動重新載入，也不送快取控制標頭。

不要雙擊 `index.html`，也不要用 `file://` 開啟。ES Modules 必須經由 HTTP 載入。

## 第一次操作

1. 登入頁已填營養師林怡安。密碼是唯讀示範。按 **進入**。
2. 登入後，右上角可切換到其他啟用中的帳號。停權帳號與停用組織不能登入，也不出現在切換清單。
3. 示範日期是 **2026-11-16**。先用這一天看既有飲食紀錄。換日期可能沒有紀錄。
4. 可依序看這些流程：
   - 營養師：每日營養目標 → 選球員 → 調整 → 驗算並儲存。
   - 營養師：菜色營養資料庫 → 預覽 Excel → 確認匯入。
   - 球員：食物攝影機 → 開始記錄 → 選一種示範辨識 → 確認並儲存。
   - 球員：個人資料 → 改訓練次數或飲食限制 → 儲存。
   - 教練：看指派期間內的球員、飲食紀錄與營養分析。

熱量驗算不通過時不能儲存。營養低於需求時，要調整數值，或勾選已檢查提醒後再儲存。

## 頁面

| 角色 | 登入後首頁 | 側欄 |
| --- | --- | --- |
| 營養師 | `/nutritionist/targets.html` | 菜色營養資料庫、每日營養目標、飲食紀錄、營養分析 |
| 教練 | `/coach/dashboard.html` | 球員飲食監督、飲食紀錄、營養分析 |
| 球員 | `/athlete/dashboard.html` | 球員首頁、食物攝影機、我的飲食紀錄、個人營養狀況、個人資料 |

餐秤站在 `/kiosk/index.html`。它不在三個角色的側欄裡。選球員後，記錄步驟與食物攝影機相同。儲存後約 3 秒回到選人畫面。

教練不能改餐點，也不能儲存每日營養目標。營養師畫面不編輯球員基本資料。球員只能改自己的個人資料。

## 食物攝影機

食物攝影機頁顯示即時畫面與餐盤對齊框。開始記錄的對話框也使用同一個鏡頭。瀏覽器必須允許攝影機；`http://127.0.0.1` 可以開鏡頭。

這版不保存照片。辨識用頁面上的示範按鈕，不呼叫外部模型。空結果、未對應菜色與辨識失敗會以紅字顯示。確認後的項目才計入當日攝取。

## 測試

不需要啟動網頁伺服器，也不需要 `npm install`：

```sh
npm test
```

同等指令是 `node --test tests/*.test.js`。測試檢查營養計算、餐點命令、權限、匯入與路由。`tests/` 不開啟瀏覽器。

## 常見問題

| 問題 | 處理方式 |
| --- | --- |
| `python3` 或 `py` 找不到 | 安裝 Python 3 後重開終端機。Windows 可試 `python`。 |
| `npm` 找不到 | 看畫面直接用 Python。要跑測試再安裝 Node.js 與 npm。 |
| 連接埠已被占用 | 把 `5173` 改成其他連接埠，並開啟對應網址。 |
| 看到資料夾清單、404 或空白頁 | 從含 `index.html` 的專案根目錄啟動，並用 HTTP 網址。 |
| 修改後畫面沒變 | 強制重新整理。Windows / Linux 用 Ctrl + Shift + R。macOS 用 Command + Shift + R。 |
| 換日期後沒有飲食紀錄 | 紀錄依日期篩選。切回 `2026-11-16`。 |
| 換瀏覽器或網址後資料不同 | Mock 只存在該瀏覽器的該網站來源。`localhost` 與 `127.0.0.1` 分開儲存。 |
| 攝影機無法使用 | 允許瀏覽器使用攝影機。若顯示正在被其他程式使用，先關閉其他占用鏡頭的分頁或程式。 |

### 重置範例資料

重置會刪除目前網站來源裡新增或修改的 Mock 資料。要保留的內容請先備份。

在瀏覽器開發者工具的 **Application / Storage → Local Storage** 刪除 `fuelform-demo-v4`，再重新整理。系統會重新載入 `js/api/seed.js`。不要清除其他網站的資料。

## 資料規則

- Mock 存在 `localStorage` 的 `fuelform-demo-v4`。第一次開啟寫入初始資料，之後不覆蓋已有紀錄。
- 登入狀態在 cookie。正式環境應使用 HttpOnly session。這版的 JavaScript 只應讀 CSRF token。寫入時的操作者來自 session，不來自表單。
- 餐點寫入只用建立草稿、修改與第一次送出。修改必須帶目前版本。版本不符時顯示「此餐點已被其他人更新，請重新載入。」頁面不會自動覆蓋。
- 送出後的修正仍走修改。重新開啟已審核餐點必須填原因。
- 當日攝取只計已送出或已審核餐點中的已確認項目。沒有目標時顯示未設定，不顯示 0。
- 當日有每日營養目標時用該日目標。沒有時才用期間政策。
- 每日營養目標的計算體重存在該日計畫。儲存計畫不會改球員基本資料的體重。
- 菜色匯入先預覽再確認。空白營養欄不寫成 0。同名菜色與無法對應的欄位會標成錯誤，不寫入。

## 目錄

- `login/`、`athlete/`、`nutritionist/`、`coach/`、`kiosk/`：各頁的 HTML。
- `js/api/`：Mock、session、餐點命令、每日計畫與初始資料。
- `js/services/`：權限範圍、營養計算、餐點與菜色規則。
- `js/pages/`：各角色頁面。共用畫面在 `js/pages/shared/`。
- `js/core/`：路由、登入與頁面外框。
- `js/components/`：側欄、頂部列、對話框與共用元件。
- `js/utils/`：Excel 讀取、菜色匯入與食物圖示。
- `css/`：樣式。`styles.css` 載入其餘檔案。
- `samples/`：菜色匯入用的 Excel 範例。
- `tests/`：Node.js 測試。
- `athlete_nutrition_v10/`：目前的資料庫與後端契約。`athlete_nutrition_mvp_v9/` 是上一版。

## 後端接入

把 `js/api/api.js` 的 `config.mode` 改成 `http`，並設定 `baseURL`。預設是 `/api/v1`。頁面不自己組網址，也不直接呼叫 `fetch`。

餐點不要做成逐表新增、修改、刪除。正式路徑是：

| 動作 | 方法與路徑 |
| --- | --- |
| 建立草稿 | `POST /meals` |
| 修改 | `POST /meals/:id/mutations` |
| 第一次送出 | `POST /meals/:id/submit` |
| 讀取一餐 | `GET /meals/:id` |
| 儲存每日營養目標 | `PUT /daily-plans` |

修改的 `action` 為 `edit`、`add_item`、`confirm`、`reject`、`delete_item`、`add_image`、`delete_image`、`queue_analysis`、`review`、`reopen`。照片只存 object key，不把圖片內容放進資料庫或 `localStorage`。欄位與權限以 `athlete_nutrition_v10/` 的契約為準。

## 程式維護

餐點查詢不會執行辨識。示範按鈕會明確呼叫模擬分析，再重新讀取結果。項目操作直接傳入餐點與項目 ID。簡化項目、驗證結果與正式串接限制見 [程式檢查紀錄](docs/code-review.md)。
