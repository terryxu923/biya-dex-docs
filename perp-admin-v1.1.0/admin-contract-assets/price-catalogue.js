(function () {
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const assets=window.ContractModel.choices['标的资产'].filter(Boolean);
  // Provider-specific fixture adapters. These catalogues are independent of the contracts being created.
  const providers={Binance:{quotes:['USDC','USDT'],perp:true},OKX:{quotes:['USDC','USDT'],perp:true},Bybit:{quotes:['USDC','USDT'],perp:true},Coinbase:{quotes:['USD','USDC'],perp:false},Kraken:{quotes:['USD','USDC'],perp:false},Pyth:{quotes:['USD'],feed:true},'公开汇率样例':{fx:true}};
  const fingerprint=s=>JSON.stringify(['v2', s.id, s.planId || '', String(s.planVersion || 1)]);
  const CATEGORY_ALIASES=['交易场所','预言机供应商','交易所／预言机供应商'];
  const TYPE_ALIASES=['现货','永续','现货 / 永续','供应商喂价','汇率'];
  function legacyFingerprints(s) {
    const keys=[];
    const types=[s.type, s.scope, ...TYPE_ALIASES];
    const cats=[s.category, ...CATEGORY_ALIASES];
    for (const type of [...new Set(types.filter(Boolean))])
      for (const cat of [...new Set(cats.filter(Boolean))])
        keys.push(JSON.stringify([s.id, s.platform, s.channel, type, cat]));
    return [...new Set(keys)];
  }
  function create(db,id,stamp) {
    db.catalogues ||= {};
    function get(s) {
      const key=fingerprint(s);
      if (db.catalogues[key]) return db.catalogues[key];
      for (const old of legacyFingerprints(s)) {
        const found=db.catalogues[old];
        if (found) {
          found.planId=s.planId; found.planVersion=s.planVersion;
          db.catalogues[key]=found;
          return found;
        }
      }
      const owned=Object.values(db.catalogues).filter(c => c.source === s.id && (!c.planId || c.planId === s.planId));
      if (owned.length === 1) {
        owned[0].planId=s.planId; owned[0].planVersion=s.planVersion;
        db.catalogues[key]=owned[0];
        return owned[0];
      }
      return db.catalogues[key]={key,source:s.id,planId:s.planId,planVersion:s.planVersion,version:0,status:'未同步',lastSuccess:null,lastAttempt:null,error:'',entries:[],history:[],attempts:[],events:[]};
    }
    function fixture(s,scenario='正常') {
      const provider=providers[s.platform];if(!provider)throw Error('供应方尚未接入目录适配器');
      const rows=[];
      const scope=s.scope || s.type;
      function add(base,quote,basis,type) {
        const pair=provider.feed?base+'/'+quote:base+quote;
        const nativeId=type+':'+pair;
        rows.push({id:s.id+':'+s.platform+':'+nativeId,nativeId,pair,base,quote,assetId:'asset:'+base,basis,type,multiplier:'1',status:'可关联'});
      }
      if(provider.fx && (s.channel==='汇率行情通道' || scope==='汇率')) {
        for(const base of ['USDT','USDC','USD'])for(const quote of ['USDT','USDC','USD'])if(base!==quote)add(base,quote,'汇率','汇率');
      } else if(provider.feed && (s.channel==='供应商喂价通道' || scope==='供应商喂价')) {
        for(const base of assets)add(base,'USD','供应商单价','供应商喂价');
      } else if(!provider.feed && !provider.fx) {
        const spot=['公开行情通道 A','公开行情通道 B'].includes(s.channel) && ['现货','现货 / 永续'].includes(scope);
        const perp=provider.perp && s.channel==='公开行情通道 A' && ['永续','现货 / 永续'].includes(scope);
        for(const base of assets)for(const quote of provider.quotes){if(spot)add(base,quote,'现货中间价','现货');if(perp)add(base,quote,'永续中间价','永续');}
      }
      if(scenario==='移除BTC现货')return rows.filter(r=>!(r.base==='BTC'&&r.type==='现货'));
      if(scenario==='空目录')return [];
      if(scenario==='新增行情' && !provider.fx)add('DEMO',provider.quotes[0],provider.feed?'供应商单价':'现货中间价',provider.feed?'供应商喂价':'现货');
      return rows;
    }
    function sync(s,scenario='正常') {
      const c=get(s),at=stamp(),attempt={id:id('CAT-SYNC'),at,status:'失败',reason:''};c.lastAttempt=at;
      try {
        if(s.connection!=='在线')throw Error('连接未通过，无法同步目录');
        if(scenario==='同步失败')throw Error('行情目录读取超时');
        const rows=fixture(s,scenario),next=rows.map(r=>({...r,version:c.entries.find(e=>e.id===r.id)?.version || 1}));
        for(const old of c.entries)if(!rows.some(r=>r.id===old.id))next.push({...old,status:'已失效'});
        const signature=r=>JSON.stringify([r.nativeId,r.pair,r.base,r.quote,r.assetId,r.basis,r.type,r.multiplier,r.status]);
        const changed=next.filter(r=>{const old=c.entries.find(e=>e.id===r.id);return !old || signature(old)!==signature(r);});
        for(const r of changed){const old=c.entries.find(e=>e.id===r.id);if(old)r.version=old.version+1;}
        if(!c.version || changed.length){
          c.version++;
          c.entries=next;
          c.history.push({version:c.version,at,entries:clone(next)});
          for(const r of changed)c.events.push({id:id('CAT-EVT'),at,entry:r.id,pair:r.pair,type:r.type,status:r.status,version:c.version});
        }
        c.lastSuccess=at;c.status='成功';c.error='';attempt.status='成功';attempt.count=rows.length;
      }catch(e){c.status='失败';c.error=e.message;attempt.reason=e.message;}
      c.attempts.push(attempt);return c;
    }
    function usable(s,strict=true) {
      const c=get(s),age=Date.now()-Date.parse(c.lastSuccess);return c.version>0 && age>=0 && age<=86400000 && (!strict || c.status==='成功');
    }
    function resolve(s,b) {
      if(!s)return null;
      const entries=get(s).entries;
      if(b.catalogueId)return entries.find(e=>e.id===b.catalogueId);
      const matches=entries.filter(e=>e.pair===b.pair && e.base===b.base && e.quote===b.quote && e.basis===b.basis);
      return matches.length===1?matches[0]:null;
    }
    function error(s,b,strict=true) {
      if(!s)return '来源不存在';
      const c=get(s);if(!usable(s,strict))return c.status==='失败'?'目录同步失败，请重试':c.version?'目录已过期，请同步':'行情目录未同步';
      const e=resolve(s,b);if(!e)return '行情不在来源目录中';
      if(e.status!=='可关联')return '来源行情已失效';
      if(e.assetId!=='asset:'+b.base || e.base!==b.base || e.quote!==b.quote || e.pair!==b.pair || e.basis!==b.basis || e.multiplier!=='1')return '行情身份、用途或单位不匹配';
      if(b.catalogueEntryVersion && b.catalogueEntryVersion!==e.version)return '行情版本已变化，请重新选择';
      return '';
    }
    function candidates(s,base,target,purpose,{sameQuote=false,convertible=()=>false}={}) {
      if(!s?.enabled || !usable(s))return [];
      return get(s).entries.filter(e=>e.status==='可关联' && e.assetId==='asset:'+base && e.multiplier==='1' && s.capabilities?.includes(e.basis)
        && (purpose==='external'?e.basis==='永续中间价':purpose==='fx'?e.basis==='汇率':['现货中间价','供应商单价'].includes(e.basis))
        && (e.quote===target || !sameQuote && convertible(e.quote,target)));
    }
    function select(s,b,entry) {
      entry=entry&&get(s).entries.find(e=>e.id===entry.id&&e.status==='可关联');
      if(!entry)throw Error('请选择来源目录中的可用行情');
      Object.assign(b,{source:s.id,sourceVersion:s.revision,catalogueId:entry.id,catalogueVersion:get(s).version,catalogueEntryVersion:entry.version,pair:entry.pair,base:entry.base,quote:entry.quote,basis:entry.basis,needsMapping:false});return b;
    }
    return {get,sync,fixture,usable,resolve,error,candidates,select,fingerprint,providers};
  }
  window.PriceCatalogue={create};
})();
