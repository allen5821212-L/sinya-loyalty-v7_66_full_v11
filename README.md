# Sinya Loyalty v7.66.3（年實際 Sales 來自 等級 × ASP）

**重點變更**
- 取消「年度實際 Sales（基準）」手動輸入。
- 由「四、會員等級與購買回饋」推導：
  - 年度實際 Sales（基準）= Σ 等級人數 × 該等級年均消費 ASP
- 活動 uplift 採年度層級（加總；可切換複利相乘），並作用於上述基準 Sales。
- 刷卡費基礎僅計入 uplift 的 all + card，不含 cash uplift。
- 其他維持：購買回饋、生日、UGC×12、推薦、運費、其他固定行銷費、營收/GP目標、恒等式自檢。

**核心公式**
- SalesBase = Σ_i (members_i × ASP_i)
- SalesYear = SalesBase × (1 + Σall + Σcash + Σcard) 〔或複利模式〕
- GPYear = SalesYear × GM
- RebatePurchase = Σ_i (members_i × ASP_i × (pCash×cbCash_i + pCard×cbCard_i))
- RebateTotal = RebatePurchase + 生日 + UGC×12 + 推薦
- CardFee = SalesBase × (1 + Σall + Σcard) × pCard × 費率
- Net = GPYear − RebateTotal − CardFee − 活動成本 − 其他固定行銷費 − 運費

**使用**
- 上傳到 GitHub Repo（Pages 指到根目錄），開啟 `index.html` 使用。
