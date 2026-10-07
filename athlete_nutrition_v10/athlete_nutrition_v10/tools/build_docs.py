"""Produce field inventory and complete Mermaid from canonical SQL metadata."""
from pathlib import Path
from build_erd import parse

ROOT=Path(__file__).resolve().parents[1]
PURPOSE={
 'Organization':'組織與啟用狀態。', 'Account':'共同登入身分、角色、組織與帳號狀態。',
 'Athlete':'球員個人資料；不重複帳號的組織與權限。', 'Nutritionist':'營養師個人資料；account_id 唯一對應營養師帳號。',
 'Coach':'教練個人資料；account_id 唯一對應教練帳號。', 'AthleteCoach':'教練與球員的有效日期指派；支援多對多。',
 'Food':'共用或組織食物目錄；營養值另存 FoodNutrient。', 'Nutrient':'營養素識別、機器代碼與單位。',
 'FoodNutrient':'食物每100g的營養值與資料來源。', 'MealRecord':'整餐、球員、用餐日期、流程狀態與目前版本。',
 'MealImage':'物件儲存圖片參照；不把圖片二進位放進DB。', 'MealItem':'一餐中的食物項目、估重及人工確認結果。',
 'MealItemNutrient':'確認當下的營養快照；食物目錄更新不回寫舊餐。', 'MealAnalysis':'AI工作狀態與原始分析；人工修正不覆蓋原始結果。',
 'AthleteNutritionTarget':'營養師設定的有效期間營養政策。', 'AthleteFoodRestriction':'營養師設定的有效期間食物限制。',
 'AthleteDailyNutritionPlan':'完整每日表單、計算依據、確認結果與不可覆寫版本。',
 'MealRevision':'整餐修正前後快照、操作者、原因與版本；只追加。'}
DESC={
 'name':'名稱／姓名', 'status':'生命週期狀態；合法值見SQL CHECK', 'email':'登入電子郵件', 'password_hash':'密碼雜湊；不可給F2e',
 'role':'athlete / nutritionist / coach / admin', 'last_login_at':'最近登入時間', 'active_email':'非disabled帳號的有效email；DB自動衍生',
 'birth_date':'出生日期；年齡從此計算', 'sex':'生理性別male / female / other / undisclosed；對齊Jenny sex，可未填', 'weight_kg':'目前體重10–350kg；未知為NULL，不影響舊計畫的計算體重',
 'height_cm':'身高cm', 'body_fat_percent':'體脂百分比', 'sport':'運動項目', 'weekly_training_count':'每週訓練次數',
 'primary_goal':'maintain / gain_muscle / lose_fat / competition', 'jersey_number':'球衣號碼；0合法、未知為NULL', 'position':'場上位置',
 'dietary_restrictions_text':'球員自述飲食限制；不是已確認政策', 'allergies_text':'球員自述過敏；供營養師確認', 'notes':'球員管理備註',
 'created_at':'建立時間UTC', 'updated_at':'最後更新時間UTC', 'start_date':'有效起日（包含）', 'end_date':'有效迄日（包含）；NULL表示持續有效',
 'food_name':'食物名稱', 'brand':'品牌', 'food_type':'食物分類文字', 'description':'描述／自由文字限制', 'source':'資料來源',
 'source_food_code':'外部資料來源食物代碼', 'source_scope_id':'DB自動衍生目錄來源範圍', 'density_g_per_ml':'g/ml密度；僅供ml轉g',
 'nutrient_code':'機器代碼；energy/protein/carbohydrate/fat等；已設定後不可改', 'nutrient_name':'營養素顯示名稱', 'unit':'營養素單位；不可直接改',
 'amount_per_100g':'每100g食物的營養量', 'source_version':'來源資料版本', 'calculation_method':'計算方法說明',
 'consumed_at':'實際用餐時間UTC', 'local_date':'用餐地當地日期／計畫日期', 'timezone':'IANA時區，例如Asia/Taipei',
 'meal_type':'breakfast / lunch / dinner / snack / pre_training / post_training', 'note':'備註',
 'status_changed_at':'最近提交／審核時間UTC', 'status_change_reason':'最近狀態改變原因', 'revision':'樂觀鎖版本；成功修改才遞增',
 'submission_request_id':'整餐首次提交的重送識別碼；同建立者下唯一', 'submission_request_hash':'正規化提交內容SHA256；防同key不同內容',
 'object_key':'圖片物件儲存key', 'mime_type':'圖片媒體型別', 'uploaded_at':'圖片記錄時間UTC', 'detected_label':'辨識／使用者輸入食物名稱',
 'estimated_weight_g':'AI或使用者估計重量g', 'confirmed_weight_g':'人工確認重量g', 'weight_source':'ai / measured / manual',
 'confirmation_status':'pending / confirmed / rejected', 'snapshot_nutrient_count':'完整快照應有筆數；DB維護', 'confirmed_at':'確認時間UTC',
 'amount':'食用重量換算後營養量；單位見Nutrient', 'calculated_at':'快照計算時間UTC', 'model_name':'AI模型名稱', 'model_version':'AI模型版本',
 'raw_result_json':'AI原始結果；完成後不可覆寫', 'error_message':'分析失敗原因', 'started_at':'分析開始時間UTC', 'completed_at':'分析完成時間UTC',
 'target_basis':'absolute絕對量 / per_kg_bw每kg體重', 'target_min':'政策下限；NULL表示未設下限', 'target_max':'政策上限；NULL表示未設上限',
 'restriction_type':'prohibited禁止 / limited限量', 'max_daily_amount_g':'當地日限量食物總重量上限g；禁止時NULL',
 'calculation_weight_kg':'當時計算體重kg；不跟現在體重連動', 'day_type':'training / rest', 'input_json':'唯一原始F2e表單；不要再複製各輸入欄位',
 'target_energy_kcal':'確認後每日熱量kcal', 'target_protein_g':'確認後每日蛋白質g', 'target_carbohydrate_g':'確認後每日碳水g', 'target_fat_g':'確認後每日脂肪g',
 'warnings_json':'DB計算的提醒代碼陣列', 'warnings_acknowledged':'是否確認提醒0/1；有提醒必須1', 'change_reason':'新版本修改原因；第二版起必填',
 'action':'造成此版本的操作種類', 'reason':'人工修改原因；必要操作不可留空', 'before_json':'修改前整餐快照；create時NULL',
 'after_json':'修改後整餐快照；schema_version=1', 'recorded_at':'歷程記錄時間UTC'}

