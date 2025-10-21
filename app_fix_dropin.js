/* =========================================================
   app.js — Permanent Fix (drop-in)
   - 修復：＋新增等級 / ＋新增活動 按鈕無法新增列
   - uplift 改為「複利相乘」，刷卡費基礎只乘 all+card（不乘 cash）
   - 購買回饋：從等級表自動帶入（依現金/刷卡占比加權）
   - 運費、其他固定行銷費、活動成本計入 Net
   - 自動連動：會員總數（#members_total_auto）
   - 兼容舊頁面：以 ID 為主，fallback 用按鈕文字；自動補 <tbody>
   ========================================================= */

(function () {
  /* ---------- 工具 ---------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const num = (t) => {
    const m=(t??'').toString().replace(/[\s,\u00A0]/g,'').match(/-?\d+(\.\d+)?/);
    return m ? +m[0] : 0;
  };
  const setTextInt = (sel, v) => { const el=$(sel); if (el) el.textContent = Math.round(v).toLocaleString(); };

  /* ---------- 確保 table 有 <tbody> ---------- */
  function ensureTbody(sel){
    const table=$(sel);
    if(!table) return null;
    let tb=table.querySelector('tbody');
    if(!tb){ tb=document.createElement('tbody'); table.appendChild(tb); }
    return tb;
  }

  /* ---------- 重新編號 ---------- */
  function reindexRows(tbody){
    (tbody? $$('tr', tbody):[]).forEach((tr,i)=>{
      const c=tr.querySelector('.idx'); if (c) c.textContent = i+1;
    });
  }

  /* ---------- 會員總數自動帶出 ---------- */
  function computeTotalMembersFromLevels(){
    const tb = ensureTbody('#tbl_levels');
    let total=0;
    if (!tb) return 0;
    $$('tr', tb).forEach(tr=>{
      total += num(tr.children?.[1]?.querySelector('input')?.value);
    });
    return total;
  }
  function refreshTotalMembersBox(){
    const box = $('#members_total_auto');
    if (box) box.value = computeTotalMembersFromLevels();
    const legacy = $('#members_total');
    if (legacy) legacy.value = box ? num(box.value) : computeTotalMembersFromLevels();
  }

  /* ---------- 新增等級列 ---------- */
  function addLevelRow(data){
    const tb = ensureTbody('#tbl_levels');
    if(!tb){ alert('找不到 #tbl_levels'); return; }
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td class="idx"></td>
      <td><input type="number" placeholder="人數"></td>
      <td><input type="number" placeholder="ASP"></td>
      <td><input type="number" placeholder="現金回饋%"></td>
      <td><input type="number" placeholder="刷卡回饋%"></td>
      <td><button class="del">刪</button></td>`;
    tb.appendChild(tr);

    if (data){
      const set=(i,v)=>{ const el=tr.children?.[i]?.querySelector('input'); if(el!=null && v!=null){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }};
      set(1, data.members); set(2, data.asp); set(3, data.cbCash); set(4, data.cbCard);
    }

    tr.querySelector('.del')?.addEventListener('click', ()=>{
      tr.remove(); reindexRows(tb); refreshTotalMembersBox(); try{ calc(); }catch(e){}
    });

    const membersInput = tr.children?.[1]?.querySelector('input');
    if (membersInput){
      const sync=()=>{ refreshTotalMembersBox(); try{ calc(); }catch(e){} };
      membersInput.addEventListener('input', sync, true);
      membersInput.addEventListener('change', sync, true);
    }

    reindexRows(tb); refreshTotalMembersBox(); try{ calc(); }catch(e){}
  }

  /* ---------- 新增活動列 ---------- */
  function addCampaignRow(data){
    const tb = ensureTbody('#tbl_campaigns');
    if(!tb){ alert('找不到 #tbl_campaigns'); return; }
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td class="idx"></td>
      <td><input type="number" placeholder="uplift%"></td>
      <td>
        <select>
          <option value="all">全部</option>
          <option value="cash">現金</option>
          <option value="card">刷卡</option>
        </select>
      </td>
      <td><input type="number" placeholder="活動成本"></td>
      <td><button class="del">刪</button></td>`;
    tb.appendChild(tr);

    if (data){
      tr.children?.[1]?.querySelector('input')?.setAttribute('value', data.uplift ?? '');
      const sel = tr.children?.[2]?.querySelector('select'); if (sel && data.scope) sel.value=data.scope;
      tr.children?.[3]?.querySelector('input')?.setAttribute('value', data.cost ?? '');
    }

    tr.querySelector('.del')?.addEventListener('click', ()=>{
      tr.remove(); reindexRows(tb); try{ calc(); }catch(e){}
    });

    reindexRows(tb); try{ calc(); }catch(e){}
  }

  /* ---------- uplift：永久使用複利 ---------- */
  function sumCampaignsMultiplicative(){
    let cost=0, mAll=1, mCash=1, mCard=1;
    const tb = ensureTbody('#tbl_campaigns');
    (tb? $$('tr', tb):[]).forEach(tr=>{
      const u   = num(tr.children?.[1]?.querySelector('input')?.value)/100;
      const sc  = tr.children?.[2]?.querySelector('select')?.value || 'all';
      const cst = num(tr.children?.[3]?.querySelector('input')?.value);
      if (isFinite(cst)) cost += cst;
      const r = isFinite(u)?u:0;
      if (sc==='all')  mAll  *= (1+r);
      if (sc==='cash') mCash *= (1+r);
      if (sc==='card') mCard *= (1+r);
    });
    return { cost, uAll:mAll-1, uCash:mCash-1, uCard:mCard-1 };
  }

  /* ---------- 其他回饋（可擴充）；預設為 0 或沿用 window.otherRebates ---------- */
  function otherRebatesSafe(){
    try{ if (typeof window.otherRebates === 'function') return +window.otherRebates() || 0; }catch(e){}
    return 0;
  }

  /* ---------- 從等級表計 SalesBase & 購買回饋 ---------- */
  function salesAndPurchaseRebatesFromLevels(){
    const tb = ensureTbody('#tbl_levels');
    let SalesBase=0, RebPurchase=0;

    const pc = num($('#pcash')?.value)/100;
    const pd = num($('#pcard')?.value)/100;
    const denom = (pc+pd)||1, pCash=pc/denom, pCard=pd/denom;

    (tb? $$('tr', tb):[]).forEach(tr=>{
      const members = num(tr.children?.[1]?.querySelector('input')?.value);
      const asp     = num(tr.children?.[2]?.querySelector('input')?.value);
      const cbCash  = num(tr.children?.[3]?.querySelector('input')?.value)/100;
      const cbCard  = num(tr.children?.[4]?.querySelector('input')?.value)/100;
      SalesBase   += members * asp;
      RebPurchase += members * asp * (pCash*cbCash + pCard*cbCard);
    });
    return { SalesBase, RebPurchase };
  }

  /* ---------- 主計算（覆蓋輸出） ---------- */
  function calc(){
    // 若頁面上有「複利」勾選，固定打勾並隱藏
    const chk = $('#use_multiplicative');
    if (chk){ try{ chk.checked=true; (chk.closest('.chk')||chk).style.display='none'; }catch(e){} }

    const GM   = num($('#gm')?.value)/100;
    const pc   = num($('#pcash')?.value)/100;
    const pd   = num($('#pcard')?.value)/100;
    const fee  = num($('#cardfee')?.value)/100;
    const other= num($('#other_mkt')?.value)||0;
    const ship = (num($('#ship_count')?.value)||0) * (num($('#ship_unit')?.value)||0);

    const denom=(pc+pd)||1, pCash=pc/denom, pCard=pd/denom;

    const {SalesBase, RebPurchase} = salesAndPurchaseRebatesFromLevels();
    const {cost:CampCost, uAll, uCash, uCard} = sumCampaignsMultiplicative();

    const multTotal = (1+uAll)*(1+uCash)*(1+uCard); // 年 Sales 乘數（複利）
    const multCard  = (1+uAll)*(1+uCard);           // 刷卡費乘數（不乘現金）

    const SalesYear = SalesBase * multTotal;
    const GPYear    = SalesYear * GM;
    const RebOthers = otherRebatesSafe();
    const Rebates   = RebPurchase + RebOthers;
    const CardFee   = (SalesBase * multCard) * pCard * fee;
    const Net       = GPYear - Rebates - CardFee - CampCost - other - ship;

    setTextInt('#out_sales',    SalesYear);
    setTextInt('#out_gp',       GPYear);
    setTextInt('#out_rebates',  Rebates);
    setTextInt('#out_cardfee',  CardFee);
    setTextInt('#out_campcost', CampCost);
    setTextInt('#out_other',    other);
    setTextInt('#out_ship',     ship);
    setTextInt('#out_net',      Net);

    refreshTotalMembersBox();
  }

  /* ---------- 事件接線（ID > 文字 fallback） ---------- */
  function wireButtons(){
    const byText = (t)=>$$('button, a').find(el=>((el.textContent||'').includes(t)));
    const addCampBtn  = $('#btn_add_campaign') || byText('新增活動');
    const addLevelBtn = $('#btn_add_level')    || byText('新增等級');
    const calcBtn     = $('#btn_calc')         || byText('立即計算');
    const resetBtn    = $('#btn_reset')        || byText('重置');

    if (addCampBtn && !addCampBtn.__wired)  { addCampBtn.addEventListener('click', ()=> addCampaignRow()); addCampBtn.__wired=true; }
    if (addLevelBtn && !addLevelBtn.__wired){ addLevelBtn.addEventListener('click', ()=> addLevelRow());    addLevelBtn.__wired=true; }
    if (calcBtn && !calcBtn.__wired)        { calcBtn.addEventListener('click', ()=> calc());              calcBtn.__wired=true; }
    if (resetBtn && !resetBtn.__wired)      {
      resetBtn.addEventListener('click', ()=>{
        ['#out_sales','#out_gp','#out_rebates','#out_cardfee','#out_campcost','#out_other','#out_ship','#out_net']
          .forEach(sel=>{ const el=$(sel); if(el) el.textContent='-'; });
      });
      resetBtn.__wired=true;
    }
  }

  /* ---------- 初始化 ---------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    try{ ensureTbody('#tbl_levels'); ensureTbody('#tbl_campaigns'); }catch(e){}
    try{ wireButtons(); }catch(e){}
    try{ refreshTotalMembersBox(); }catch(e){}
    try{ calc(); }catch(e){}
  });

  /* ---------- 對外暴露 ---------- */
  window.addLevelRow   = window.addLevelRow   || addLevelRow;
  window.addCampaignRow= window.addCampaignRow|| addCampaignRow;
  window.calc = window.calc || calc;
  window.computeTotalMembersFromLevels = window.computeTotalMembersFromLevels || computeTotalMembersFromLevels;
})();