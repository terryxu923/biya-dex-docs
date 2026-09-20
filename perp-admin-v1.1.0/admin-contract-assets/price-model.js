(function () {
  'use strict';
  const D = window.Decimal, copy = v => JSON.parse(JSON.stringify(v));
  const SOURCE_CATEGORY = '交易所／预言机供应商';
  const DEBUG_KEYS = ['fixtureOutcome', 'catalogueScenario'];
  const SOURCE_FIELDS = ['id','name','code','platform','planId','planVersion','planName','group','groupVersion','proof','type','scope','category','channel','capabilities','enabled','revision','created','updated','interval'];
  const channels = {
    '公开行情通道 A': ['现货中间价', '永续中间价'],
    '公开行情通道 B': ['现货中间价'],
    '汇率行情通道': ['汇率'],
    '供应商喂价通道': ['供应商单价']
  };
  const providers = [
    {id:'Binance', name:'Binance'}, {id:'OKX', name:'OKX'}, {id:'Bybit', name:'Bybit'},
    {id:'Coinbase', name:'Coinbase'}, {id:'Kraken', name:'Kraken'}, {id:'Pyth', name:'Pyth'},
    {id:'公开汇率样例', name:'公开汇率样例'}
  ];
  const accessPlans = [
    {id:'ap-binance-public-a', version:1, name:'公开行情 A', provider:'Binance', scope:'现货 / 永续', channel:'公开行情通道 A', capabilities:['现货中间价','永续中间价'], group:'Binance', proof:'平台公开行情，独立撮合市场'},
    {id:'ap-binance-public-b', version:1, name:'公开行情 B', provider:'Binance', scope:'现货', channel:'公开行情通道 B', capabilities:['现货中间价'], group:'Binance', proof:'平台公开行情，独立撮合市场'},
    {id:'ap-okx-public-a', version:1, name:'公开行情 A', provider:'OKX', scope:'现货 / 永续', channel:'公开行情通道 A', capabilities:['现货中间价','永续中间价'], group:'OKX', proof:'平台公开行情，独立撮合市场'},
    {id:'ap-bybit-public-a', version:1, name:'公开行情 A', provider:'Bybit', scope:'现货 / 永续', channel:'公开行情通道 A', capabilities:['现货中间价','永续中间价'], group:'Bybit', proof:'平台公开行情，独立撮合市场'},
    {id:'ap-coinbase-public-a', version:1, name:'公开行情 A', provider:'Coinbase', scope:'现货', channel:'公开行情通道 A', capabilities:['现货中间价'], group:'Coinbase', proof:'平台公开行情，独立撮合市场'},
    {id:'ap-kraken-public-a', version:1, name:'公开行情 A', provider:'Kraken', scope:'现货', channel:'公开行情通道 A', capabilities:['现货中间价'], group:'Kraken', proof:'平台公开行情，独立撮合市场'},
    {id:'ap-pyth-feed', version:1, name:'供应商喂价', provider:'Pyth', scope:'供应商喂价', channel:'供应商喂价通道', capabilities:['供应商单价'], group:'Pyth', proof:'供应商独立喂价核定关系'},
    {id:'ap-fx-rate', version:1, name:'稳定币汇率', provider:'公开汇率样例', scope:'汇率', channel:'汇率行情通道', capabilities:['汇率'], group:'FX-MARKET', proof:'独立稳定币交易市场样例'}
  ].map(p => ({...p, category:SOURCE_CATEGORY, interval:'10', groupVersion:1, status:'已部署已核定'}));
  const planById = id => accessPlans.find(p => p.id === id && p.status === '已部署已核定');
  const plansFor = provider => accessPlans.filter(p => p.provider === provider && p.status === '已部署已核定');
  const defaultName = plan => plan.provider + ' · ' + plan.name;
  const positive = v => { try { return new D(v).isFinite() && new D(v).gt(0); } catch (_) { return false; } };
  function resolvePlan(s) {
    if (s?.planId && planById(s.planId)) return planById(s.planId);
    return accessPlans.find(p => p.provider === s?.platform && p.channel === s?.channel && (p.scope === s.type || p.scope === s.scope))
      || accessPlans.find(p => p.provider === s?.platform && p.channel === s?.channel)
      || accessPlans.find(p => p.provider === s?.platform);
  }
  function isDefaultName(name, platform) {
    return !name || name === (platform ? platform + ' 行情' : '') || accessPlans.some(p => defaultName(p) === name);
  }
  function stripDebug(s) {
    const out = copy(s);
    DEBUG_KEYS.forEach(k => delete out[k]);
    return out;
  }
  function applyPlan(s, plan, {resetCheck=true, rename=false}={}) {
    if (!plan || plan.status !== '已部署已核定') throw Error('只能选择已部署、已核定的接入方案');
    const changed = s.planId !== plan.id || Number(s.planVersion || 0) !== plan.version;
    const keepName = !rename && !isDefaultName(s.name, s.platform);
    s.planId = plan.id; s.planVersion = plan.version; s.planName = plan.name;
    s.platform = plan.provider; s.category = plan.category; s.scope = plan.scope; s.type = plan.scope;
    s.channel = plan.channel; s.capabilities = copy(plan.capabilities); s.interval = plan.interval;
    s.group = plan.group; s.groupVersion = plan.groupVersion; s.proof = plan.proof;
    if (!keepName) s.name = defaultName(plan);
    if (changed && resetCheck) { s.connection = '未检查'; s.healthy = false; s.check = null; }
    return s;
  }
  function median(rows) {
    if (!rows.length) return null;
    const sorted = rows.slice().sort((a,b) => new D(a.price).cmp(b.price));
    const total = sorted.reduce((n,r) => n.plus(r.weight), new D(0));
    if (!total.gt(0)) return null;
    let acc = new D(0);
    for (const r of sorted) { acc = acc.plus(r.weight); if (acc.gte(total.div(2))) return String(r.price); }
    return null;
  }
  function create(state, legacy = false) {
    const db = state.pricing || { format: 1, serial: 0, plans: {}, changes: [], quotes: [], snapshots: [], events: [], sourceHistory: [], sourceAudits: [], scenarios: {}, migration: legacy ? '旧来源映射待补全' : '' };
    db.sourceAudits ||= [];
    state.pricing = db;
    const id = prefix => prefix + '-' + (++db.serial).toString().padStart(6,'0');
    const stamp = () => new Date().toISOString();
    const source = key => state.sources.find(s => s.id === key);
    const market = key => state.markets.find(m => m.id === key);
    const catalogue=window.PriceCatalogue.create(db,id,stamp);
    const rule = (quote,target,base) => {
      const match=state.sources.filter(s=>s.enabled&&catalogue.usable(s)).flatMap(s=>catalogue.get(s).entries.filter(e=>e.status==='可关联'&&e.basis==='汇率'&&((e.base===quote&&e.quote===target)||(e.quote===quote&&e.base===target))).map(e=>({source:s.id,entry:e})))[0];
      const leg=match?{source:match.source,base:match.entry.base,quote:match.entry.quote,direction:match.entry.base===quote?'乘':'除'}:{source:'src-fx',base:quote,quote:target,direction:'乘'};
      return {id:id('FXR'),version:1,mode:quote===target?'恒等':'单位转换',from:quote,to:target,base,multiplier:'1',maxAge:'5',failure:'排除该来源',legs:quote===target?[]:[leg]};
    };
    function nextCode(platform) {
      const stem = String(platform || 'SOURCE').toUpperCase().replace(/[^A-Z0-9]+/g,'_');
      let n = 1, code;
      do { code = n === 1 ? stem + '_PUBLIC' : stem + '_PUBLIC_' + n; n++; }
      while (state.sources.some(x => x.code === code));
      return code;
    }
    function normalizeSource(s, imported = false) {
      s.events ||= []; s.groupVersion ||= 1; s.created ||= stamp(); s.updated ||= s.created;
      s.connection ||= imported ? '未检查' : (s.healthy ? '在线' : '离线');
      const plan = resolvePlan(s);
      if (plan) applyPlan(s, plan, {resetCheck:false, rename:false});
      else {
        s.category = SOURCE_CATEGORY;
        s.scope ||= s.type;
        if (!s.capabilities) s.capabilities = imported ? [] : copy(channels[s.channel] || []);
      }
      if (!imported && catalogue.providers[s.platform] && plan) s.capabilities = copy(plan.capabilities);
      if (!db.sourceHistory.some(h => h.id === s.id && h.revision === s.revision)) db.sourceHistory.push(sourceConfig(s));
    }
    function sourceConfig(s) {
      return copy(Object.fromEntries(SOURCE_FIELDS.map(k => [k, s[k] ?? null])));
    }
    state.sources.forEach(s => normalizeSource(s,legacy && !state.pricing.plans?.[s.id] && !s.capabilities));
    if (!source('src-fx')) {
      const s = {id:'src-fx',name:'稳定币汇率',code:'STABLE_FX',platform:'公开汇率样例',group:'FX-MARKET',type:'现货',channel:'汇率行情通道',interval:'10',enabled:true,healthy:true,proof:'独立稳定币交易市场样例',revision:1};
      state.sources.push(s); normalizeSource(s);
    }
    state.sources.forEach(s=>{if(s.connection==='在线' && s.capabilities.length && catalogue.get(s).status==='未同步')catalogue.sync(s);});
    window.ContractModel.sourceInstrumentOptions=(s,base,target,purpose)=>catalogue.candidates(s,base,target,purpose,{sameQuote:true});
    window.ContractModel.sourceInstrumentError=(s,b,base,target,purpose)=>catalogue.error(s,{...b,base:b.base || base,quote:b.quote || target,basis:b.basis || (purpose==='oracle'?'现货中间价':'永续中间价')});
    function available(s,base,target,purpose) {
      return catalogue.candidates(s,base,target,purpose,{convertible:(from,to)=>state.sources.some(fs=>fs.enabled&&catalogue.usable(fs)&&catalogue.get(fs).entries.some(e=>e.status==='可关联'&&e.basis==='汇率'&&((e.base===from&&e.quote===to)||(e.quote===from&&e.base===to))))});
    }
    function selectInstrument(binding,entry,target) {
      const s=source(binding.source),changed=binding.catalogueId!==entry.id || binding.rule?.to!==target;
      catalogue.select(s,binding,entry);
      if(changed || !binding.rule)binding.rule=rule(entry.quote,target,entry.base);
      return binding;
    }
    function fromMarket(m, purpose, isLegacy = false) {
      const g = purpose === 'oracle' ? 'CM23' : 'CM24';
      return {id:id('PLAN'),market:m.id,purpose,version:1,status:m.version ? '已生效' : '待发布',created:stamp(),effectiveAt:m.version ? stamp() : null,target:m.quote,
        maxAge:String(m.config[g]?.[purpose === 'oracle' ? '最大报价年龄' : '最大盘口报价年龄'] || 5),minSources:purpose === 'oracle' ? String(m.config.CM23?.['最少有效源数量'] || 3) : null,
        groupCap:String(m.config.RC10?.['单来源组最大权重占比'] || 60),admission:m.config.RC11?.['准入策略模板'] || '能力质量校验 V1',outlier:m.config.RC12?.['异常报价策略与版本'] || '独立参考观察 V1',threshold:String(m.config.RC12?.['报价异常偏离阈值'] || 3),recovery:String(m.config.RC12?.['恢复偏离阈值'] || 1),mode:'观察告警',
        bindings:(m[purpose] || []).map((b,i) => {
          const quote = b.catalogueId?b.quote:!isLegacy && m.base === 'BTC' && i !== 1 ? 'USDT' : m.quote;
          const binding={...copy(b),id:id('BIND'),version:1,source:b.source,sourceVersion:source(b.source)?.revision,base:m.base,quote,pair:b.catalogueId||isLegacy?b.pair:m.base+quote,basis:purpose === 'oracle' ? '现货中间价' : '永续中间价',weight:b.weight,enabled:b.enabled,needsMapping:isLegacy,rule:b.rule?copy(b.rule):rule(quote,m.quote,m.base)};
          const entry=catalogue.resolve(source(b.source),binding);if(entry && !isLegacy)catalogue.select(source(b.source),binding,entry);
          return binding;
        })};
    }
    function ensure(m) {
      m.protocolPriceAt ||= m.updated;
      if (!db.plans[m.id]) db.plans[m.id] = {};
      for (const purpose of ['oracle','external']) if (!db.plans[m.id][purpose]) {
        const p = fromMarket(m,purpose,legacy);
        db.plans[m.id][purpose] = {current:p,history:m.version ? [copy(p)] : [],draft:null};
      }
      return db.plans[m.id];
    }
    state.markets.filter(m=>!m.config.PYTH).forEach(ensure);
    function bucket(m,purpose) { return ensure(m)[purpose]; }
    function current(m,purpose='oracle') { return bucket(m,purpose).current; }
    function dependencies(plan) {
      return [...new Set(plan.bindings.filter(b => b.enabled).flatMap(b => [b.source,...(b.rule?.legs || []).map(l => l.source)]))];
    }
    function validate(plan, sources=state.sources) {
      const errors = [], seen = new Set(), m = market(plan.market), find = key => sources.find(s => s.id === key);
      if (!m || plan.target !== m.quote) errors.push('目标计价资产必须符合当前合约计价规格；不能由抵押币推导');
      if (!positive(plan.maxAge)) errors.push('最大报价年龄必须大于0');
      if (!positive(plan.groupCap) || new D(plan.groupCap || 0).gt(100)) errors.push('独立组权重上限须在0至100%之间');
      if (plan.purpose === 'oracle' && (!positive(plan.minSources) || !new D(plan.minSources).isInteger())) errors.push('最少独立源数必须为正整数');
      if (plan.mode !== '观察告警') errors.push('异常执行筛除尚未验证，仅允许观察告警');
      if (!positive(plan.threshold) || !positive(plan.recovery) || new D(plan.recovery || 0).gte(plan.threshold || 0)) errors.push('恢复阈值必须为正且小于异常阈值');
      const weights = {}, groups = new Set(); let total = new D(0);
      for (const b of plan.bindings) {
        const s = find(b.source), label = (s?.name || b.source) + '：';
        if (seen.has(b.source)) errors.push(label+'同方案来源不能重复'); seen.add(b.source);
        if (!b.enabled) continue;
        if (b.needsMapping) errors.push(label+'旧映射待补全');
        const directoryError=catalogue.error(s,b);if(directoryError)errors.push(label+directoryError);
        if (!s || !s.enabled) errors.push(label+'来源未启用');
        if (!s?.capabilities?.includes(b.basis)) errors.push(label+'来源能力不支持输入口径');
        if (plan.purpose === 'external' && b.basis !== '永续中间价') errors.push(label+'外部盘口须使用永续双边报价');
        if (plan.purpose === 'oracle' && !['现货中间价','供应商单价'].includes(b.basis)) errors.push(label+'预言机输入口径无效');
        if (b.base !== m?.base || !b.pair || !b.quote) errors.push(label+'来源标的、交易对或原始单位不完整');
        if (b.basis !== '供应商单价' && b.pair !== b.base+b.quote) errors.push(label+'样例适配器的交易对须匹配原始标的与计价资产');
        if (!positive(b.weight)) errors.push(label+'配置权重必须为正数');
        else { const w = new D(b.weight); total = total.plus(w); const key=s?.group || b.source; groups.add(key); weights[key]=(weights[key] || new D(0)).plus(w); }
        const r = b.rule;
        if (!r || r.from !== b.quote || r.to !== plan.target || r.base !== b.base || r.multiplier !== '1') { errors.push(label+'换算单位或已支持倍率不匹配'); continue; }
        if (!positive(r.maxAge)) errors.push(label+'汇率最大年龄必须大于0');
        if (r.mode === '恒等') { if (b.quote !== plan.target || r.legs.length) errors.push(label+'恒等处理不得改贴币种或配置汇率路径'); }
        else if (r.mode === '单位转换') {
          let unit = b.quote; const visited = new Set([unit]);
          if (!r.legs.length) errors.push(label+'单位转换必须配置汇率路径');
          for (const leg of r.legs) {
            const fs = find(leg.source), from = leg.direction === '乘' ? leg.base : leg.quote, to = leg.direction === '乘' ? leg.quote : leg.base;
            if (!fs?.enabled || !fs.capabilities?.includes('汇率')) errors.push(label+'汇率来源未启用或不具备能力');
            const fxError=catalogue.error(fs,{...leg,pair:leg.base+leg.quote,basis:'汇率'});if(fxError)errors.push(label+'汇率目录：'+fxError);
            if (!['乘','除'].includes(leg.direction) || from !== unit) errors.push(label+'汇率路径方向或单位不连续');
            if (visited.has(to)) errors.push(label+'汇率依赖形成循环'); visited.add(to); unit=to;
          }
          if (unit !== plan.target) errors.push(label+'汇率路径未到达目标计价单位');
        } else errors.push(label+'未知换算方式');
      }
      if (plan.purpose === 'oracle' && groups.size < Number(plan.minSources)) errors.push('配置独立来源不足');
      if (!total.gt(0)) errors.push('没有启用的正权重来源');
      if (positive(plan.groupCap) && total.gt(0) && Object.values(weights).some(w => w.div(total).mul(100).gt(plan.groupCap))) errors.push('配置独立组权重占比超限');
      return [...new Set(errors)];
    }
    function rate(base,quote) {
      const usd = {USDT:new D('0.99866'),USDC:new D('0.9995'),USD:new D(1)};
      return usd[base] && usd[quote] ? usd[base].div(usd[quote]) : null;
    }
    function quoteFor(s,b,plan,time,scenario,index,isFx=false) {
      const m=market(plan.market), fx=rate(b.base,b.quote);
      let px=isFx ? fx : new D(m.price).mul(new D(1).plus(new D(index).mul('.0002')));
      if (!isFx && b.quote !== plan.target) { const r=rate(b.quote,plan.target); px=r ? px.div(r) : null; }
      const age=(scenario==='报价过期' && !isFx && index===0) || (scenario==='汇率过期' && isFx) ? 20 : scenario==='未来时间' && index===0 && !isFx ? -3 : .2+index*.1;
      if (scenario==='偏离观察' && index===0 && !isFx && px) px=px.mul('1.08');
      const missing=scenario==='缺失报价' && index===0 && !isFx;
      const entry=catalogue.resolve(s,{...b,pair:b.pair || b.base+b.quote,basis:b.basis || '汇率'});
      const q={id:id('QUOTE'),source:s?.id,sourceVersion:s?.revision,catalogueVersion:s?catalogue.get(s).version:null,catalogueEntry:entry?copy(entry):null,pair:b.pair || b.base+b.quote,base:b.base,quote:b.quote,basis:b.basis || '汇率',price:missing || !px ? null : px.toString(),bid:null,ask:null,generatedAt:new Date(time-age*1000).toISOString(),receivedAt:new Date(time).toISOString(),quality:{sufficient:true,confidencePct:'0.1'},sourceConfig:s ? sourceConfig(s) : null,connection:s?.connection || '未检查',provenance:'演示行情适配器'};
      if (!isFx && b.basis !== '供应商单价' && q.price) { q.bid=px.mul('.99999').toString(); q.ask=px.mul(scenario==='盘口倒挂' && index===0 ? '.99998' : '1.00001').toString(); }
      return q;
    }
    function invalid(q,maxAge,time) {
      if (!q || !positive(q.price)) return '缺失或非正报价';
      if (!q.sourceConfig?.enabled) return '来源全局停用';
      if (q.connection !== '在线') return '来源连接不可用';
      const age=(time-Date.parse(q.generatedAt))/1000;
      if (!Number.isFinite(age) || age<0) return '报价时间异常';
      if (age>Number(maxAge)) return '报价已过期';
      if (!q.quality.sufficient || new D(q.quality.confidencePct).gt(2)) return '来源质量校验不通过';
      if (q.bid !== null && (!positive(q.bid) || !positive(q.ask) || new D(q.ask).lt(q.bid))) return '双边盘口无效';
      return '';
    }
    function evaluate(plan, options={}) {
      const time=options.time ?? Date.now(), scenario=options.scenario || '正常', sources=options.sources || state.sources, quotes=[];
      const inputs=plan.bindings.map((b,index) => {
        const s=sources.find(s=>s.id===b.source), q=quoteFor(s,b,plan,time,scenario,index); quotes.push(q);
        const input={id:id('INPUT'),binding:copy(b),sourceConfig:s ? sourceConfig(s) : null,raw:q,fx:[],at:new Date(time).toISOString(),age:(time-Date.parse(q.generatedAt))/1000,normalized:null,rate:'1',weight:b.weight,share:'0',group:s?.group || b.source,accepted:false,reason:'',reference:null,deviation:null,observation:'正常'};
        let error=!b.enabled ? '关联停用' : b.needsMapping ? '旧映射待补全' : !s?.capabilities?.includes(b.basis) ? '来源能力不匹配' : invalid(q,plan.maxAge,time);
        error ||= catalogue.error(s,b,false);
        let px=q.price ? new D(q.bid !== null && q.ask !== null ? new D(q.bid).plus(q.ask).div(2) : q.price) : null;
        if (!positive(b.weight)) error ||= '权重无效';
        if (!error) {
          if (!b.rule || b.rule.from!==b.quote || b.rule.to!==plan.target) error='换算单位不匹配';
          else if (b.rule.mode==='恒等' && b.quote!==plan.target) error='恒等处理不能改贴币种';
          else if (b.rule.mode==='单位转换') {
            let factor=new D(1), unit=b.quote; const visited=new Set([unit]);
            for (const leg of b.rule.legs) {
              const fs=sources.find(s=>s.id===leg.source), fq=quoteFor(fs,leg,plan,time,scenario,0,true); quotes.push(fq); input.fx.push(fq);
              const from=leg.direction==='乘'?leg.base:leg.quote,to=leg.direction==='乘'?leg.quote:leg.base;
              if (unit!==from || visited.has(to)) { error='汇率依赖循环或单位不连续'; break; }
              unit=to; visited.add(unit);
              const fail=invalid(fq,b.rule.maxAge,time) || catalogue.error(fs,{...leg,pair:leg.base+leg.quote,basis:'汇率'},false);
              if (fail || !fs?.capabilities?.includes('汇率')) { error='汇率不可用：'+(fail || '能力不匹配'); break; }
              factor=leg.direction==='乘'?factor.mul(fq.price):factor.div(fq.price);
            }
            if (!error && unit!==plan.target) error='汇率路径未到达目标单位';
            input.rate=factor.toString(); px=px.mul(factor);
          }
        }
        input.reason=error; input.accepted=!error; if (!error) input.normalized=px.toString();
        return input;
      });
      const valid=inputs.filter(i=>i.accepted), total=valid.reduce((n,i)=>n.plus(i.weight),new D(0)), groups=new Set(valid.map(i=>i.group));
      for (const i of valid) {
        i.share=new D(i.weight).div(total).mul(100).toString();
        const others=valid.filter(o=>o.group!==i.group); i.reference=median(others.map(o=>({price:o.normalized,weight:o.weight})));
        if (i.reference) { i.deviation=new D(i.normalized).minus(i.reference).div(i.reference).mul(100).toString(); if (new D(i.deviation).abs().gt(plan.threshold)) i.observation='偏离观察'; }
        else i.observation='独立参考不可用';
      }
      const groupWeights={}; valid.forEach(i=>groupWeights[i.group]=(groupWeights[i.group] || new D(0)).plus(i.weight));
      const concentrated=total.gt(0) && Object.values(groupWeights).some(w=>w.div(total).mul(100).gt(plan.groupCap));
      const enough=valid.length>0 && (plan.purpose!=='oracle' || groups.size>=Number(plan.minSources));
      const result={id:id('AGG'),plan:copy(plan),time:new Date(time).toISOString(),unit:plan.target+'/'+market(plan.market).base,inputs,enabled:plan.bindings.filter(b=>b.enabled).length,valid:valid.length,independent:groups.size,price:enough?median(valid.map(i=>({price:i.normalized,weight:i.weight}))):null,status:!enough?'不可用':valid.length<plan.bindings.filter(b=>b.enabled).length || concentrated ? '降级':'正常',reason:!enough?'有效独立来源不足或无有效来源':concentrated?'当前独立组权重占比超限':valid.some(i=>i.observation==='偏离观察')?'存在偏离观察，未执行筛除':'',provenance:'本地采集聚合，不代表协议采用'};
      if (options.save) {
        db.quotes.push(...quotes); db.snapshots.push(result);
        const conditions=inputs.filter(i=>i.reason || i.observation!=='正常').map(i=>({source:i.binding.source,reason:i.reason || i.observation}));
        const previous=db.events.filter(e=>e.plan===plan.id && !e.recoveredAt);
        previous.forEach(e=>{if(!conditions.some(c=>c.source===e.source && c.reason===e.reason))e.recoveredAt=result.time;});
        conditions.forEach(c=>{if(!previous.some(e=>e.source===c.source && e.reason===c.reason))db.events.push({id:id('EVT'),plan:plan.id,...c,at:result.time,snapshot:result.id,action:'观察告警',recoveredAt:null});});
      }
      return result;
    }
    function capture(m,purpose,scenario='正常') {
      if (scenario==='读取失败') throw Error('行情读取失败，保留最后成功快照');
      return evaluate(current(m,purpose),{scenario,save:true});
    }
    function impacts(sid, replacement) {
      const list=state.sources.map(s=>s.id===sid?{...s,...replacement}:s);
      return state.markets.flatMap(m=>Object.values(ensure(m)).filter(b=>b.current.status==='已生效' && dependencies(b.current).includes(sid)).map(b=>{
        const p=b.current, r=evaluate(p,{sources:list});
        return {market:m.id,code:m.code,plan:p.id,purpose:p.purpose,reference:p.bindings.some(x=>x.enabled && x.source===sid)?'直接取价':'汇率依赖',valid:r.valid,independent:r.independent,status:r.status,reason:r.reason,blocked:r.status==='不可用' || r.reason.includes('权重占比超限')};
      }));
    }
    function checkConnection(s) {
      const plan=resolvePlan(s);
      if (plan) applyPlan(s, plan, {resetCheck:false, rename:false});
      const ok=s.fixtureOutcome!=='failure' && !!plan && !!channels[s.channel] && !!catalogue.providers[s.platform];
      s.connection=ok?'在线':'离线'; s.healthy=ok;
      s.check={at:stamp(),planId:s.planId,planVersion:s.planVersion,channel:s.channel,platform:s.platform,result:ok?'成功':'失败',reason:ok?'':'样例通道连接超时'};
      if (ok) {s.capabilities=copy(plan.capabilities);catalogue.sync(s,s.catalogueScenario || '正常');}
      return copy(s.check);
    }
    function sourceImpactKind(live, draft) {
      if (live?.enabled && !draft.enabled) return '停用';
      if (live && (live.planId !== draft.planId || Number(live.planVersion || 0) !== Number(draft.planVersion || 0))) return '更换接入方案';
      return '';
    }
    function applySource(draft, actor, reason='') {
      if (actor!=='运营管理员') throw Error('仅运营管理员可以保存来源配置');
      const payload=stripDebug(draft); delete payload.reason;
      const live=source(payload.id), impact=sourceImpactKind(live, payload);
      if (impact && (!String(reason || '').trim() || String(reason).trim().length>200)) throw Error(impact==='停用'?'停用须填写200字以内操作原因':'更换接入方案须填写200字以内操作原因');
      if (live && Number(payload.revision)!==Number(live.revision)) throw Error('来源配置已变化，请重新打开后再保存');
      const errors=validateSource(payload);
      if (errors.length) throw Error(errors.join('；'));
      if (impacts(payload.id, payload).some(i=>i.blocked)) throw Error('依赖影响预检未通过，请先调整关联合约或汇率路径');
      const start=stamp(), previous=live?sourceConfig(live):null;
      if (!live) {
        payload.enabled=false; payload.revision=1; payload.phase='已生效'; payload.updated=start; payload.created||=start;
        delete payload.draft; state.sources.push(payload);
      } else {
        payload.revision=live.revision+1;
        payload.groupVersion=live.groupVersion+(live.group!==payload.group || live.proof!==payload.proof?1:0);
        payload.updated=start; payload.phase='已生效';
        Object.assign(live, payload); delete live.draft;
      }
      const applied=source(payload.id);
      db.sourceAudits.push({id:id('SAUD'),scope:'source',target:applied.id,action:previous?(impact || '保存'):'新增',actor,reason:String(reason || '').trim(),at:start,previous,current:sourceConfig(applied)});
      if (!db.sourceHistory.some(h=>h.id===applied.id && h.revision===applied.revision)) db.sourceHistory.push(sourceConfig(applied));
      return applied;
    }
    function submit(scope,target,draft,reason,actor,scheduled=null) {
      if (scope==='source') return applySource(draft, actor, reason);
      if (actor!=='运营管理员') throw Error('仅运营管理员可以提交配置');
      if (!reason?.trim() || reason.trim().length>200) throw Error('请填写200字以内操作原因');
      if (db.changes.some(c=>c.target===target && ['待审批','待生效','生效失败'].includes(c.status))) throw Error('该对象已有待处理变更');
      if (scheduled && (!Number.isFinite(Date.parse(scheduled)) || Date.parse(scheduled)<=Date.now())) throw Error('计划生效时间必须晚于当前时间');
      const previous=scope==='source'?sourceConfig(source(target)):copy(current(market(draft.market),draft.purpose));
      const payload=scope==='source'?stripDebug(draft):copy(draft);
      if(scope==='plan' && draft.version!==previous.version)throw Error('草稿基于旧方案版本，请重新比较当前版本');
      if(scope==='source' && draft.revision!==previous.revision)throw Error('来源草稿版本已过期，请重新比较');
      const errors=scope==='plan'?validate(draft):validateSource(draft);
      if (errors.length) throw Error(errors.join('；'));
      if (scope==='source' && impacts(target,draft).some(i=>i.blocked)) throw Error('依赖影响预检未通过，请先发布替代来源或汇率路径');
      const c={id:id('PCHG'),scope,target,previous,draft:payload,reason:reason.trim(),actor,reviewer:null,status:'待审批',created:stamp(),scheduled,attempts:[],baseVersion:scope==='source'?previous.revision:previous.version,dependencies:scope==='plan'?dependencies(draft).map(key=>({id:key,revision:source(key)?.revision,catalogueVersion:catalogue.get(source(key)).version})):[]};
      db.changes.push(c); return c;
    }
    function validateSource(s) {
      const errors=[];
      const plan=resolvePlan(s);
      if (plan) applyPlan(s, plan, {resetCheck:false, rename:false});
      if (!String(s.name || '').trim()) errors.push('来源名称不能为空');
      if (!s.platform || !providers.some(p=>p.id===s.platform)) errors.push('请选择已接入供应方');
      if (!plan) errors.push('请选择该供应方下已部署、已核定的接入方案');
      else if (plan.provider !== s.platform) errors.push('接入方案必须属于所选供应方');
      if (!s.code) s.code = nextCode(s.platform);
      if (state.sources.some(x=>x.id!==s.id && x.code===s.code)) errors.push('来源代码重复');
      const current=source(s.id);
      if(current?.revision>0 && current.code!==s.code)errors.push('已保存来源代码不可修改');
      if(current?.revision>0 && current.platform!==s.platform)errors.push('已保存来源不可更换供应方');
      const planChanged=current?.revision>0 && (current.planId!==s.planId || Number(current.planVersion||0)!==Number(s.planVersion||0));
      const disabling=current?.revision>0 && current.enabled && !s.enabled && s.planId===current.planId && s.platform===current.platform;
      if (planChanged && !disabling && (!s.check || s.check.planId!==s.planId || s.check.planVersion!==s.planVersion)) errors.push('切换接入方案后必须重新检查连接并同步目录');
      if (!disabling && (!s.check || s.check.result!=='成功' || s.check.planId!==s.planId || s.check.platform!==s.platform)) errors.push('保存前必须完成与当前接入方案一致的连接检查');
      if(!disabling && !catalogue.usable(s))errors.push('保存前须成功同步当前来源行情目录');
      return errors;
    }
    function review(change,actor,approve,comment) {
      if (actor!=='风控复核员' || actor===change.actor || change.status!=='待审批') throw Error('需要独立风控复核员处理待审批变更');
      if (!comment?.trim()) throw Error('请填写复核意见');
      change.reviewer=actor; change.reviewAt=stamp(); change.reviewReason=comment;
      change.status=approve?'待生效':'已驳回'; return change;
    }
    function apply(change,actor,outcome='success',at=Date.now()) {
      if (!['运营管理员','风控复核员'].includes(actor) || !change.reviewer || !['待生效','生效失败'].includes(change.status)) throw Error('变更尚未批准或已经处理');
      if (change.scheduled && Date.parse(change.scheduled)>at) throw Error('尚未到计划生效时间');
      const start=new Date(at).toISOString(), attempt={id:id('TRY'),start,status:'失败',reason:''};
      change.attempts.push(attempt);
      let errors=[];
      if (change.scope==='plan') {
        const m=market(change.draft.market), b=bucket(m,change.draft.purpose);
        if (b.current.version!==change.baseVersion) errors.push('有效方案版本已变化，请重新提交');
        if (change.dependencies.some(d=>source(d.id)?.revision!==d.revision)) errors.push('来源依赖版本已变化，请重新提交复核');
        if(change.dependencies.some(d=>d.catalogueVersion!==undefined && catalogue.get(source(d.id)).version!==d.catalogueVersion))errors.push('行情目录版本已变化，请重新提交复核');
        errors.push(...validate(change.draft));
        const preview=evaluate(change.draft);
        if (preview.status==='不可用') errors.push('行情输入不可用');
      } else {
        const s=source(change.target);
        if (!s || s.revision!==change.baseVersion) errors.push('来源版本已变化');
        errors.push(...validateSource(change.draft));
        if (impacts(change.target,change.draft).some(i=>i.blocked)) errors.push('依赖影响预检未通过');
      }
      if (outcome==='failure') errors.push('价格服务确认失败');
      if (errors.length) { attempt.reason=errors.join('；'); attempt.end=stamp(); change.status='生效失败'; change.failure=attempt.reason; return false; }
      if (change.scope==='plan') {
        const m=market(change.draft.market), b=bucket(m,change.draft.purpose), p=copy(change.draft);
        p.version=b.current.version+1; p.status='已生效'; p.effectiveAt=start;
        p.bindings.forEach(binding=>{binding.version=p.version;binding.sourceVersion=source(binding.source).revision;binding.rule.version=p.version;const entry=catalogue.resolve(source(binding.source),binding);if(binding.enabled && entry)catalogue.select(source(binding.source),binding,entry);});
        b.current=p; b.history.push(copy(p)); b.draft=null;
        const key=p.purpose,g=key==='oracle'?'CM23':'CM24';
        m[key]=p.bindings.map(r=>({source:r.source,pair:m.base+m.quote,weight:r.weight,enabled:r.enabled}));
        m.config[g][key==='oracle'?'最大报价年龄':'最大盘口报价年龄']=p.maxAge;
        if (key==='oracle') m.config.CM23['最少有效源数量']=p.minSources;
        m.version++; m.revision++; m.updated=start;
        m.history.push({version:m.version,time:start,...window.ContractModel.snapshot(m)});
      } else {
        const s=source(change.target), draft=stripDebug(change.draft);
        draft.revision=s.revision+1; draft.groupVersion=s.groupVersion+(s.group!==draft.group || s.proof!==draft.proof?1:0); draft.updated=start;
        DEBUG_KEYS.forEach(k => delete draft[k]);
        Object.assign(s,draft); s.phase='已发布'; db.sourceHistory.push(sourceConfig(s)); delete s.draft;
      }
      attempt.status='成功'; attempt.end=stamp(); change.status='已生效'; change.applied=start; change.failure=''; return true;
    }
    function syncMarket(m) {
      const plans=ensure(m);
      for (const purpose of ['oracle','external']) {
        const b=plans[purpose];
        if (b.current.status!=='已生效' && m.version) {
          b.current.status='已生效'; b.current.effectiveAt=stamp(); b.history.push(copy(b.current));
        }
      }
    }
    function syncUnpublished(m) {
      if(m.version)return;
      db.plans[m.id]=Object.fromEntries(['oracle','external'].map(purpose=>[purpose,{current:fromMarket(m,purpose),history:[],draft:null}]));
    }
    return {db,id,stamp,copy,channels,providers,accessPlans,SOURCE_CATEGORY,DEBUG_KEYS,planById,plansFor,resolvePlan,applyPlan,defaultName,nextCode,stripDebug,sourceImpactKind,applySource,source,market,current,bucket,ensure,rule,sourceConfig,normalizeSource,validate,validateSource,median,evaluate,capture,dependencies,impacts,checkConnection,submit,review,apply,syncMarket,syncUnpublished,fromMarket,catalogue,available,selectInstrument};
  }
  window.PriceModel={create,median,positive,channels,providers,accessPlans,SOURCE_CATEGORY,DEBUG_KEYS};
})();