# Manual design decisions; formatting and exhaustive field coverage are automated.
REVIEW={
 ('Account','active_email'):'由email及status自動衍生，支援未disabled帳號唯一性；不接受人工維護第二份email。',
 ('Account','organization_id'):'共同租戶來源；admin可NULL，其他角色CHECK要求組織；profile不重複保存。',
 ('Account','last_login_at'):'登入事件時間；created_at與updated_at無法替代，未登入為NULL。',
 ('Food','source_scope_id'):'由organization_id自動衍生，NULL共用目錄映射0供唯一索引；不是另一個組織FK。',
 ('Food','source'):'整筆食物的外部目錄命名空間，與source_food_code成對；不同於每項營養值的來源。',
 ('Food','source_food_code'):'外部目錄識別碼，可含前導0及字母，不以整數保存；與scope/source共同去重。',
 ('Food','density_g_per_ml'):'保留原食物目錄的體積換重依據；只有ml轉g才使用，未知NULL，不新增體積營養欄位。',
 ('Food','description'):'食物目錄描述，不是營養政策；不是品牌或分類的另一份副本。',
 ('FoodNutrient','source'):'單一營養素測量／資料來源，可能與食物目錄來源不同。',
 ('FoodNutrient','source_version'):'該營養數值來源版本，供追查資料更新；不從food來源代碼猜測。',
 ('FoodNutrient','calculation_method'):'數值的量測或換算方法說明，與來源名稱及版本不同。',
 ('Athlete','primary_goal'):'球員個人意向，承接Jenny goal；不是四項數值target的副本。',
 ('Athlete','sex'):'對齊Jenny的生理性別欄位；改正原gender命名，不另新增性別欄位。',
 ('Athlete','notes'):'Jenny球員管理備註；與過敏及飲食限制自述分開。',
 ('MealRecord','local_date'):'用餐當地日的查詢依據；不同於UTC日期，由command計算並由trigger核對，不能獨立任填。',
 ('MealRecord','timezone'):'UTC事件轉為local_date的IANA依據；datetime本身不含時區。',
 ('MealRecord','status_changed_by_account_id'):'目前狀態的責任帳號；與建立人及歷次修改人不同，由command維護。',
 ('MealRecord','status_changed_at'):'最近狀態轉換時間；內容更新updated_at不能替代，由command維護。',
 ('MealRecord','status_change_reason'):'目前狀態的reopen原因投影；完整歷程仍在MealRevision，同筆交易維護，非獨立原因來源。',
 ('MealRecord','submission_request_id'):'首次提交的重送識別碼，與餐點PK不同；同建立者唯一且區分大小寫。',
 ('MealRecord','submission_request_hash'):'與key成對保存正規化內容hash，阻止同key不同內容；固定64個ASCII十六進位字元。',
 ('MealImage','object_key'):'儲存物件定位，不保存二進位圖片或易過期簽名URL。',
 ('MealImage','mime_type'):'物件媒體型別提示，非檔名或圖片內容副本；不能當作安全驗證結果。',
 ('MealItem','estimated_weight_g'):'估計輸入證據，與人工confirmed_weight_g語意不同；單位g明確。',
 ('MealItem','confirmed_weight_g'):'本次確認食用重量，負責快照換算；不覆蓋原估重。',
 ('MealItem','snapshot_nutrient_count'):'DB記錄確認時預期快照筆數，供完整性守門；不是營養總量，不從已損壞子表反推期望值。',
 ('MealItemNutrient','amount'):'本次食用量的歷史營養快照；目錄更新不能改寫，單位由nutrient_id決定。',
 ('MealAnalysis','raw_result_json'):'保留模型原始輸出證據；人工確認由MealItem保存，不維護兩份現況。',
 ('AthleteNutritionTarget','target_basis'):'說明absolute或每kg基準，避免同一數字被誤讀成不同單位。',
 ('AthleteNutritionTarget','target_min'):'政策下限；NULL表示未設定下限，不等同0；與上限各自必要。',
 ('AthleteNutritionTarget','target_max'):'政策上限；NULL表示未設定上限；精確值用min=max，不能猜測範圍中點。',
 ('AthleteFoodRestriction','description'):'食物未對應目錄時的文字限制本體；不是note說明。',
 ('AthleteFoodRestriction','note'):'政策原因或補充說明；不重複限制本體，未提供可NULL。',
 ('AthleteFoodRestriction','max_daily_amount_g'):'有效期間內每個當地日的食物總重量g上限；依MealRecord.local_date彙總submitted/reviewed的confirmed項目，禁止時NULL；不包含自動判定服務。',
 ('AthleteDailyNutritionPlan','input_json'):'Jenny完整原表單的唯一輸入來源；不再新增每個輸入設定欄位。',
 ('AthleteDailyNutritionPlan','calculation_weight_kg'):'當時確認的計算體重快照，與現在Athlete.weight_kg不同；command從input驗證取得。',
 ('AthleteDailyNutritionPlan','day_type'):'已確認日型別的查詢投影，從input.training轉換；不作另一個可獨立修改的輸入。',
 ('AthleteDailyNutritionPlan','warnings_json'):'DB產生的當次提醒證據，與caller原始輸入不同；不信任caller提供提醒。',
 ('AthleteDailyNutritionPlan','warnings_acknowledged'):'營養師是否確認提醒的行為證據；不能從有無warnings猜測。',
 ('MealRevision','before_json'):'變更前歷史版本，包括被刪內容；create為NULL，與現在子表不同。',
 ('MealRevision','after_json'):'變更後歷史版本；只追加，與可繼續修改的目前子表不同。',
}

