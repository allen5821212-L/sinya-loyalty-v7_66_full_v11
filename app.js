/* v7.66.3 — Annual Sales derived from tiers */
(function(){
  const $ = (id)=>document.getElementById(id);
  const n = (v)=>{ const t=(v??'').toString().replace(/[, \u00A0]/g,''); if(t==='') return 0; const x=Number(t); return isFinite(x)?x:0; };
  const fmt = (x)=> (x==null||!isFinite(x)) ? '—' : x.toLocaleString(undefined,{maximumFractionDigits:2});
  const pct = (x)=> (x==null||!isFinite(x)) ? '—' : (x*100).toFixed(2)+'%';

  // Levels
  const levelsTbody = document.querySelector('#tbl_levels tbody');
  function addLevelRow(data={level:'L1', members:1000, asp:10000, cbCash:1.0, cbCard:0.5}){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${data.level}"></td>
      <td><input type="number" step="1" value="${data.members}"></td>
      <td><input type="number" step="1" value="${data.asp}"></td>
      <td><input type="number" step="0.01" value="${data.cbCash}"></td>
      <td><input type="number" step="0.01" value="${data.cbCard}"></td>
      <td><button class="ghost del">刪除</button></td>
    `;
    tr.querySelector('.del').onclick = ()=> tr.remove();
    levelsTbody.appendChild(tr);
  }
  $('add_level').onclick = ()=> addLevelRow({level:'L'+(levelsTbody.children.length+1), members:0, asp:0, cbCash:0, cbCard:0});
  addLevelRow(); // initial row

  // Campaigns (annual-level)
  const campTbody = document.querySelector('#tbl_campaigns tbody');
  function addCampaignRow(data={name:'活動1', uplift:10, scope:'all', cost:20000}){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${data.name}"></td>
      <td><input type="number" step="0.01" value="${data.uplift}"></td>
      <td>
        <select>
          <option value="all"${data.scope==='all'?' selected':''}>全部</option>
          <option value="cash"${data.scope==='cash'?' selected':''}>現金</option>
          <option value="card"${data.scope==='card'?' selected':''}>刷卡</option>
        </select>
      </td>
      <td><input type="number" step="1" value="${data.cost}"></td>
      <td><button class="ghost del">刪除</button></td>
    `;
    tr.querySelector('.del').onclick = ()=> tr.remove();
    campTbody.appendChild(tr);
  }
  $('add_campaign').onclick = ()=> addCampaignRow({name:'活動'+(campTbody.children.length+1), uplift:0, scope:'all', cost:0});
  addCampaignRow(); // default

  function normalizedShares(){
    const a = Math.max(0, n($('pcash').value)/100);
    const b = Math.max(0, n($('pcard').value)/100);
    const s = a + b;
    if (s <= 0) return {pCash:1, pCard:0};
    return {pCash: a/s, pCard: b/s};
  }

  function deriveSalesBaseFromTiers(){
    let base = 0;
    levelsTbody.querySelectorAll('tr').forEach(tr=>{
      const members = n(tr.children[1].querySelector('input').value);
      const asp     = n(tr.children[2].querySelector('input').value);
      base += members * asp;
    });
    return base;
  }

  function purchaseRebate(pCash, pCard){
    let sum = 0;
    levelsTbody.querySelectorAll('tr').forEach(tr=>{
      const members = n(tr.children[1].querySelector('input').value);
      const asp     = n(tr.children[2].querySelector('input').value);
      const cbCash  = n(tr.children[3].querySelector('input').value)/100;
      const cbCard  = n(tr.children[4].querySelector('input').value)/100;
      const rate    = pCash*cbCash + pCard*cbCard;
      sum += members * asp * rate;
    });
    return sum;
  }

  function otherRebates(){
    const bdayAmt = n($('bday_amt').value);
    const bdayP   = n($('bday_part').value)/100;
    const mems    = n($('members_total').value);
    const ugcM    = n($('ugc_month').value);
    const refR    = n($('ref_referrer').value);
    const refI    = n($('ref_invitee').value);
    const refN    = n($('ref_orders').value);
    const birthday = bdayAmt * bdayP * mems;
    const ugcY     = ugcM * 12;
    const referral = (refR + refI) * refN;
    return (birthday||0)+(ugcY||0)+(referral||0);
  }

  function sumCampaigns(){
    let cost = 0, uAll=0, uCash=0, uCard=0;
    const multiplicative = document.getElementById('use_multiplicative').checked;
    const ups = [];
    campTbody.querySelectorAll('tr').forEach(tr=>{
      const r   = n(tr.children[1].querySelector('input').value) / 100;
      const sc  = tr.children[2].querySelector('select').value;
      const cs  = n(tr.children[3].querySelector('input').value);
      cost += cs;
      ups.push({r, sc});
    });
    if (multiplicative){
      let mAll=1, mCash=1, mCard=1;
      ups.forEach(x=>{
        if(x.sc==='all') mAll *= (1+x.r);
        if(x.sc==='cash') mCash *= (1+x.r);
        if(x.sc==='card') mCard *= (1+x.r);
      });
      uAll  = mAll - 1;
      uCash = mCash - 1;
      uCard = mCard - 1;
    }else{
      ups.forEach(x=>{
        if(x.sc==='all') uAll += x.r;
        if(x.sc==='cash') uCash += x.r;
        if(x.sc==='card') uCard += x.r;
      });
    }
    return {cost, uAll, uCash, uCard};
  }

  function calc(){
    const GM   = n($('gm').value)/100;
    const fee  = n($('cardfee').value)/100;
    const {pCash, pCard} = normalizedShares();
    const SalesBase = deriveSalesBaseFromTiers(); // ★ 由等級推導
    const SalesTgt  = n($('sales_target').value);
    const GPTgt     = n($('gp_target').value);
    const OtherMkt  = n($('other_mkt').value);
    const shipCount = n($('ship_count').value);
    const shipUnit  = n($('ship_unit').value);
    const Shipping  = shipCount * shipUnit;

    const {cost:CampCost, uAll, uCash, uCard} = sumCampaigns();
    const multTotal = 1 + uAll + uCash + uCard;
    const multCard  = 1 + uAll + uCard; // cash-only 不進入刷卡費基礎

    const SalesYear = SalesBase * multTotal;
    const GPYear    = SalesYear * GM;

    const RebatePurchase = purchaseRebate(pCash, pCard);
    const RebateOthers   = otherRebates();
    const RebateTotal    = RebatePurchase + RebateOthers;

    const CardFee = (SalesBase * multCard) * pCard * fee;

    const Net = GPYear - RebateTotal - CardFee - CampCost - OtherMkt - Shipping;

    const SalesAttain   = (SalesTgt>0) ? (SalesYear/SalesTgt) : null;
    const NetVsGPTarget = (GPTgt>0) ? (Net/GPTgt) : null;

    document.getElementById('norm_share').textContent = `${pct(pCash)} / ${pct(pCard)}`;
    document.getElementById('out_sales').textContent  = fmt(SalesYear);
    document.getElementById('out_gp').textContent     = fmt(GPYear);
    document.getElementById('out_rebate').textContent = fmt(RebateTotal);
    document.getElementById('out_cardfee').textContent= fmt(CardFee);
    document.getElementById('out_campaign').textContent= fmt(CampCost);
    document.getElementById('out_othermkt').textContent= fmt(OtherMkt);
    document.getElementById('out_shipping').textContent= fmt(Shipping);
    document.getElementById('out_net').textContent    = fmt(Net);
    document.getElementById('out_sales_attain').textContent = SalesAttain==null?'—':pct(SalesAttain);
    document.getElementById('out_net_vs_gptarget').textContent = NetVsGPTarget==null?'—':pct(NetVsGPTarget);

    // identity check
    const rhs = Net + RebateTotal + CardFee + CampCost + OtherMkt + Shipping;
    const diff = GPYear - rhs;
    if (Math.abs(diff) > 1){
      console.warn('[恒等式不平衡] 應有 GP = Net + 回饋 + 刷卡費 + 活動 + 其他行銷 + 運費；diff=', diff);
    } else {
      console.log('[OK] 恒等式平衡');
    }
  }

  document.getElementById('btn_calc').onclick = calc;
  document.getElementById('btn_reset').onclick = ()=>{
    document.querySelectorAll('input').forEach(i=> i.value='');
    document.querySelector('#tbl_campaigns tbody').innerHTML=''; addCampaignRow();
    document.querySelector('#tbl_levels tbody').innerHTML=''; addLevelRow();
    ['norm_share','out_sales','out_gp','out_rebate','out_cardfee','out_campaign','out_othermkt','out_shipping','out_net','out_sales_attain','out_net_vs_gptarget']
      .forEach(id=> document.getElementById(id).textContent='-');
  };

  // 初次計算
  calc();
})();

