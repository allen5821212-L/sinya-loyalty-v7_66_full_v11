/* Sinya Loyalty v7.66 — 修復增強版 app.js */
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const num = (t) => { const m=(t??'').toString().replace(/[\s,\u00A0]/g,'').match(/-?\d+(\.\d+)?/); return m?+m[0]:0; };
  const KEY='sinya_loyalty_state_v3';

  const getDecimals = ()=> Math.max(0, Math.min(4, num($('#decimals')?.value)||0));
  const getCurrency = ()=> ($('#curr_sym')?.value ?? '').toString();
  const fmtMoney = (v)=>{
    if (!isFinite(v)) return '-';
    const d=getDecimals(), sym=getCurrency();
    return sym + (Number(v).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  };
  const outMoney = (sel,v)=>{ const el=$(sel); if (el) el.textContent = fmtMoney(Math.round(v)); };

  function reindexRows(tbody){ (tbody? $$('tr',tbody):[]).forEach((tr,i)=>{ const c=tr.querySelector('.idx'); if(c) c.textContent=i+1; }); }
  function ensureTbody(sel){ const table=$(sel); if(!table) return null; let tb=table.querySelector('tbody'); if(!tb){ tb=document.createElement('tbody'); table.appendChild(tb);} return tb; }
  function computeTotalMembersFromLevels(){ const tb=$('#tbl_levels tbody'); let total=0; (tb? $$('tr',tb):[]).forEach(tr=> total+= num(tr.children[1]?.querySelector('input')?.value)); return total; }
  function refreshTotalMembersBox(){ const box=$('#members_total_auto'); if(box) box.value=computeTotalMembersFromLevels(); }

  function addLevelRow(data){
    const tb=ensureTbody('#tbl_levels'); if(!tb){ alert('找不到 #tbl_levels'); return; }
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="idx"></td>
      <td><input type="number" placeholder="人數"></td>
      <td><input type="number" placeholder="ASP"></td>
      <td><input type="number" step="0.01" placeholder="現金回饋%"></td>
      <td><input type="number" step="0.01" placeholder="刷卡回饋%"></td>
      <td><button class="del">刪</button></td>`;
    tb.appendChild(tr);
    if(data){
      const set=(i,v)=>{ const el=tr.children[i]?.querySelector('input'); if(el!=null && v!=null){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }};
      set(1,data.members); set(2,data.asp); set(3,data.cbCash); set(4,data.cbCard);
    }
    tr.querySelector('.del')?.addEventListener('click', ()=>{ tr.remove(); reindexRows(tb); refreshTotalMembersBox(); try{ calc(); }catch(e){} });
    const membersInput=tr.children[1]?.querySelector('input');
    if(membersInput){ const sync=()=>{ refreshTotalMembersBox(); try{ calc(); }catch(e){} }; membersInput.addEventListener('input',sync,true); membersInput.addEventListener('change',sync,true); }
    reindexRows(tb); refreshTotalMembersBox(); try{ calc(); }catch(e){}
  }

  function addCampaignRow(data){
    const tb=ensureTbody('#tbl_campaigns'); if(!tb){ alert('找不到 #tbl_campaigns'); return; }
    const tr=document.createElement('tr');
    tr.innerHTML=`
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
    if(data){
      const u=tr.children[1]?.querySelector('input'); const s=tr.children[2]?.querySelector('select'); const c=tr.children[3]?.querySelector('input');
      if(u && data.uplift!=null) u.value=data.uplift; if(s && data.scope) s.value=data.scope; if(c && data.cost!=null) c.value=data.cost;
    }
    tr.querySelector('.del')?.addEventListener('click', ()=>{ tr.remove(); reindexRows(tb); try{ calc(); }catch(e){} });
    reindexRows(tb); try{ calc(); }catch(e){}
  }

  function sumCampaignsMultiplicative(){
    let cost=0, mAll=1, mCash=1, mCard=1;
    const tb=$('#tbl_campaigns tbody');
    (tb? $$('tr',tb):[]).forEach(tr=>{
      const u=num(tr.children[1]?.querySelector('input')?.value)/100;
      const sc=tr.children[2]?.querySelector('select')?.value||'all';
      const cst=num(tr.children[3]?.querySelector('input')?.value);
      if(isFinite(cst)) cost+=cst;
      const r=isFinite(u)?u:0;
      if(sc==='all') mAll*=(1+r);
      if(sc==='cash') mCash*=(1+r);
      if(sc==='card') mCard*=(1+r);
    });
    return { cost, uAll:mAll-1, uCash:mCash-1, uCard:mCard-1 };
  }

  function salesAndPurchaseRebatesFromLevels(){
    const tb=$('#tbl_levels tbody'); let SalesBase=0, RebPurchase=0;
    const pc=num($('#pcash')?.value)/100, pd=num($('#pcard')?.value)/100;
    const denom=(pc+pd)||1, pCash=pc/denom, pCard=pd/denom;
    (tb? $$('tr',tb):[]).forEach(tr=>{
      const members=num(tr.children[1]?.querySelector('input')?.value);
      const asp=num(tr.children[2]?.querySelector('input')?.value);
      const cbCash=num(tr.children[3]?.querySelector('input')?.value)/100;
      const cbCard=num(tr.children[4]?.querySelector('input')?.value)/100;
      SalesBase+=members*asp;
      RebPurchase+=members*asp*(pCash*cbCash+pCard*cbCard);
    });
    return { SalesBase, RebPurchase };
  }

  function computeReferralOrders(){
    const auto=$('#ref_auto')?.checked;
    const totalMembers=computeTotalMembersFromLevels();
    if(!auto) return num($('#ref_orders')?.value);
    const ar=num($('#ref_active_rate')?.value)/100;
    const inv=num($('#ref_invites_per_active')?.value);
    const acc=num($('#ref_accept_rate')?.value)/100;
    const pcv=num($('#ref_purchase_conv')?.value)/100;
    const opi=num($('#ref_orders_per_invitee')?.value);
    const est=totalMembers*ar*inv*acc*pcv*opi;
    const el=$('#ref_orders'); if(el) el.value=Math.round(est);
    return est;
  }
  function computeReferralCost(){
    const r1=num($('#ref_referrer')?.value), r2=num($('#ref_invitee')?.value);
    const orders=computeReferralOrders(); return (r1+r2)*orders;
  }
  function otherRebatesSafe(){ let v=computeReferralCost(); try{ if(typeof window.otherRebates==='function') v+=window.otherRebates(); }catch(e){} return v; }

  function calc(){
    const chk=$('#use_multiplicative'); if(chk){ try{ chk.checked=true; (chk.closest('.chk')||chk).style.display='none'; }catch(e){} }
    const GM=num($('#gm')?.value)/100;
    const pc=num($('#pcash')?.value)/100, pd=num($('#pcard')?.value)/100, fee=num($('#cardfee')?.value)/100;
    const other=num($('#other_mkt')?.value)||0;
    const ship=(num($('#ship_count')?.value)||0)*(num($('#ship_unit')?.value)||0);
    const denom=(pc+pd)||1, pCash=pc/denom, pCard=pd/denom;

    const {SalesBase, RebPurchase}=salesAndPurchaseRebatesFromLevels();
    const {cost:CampCost, uAll, uCash, uCard}=sumCampaignsMultiplicative();
    const multTotal=(1+uAll)*(1+uCash)*(1+uCard);
    const multCard=(1+uAll)*(1+uCard);

    const SalesYear=SalesBase*multTotal;
    const GPYear=SalesYear*GM;
    const RebOthers=otherRebatesSafe();
    const Rebates=RebPurchase+RebOthers;
    const CardFee=(SalesBase*multCard)*pCard*fee;
    const Net=GPYear - Rebates - CardFee - CampCost - other - ship;

    outMoney('#out_sales',SalesYear);
    outMoney('#out_gp',GPYear);
    outMoney('#out_rebates',Rebates);
    outMoney('#out_cardfee',CardFee);
    outMoney('#out_campcost',CampCost);
    outMoney('#out_other',other);
    outMoney('#out_ship',ship);
    outMoney('#out_net',Net);

    refreshTotalMembersBox();
  }

  function collectState(){
    const q=(id)=>$('#'+id)?.value;
    return {
      settings:{curr_sym:q('curr_sym'), decimals:num(q('decimals'))},
      params:{gm:num(q('gm')), pcash:num(q('pcash')), pcard:num(q('pcard')), cardfee:num(q('cardfee')), other_mkt:num(q('other_mkt'))},
      shipping:{count:num(q('ship_count')), unit:num(q('ship_unit'))},
      referral:{
        ref_referrer:num(q('ref_referrer')), ref_invitee:num(q('ref_invitee')), ref_orders:num(q('ref_orders')), ref_auto:$('#ref_auto')?.checked||false,
        ref_active_rate:num(q('ref_active_rate')), ref_invites_per_active:num(q('ref_invites_per_active')), ref_accept_rate:num(q('ref_accept_rate')),
        ref_purchase_conv:num(q('ref_purchase_conv')), ref_orders_per_invitee:num(q('ref_orders_per_invitee'))
      },
      levels:Array.from($('#tbl_levels tbody')?.querySelectorAll('tr')||[]).map(tr=>({
        members:num(tr.children[1]?.querySelector('input')?.value), asp:num(tr.children[2]?.querySelector('input')?.value),
        cbCash:num(tr.children[3]?.querySelector('input')?.value), cbCard:num(tr.children[4]?.querySelector('input')?.value)
      })),
      campaigns:Array.from($('#tbl_campaigns tbody')?.querySelectorAll('tr')||[]).map(tr=>({
        uplift:num(tr.children[1]?.querySelector('input')?.value), scope:tr.children[2]?.querySelector('select')?.value||'all', cost:num(tr.children[3]?.querySelector('input')?.value)
      }))
    };
  }
  function applyState(state){
    const set=(id,v)=>{ const el=$('#'+id); if(el!=null && v!=null){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }};
    if(state.settings){ set('curr_sym',state.settings.curr_sym); set('decimals',state.settings.decimals); }
    if(state.params){ set('gm',state.params.gm); set('pcash',state.params.pcash); set('pcard',state.params.pcard); set('cardfee',state.params.cardfee); set('other_mkt',state.params.other_mkt); }
    if(state.shipping){ set('ship_count',state.shipping.count); set('ship_unit',state.shipping.unit); }
    if(state.referral){
      set('ref_referrer',state.referral.ref_referrer); set('ref_invitee',state.referral.ref_invitee);
      $('#ref_auto').checked=!!state.referral.ref_auto;
      set('ref_orders',state.referral.ref_orders);
      set('ref_active_rate',state.referral.ref_active_rate); set('ref_invites_per_active',state.referral.ref_invites_per_active);
      set('ref_accept_rate',state.referral.ref_accept_rate); set('ref_purchase_conv',state.referral.ref_purchase_conv);
      set('ref_orders_per_invitee',state.referral.ref_orders_per_invitee);
    }
    const lvTB=$('#tbl_levels tbody'); if(lvTB) lvTB.innerHTML=''; (state.levels||[]).forEach(row=> addLevelRow(row));
    const cpTB=$('#tbl_campaigns tbody'); if(cpTB) cpTB.innerHTML=''; (state.campaigns||[]).forEach(row=> addCampaignRow(row));
    calc();
  }
  function saveLocal(){ try{ localStorage.setItem(KEY, JSON.stringify(collectState())); alert('已儲存'); }catch(e){ alert('儲存失敗：'+e.message); } }
  function loadLocal(){ try{ const raw=localStorage.getItem(KEY); if(!raw) return alert('尚未有儲存資料'); applyState(JSON.parse(raw)); alert('已載入'); }catch(e){ alert('載入失敗：'+e.message); } }
  function downloadJSON(){ const data=JSON.stringify(collectState(),null,2); const blob=new Blob([data],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='sinya_loyalty_state.json'; document.body.appendChild(a); a.click(); a.remove(); }
  function uploadJSON(file){ const reader=new FileReader(); reader.onload=()=>{ try{ const obj=JSON.parse(reader.result); applyState(obj); alert('設定已匯入'); }catch(e){ alert('JSON 解析失敗：'+e.message);} }; reader.readAsText(file); }

  function sanityCheck(){
    const v=(sel)=>num($(sel)?.textContent);
    const GP=v('#out_gp'), Reb=v('#out_rebates'), Fee=v('#out_cardfee'), Camp=v('#out_campcost'), Oth=v('#out_other'), Ship=v('#out_ship'), Net=v('#out_net');
    const left=GP, right=Net+Reb+Fee+Camp+Oth+Ship;
    const ok=Math.abs(left-right)<=1;
    alert(ok ? '🟢 恒等式成立：GP ≈ Net + 回饋 + 刷卡費 + 活動 + 其他 + 運費' : `🟠 不相等\nGP=${GP} vs. 右側合計=${right}（差異=${left-right}）`);
  }

  function fillSample(){
    $('#curr_sym').value='NT$'; $('#decimals').value=0;
    $('#gm').value=20; $('#pcash').value=50; $('#pcard').value=50; $('#cardfee').value=1.8; $('#other_mkt').value=300000;
    $('#ship_count').value=10; $('#ship_unit').value=60;
    const lvTB=$('#tbl_levels tbody'); lvTB.innerHTML=''; addLevelRow({members:100,asp:10000,cbCash:1,cbCard:0.5});
    const cpTB=$('#tbl_campaigns tbody'); cpTB.innerHTML=''; addCampaignRow({uplift:10,scope:'all',cost:0}); addCampaignRow({uplift:2,scope:'card',cost:0});
    $('#ref_referrer').value=50; $('#ref_invitee').value=30; $('#ref_auto').checked=true;
    $('#ref_active_rate').value=30; $('#ref_invites_per_active').value=0.2; $('#ref_accept_rate').value=25; $('#ref_purchase_conv').value=40; $('#ref_orders_per_invitee').value=1.3;
    calc();
  }

  function wire(){
    $('#btn_add_level')?.addEventListener('click', ()=> addLevelRow());
    $('#btn_add_campaign')?.addEventListener('click', ()=> addCampaignRow());
    $('#btn_calc')?.addEventListener('click', ()=> calc());
    $('#btn_reset')?.addEventListener('click', ()=>{
      ['#out_sales','#out_gp','#out_rebates','#out_cardfee','#out_campcost','#out_other','#out_ship','#out_net'].forEach(sel=>{ const el=$(sel); if(el) el.textContent='-'; });
    });
    $('#btn_save')?.addEventListener('click', saveLocal);
    $('#btn_load')?.addEventListener('click', loadLocal);
    $('#btn_download')?.addEventListener('click', downloadJSON);
    $('#file_upload')?.addEventListener('change',(e)=>{ const f=e.target.files?.[0]; if(f) uploadJSON(f); e.target.value=''; });
    $('#btn_sample')?.addEventListener('click', fillSample);
    $('#btn_check')?.addEventListener('click', sanityCheck);
    const toggleAuto=()=>{ const auto=$('#ref_auto')?.checked; const ro=$('#ref_orders'); if(ro){ ro.disabled=!!auto; ro.placeholder= auto?'自動估算中':'手動輸入'; } calc(); };
    $('#ref_auto')?.addEventListener('change', toggleAuto); toggleAuto();
  }

  document.addEventListener('DOMContentLoaded', ()=>{ try{ wire(); }catch(e){} try{ calc(); }catch(e){} });
  window.addLevelRow = window.addLevelRow || addLevelRow;
  window.addCampaignRow = window.addCampaignRow || addCampaignRow;
  window.calc = calc;
})();