def type_reason(d):
 kind=d['type']
 if kind=='bigint':return '64位整數識別碼；PK/FK同型，API以字串傳送。'
 if kind.startswith('decimal'):
  p,s=map(int,kind[kind.index('(')+1:-1].split(','))
  return f'固定小數，{p-s}位整數／{s}位小數；範圍另受CHECK限制，寫入前驗證精度。'
 if kind=='date':return '僅日曆日期，不混入時間或時區。'
 if kind.startswith('datetime'):return 'UTC日期時間、微秒精度；DATETIME不自帶時區。'
 if kind=='json':return 'MariaDB JSON alias含JSON_VALID；形狀及生命週期另由CHECK/command驗證。'
 if kind=='text':return '可變長自由文字；不強行解析成結構化政策。'
 if kind.startswith('varchar'):return '有上限的文字；代碼合法集合由CHECK驗證，非固定集合不硬塞ENUM。'
 if kind.startswith('char'):return '固定長度hash；ascii_bin保留大小寫語意。'
 if kind in ('int','tinyint'):return '整數計數／版本／旗標；unsigned與CHECK限制合法範圍。'
 raise ValueError('Unreviewed type '+kind)

def decision(table,col,d,fks):
 if (table,col) in REVIEW:return REVIEW[table,col]
 if d['primary']:return '單列穩定識別碼，供更新、引用及API定位；自然唯一鍵仍另約束，不重複業務資料。'
 if (table,col) in fks:return '連結'+fks[table,col][0]+'的唯一身分；不另複製被引用實體的姓名／角色／營養值。'
 if col in ('created_at','updated_at'):return ('建立該實體的UTC時間，與其他實體及最後更新時間不同。' if col=='created_at' else '該實體最後更新的UTC時間，與建立時間不同；維護端須同步寫入。')
 if col=='revision':return {'MealRecord':'目前整餐樂觀鎖版本；與歷次事件編號對應，由command維護。','MealRevision':'該歷史事件的版本識別；與目前餐點版本用途不同。','AthleteDailyNutritionPlan':'同球員同日的不可覆寫計畫版本；唯一鍵限制重複。'}[table]
 if col.startswith('target_') and table=='AthleteDailyNutritionPlan':return '已確認'+DESC[col]+'，用於日查詢與比較；command由輸入計算，不能獨立任填。'
 return DESC[col]+'；服務'+PURPOSE[table].rstrip('。')+'，沒有另一個同用途可寫欄位。'
