/* v7.66 完整版 — formulas + shipping + monthly + campaigns + tiers */
(function(){
  const $ = (id)=>document.getElementById(id);
  const n = (v)=>{
    const t = (v??'').toString().replace(/[, \u00A0]/g,'');
    if(t==='') return 0;
    const x = Number(t);
    return isFinite(x) ? x : 0;
  };
  const fmt = (x)=> (x==null || !isFinite(x)) ? '—' : x.toLocaleString(undefined,{maximumFractionDigits:2});
  const pct = (x)=> (x==null || !isFinite(x)) ? '—' : (x*100).toFixed(2)+'%';
  const clamp = (x,min,max)=> Math.min(max,Math.max(min,x));

  // ----------------- Levels (tiers) -----------------
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

  // initial one row
  addLevelRow();

  // ----------------- Campaigns -----------------
  const campTbody = document.querySelector('#tbl_campaigns tbody');
  function addCampaignRow(data={name:'活動1', month:1, uplift:10, scope:'all', cost:20000}){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${data.name}"></td>
      <td><input type="number" step="1" min="1" max="12" value="${data.month}"></td>
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
  $('add_campaign').onclick = ()=> addCampaignRow({name:'活動'+(campTbody.children.length+1), month:1, uplift:0, scope:'all', cost:0});

  // ----------------- Monthly -----------------
  const monthsTbody = document.querySelector('#tbl_months tbody');
  const months = Array.from({length:12}, (_,i)=>i+1);
  function buildMonthRows(){
    monthsTbody.innerHTML = '';
    months.forEach(m=>{
      const tr = document.createElement('tr');
      tr.dataset.m = m;
      tr.innerHTML = `
        <td>${m}</td>
        <td><input class="coef" type="number" step="0.01" value="${(100/12).toFixed(3)}"></td>
        <td class="tgt">-</td>
        <td><input class="act" type="number" step="1" value="${m===1?10000000:0}"></td>
        <td class="eff">-</td>
        <td class="gp">-</td>
      `;
      monthsTbody.appendChild(tr);
    });
  }
  buildMonthRows();

  $('coef_even').onclick = ()=>{
    monthsTbody.querySelectorAll('input.coef').forEach(i=> i.value=(100/12).toFixed(3));
  };
  $('coef_q4').onclick = ()=>{
    // 10,10,10,10,10,10,10,10,15,15,20,20  -> sum=150 -> normalize to 100
    const raw = [10,10,10,10,10,10,10,10,15,15,20,20];
    const s = raw.reduce((a,b)=>a+b,0);
    const norm = raw.map(x=> x/s*100);
    monthsTbody.querySelectorAll('tr').forEach((tr,idx)=>{
      tr.querySelector('input.coef').value = norm[idx].toFixed(3);
    });
  };

  // ----------------- Core helpers -----------------
  function normalizedShares(){
    const a = Math.max(0, n($('pcash').value)/100);
    const b = Math.max(0, n($('pcard').value)/100);
    const s = a+b;
    if (s<=0) return {pCash:1, pCard:0};
    return {pCash:a/s, pCard:b/s};
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

  function sumCampaignCost(){
    let c = 0;
    campTbody.querySelectorAll('tr').forEach(tr=>{
      c += n(tr.children[4].querySelector('input').value);
    });
    return c;
  }

  function monthUplifts(){
    // Returns object {m: {all: r, cash: r, card: r}} where r is multiplier - 1
    const map = {};
    months.forEach(m=> map[m] = {all:0, cash:0, card:0});
    campTbody.querySelectorAll('tr').forEach(tr=>{
      const m = clamp(n(tr.children[1].querySelector('input').value),1,12);
      const r = n(tr.children[2].querySelector('input').value)/100; // uplift%
      const scope = tr.children[3].querySelector('select').value;
      if (!map[m]) map[m] = {all:0, cash:0, card:0};
      map[m][scope] += r;
    });
    return map;
  }

  function calc(){
    const GM  = n($('gm').value)/100;
    const fee = n($('cardfee').value)/100;
    const {pCash, pCard} = normalizedShares();
    const SalesTarget = n($('sales_target').value);
    const GPTarget    = n($('gp_target').value);
    const OtherMkt    = n($('other_mkt').value);
    const shipCount   = n($('ship_count').value);
    const shipUnit    = n($('ship_unit').value);
    const Shipping    = shipCount * shipUnit;

    // Monthly targets from coefficients (normalize to 100%)
    const coefs = Array.from(monthsTbody.querySelectorAll('input.coef')).map(i=> n(i.value));
    const coefSum = coefs.reduce((a,b)=>a+b,0);
    const coefsN = coefSum>0 ? coefs.map(x=> x/coefSum) : coefs.map(()=> 1/12);

    // Monthly actuals (pre-uplift)
    const acts = Array.from(monthsTbody.querySelectorAll('input.act')).map(i=> n(i.value));

    // Apply uplifts by month and scope; also compute card-fee-adjusted base
    const upl = monthUplifts();

    let tgtSum=0, actSum=0, effSum=0, gpSum=0, cardBaseSale=0, campCost=0;
    months.forEach((m, idx)=>{
      const tgt = SalesTarget * coefsN[idx];
      const base = acts[idx];
      const u = upl[m] || {all:0,cash:0,card:0};
      // total uplift multiplier
      const mult = 1 + u.all + u.cash + u.card;
      const eff  = base * mult;

      // For card fee base, only uplift parts that affect 'card' or 'all' should count
      const eff_card_component = base*(1+u.all+u.card); // cash-only uplift不增加刷卡費基礎
      cardBaseSale += eff_card_component * pCard; // only card share

      tgtSum += tgt;
      actSum += base;
      effSum += eff;
      gpSum  += eff * GM;

      // update table cells
      const tr = monthsTbody.querySelectorAll('tr')[idx];
      tr.querySelector('.tgt').textContent = fmt(tgt);
      tr.querySelector('.eff').textContent = fmt(eff);
      tr.querySelector('.gp').textContent  = fmt(eff * GM);
    });

    // totals
    document.getElementById('coef_sum').textContent = (coefSum||0).toFixed(3)+'%';
    document.getElementById('tgt_sum').textContent  = fmt(tgtSum);
    document.getElementById('act_sum').textContent  = fmt(actSum);
    document.getElementById('eff_sum').textContent  = fmt(effSum);
    document.getElementById('gp_sum').textContent   = fmt(gpSum);

    // purchase rebate + other rebates
    const rebatePurchase = purchaseRebate(pCash, pCard);
    const rebateOthers   = otherRebates();
    const rebateTotal    = rebatePurchase + rebateOthers;

    // campaign cost
    campCost = sumCampaignCost();

    // Card fee: use effSum but subtract any cash-only uplift from the base for card fee
    // We already computed cardBaseSale as eff_card_component * pCard aggregated; fee applies on that base.
    const CardFee = cardBaseSale * fee;

    // Summary
    const GP = gpSum;
    const Net = GP - rebateTotal - CardFee - campCost - OtherMkt - Shipping;

    // Attainments
    const SalesAttain   = (SalesTarget>0) ? (effSum / SalesTarget) : null;
    const NetVsGPTarget = (GPTarget>0) ? (Net / GPTarget) : null;

    // Render
    $('norm_share').textContent = `${pct(pCash)} / ${pct(pCard)}`;
    $('out_sales').textContent  = fmt(effSum);
    $('out_gp').textContent     = fmt(GP);
    $('out_rebate').textContent = fmt(rebateTotal);
    $('out_cardfee').textContent= fmt(CardFee);
    $('out_campaign').textContent= fmt(campCost);
    $('out_othermkt').textContent= fmt(OtherMkt);
    $('out_shipping').textContent= fmt(Shipping);
    $('out_net').textContent    = fmt(Net);
    $('out_sales_attain').textContent = SalesAttain==null?'—':pct(SalesAttain);
    $('out_net_vs_gptarget').textContent = NetVsGPTarget==null?'—':pct(NetVsGPTarget);

    // Identity check
    const rhs = Net + rebateTotal + CardFee + campCost + OtherMkt + Shipping;
    const diff = GP - rhs;
    if (Math.abs(diff) > 1) {
      console.warn('[恒等式不平衡] 應有 GP = Net + 回饋 + 刷卡費 + 活動 + 其他行銷 + 運費；差額 diff =', diff);
    } else {
      console.log('[OK] 恒等式平衡');
    }
  }

  $('btn_calc').onclick = calc;
  $('btn_reset').onclick = ()=>{
    document.querySelectorAll('input').forEach(i=> i.value='');
    buildMonthRows();
    campTbody.innerHTML=''; addCampaignRow();
    levelsTbody.innerHTML=''; addLevelRow();
    ['coef_sum','tgt_sum','act_sum','eff_sum','gp_sum','norm_share','out_sales','out_gp','out_rebate','out_cardfee','out_campaign','out_othermkt','out_shipping','out_net','out_sales_attain','out_net_vs_gptarget']
      .forEach(id=> $(id).textContent='-');
  };

  // 初次計算
  calc();
})();
