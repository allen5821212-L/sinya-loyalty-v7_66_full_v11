# Sinya Loyalty v7.66.2（無逐月KPI）

**變更**
- 移除「五、逐月 KPI（係數→目標、實際→達成）」整段。
- 活動 uplift 改為年度層級設定（多筆、可擇影響支付：全部/現金/刷卡）。
- 刷卡費基礎僅計入「all + card」uplift，現金 uplift 不進入刷卡費基礎。
- 新增「uplift 使用複利相乘」選項（預設為加總）。
- 保留：等級購買回饋、生日/UGC/推薦、運費（件數×每件）、其他固定行銷費、營收/GP目標。

**公式**
- 年 Sales（uplift 後）= 年度實際 Sales × (1 + Σall + Σcash + Σcard)（或複利式相乘）。
- 年 GP = 年 Sales × GM。
- 回饋合計 = 購買回饋（等級×ASP×加權回饋率）＋ 生日 ＋ UGC×12 ＋ 推薦。
- 刷卡費 = 年度「刷卡相關 Sales」× 費率；刷卡相關 Sales = 年度實際 Sales × (1 + Σall + Σcard) × 刷卡占比。
- Net = GP − 回饋 − 刷卡費 − 活動成本 − 其他固定行銷費 − 運費。

**使用**
- 上傳到 GitHub Repo 根目錄，開啟 GitHub Pages，直接打開 `index.html`。