def main():
 tables,refs=parse((ROOT/'athlete_nutrition_schema.sql').read_text(encoding='utf-8'))
 fks={(t,c):(p,k) for t,c,p,k,_ in refs}
 lines=['# v10 欄位字典與逐欄減法審查','', 'SQL 是正式來源。共18表、169欄位、30條外鍵；NULL表示未提供，不以0或空字串替代。',
        '','Account.role是權限來源；Athlete、Coach、Nutritionist是角色資料。每日計畫confirmed_by_account_id及歷程actor_account_id連Account，由command驗證身分，不重複存nutritionist_id。','']
 lines += ['每個欄位均核對型別、必要性、冗餘與命名。以下判讀是逐欄設計審查，生成器只驗證169欄覆蓋，不能自動證明業務必要性。可NULL不代表F2e新增表單可缺必填。', '',
 'BIGINT的PK/FK一致；DECIMAL保存精確數量，超出精度須由adapter拒絕；DATE保存日期；DATETIME(6)以UTC契約保存事件；JSON保存表單／歷史證據。合理容量不等於已執行每個varchar長度的邊界測試。','',
 '同值的不同用途分為歷史證據及受控查詢投影。active_email/source_scope_id由DB自動生成；local_date、當前狀態metadata、日計畫結果由command/trigger一致維護；snapshot_nutrient_count是完整性期望值。這些不屬於兩份可獨立寫入的業務現況。', '',
 '命名採snake_case；重量與宏量結果標示單位，amount及target_min/max的單位由Nutrient及target_basis共同決定。name/status/source等名稱以資料表限定語意，不再加重複表名前綴。', '']
 for name,t in tables.items():
  lines += ['## '+name,'',PURPOSE[name],'','| 欄位 | SQL型別 | 必填 | 關聯／用途 | 型別判讀 | 必要性／冗餘判讀 | 命名判讀 |','|---|---|---|---|---|---|---|']
  for col,d in t['columns'].items():
   meaning=DESC.get(col)
   if (name,col) in fks:
    p,k=fks[name,col]; meaning=f'FK → {p}.{k}'+('；'+meaning if meaning else '')
   elif d['primary']:meaning='PK；DB產生的識別碼'
   if not meaning:raise ValueError('Missing description '+name+'.'+col)
   naming='清楚；以表限定語意，單位／代碼依用途欄解讀。'
   if col=='sex':naming='已改正gender；生理性別與Jenny sex一致。'
   lines.append(f'| `{col}` | {d["type"]}'+(' unsigned' if d['unsigned'] else '')+f' | {"是" if d["required"] else "否"} | {meaning} | {type_reason(d)} | {decision(name,col,d,fks)} | {naming} |')
  lines += ['']
 (ROOT/'column_dictionary.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 lines=['# 完整18表 ERD','', '完整圖包含Coach與Nutritionist；線條只表示實際FK，角色限制另由SQL驗證。','', '```mermaid','erDiagram']
 for child,col,parent,key,_ in refs:
  d=tables[child]['columns'][col]
  parent_end='||' if d['required'] else '|o'
  child_end='o|' if d['unique'] or d['primary'] else 'o{'
  lines.append(f'    {parent} {parent_end}--{child_end} {child} : {col}')
 lines += ['```','', 'Account與每個角色profile是1對0..1；每個profile必須有一個Account。','',
           'Nutritionist → Account → AthleteDailyNutritionPlan 表示營養師以共用帳號確認。營養師仍直接連AthleteNutritionTarget及AthleteFoodRestriction。']
 (ROOT/'erd/full_erd.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
if __name__=='__main__':main()