// === Button wiring (robust) ===
(function wireButtons(){
  const byText = (t)=>[...document.querySelectorAll('button, a')].find(el=>((el.textContent||'').includes(t)));
  const addCampBtn  = document.getElementById('btn_add_campaign') || byText('新增活動') || document.querySelector('.btn-add-campaign');
  const addLevelBtn = document.getElementById('btn_add_level')    || byText('新增等級') || document.querySelector('.btn-add-level');
  const calcBtn     = document.getElementById('btn_calc')         || byText('立即計算') || document.querySelector('.btn-calc');
  const resetBtn    = document.getElementById('btn_reset')        || byText('重置')     || document.querySelector('.btn-reset');

  if (addCampBtn)  addCampBtn.addEventListener('click', ()=> (typeof addCampaignRow==='function' ? addCampaignRow() : alert('addCampaignRow() 不存在')));
  if (addLevelBtn) addLevelBtn.addEventListener('click', ()=> (typeof addLevelRow==='function' ? addLevelRow() : alert('addLevelRow() 不存在')));
  if (calcBtn)     calcBtn.addEventListener('click', ()=> (typeof calc==='function' ? calc() : alert('calc() 不存在')));
  if (resetBtn)    resetBtn.addEventListener('click', ()=> (typeof reset==='function' ? reset() : location.reload()));
})();