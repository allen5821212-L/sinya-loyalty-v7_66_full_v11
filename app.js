/* =========================================================
   sinya-loyalty app.js (fixed, standalone)
   - 永久使用「複利相乘」uplift
   - 刷卡費基礎：僅乘 all + card（不乘 cash）
   - 回饋（購買）= Σ(人數×ASP×(pCash×現金% + pCard×刷卡%))
   - 其他回饋：沿用 otherRebates()（若無則 0），且總會員數取自等級
   - 會員總數（members_total_auto）自動連動
   - 支援運費 = 件數×每件金額（ship_count / ship_unit）
   - 強韌按鈕接線：新增活動 / 新增等級 / 立即計算 / 重置
   ========================================================= */

(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const num = (t) => {
    const m=(t??'').toString().replace(/[\s,\u00A0]/g,'').match(/-?\d+(\.\d+)?/);
    return m ? +m[0] : 0;
  };
  const out = (sel, v) => { const el=$(sel); if(el) el.textContent = Math.round(v).toLocaleString(); };

  function reindexRows(tbody){
    (tbody? $$('tr', tbody):[]).forEach((tr,i)=>{
      const c = tr.querySelector('.idx'); if (c) c.textContent = (i+1);
    });
  }

  function computeTotalMembersFromLevels(){
    const tb = $('#tbl_levels tbody'); let total = 0;
    if (!tb) return 0;
    $$('tr', tb).forEach(tr=>{
      total += num(tr.children[1]?.querySelector('input')?.value);
    });
    return total;
  }

  function refreshTotalMembersBox(){
    const total = computeTotalMembersFromLevels();
    const box = $('#members_total_auto');
    if (box) box.value = total;
    const legacy = $('#members_total');
    if (legacy) legacy.value = total;
  }

  function addLevelRow(data){
    const tb = $('#tbl_levels tbody'); if(!tb){ alert('找不到 #tbl_levels tbody'); return; }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="idx"></td>
      <td><input type="number" step="1" placeholder="人數"></td>
      <td><input type="number" step="1" placeholder="ASP"></td>
      <td><input type="number" step="0.01" placeholder="現金回饋%"></td>
      <td><input type="number" step="0.01" placeholder="刷卡回饋%"></td>
      <td><button class="del">刪</button></td>`;
    tb.appendChild(tr);

    if (data){
      const set=(i,v)=>{ const el=tr.children[i]?.querySelector('input'); if(el!=null && v!=null){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } };
      set(1, data.members);
      set(2, data.asp);
      set(3, data.cbCash);
      set(4, data.cbCard);
    }

    tr.querySelector('.del')?.addEventListener('click', ()=>{
      tr.remove(); reindexRows(tb); refreshTotalMembersBox();
      try{ calc(); }catch(e){}
    });

    const membersInput = tr.children[1]?.querySelector('input');
    if (membersInput){
      const sync=()=>{
        refreshTotalMembersBox();
        try{ calc(); }catch(e){}
      };
      membersInput.addEventListener('input', sync, true);
      membersInput.addEventListener('change', sync, true);
    }

    reindexRows(tb);
    refreshTotalMembersBox();
    try{ calc(); }catch(e){}
  }

  function addCampaignRow(data){
    const tb = $('#tbl_campaigns tbody'); if(!tb){ alert('找不到 #tbl_campaigns tbody'); return; }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="idx"></td>
      <td><input type="number" step="0.01" placeholder="0"></td>
      <td>
        <select>
          <option value="all">全部</option>
          <option value="cash">現金</option>
          <option value="card">刷卡</option>
        </select>
      </td>
      <td><input type="number" step="1" placeholder="0"></td>
      <td><button class="del">刪</button></td>`;
    tb.appendChild(tr);

    if (data){
      const u=tr.children[1]?.querySelector('input');
      const s=tr.children[2]?.querySelector('select');
      const c=tr.children[3]?.querySelector('input');
      if (u && data.uplift!=null) u.value=data.uplift;
      if (s && data.scope)       s.value=data.scope;
      if (c && data.cost!=null)  c.value=data.cost;
    }

    tr.querySelector('.del')?.addEventListener('click', ()=>{
      tr.remove(); reindexRows(tb);
      try{ calc(); }catch(e){}
    });

    reindexRows(tb);
    try{ calc(); }catch(e){}
  }

  function sumCampaignsMultiplicative(){
    let cost=0, mAll=1, mCash=1, mCard=1;
    const tb=$('#tbl_campaigns tbody');
    (tb? $$('tr', tb):[]).forEach(tr=>{
      const u   = num(tr.children[1]?.querySelector('input')?.value)/100;
      const sc  = tr.children[2]?.querySelector('select')?.value || 'all';
      const cst = num(tr.children[3]?.querySelector('input')?.value);
      if (isFinite(cst)) cost += cst;
      const r = isFinite(u)?u:0;
      if (sc==='all')  mAll  *= (1+r);
      if (sc==='cash') mCash *= (1+r);
      if (sc==='card') mCard *= (1+r);
    });
    return { cost: cost, uAll: mAll-1, uCash: mCash-1, uCard: mCard-1 };
  }

  function otherRebatesSafe(){
    try{
      if (typeof window.otherRebates === 'function') return window.otherRebates();
    }catch(e){}
    return 0;
  }

  function salesAndPurchaseRebatesFromLevels(){
    const tb = $('#tbl_levels tbody');
    let SalesBase=0, RebPurchase=0;

    const pc = num($('#pcash')?.value)/100;
    const pd = num($('#pcard')?.value)/100;
    const denom = (pc+pd)||1, pCash=pc/denom, pCard=pd/denom;

    (tb? $$('tr', tb):[]).forEach(tr=>{
      const members = num(tr.children[1]?.querySelector('input')?.value);
      const asp     = num(tr.children[2]?.querySelector('input')?.value);
      const cbCash  = num(tr.children[3]?.querySelector('input')?.value)/100;
      const cbCard  = num(tr.children[4]?.querySelector('input')?.value)/100;
      SalesBase   += members * asp;
      RebPurchase += members * asp * (pCash*cbCash + pCard*cbCard);
    });
    return { SalesBase, RebPurchase };
  }

  function calc(){
    const chk = document.getElementById('use_multiplicative');
    if (chk){ try{ chk.checked=true; (chk.closest('.chk')||chk).style.display='none'; }catch(e){} }

    const GM   = num($('#gm')?.value)/100;
    const pc   = num($('#pcash')?.value)/100;
    const pd   = num($('#pcard')?.value)/100;
    const fee  = num($('#cardfee')?.value)/100;
    const other= num($('#other_mkt')?.value)||0;
    const shipCount = $('#ship_count') ? num($('#ship_count').value) : 0;
    const shipUnit  = $('#ship_unit')  ? num($('#ship_unit').value)  : 0;
    const ship = shipCount * shipUnit;

    const denom=(pc+pd)||1, pCash=pc/denom, pCard=pd/denom;

    const {SalesBase, RebPurchase} = salesAndPurchaseRebatesFromLevels();

    const {cost:CampCost, uAll, uCash, uCard} = sumCampaignsMultiplicative();
    const multTotal = (1+uAll)*(1+uCash)*(1+uCard);
    const multCard  = (1+uAll)*(1+uCard);

    const SalesYear = SalesBase * multTotal;
    const GPYear    = SalesYear * GM;
    const RebOthers = otherRebatesSafe();
    const Rebates   = RebPurchase + RebOthers;
    const CardFee   = (SalesBase * multCard) * pCard * fee;
    const Net       = GPYear - Rebates - CardFee - CampCost - other - ship;

    out('#out_sales',    SalesYear);
    out('#out_gp',       GPYear);
    out('#out_rebates',  Rebates);
    out('#out_cardfee',  CardFee);
    out('#out_campcost', CampCost);
    out('#out_other',    other);
    out('#out_ship',     ship);
    out('#out_net',      Net);

    refreshTotalMembersBox();
  }

  function wireButtons(){
    const byText = (t)=>[...document.querySelectorAll('button, a')].find(el=>((el.textContent||'').includes(t)));
    const addCampBtn  = $('#btn_add_campaign') || byText('新增活動') || $('.btn-add-campaign');
    const addLevelBtn = $('#btn_add_level')    || byText('新增等級') || $('.btn-add-level');
    const calcBtn     = $('#btn_calc')         || byText('立即計算') || $('.btn-calc');
    const resetBtn    = $('#btn_reset')        || byText('重置')     || $('.btn-reset');

    if (addCampBtn)  addCampBtn.addEventListener('click', ()=> addCampaignRow());
    if (addLevelBtn) addLevelBtn.addEventListener('click', ()=> addLevelRow());
    if (calcBtn)     calcBtn.addEventListener('click', ()=> calc());
    if (resetBtn)    resetBtn.addEventListener('click', ()=>{
      ['#out_sales','#out_gp','#out_rebates','#out_cardfee','#out_campcost','#out_other','#out_ship','#out_net']
        .forEach(sel=>{ const el=$(sel); if(el) el.textContent='-'; });
    });
  }

  function ensureMembersTotalBox(){
    if (!$('#members_total_auto')) {
      const wrap = document.createElement('div');
      wrap.className = 'grid';
      wrap.style.marginTop = '8px';
      wrap.innerHTML = `<label>會員人數（總，連動等級）
        <input id="members_total_auto" type="number" disabled placeholder="自動計算">
      </label>`;
      const table = $('#tbl_levels');
      const anchor = table?.closest('.table-wrap') || table?.parentElement || document.body;
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    try { ensureMembersTotalBox(); } catch(e){}
    try { wireButtons(); } catch(e){}
    try { refreshTotalMembersBox(); } catch(e){}
    try { calc(); } catch(e){}
  });

  window.addLevelRow  = window.addLevelRow  || addLevelRow;
  window.addCampaignRow = window.addCampaignRow || addCampaignRow;
  window.calc = calc;
  window.computeTotalMembersFromLevels = window.computeTotalMembersFromLevels || computeTotalMembersFromLevels;
})();