(function () {
  'use strict';
  const D=window.Decimal,copy=v=>JSON.parse(JSON.stringify(v));
  const mode='pyth-core-v1',dataMode='local-demo-v2';
  const assets=window.ContractModel.choices['标的资产'].filter(Boolean);
  const feeds=assets.map(base=>({id:'DEMO-PYTH-'+base+'-USD',base,quote:'USD',name:base+'/USD',version:1,demo:true}));
  const providers=[
    {id:'src-binance',name:'Binance'},{id:'src-okx',name:'OKX'},{id:'src-bybit',name:'Bybit'},
    {id:'src-gate',name:'Gate'},{id:'src-mexc',name:'MEXC'}
  ];
  const demoPrices={BTC:'60000',ETH:'3000',SOL:'150',LINK:'15',DOGE:'0.1',XRP:'0.5',AVAX:'25',DOT:'5',LTC:'65',ADA:'0.35',BCH:'350',UNI:'7',AAVE:'100',SUI:'1',NEAR:'4',ATOM:'5',ETC:'20',FIL:'4',TRX:'0.15',APT:'7',INJ:'20',ARB:'0.5',OP:'1.5',PEPE:'0.00001',TRB:'60',HYPE:'30'};
  const mappings={USDC:{id:'USD-USDC-V1',version:1,rate:'0.9998',maxAge:5},USDT:{id:'USD-USDT-V1',version:1,rate:'0.9987',maxAge:5},USD:{id:'USD-IDENTITY-V1',version:1,rate:'1',maxAge:5}};
  const template={id:'LOCAL-BOOK-DEFAULT-V2',version:2,name:'默认来源组合',maxAge:5,rows:[{source:'src-binance',weight:'3'},{source:'src-okx',weight:'2'},{source:'src-bybit',weight:'2'}]};
  const scenarios=['正常','报告过期','报告验证失败','Feed错配','置信区间超限','汇率过期','外部盘口不可用','本地盘口不可用','全部价格不可用','报告时间超前','非正价格'];
  const is=m=>m?.config?.PYTH?.mode===mode;
  const isLocal=m=>is(m)&&m.config.PYTH.dataMode===dataMode;
  const catalogue=providers.flatMap(source=>assets.flatMap(base=>['USDC','USDT'].map(quote=>({
    id:'DEMO:'+source.id+':'+base+':'+quote,source:source.id,version:1,base,quote,basis:'永续中间价',multiplier:'1',
    pair:source.id==='src-okx'?base+'-'+quote+'-SWAP':['src-gate','src-mexc'].includes(source.id)?base+'_'+quote:base+quote
  }))));
  function initial(){return {mode,dataMode,product:'Pyth Core',feedId:'',feedVersion:1,base:'',target:'USDC',mappingId:'',mappingVersion:1,templateId:template.id,templateVersion:2,externalBindings:null,maxAge:'3',confidenceCap:'0.5',policyVersion:'LOCAL-QUALITY-V2',formulaVersion:'BIYA-14-45-PYTH-V1'};}
  function sync(m,draft){
    if(!isLocal(draft))return;
    const p=draft.config.PYTH,b=draft.config.CM05,base=b['标的资产']||'',target=b['计价资产'];
    p.base=base;p.target=target;p.feedId=feeds.find(f=>f.base===base)?.id||'';p.feedVersion=1;
    p.mappingId=mappings[target]?.id||'';p.mappingVersion=mappings[target]?.version||1;
  }
  function create(state,E){
    const runtime=new Map();
    let serial=0;
    function context(m){
      if(!runtime.has(m.id))runtime.set(m.id,{scenario:m.priceObservation?.scenario||'正常',epoch:m.priceObservation?.epoch||0,check:null,ema:null,aux:null});
      return runtime.get(m.id);
    }
    function fingerprint(m,draft){return JSON.stringify([draft.config.PYTH,draft.config.CM25,m.revision]);}
    function invalidate(m){context(m).check=null;}
    function setScenario(m,value){if(!scenarios.includes(value))throw Error('未知输入情景');const c=context(m);c.scenario=value;c.epoch++;c.check=null;c.ema=null;c.aux=null;}
    function conversion(from,to){if(!mappings[from]||!mappings[to])return null;return {id:from===to?'IDENTITY-'+to+'-V1':from+'-'+to+'-V1',version:1,from,to};}
    function externalOptions(m,source){return catalogue.filter(e=>e.source===source&&e.base===m.base&&!!conversion(e.quote,m.quote));}
    function entryFor(m,source){const same=externalOptions(m,source).filter(e=>e.quote===m.quote);return same.length===1?same[0]:null;}
    function binding(m,source,entry,previous={}){
      return {rowId:previous.rowId||'book-'+Date.now()+'-'+(++serial),source,weight:previous.weight??'1',enabled:previous.enabled??true,
        catalogueId:entry?.id||'',catalogueEntryVersion:entry?.version||0,sourceVersion:1,pair:entry?.pair||'',
        base:entry?.base||m.base,quote:entry?.quote||'',basis:entry?.basis||'',multiplier:entry?.multiplier||'',
        conversion:entry?conversion(entry.quote,m.quote):null,manual:previous.manual||false,contextBase:m.base,contextQuote:m.quote};
    }
    function syncExternal(m,draft){
      if(!isLocal(draft))return;
      const p=draft.config.PYTH;
      if(p.externalBindings===null)p.externalBindings=template.rows.map(r=>binding(m,r.source,entryFor(m,r.source),r));
      if(!Array.isArray(p.externalBindings))return;
      p.externalBindings=p.externalBindings.map(b=>{
        if(b.contextBase!==m.base)return binding(m,b.source,b.manual?null:entryFor(m,b.source),b);
        if(b.contextQuote!==m.quote)return b.manual?{...b,contextQuote:m.quote,conversion:conversion(b.quote,m.quote)}:binding(m,b.source,entryFor(m,b.source),b);
        return b;
      });
    }
    function editable(m,draft){if(!isLocal(draft))throw Error('历史价格配置只读');syncExternal(m,draft);if(!Array.isArray(draft.config.PYTH.externalBindings))throw Error('来源配置格式错误');return draft.config.PYTH.externalBindings;}
    function addExternal(m,draft){
      const rows=editable(m,draft);if(rows.length>=providers.length)throw Error('最多配置5个来源');
      const b=binding(m,'',null);while(rows.some(r=>r.rowId===b.rowId))b.rowId='book-'+Date.now()+'-'+(++serial);
      rows.push(b);invalidate(m);return b.rowId;
    }
    function removeExternal(m,draft,rowId){const rows=editable(m,draft),i=rows.findIndex(r=>r.rowId===rowId);if(i<0)throw Error('来源行不存在');rows.splice(i,1);invalidate(m);}
    function updateExternal(m,draft,rowId,key,value){
      const rows=editable(m,draft),i=rows.findIndex(r=>r.rowId===rowId);if(i<0)throw Error('来源行不存在');
      const b=rows[i];
      if(key==='source'){
        if(!providers.some(p=>p.id===value))throw Error('请选择交易所');
        if(rows.some(r=>r.rowId!==rowId&&r.source===value))throw Error('同一交易所不能重复关联');
        rows[i]=binding(m,value,entryFor(m,value),{...b,manual:false});
      }else if(key==='pair'){
        const entry=externalOptions(m,b.source).find(e=>e.id===value);if(value&&!entry)throw Error('请选择同标的永续交易对');
        rows[i]=binding(m,b.source,entry,{...b,manual:true});
      }else if(key==='weight')b.weight=String(value);
      else if(key==='enabled')b.enabled=Boolean(value);
      else throw Error('不支持的来源字段');
      invalidate(m);
    }
    function externalRows(m,draft=m){
      const raw=draft.config.PYTH?.externalBindings;
      if(!Array.isArray(raw))return [];
      const total=raw.reduce((sum,b)=>{try{const v=new D(b.weight);return b.enabled&&v.isFinite()&&v.gt(0)?sum.plus(v):sum;}catch(_){return sum;}},new D(0));
      return raw.map(b=>{
        const provider=providers.find(p=>p.id===b.source),options=externalOptions(m,b.source),entry=options.find(e=>e.id===b.catalogueId);
        const converted=entry?conversion(entry.quote,m.quote):null;
        const configured=!!entry&&b.sourceVersion===1&&b.catalogueEntryVersion===entry.version&&b.base===m.base&&b.quote===entry.quote&&b.pair===entry.pair&&b.basis==='永续中间价'&&b.multiplier==='1'&&JSON.stringify(b.conversion)===JSON.stringify(converted);
        let share='--';try{const v=new D(b.weight);share=!b.enabled?'0.00':v.isFinite()&&v.gt(0)&&total.gt(0)?v.div(total).mul(100).toFixed(2):'--';}catch(_){}
        return {...b,name:provider?.name||'待选择',options,configured,share,online:!!provider};
      });
    }
    function validate(m,draft){
      const p=draft.config.PYTH,errors=[],fail=(field,message)=>errors.push({group:'CM23',field,message});
      if(!p||p.mode!==mode)return [{group:'CM23',field:'模式',message:'定价模式不可修改'}];
      if(!isLocal(draft)){
        if(isLocal(m)||JSON.stringify(p)!==JSON.stringify(m.config.PYTH))fail('历史价格配置','历史配置只读，不自动迁移');
        return errors;
      }
      if(m.version&&!isLocal(m))fail('定价模式','旧合约不得自动迁移定价方案');
      const f=feeds.find(f=>f.id===p.feedId),b=draft.config.CM05;
      if(!f||f.base!==b['标的资产']||p.feedVersion!==1)fail('喂价项目','喂价项目必须与基础标的一致');
      if(p.base!==b['标的资产']||p.target!==b['计价资产'])fail('报价单位','定价配置与合约身份不一致');
      if(p.product!=='Pyth Core'||p.policyVersion!=='LOCAL-QUALITY-V2'||p.formulaVersion!=='BIYA-14-45-PYTH-V1')fail('接入方案','价格配置方案不匹配');
      const rule=mappings[p.target];
      if(!rule||p.mappingId!==rule.id||p.mappingVersion!==1)fail('单位处理方案','缺少单位处理方案');
      for(const [key,label] of [['maxAge','报价最大年龄'],['confidenceCap','最大置信区间占比']]){
        try{const v=new D(p[key]);if(!v.isFinite()||v.lte(0)||(key==='confidenceCap'&&v.gt(100)))throw Error();}
        catch(_){fail(label,'请输入有效正数'+(key==='confidenceCap'?'，且不超过100%':''));}
      }
      if(!Array.isArray(p.externalBindings)){fail('外部盘口','来源配置格式错误');return errors;}
      const rows=externalRows(m,draft),seen=new Set(),ids=new Set();
      if(!rows.some(r=>r.enabled))fail('外部盘口','至少配置一个启用的外部来源');
      if(rows.length>providers.length)fail('外部盘口','来源数量超过可配置上限');
      for(const r of rows){
        if(!r.rowId||ids.has(r.rowId))fail('外部盘口','来源行标识重复');ids.add(r.rowId);
        if(r.source&&seen.has(r.source))fail('来源交易所','同一交易所不能重复关联');seen.add(r.source);
        if(!providers.some(s=>s.id===r.source)){fail('来源交易所','请选择交易所');continue;}
        if(!r.enabled)continue;
        if(!r.configured)fail('永续交易对',r.name+'：请选择匹配的同标的永续行情');
        try{const n=new D(r.weight);if(!n.isFinite()||n.lte(0))throw Error();}
        catch(_){fail('配置权重',r.name+'：启用来源的权重必须为正数');}
      }
      for(const name of ['本地溢价EMA周期 tau1','辅助价格EMA周期 tau2']){
        try{const v=new D(draft.config.CM25[name]);if(!v.isFinite()||v.lte(0))throw Error();}
        catch(_){errors.push({group:'CM25',field:name,message:'平滑周期必须为有效正数'});}
      }
      return errors;
    }
    function sample(m,draft,at){
      const p=draft.config.PYTH,c=context(m),s=c.scenario,px=new D(demoPrices[m.base]||1),expo=m.base==='PEPE'?-10:-8,scale=new D(10).pow(-expo);
      return {feedId:s==='Feed错配'?feeds.find(f=>f.id!==p.feedId)?.id:p.feedId,
        price:s==='非正价格'?'0':px.mul(scale).toFixed(0),expo,conf:D.max(1,px.mul(s==='置信区间超限'?'.02':'.0001').mul(scale)).toFixed(0),
        publishTime:at-(s==='报告过期'||s==='全部价格不可用'?(Number(p.maxAge)+60)*1000:s==='报告时间超前'?-10000:0),
        verified:s!=='报告验证失败',fxAt:at-(s==='汇率过期'?60000:0),
        external:s!=='外部盘口不可用'&&s!=='全部价格不可用',local:s!=='本地盘口不可用'&&s!=='全部价格不可用'};
    }
    function evaluate(m,draft,report,at=Date.now()){
      const p=draft.config.PYTH,c=context(m),errors=validate(m,draft),reasons=[],rule=mappings[p.target],raw=report;
      let oracle=null,confidence=null,ratio=null,rate=null;
      if(!isLocal(draft))reasons.push('历史价格配置仅保留查询');
      if(raw.feedId!==p.feedId)reasons.push('Feed身份不匹配');
      if(raw.verified!==true)reasons.push('报告验证失败');
      if(!Number.isFinite(raw.publishTime)||at<raw.publishTime||at-raw.publishTime>Number(p.maxAge)*1000)reasons.push('报告时间无效或已过期');
      try{
        if(!Number.isInteger(raw.expo)||Math.abs(raw.expo)>18)throw Error();
        const value=new D(raw.price).mul(new D(10).pow(raw.expo));confidence=new D(raw.conf).mul(new D(10).pow(raw.expo));
        if(!value.isFinite()||value.lte(0)||!confidence.isFinite()||confidence.lt(0))throw Error();
        ratio=confidence.div(value).mul(100);if(ratio.gt(p.confidenceCap))reasons.push('置信区间占比超限');
        if(!rule||!Number.isFinite(raw.fxAt)||at<raw.fxAt||at-raw.fxAt>rule.maxAge*1000)reasons.push('汇率不可用或已过期');
        else {rate=new D(1).div(rule.rate);if(!reasons.length&&!errors.length)oracle=value.div(rule.rate);}
      }catch(_){reasons.push('价格、精度或置信区间无效');}
      const px=new D(demoPrices[m.base]||1),rows=externalRows(m,draft).map(({options,...r})=>r);
      const validRows=rows.filter(r=>r.enabled&&r.configured&&r.online&&raw.external&&(r.quote===m.quote||at-raw.fxAt>=0&&at-raw.fxAt<=5000));
      const local=raw.local?px.mul('1.0000033333333333333'):null;
      let external=null;
      if(!errors.length&&validRows.length){
        external=new D(E.median(validRows.map(r=>{
          const i=providers.findIndex(p=>p.id===r.source);
          const rawPx=px.mul(new D(1).plus(new D(i+1).div(1000000))).div(mappings[r.quote].rate);
          const fx=new D(mappings[r.quote].rate).div(mappings[m.quote].rate);
          r.rawPrice=rawPx.toString();r.conversionRate=fx.toString();r.normalizedPrice=rawPx.mul(fx).toString();
          return {price:r.normalizedPrice,weight:new D(r.weight)};
        })));
      }
      const fp=fingerprint(m,draft);
      if(c.ema?.fingerprint!==fp)c.ema=null;
      let x1=null,x4=null;
      if(local&&oracle&&!errors.length){
        const spread=local.minus(oracle),dt=c.ema?Math.max(0,(at-c.ema.at)/1000):0;
        const alpha=c.ema?new D(Math.exp(-dt/Number(draft.config.CM25['本地溢价EMA周期 tau1']))):new D(0);
        const smooth=c.ema?new D(c.ema.spread).mul(alpha).plus(spread.mul(new D(1).minus(alpha))):spread;
        x1=oracle.plus(smooth);c.ema={fingerprint:fp,at,spread:smooth.toString()};
      }else c.ema=null;
      if(local&&!errors.length){
        const prev=c.aux?.fingerprint===fp?c.aux:null,dt=prev?Math.max(0,(at-prev.at)/1000):0;
        const a=prev?new D(Math.exp(-dt/Number(draft.config.CM25['辅助价格EMA周期 tau2']))):new D(0);
        x4=prev?new D(prev.value).mul(a).plus(local.mul(new D(1).minus(a))):local;c.aux={fingerprint:fp,at,value:x4.toString()};
      }else c.aux=null;
      const xs=[x1,local,external].filter(x=>x!==null).sort((a,b)=>a.cmp(b));
      let mark=null,path='无有效主要分量';
      if(xs.length===3){mark=xs[1];path='三主要分量中位数';}
      else if(xs.length===2){mark=x4?[...xs,x4].sort((a,b)=>a.cmp(b))[1]:xs[0].plus(xs[1]).div(2);path=x4?'两主要分量 + 辅助EMA':'两主要分量平均值';}
      else if(xs.length===1){mark=xs[0];path='单主要分量';}
      const runtimeErrors=[...errors.map(e=>e.message),...reasons];
      if(!external)runtimeErrors.push('外部永续盘口不可用');if(!local)runtimeErrors.push('本地盘口不可用');
      if(errors.length){mark=null;path='配置未通过';}
      return {id:'LOCAL-CHECK-'+at,at,demo:true,scenario:c.scenario,epoch:c.epoch,fingerprint:fp,configSnapshot:copy(p),
        mappingSnapshot:rule?copy(rule):null,externalInputs:copy(rows),report:copy(report),oracle:oracle?.toString()||null,
        mark:mark?.toString()||null,confidence:confidence?.toString()||null,ratio:ratio?.toString()||null,rate:rate?.toString()||null,
        components:errors.length?[null,null,null,null]:[x1,local,external,x4].map(v=>v?.toString()||null),
        path,configErrors:errors,runtimeErrors,ready:runtimeErrors.length===0,validExternal:validRows.length,policy:p.policyVersion};
    }
    function capture(m,draft){const at=Date.now(),c=context(m);c.check=evaluate(m,draft,sample(m,draft,at),at);return c.check;}
    function adopt(m){
      const r=capture(m,window.ContractModel.snapshot(m));m.priceObservation=copy(r);
      if(r.mark)m.markAdoption=copy(r);if(r.oracle&&r.mark)m.priceAdoption=copy(r);
      m.priceAudit||=[];m.priceAudit.push(copy(r));return r;
    }
    function online(m){const r=capture(m,window.ContractModel.snapshot(m));if(r.ready){m.priceObservation=copy(r);m.priceAdoption=copy(r);m.priceAudit||=[];m.priceAudit.push(copy(r));}return r;}
    function fresh(m){
      const r=m.priceObservation;if(!r||r.fingerprint!==fingerprint(m,window.ContractModel.snapshot(m)))return false;
      if(r.demo&&isLocal(m)){const c=context(m);return r.scenario===c.scenario&&r.epoch===c.epoch;}
      return Date.now()-r.at<=Math.min(Number(m.config.PYTH.maxAge),5)*1000;
    }
    function value(m,type){return fresh(m)?m.priceObservation[type]??null:null;}
    function exportRows(m){
      const p=m.config.PYTH;
      return [['预言机','喂价项目',p.base+'/USD',''],['预言机','Feed标识',p.feedId,''],
        ['预言机','单位处理方案',p.mappingId,''],['预言机','报价最大年龄',p.maxAge,'秒'],['预言机','最大置信区间占比',p.confidenceCap,'%'],
        ...externalRows(m).flatMap(r=>[['外部盘口',r.name,r.pair,''],['外部盘口',r.name+'配置权重',r.weight,''],
          ['外部盘口',r.name+'启用状态',r.enabled?'启用':'停用',''],['外部盘口',r.name+'配置占比',r.share,'%'],
          ['外部盘口',r.name+'行情标识',r.catalogueId,''],['外部盘口',r.name+'单位处理',r.conversion?.id||'未配置','']])];
    }
    return {context,externalRows,externalOptions,syncExternal,addExternal,removeExternal,updateExternal,validate,evaluate,capture,
      invalidate,setScenario,adopt,online,fresh,value,fingerprint,exportRows};
  }
  window.PythPricing={mode,dataMode,assets,feeds,providers,catalogue,mappings,template,scenarios,is,isLocal,initial,sync,create};
})();
