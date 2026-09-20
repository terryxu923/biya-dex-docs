(function () {
  'use strict';
  const M=window.ContractModel,D=window.Decimal;
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,n=2)=>new D(v||0).toNumber().toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n});
  const date=v=>v?new Date(v).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai',hour12:false}):'--';
  const priceFmt=v=>new D(v).abs().lt('.1')?new D(v).toFixed(10):fmt(v,1);
  const short=v=>v?.length>22?v.slice(0,10)+'...'+v.slice(-6):v;
  const icon=n=>'<i data-lucide="'+n+'"></i>';
  const button=(text,action,attrs='',primary=false)=>`<button class="btn ${primary?'primary':''}" data-cm-action="${action}" ${attrs}>${esc(text)}</button>`;
  const tool=(name,action,symbol,attrs='')=>`<button class="cm-icon-button" title="${name}" aria-label="${name}" data-cm-action="${action}" ${attrs}>${icon(symbol)}</button>`;
  const state={markets:M.markets,sources:M.sources,role:'运营管理员',route:'#contracts',tab:'overview',group:'CM05',queries:{},pages:{},sizes:{},sorts:{},columns:null,editor:null,error:'',pendingNavigation:null,returnRoute:null};
  const retiredNoticeFields=['风险提示开关','提示类型','风险提示文案','提示展示方式','提示开始时间','提示结束时间','关联公告'];
  const STORAGE='BIYA_CONTRACT_V110_2';
  let importedLegacy=false;
  try{const raw=localStorage.getItem(STORAGE),cached=JSON.parse(raw);if([2,3].includes(cached?.format)&&Array.isArray(cached.markets)&&Array.isArray(cached.sources)){state.markets=cached.markets;state.sources=cached.sources;state.pricing=cached.pricing;importedLegacy=cached.format===2;if(importedLegacy&&!localStorage.getItem(STORAGE+'_BACKUP'))localStorage.setItem(STORAGE+'_BACKUP',raw);}}catch(_){/* File-origin storage may be unavailable; the session remains usable. */}
  const priceEngine=window.PriceModel.create(state,importedLegacy);
  const B=window.PythPricing,pyth=B.create(state,priceEngine);
  function retireNoticeConfig(draft){const basic=draft?.config?.CM05;if(basic)for(const name of retiredNoticeFields)delete basic[name];}
  function ensureCurrentContract(m,draft=m){const basic=draft.config?.CM05;if(basic){basic['合约类型']='U本位';if(typeof basic['合约名称']==='string')basic['合约名称']=basic['合约名称'].replace(/线性永续永续/g,'U本位永续').replace(/线性永续/g,'U本位');}retireNoticeConfig(draft);if(B.isLocal(draft))return;draft.config.PYTH=B.initial();B.sync(m,draft);pyth.syncExternal(m,draft);}
  state.markets.forEach(m=>{ensureCurrentContract(m);if(m.draft)ensureCurrentContract(m,m.draft);if(m.pending?.draft)ensureCurrentContract(m,m.pending.draft);(m.history||[]).forEach(h=>ensureCurrentContract(m,h));});
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({format:3,markets:state.markets,sources:state.sources,pricing:state.pricing}));}catch(_){toast('本地存储不可用，本次更改仅保留在当前会话');}}
  const root=document.createElement('section');root.id='cmRoot';root.className='cm-root';$('.content').append(root);
  const mobile=document.createElement('div');mobile.className='cm-nav-mobile';mobile.innerHTML=button('账户','nav','data-route="#accounts"')+button('合约','nav','data-route="#contracts"');$('.content').prepend(mobile);
  const overlay=document.createElement('div');overlay.className='cm-overlay';overlay.hidden=true;document.body.append(overlay);
  let dialogContext=null,lastFocus=null;
  const tableCache={};
  function fundingQuantity(index){const n=accounts().length,l=Math.ceil(n/2),s=n-l;return new D(index<l?s:l).mul('.01');}
  function fundingAccountAmount(m,index){return fundingQuantity(index).mul(m.price).mul('.0000125').mul(index<Math.ceil(accounts().length/2)?-1:1);}
  function fundingTotal(m){return new D(Math.ceil(accounts().length/2)).mul(Math.floor(accounts().length/2)).mul('.01').mul(m.price).mul('.0000125').toFixed(6);}
  function csvValue(f,m,v,mixed=false){if(!/^-?\d+(\.\d+)?$/.test(String(v)))return v;const u=M.unit(f,m);if(u==='%')return v+'%';if(u==='倍')return v+'x';return mixed&&u?v+' '+u:v;}
  function sourceListRows(){const q=state.queries.sources||{};return state.sources.filter(s=>(!q.keyword||(s.name+s.code).toLowerCase().includes(q.keyword.toLowerCase()))&&(!q.enabled||(s.enabled?'启用':'停用')===q.enabled)&&(!q.type||s.type===q.type)&&(!q.healthy||(s.healthy?'正常':'异常')===q.healthy)&&(!q.purpose||sourceValue(s,'支持用途').includes(q.purpose)));}
  const nav=$$('.sidebar .nav-item');
  const contractNav=nav.find(n=>n.textContent.includes('合约品种'));
  contractNav.id='contractNav';contractNav.dataset.cmAction='nav';contractNav.dataset.route='#contracts';contractNav.tabIndex=0;contractNav.setAttribute('role','button');
  const sourceNav=document.createElement('div');
  $('#accountNav').dataset.cmAction='nav';$('#accountNav').dataset.route='#accounts';
  function refreshIcons(){window.lucide?.createIcons({attrs:{'stroke-width':1.7}});}
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2500);}
  function tag(value){let tone=/失败|暂停|不可用|不合格/.test(value)?'danger':/观察|只减仓|下线中|预警|待|降级/.test(value)?'warning':/正常|已生效|已上线|合格|启用|成功|已完成|有效/.test(value)?'success':'neutral';return `<span class="tag ${tone}">${esc(value)}</span>`;}
  function token(m,small=false){const uploaded=m.config.CM05['图标'];if(uploaded?.startsWith('data:image/'))return '<img class="'+(small?'':'cm-token')+'" src="'+esc(uploaded)+'" alt="'+esc(m.base)+'" width="'+(small?24:38)+'" height="'+(small?24:38)+'">';if(!['BTC','ETH','SOL'].includes(m.base))return `<span class="cm-token-text ${small?'small':''}" aria-label="${esc(m.base)}">${esc(m.base.slice(0,2))}</span>`;return `<img class="${small?'':'cm-token'}" src="admin-contract-assets/vendor/${m.base.toLowerCase()}.png" alt="${esc(m.base)}" width="${small?24:38}" height="${small?24:38}">`;}
  function current(){return state.markets.find(m=>m.id===state.marketId);}
  function sourceById(id){return state.sources.find(s=>s.id===id);}
  function accounts(){return window.BIYA_ACCOUNT_BRIDGE.list();}
  function sourceValue(source,name){const values={'来源代码':source.code,'来源名称':source.name,'价格源名称':source.name+(source.planName?' · '+source.planName:''),'供应方':source.platform,'所属平台':source.platform,'来源类别':source.category,'接入方案':source.planName,'接入范围':source.scope||source.type,'市场类型':source.scope||source.type,'来源市场类型':source.scope||source.type,'来源独立分组':source.group,'独立性核对依据':source.proof,'支持能力':(source.capabilities||[]).join(' / '),'支持用途':(source.capabilities||[]).join(' / ')||'预言机单价 / 外部双边盘口','启用状态':source.enabled?'启用':'停用','运行健康状态':source.healthy?'正常':'异常','最近检查时间':'2026-09-10 10:40:00','最近修改时间':source.updated||'2026-09-09 16:20:00','健康检查间隔':source.interval,'数据接入通道':source.channel,'技术通道':source.channel,'操作原因':source.reason||'公开行情接入','创建信息':'2026-09-01 09:00:00 · 运营管理员','来源基础信息':source.code+' · '+source.name+' · '+(source.planName||source.group),'配置状态':(source.enabled?'启用':'停用')+' · V'+source.revision,'接入状态':(source.planName||source.channel)+' · '+(source.healthy?'正常':'连接异常')};return values[name]??'--';}
  function contractValue(m,name){const b=m.config.CM05,t=m.config.CM08,r=m.config.CM12||{},group=m.config.RC03||{},liquidation=m.config.CM13||{},f=m.config.CM16||{};return({'合约':m.code,'合约名称':b['合约名称'],'标的资产':m.base,'计价资产':m.quote,'结算资产':m.settle,'合约类型':b['合约类型']||'U本位','保证金模式':'全仓','最大杠杆':m.config.CM09['最大杠杆'],'Maker费率':f['基础档Maker费率']||'0.015','Taker费率':f['基础档Taker费率']||'0.045','收费币种':f['收费币种']||m.settle,'最小委托数量':t['最小委托数量'],'最大委托数量':t['最大委托数量'],'最小委托价值':t['最小委托价值'],'单账户持仓名义价值上限':r['单账户持仓上限开关']?r['单账户持仓名义价值上限']:'不适用','市场持仓名义价值上限':r['市场持仓上限开关']?r['市场持仓名义价值上限']:'不适用','主账户组多头名义价值上限':group['主账户组持仓限制']?group['主账户组多头名义价值上限']:'不适用','主账户组空头名义价值上限':group['主账户组持仓限制']?group['主账户组空头名义价值上限']:'不适用','强平委托价格保护比例':liquidation['强平价格保护比例'],'交易状态':['草稿','待上线','已下线'].includes(m.lifecycle)?'不适用':m.trade,'上线状态':m.lifecycle,'客户端可见':b['客户端可见'],'价格可用状态':B.is(m)?(!m.priceObservation?'未采纳':!pyth.fresh(m)?(B.isLocal(m)?'待检查':'已过期'):m.priceObservation.ready?'正常':m.priceObservation.mark?'降级':'不可用'):m.quality,'当前配置版本':m.version?'V'+m.version:'--','配置生效时间':m.updated,'最近修改时间':m.updated,'展示标签':b['展示标签']?.join('、')||'--','展示排序':b['展示排序'],'价格展示精度':t['价格展示精度'],'数量展示精度':t['数量展示精度'],'价格步长':t['价格步长'],'数量步长':t['数量步长'],'市价保护比例':t['市价保护比例'],'单笔委托价值上限':t['单笔委托价值上限'],'计划上线时间':m.pending?.scheduled?date(m.pending.scheduled):'--','实际上线时间':m.version?m.opened:'--','手续费归集账户':f['手续费归集账户']})[M.clean(name)]??'--';}
  function isCreateEditor(){return !!(state.editor&&!state.editor.market.version);}
  function configuredWeightPreview(e){
    return ['oracle','external'].map(key=>{
      const weights={};let total=new D(0);
      for(const r of (e.draft[key]||[]).filter(r=>r.enabled)){const g=sourceById(r.source)?.group||r.source;try{const w=new D(r.weight);if(!w.isFinite()||w.lte(0))continue;weights[g]=(weights[g]||new D(0)).plus(w);total=total.plus(w);}catch(_){}}
      return (key==='oracle'?'预言机输入':'外部盘口')+'：'+(total.gt(0)?Object.entries(weights).map(([k,v])=>k+' '+v.div(total).mul(100).toFixed(2)+'%').join(' / '):'--');
    }).join('；');
  }
  function independentGroupsPreview(e){return [...new Set([...(e.draft.oracle||[]),...(e.draft.external||[])].filter(r=>r.enabled).map(r=>sourceById(r.source)?.group).filter(Boolean))].join(' / ')||'未选择';}
  function configValue(m,g,f,draft){const n=M.clean(f.name),conf=draft?.config||m.config;if(n==='周期换算系数 h'){try{return new D(conf.CM18['利率基准周期']).div(conf.CM18['结算周期']).toString();}catch(_){return '--';}}if(n==='关联保险基金')return conf.CM13['保险基金关联账户'];if(n==='创建时间')return m.created||(m.version?'2026-08-19 14:22:31':'--');if(n==='实际上线时间')return m.opened||'--';if(n==='计划上线时间')return m.pending?.scheduled?date(m.pending.scheduled):'--';if(/方案版本|归集配置版本|当前版本/.test(n))return m.version?'V'+m.version+' · '+m.updated:'--';if(isCreateEditor()&&n==='配置权重占比')return configuredWeightPreview(state.editor);if(isCreateEditor()&&n==='来源独立分组')return independentGroupsPreview(state.editor);if(isCreateEditor()&&n==='准入状态与原因')return state.editor.prechecked?(state.editor.errors.some(x=>['CM23','CM24','RC10','RC11'].includes(x.group))?'未通过：来源或权重预检失败':'通过：基础能力及质量校验；深度准入未启用'):'未校验';if(isCreateEditor()&&n==='标记价格交易时效'&&g==='CM13')return conf.CM08?.['标记价格交易时效'];return conf[g]?.[n]??'--';}
  function display(value,field,m,table=false){const n=M.clean(field.name);if(value===true||value===false)return value?'开启':'关闭';if(value==null||value==='')return '--';if(Array.isArray(value))return value.join('、');if(n==='图标'){const src=String(value).startsWith('vendor/')?'admin-contract-assets/'+value:value;return String(src).startsWith('data:image/')||String(src).startsWith('admin-contract-assets/vendor/')?`<img src="${esc(src)}" alt="${esc(m.base||'合约图标')}" width="38" height="38">`:esc(value);}const u=M.unit(field,m);const numeric=/^-?\d+(\.\d+)?$/.test(String(value));if(!numeric)return esc(value);let num=String(value);if(u==='%' )return esc(num)+'%';if(u==='倍')return esc(num)+'x';if(u==='位小数')return esc(num)+'位小数';if(u&& !table)return esc(num)+` <span class="cm-unit">${esc(u)}</span>`;return esc(num);}
  function tableHeader(f,m,mixed=false){const u=M.unit(f,m),n=M.clean(f.name);if(mixed||!u||['%','倍','位小数'].includes(u))return n;return n+'（'+u+'）';}
  function roleControl(){return '';}
  function canWrite(){return true;}
  function noticeVisible(){return false;}
  const historyConfigGroups=['CM05','CM08','CM09','CM12','RC03','CM13','CM16','CM18'];
  function versionDialog(version,group='CM05'){const m=current(),h=m.history.find(h=>h.version===Number(version));if(!h)return;if(!historyConfigGroups.includes(group))group='CM05';const values=Object.fromEntries(M.fields(group).map(f=>[M.clean(f.name),h.config[group]?.[M.clean(f.name)]??'--']));dialog('历史配置 · V'+h.version,'<div class="cm-section-head"><span>'+h.time+'</span><select class="control" style="width:240px" data-version-group="'+h.version+'" aria-label="历史配置分组">'+historyConfigGroups.map(g=>'<option value="'+g+'" '+(g===group?'selected':'')+'>'+groupTitle(g)+'</option>').join('')+'</select></div>'+grid(group,m,values),button('关闭','close-dialog'),true);}
  function navigate(route){if(state.editor?.dirty){state.pendingNavigation=route;dialog('离开未保存的配置', '<p>当前修改尚未保存。</p>',button('继续编辑','close-dialog')+button('放弃修改','discard-editor','',true));return;}go(route);}
  function go(route){state.editor=null;state.route=route;try{history.pushState({},'',route);}catch(_){location.hash=route;}renderRoute();}
  function renderRoute(){const hash=state.route;overlay.hidden=true;const acc=hash.startsWith('#account');$('#breadcrumbParent').textContent=acc?'账户与授权':'交易配置';root.hidden=acc;$('#listPage').classList.remove('active');$('#detailPage').classList.remove('active');$$('.sidebar .nav-item').forEach(n=>n.classList.remove('active'));if(acc){$('#accountNav').classList.add('active');const id=hash.match(/^#account=([^&]+)/)?.[1];if(id)window.BIYA_ACCOUNT_BRIDGE.open(decodeURIComponent(id));else window.BIYA_ACCOUNT_BRIDGE.showList();if(state.returnRoute){let b=$('#cmReturn');if(!b){b=document.createElement('button');b.id='cmReturn';b.className='btn-link';b.dataset.cmAction='return-contract';$('.breadcrumb').prepend(b);}b.textContent='返回合约 / ';}return;}$('#cmReturn')?.remove();contractNav.classList.toggle('active',hash.startsWith('#contracts'));sourceNav.classList.toggle('active',hash.startsWith('#sources'));root.hidden=false;const parts=hash.slice(1).split('/');if(parts[0]==='sources'){if(parts[1])renderSourceDetail(parts[1]);else renderSources();}else if(parts[1]==='new'){startEditor(null);return;}else if(parts[1]){state.marketId=parts[1];const m=current();if(!m){renderMarketList();return;}state.tab=parts[2]||'overview';state.group=parts[3]||M.tabs.find(t=>t[0]===state.tab)?.[2][0]||'CM05';renderMarketDetail();}else renderMarketList();refreshIcons();}
  function fieldFilter(label,name,options,value='',wide=false){return `<div><label for="cm-filter-${name}">${esc(label)}</label>${options?`<select class="control" name="${name}" id="cm-filter-${name}"><option value="">全部</option>${options.map(o=>`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input class="control" type="search" name="${name}" value="${esc(value)}" id="cm-filter-${name}" placeholder="${esc(label)}">`}</div>`;}
  function pager(key,count){const size=state.sizes[key]||20,pages=Math.max(1,Math.ceil(count/size));state.pages[key]=Math.min(state.pages[key]||1,pages);const page=state.pages[key];return `<div class="cm-pager"><span>共 ${count} 条 · 第 ${page} / ${pages} 页</span><div class="cm-actions"><select class="control" data-cm-size="${key}" aria-label="每页条数">${[20,50,100].map(n=>`<option value="${n}" ${n===size?'selected':''}>${n}条 / 页</option>`).join('')}</select>${tool('上一页','page','chevron-left',`data-key="${key}" data-page="${page-1}" ${page===1?'disabled':''}`)}${Array.from({length:Math.min(pages,5)},(_,i)=>`<button class="page-btn ${page===i+1?'active':''}" data-cm-action="page" data-key="${key}" data-page="${i+1}">${i+1}</button>`).join('')}${tool('下一页','page','chevron-right',`data-key="${key}" data-page="${page+1}" ${page===pages?'disabled':''}`)}</div></div>`;}
  function slice(key,rows){const size=state.sizes[key]||20,max=Math.max(1,Math.ceil(rows.length/size));state.pages[key]=Math.min(state.pages[key]||1,max);return rows.slice(((state.pages[key]||1)-1)*size,(state.pages[key]||1)*size);}
  const defaultListColumns=['合约','合约类型','标的资产','计价资产','结算资产','最大杠杆','Maker费率','Taker费率','收费币种','最大委托数量','单账户持仓名义价值上限','上线状态','交易状态','客户端可见','价格可用状态','最近修改时间'];
  const listFieldSources=[
    ['合约','CM01','合约'],['合约类型','CM05','合约类型'],['标的资产','CM05','标的资产'],['计价资产','CM05','计价资产'],['结算资产','CM05','结算资产'],['保证金模式','CM05','保证金模式'],
    ['最大杠杆','CM09','最大杠杆'],['Maker费率','CM16','基础档Maker费率'],['Taker费率','CM16','基础档Taker费率'],['收费币种','CM16','收费币种'],
    ['价格展示精度','CM08','价格展示精度'],['数量展示精度','CM08','数量展示精度'],['价格步长','CM08','价格步长'],['数量步长','CM08','数量步长'],['最小委托数量','CM08','最小委托数量'],['最大委托数量','CM08','最大委托数量'],['最小委托价值','CM08','最小委托价值'],['单笔委托价值上限','CM08','单笔委托价值上限'],['市价保护比例','CM08','市价保护比例'],
    ['单账户持仓名义价值上限','CM12','单账户持仓名义价值上限'],['市场持仓名义价值上限','CM12','市场持仓名义价值上限'],['主账户组多头名义价值上限','RC03','主账户组多头名义价值上限'],['主账户组空头名义价值上限','RC03','主账户组空头名义价值上限'],['强平委托价格保护比例','CM13','强平价格保护比例'],
    ['上线状态','CM01','上线状态'],['交易状态','CM01','交易状态'],['客户端可见','CM05','客户端可见'],['展示标签','CM05','展示标签'],['展示排序','CM05','展示排序'],['价格可用状态','CM01','价格可用状态'],['手续费归集账户','CM16','手续费归集账户'],['计划上线时间','CM05','计划上线时间'],['实际上线时间','CM05','实际上线时间'],['配置生效时间','CM01','配置生效时间'],['最近修改时间','CM01','最近修改时间']
  ];
  function listField(name,group,sourceName){const source=M.fields(group).find(f=>M.clean(f.name)===sourceName)||{name:sourceName,unit:''};return {...source,name};}
  function allListFields(){return listFieldSources.map(args=>listField(...args));}
  function listRows(){const q=state.queries.list||{};return state.markets.filter(m=>{const b=m.config.CM05;return(!q.keyword||(m.code+' '+b['合约名称']).toLowerCase().includes(q.keyword.toLowerCase()))&&(!q.type||contractValue(m,'合约类型')===q.type)&&(!q.base||m.base===q.base)&&(!q.quote||m.quote===q.quote)&&(!q.settle||m.settle===q.settle)&&(!q.lifecycle||m.lifecycle===q.lifecycle)&&(!q.trade||contractValue(m,'交易状态')===q.trade)&&(!q.visible||b['客户端可见']===q.visible)&&(!q.tag||b['展示标签']?.includes(q.tag));});}
  function listFields(){const all=allListFields(),allowed=new Set(all.map(f=>f.name)),names=(state.columns||defaultListColumns).filter(name=>allowed.has(name));return all.filter(f=>names.includes(f.name));}
  function renderMarketList(){const q=state.queries.list||{},rows=listRows(),cols=listFields();$('#breadcrumb').textContent='合约列表';root.innerHTML=`<div class="cm-heading"><div><h1>合约管理</h1><div class="cm-heading-sub">${state.markets.filter(m=>m.lifecycle==='已上线').length} 个已上线 · ${state.markets.filter(m=>m.trade==='只减仓').length} 个只减仓</div></div><div class="cm-actions">${roleControl()}${tool('刷新合约列表','refresh','refresh-cw')}${button('新增合约','new-market','',true)}</div></div><form class="cm-band cm-filters" id="cmListFilters">${fieldFilter('合约代码 / 名称','keyword',null,q.keyword)}${fieldFilter('合约类型','type',['U本位'],q.type)}${fieldFilter('标的资产','base',state.markets.map(m=>m.base),q.base)}${fieldFilter('计价资产','quote',['USDC','USDT'],q.quote)}${fieldFilter('结算资产','settle',['USDC','USDT'],q.settle)}${fieldFilter('上线状态','lifecycle',['草稿','待上线','已上线','下线中','已下线'],q.lifecycle)}${fieldFilter('交易状态','trade',['正常交易','只减仓','已暂停','不适用'],q.trade)}${fieldFilter('展示标签','tag',['主流','新上线','高波动','DeFi'],q.tag)}${fieldFilter('客户端可见','visible',['显示','隐藏'],q.visible)}${fieldFilter('风险提示状态','risk',['开启','关闭'],q.risk)}${fieldFilter('提示类型','notice',['一般风险','下线提示'],q.notice)}<div class="cm-filter-foot">${button('重置','reset-list')}${button('查询','query-list','',true)}</div></form><div class="cm-workspace"><div class="cm-toolbar"><span>合约列表 <strong>${rows.length}</strong></span><div class="cm-actions">${tool('列设置','columns','columns-3')}${tool('导出当前结果','export-list','download')}</div></div><div class="cm-table-scroll"><table class="cm-table"><thead><tr>${cols.map((f,i)=>`<th class="${i===0?'cm-sticky':''}">${esc(f.name)}</th>`).join('')}<th class="cm-last">操作</th></tr></thead><tbody>${slice('list',rows).map(m=>`<tr data-market-id="${m.id}">${cols.map((f,i)=>`<td class="${i===0?'cm-sticky':''}">${marketCell(m,f)}</td>`).join('')}<td class="cm-last"><div class="cm-actions"><button class="btn-link" data-cm-action="detail" data-id="${m.id}">详情</button><button class="btn-link" data-cm-action="edit" data-id="${m.id}">编辑</button><button class="btn-link" data-cm-action="notice" data-id="${m.id}">提示设置</button></div></td></tr>`).join('')||`<tr><td colspan="${cols.length+1}"><div class="cm-empty">暂无匹配合约</div></td></tr>`}</tbody></table></div>${pager('list',rows.length)}</div>`;refreshIcons();}
  function marketCell(m,f){const n=M.clean(f.name),v=contractValue(m,n);if(n==='合约')return `<div class="cm-inline-id">${token(m,true)}<div><button class="btn-link" data-cm-action="detail" data-id="${m.id}">${m.code}</button><small>${esc(contractValue(m,'合约名称'))}</small></div></div>`;if(/状态/.test(n))return tag(v);if(['最小委托数量','最大委托数量','数量步长'].includes(n)&&v!=='不适用')return esc(v)+' <span class="cm-unit">'+m.base+'</span>';if(/价值上限|委托价值/.test(n)&&v!=='不适用')return fmt(v)+' <span class="cm-unit">'+m.quote+'</span>';return display(v,f,m,false);}
  function renderMarketDetail(){const m=current();$('#breadcrumb').textContent=m.code;const tab=M.tabs.find(t=>t[0]===state.tab)||M.tabs[0];if(!tab[2].includes(state.group))state.group=tab[2][0];const b=m.config.CM05,type=contractValue(m,'合约类型');root.innerHTML=`<div class="cm-heading"><div class="cm-heading-id">${tool('返回合约列表','nav','arrow-left','data-route="#contracts"')}${token(m)}<div><h1>${esc(m.code)} <span class="cm-unit">· ${esc(type)}永续</span></h1><div class="cm-heading-sub">${tag(m.lifecycle)} ${tag(m.trade)} <span>${esc(type)} · V${m.version} · ${m.updated} UTC+8</span></div></div></div><div class="cm-actions">${roleControl()}${tool('刷新数据','refresh','refresh-cw')}${tool('导出合约配置','export-config','download')}${button(m.draft?'继续编辑草稿':'编辑配置','edit','data-id="'+m.id+'"')}${button('状态与发布','operations')}</div></div>${m.pending?`<div class="cm-notice">待处理变更 ${esc(m.pending.id)} · ${esc(m.pending.status)} ${button('查看变更','change-detail','data-event="'+m.pending.id+'"')}${button('继续处理','operations')}</div>`:''}${noticeVisible(m)?`<div class="cm-notice">${esc(b['风险提示文案'])}</div>`:''}<div class="cm-topstats">${[['最新成交价',m.empty?'--':fmt(m.price,1),m.quote+'/'+m.base],['标记价格',m.quality==='不可用'?'--':(B.is(m)?(pyth.value(m,'mark')?priceFmt(pyth.value(m,'mark')):'--'):fmt(m.price,1)),m.quote+'/'+m.base],['预言机价格',m.quality==='不可用'?'--':(B.is(m)?(pyth.value(m,'oracle')?priceFmt(pyth.value(m,'oracle')):'--'):fmt(new D(m.price).mul('1.0001'),1)),m.quote+'/'+m.base],['当前资金费率',m.empty?'--':'0.00125%','每1小时结算'],['持仓量',m.empty?'0':fmt(m.positions*2,3),m.base],['24H 成交额',m.empty?'0':fmt(new D(m.price).mul(345)),m.quote]].map(s=>`<div class="cm-stat"><small>${s[0]}</small><strong>${s[1]}</strong><span>${s[2]}</span></div>`).join('')}</div><div class="cm-workspace"><div class="cm-tabs" role="tablist">${M.tabs.map(t=>`<button class="cm-tab ${state.tab===t[0]?'active':''}" role="tab" aria-selected="${state.tab===t[0]}" data-cm-action="tab" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div><div class="cm-subtabs">${tab[2].map(g=>`<button class="cm-subtab ${state.group===g?'active':''}" data-cm-action="group" data-group="${g}">${esc(groupTitle(g))}</button>`).join('')}</div><div class="cm-surface" id="cmSurface">${renderGroup(state.group,m)}</div></div>`;refreshIcons();}
  function groupTitle(g){return ({CM05:'基本信息与展示',CM06:'功能状态',CM07:'配置生效摘要',CM08:'交易参数',CM09:'杠杆与保证金',CM10:'保证金档位',CM11:'计算预览',RISK_PARAMS:'参数设置',CM12:'账户与市场限额',CM13:'清算保护',CM16:'手续费配置',CM17:'当前资金费',CM18:'资金费参数',CM22:'价格状态',CM23:'预言机配置',CM24:'外部盘口',CM25:'标记价格',CM26:'实时报价',RC03:'主账户组限额'})[g]||M.schema[g]?.title||g;}
  const detailFieldNames={
    CM05:['合约代码','合约名称','合约类型','标的资产','计价资产','结算资产','保证金模式','图标','展示排序','客户端可见','展示标签'],
    CM08:['价格步长','数量步长','最小委托数量','最大委托数量','最小委托价值','单笔委托价值上限','市价保护比例','标记价格交易时效','支持订单类型','价格展示精度','数量展示精度'],
    CM09:['最小杠杆','最大杠杆','默认杠杆','杠杆调整步长'],
    CM12:['单账户持仓上限开关','单账户持仓名义价值上限','市场持仓上限开关','市场持仓名义价值上限'],
    RC03:['主账户组持仓限制','主账户组多头名义价值上限','主账户组空头名义价值上限'],
    CM13:['强平价格保护比例'],
    CM16:['基础档Maker费率','基础档Taker费率','收费币种','手续费归集账户'],
    CM18:['利率基准周期','溢价采样窗口','采样间隔','结算周期','结算时间基准','固定利率项 I','利率差限幅 cI','周期换算系数 h','单次费率绝对值上限 cF','冲击名义金额']
  };
  function detailLabel(g,name){return M.createLabel(g,M.clean(name));}
  function detailFields(g,index=0,m,values){const names=detailFieldNames[g];let list=M.fields(g,index);if(names)list=list.filter(f=>names.includes(M.clean(f.name)));const data=values||m?.config?.[g]||{};if(g==='CM12'){if(!data['单账户持仓上限开关'])list=list.filter(f=>M.clean(f.name)!=='单账户持仓名义价值上限');if(!data['市场持仓上限开关'])list=list.filter(f=>M.clean(f.name)!=='市场持仓名义价值上限');}if(g==='RC03'&&!data['主账户组持仓限制'])list=list.filter(f=>!['主账户组多头名义价值上限','主账户组空头名义价值上限'].includes(M.clean(f.name)));return list;}
  function staticGrid(g,rows){return `<div class="cm-grid" data-spec-group="${g}">${rows.map(([name,value])=>`<div class="cm-detail-field" data-spec-field="${esc(name)}"><span>${esc(name)}</span><div>${value}</div></div>`).join('')}</div>`;}
  function grid(g,m,values){return `<div class="cm-grid" data-spec-group="${g}">${detailFields(g,0,m,values).map(f=>`<div class="cm-detail-field" data-spec-field="${esc(M.clean(f.name))}"><span>${esc(detailLabel(g,f.name))}</span><div>${values?esc(values[M.clean(f.name)]??'--'):display(configValue(m,g,f),f,m)}</div></div>`).join('')}</div>`;}
  function renderGroup(g,m){const title=`<div class="cm-section-head"><h2>${esc(groupTitle(g))}</h2><div class="cm-actions"><small>${m.updated} UTC+8</small>${M.configGroups.includes(g)?button('编辑配置','edit-group',`data-group="${g}"`):''}</div></div>`;if(M.configGroups.includes(g)){let html=grid(g,m);if(g==='CM23'||g==='CM24')html+=renderSourcesBinding(m,g,false);if(g==='CM18')html+=`<div style="margin-top:16px">${button('资金费计算预览','funding-preview')}</div>`;if(g==='CM25')html+=renderTable('CM25-components',m,M.fields('CM25',1),componentRows(m),'none');return title+html;}
    if(g==='CM06')return title+renderTable(g,m,M.fields(g),['市场交易','上线／下线','客户端可见性'].map((kind,i)=>({'管理项':kind,'当前值':[m.trade,m.lifecycle,m.config.CM05['客户端可见']][i],'最近变更时间':m.updated,'最近操作原因':m.events[0]?.reason||'初始配置','__action':'state'})),'none',true);
    if(g==='CM07')return title+staticGrid('CM07-lifecycle',[
      ['创建时间',esc(m.created||(m.version?'2026-08-19 14:22:31':'--'))],
      ['计划上线时间',esc(m.pending?.scheduled?date(m.pending.scheduled):'--')],
      ['实际上线时间',esc(m.opened||'--')],
      ['当前配置版本',esc(m.version?'V'+m.version:'--')],
      ['最近修改时间',esc(m.updated+' UTC+8')],
      ['上线状态',tag(m.lifecycle)]
    ])+renderTable(g,m,M.fields(g),M.steps.map(s=>({'配置分组':s[0],'有效版本':'V'+m.version,'生效时间':m.updated,'待生效版本':m.pending?'V'+(m.version+1):'--','计划生效时间':m.pending?.scheduled?date(m.pending.scheduled):'--','生效状态':m.pending?.status||'已生效','__action':'version'})),'none',true);
    if(g==='CM10')return title+tiersTable(m,false)+`<div style="margin-top:14px">${button('编辑档位','edit-group','data-group="CM10"')}${button('计算预览','group','data-group="CM11"')}</div>`;
    if(g==='CM11')return title+'<form id="cmMarginPreview" class="cm-form-grid"><div class="cm-field"><label>预览配置版本</label><select class="control" name="version"><option value="current">当前有效 V'+m.version+'</option>'+(m.draft?'<option value="draft">未发布草稿</option>':'')+m.history.filter(h=>h.version!==m.version).map(h=>'<option value="'+h.version+'">历史 V'+h.version+'</option>').join('')+'</select></div><div class="cm-field"><label>持仓名义价值</label><div class="cm-input-unit"><input name="notional" type="number" min="0" value="200000" required><span>'+m.quote+'</span></div></div><div class="cm-field"><label>适用杠杆</label><div class="cm-input-unit"><input name="leverage" type="number" min="1" value="10" required><span>倍</span></div></div></form><div style="margin:16px 0">'+button('计算','calculate-margin','',true)+' '+button('重置','reset-margin')+'</div><div id="cmMarginResult">'+grid('CM11',m,{'预览配置版本':'当前有效 V'+m.version,'持仓名义价值':'200,000 '+m.quote,'适用杠杆':'10x','命中档位':'--','初始保证金':'--','维持保证金率':'--','维持保证金速算额':'--','维持保证金':'--','校验结果':'待计算'})+'</div>';
    if(g==='CM22'||g==='CM17')return title+grid(g,m,snapshotValues(g,m));
    if(g==='CM26')return title+renderTable(g,m,M.fields(g),quoteRows(m),'quotes');
    if(g==='CM31')return title+renderChanges(m);
    return title+recordSurface(g,m);
  }
  function snapshotValues(g,m){const price=m.quality==='不可用'?'--':fmt(m.price,1)+' '+m.quote+'/'+m.base;const stamp=m.updated+' UTC+8';const rows={};for(const f of M.fields(g)){const n=f.name;if(/价格|价及|中间价/.test(n))rows[n]=price;else if(/时间|窗口/.test(n))rows[n]=stamp;else if(/数量|采样数/.test(n))rows[n]='3';else if(/状态/.test(n))rows[n]=m.quality;else if(/费率|溢价/.test(n))rows[n]='0.00125%';else if(/版本/.test(n))rows[n]='PRICE-V1';else rows[n]='--';}Object.assign(rows,{'当前降级路径':m.quality==='正常'?'三分量中位数':m.quality==='降级'?'两分量加辅助中位数':'不可用','有效主要分量数量':m.quality==='正常'?'3':m.quality==='降级'?'2':'0','预言机有效源数量':'3 / 3','外部市场有效源数量':'3','辅助分量状态':'有效','不可用原因':m.quality==='不可用'?'来源数据过期':'--','预计支付方向':'多头支付空头','有效采样数':'5,760','下一结算时间':'2026-09-10 11:00:00 UTC+8'});return rows;}
  function tiersTable(m,edit){const tiers=edit?state.editor.draft.tiers:m.tiers;let computed;try{computed=M.tierValues(tiers);}catch(_){computed=tiers.map(t=>({...t,lower:'--',deduction:'--',imr:'--'}));}return `<div class="cm-table-scroll"><table class="cm-table" data-spec-group="CM10"><thead><tr><th>档位</th><th>名义价值下限（${m.quote}）</th><th>名义价值上限（${m.quote}）</th><th>档位最大杠杆${edit?'（倍）':''}</th><th>最低初始保证金率</th><th>维持保证金率${edit?'（%）':''}</th><th>维持保证金速算额（${m.quote}）</th>${edit?'<th>操作</th>':''}</tr></thead><tbody>${computed.map((t,i)=>`<tr><td>${i+1}</td><td>${esc(t.lower)}</td><td>${edit?`<input class="control" type="number" min="0" data-tier="${i}" data-key="upper" value="${esc(t.upper)}" placeholder="无上限" aria-label="第${i+1}档名义价值上限">`:esc(t.upper||'无上限')}</td><td>${edit?`<input class="control" type="number" min="1" data-tier="${i}" data-key="leverage" value="${t.leverage}" aria-label="第${i+1}档最大杠杆">`:t.leverage+'x'}</td><td>${esc(t.imr)}%</td><td>${edit?`<input class="control" type="number" min="0" step="any" data-tier="${i}" data-key="mmr" value="${t.mmr}" aria-label="第${i+1}档维持保证金率">`:t.mmr+'%'}</td><td>${esc(t.deduction)}</td>${edit?`<td>${tool('删除档位','remove-tier','trash-2',`data-index="${i}" ${tiers.length===1?'disabled':''}`)}</td>`:''}</tr>`).join('')}</tbody></table></div>${edit?`<div style="margin-top:10px">${button('增加档位','add-tier')}</div>`:''}`;}
  function renderSourcesBinding(m,g,edit){
    const key=g==='CM23'?'oracle':'external',all=edit?state.editor.draft[key]:m[key],filterKey=g+'-bindings',q=state.queries[filterKey]||{};
    const bindings=edit?all:all.filter(b=>(!q.keyword||((sourceById(b.source)?.name||'')+b.pair).toLowerCase().includes(q.keyword.toLowerCase()))&&(!q.enabled||(b.enabled?'启用':'停用')===q.enabled));
    const create=edit&&isCreateEditor();
    const weightHead=create?'配置权重':'参与权重';
    const mapHead=create?'关联校验':'映射检查结果';
    return `<h3 style="margin:20px 0 12px">来源明细</h3>${edit?'':`<form class="cm-search-filters" data-record-form="${filterKey}"><input class="control" name="keyword" value="${esc(q.keyword||'')}" placeholder="来源 / 映射交易对" aria-label="来源明细关键字"><select class="control" name="enabled" aria-label="来源启用状态"><option value="">全部启用状态</option><option ${q.enabled==='启用'?'selected':''}>启用</option><option ${q.enabled==='停用'?'selected':''}>停用</option></select>${button('查询','query-record','data-key="'+filterKey+'"',true)}${button('重置','reset-record','data-key="'+filterKey+'"')}</form>`}<div class="cm-table-scroll"><table class="cm-table" data-spec-group="${g}-sources"><thead><tr><th>价格源名称</th><th>来源类别</th><th>接入范围</th><th>支持能力</th><th>来源市场类型</th><th>来源交易对</th><th>${weightHead}</th><th>启用状态</th><th>${mapHead}</th><th>操作</th></tr></thead><tbody>${bindings.map((r,i)=>{
      const s=sourceById(r.source),options=M.sourcePairOptions(s,m.base,m.quote,key),matched=options.includes(r.pair)&&!M.sourceInstrumentError(s,r,m.base,m.quote,key);
      const catalogue=s?priceEngine.catalogue.get(s):null;
      const entry=s?priceEngine.catalogue.resolve(s,r)||catalogue?.entries.find(e=>e.pair===r.pair):null;
      const label=s?(s.name+(s.planName?' · '+s.planName:'')):'未知来源';
      const placeholder=!s?'请先选择价格源':!m.base||m.base==='NEW'?'请先选择标的资产':catalogue.status==='失败'?'目录读取失败':!catalogue.version?'目录尚未同步':!options.length?'无可用交易对':'请选择交易对';
      const selection=`<div class="cm-actions"><select class="control" data-binding="${key}" data-index="${i}" data-key="pair" aria-label="来源交易对" ${!options.length?'disabled':''}><option value="" ${!matched?'selected':''} disabled>${placeholder}</option>${options.map(p=>`<option value="${esc(p)}" ${matched&&p===r.pair?'selected':''}>${esc(p)}</option>`).join('')}</select>${s&&!options.length&&m.base!=='NEW'?tool('同步行情目录','sync-initial-catalogue','refresh-cw',`data-source="${esc(s.id)}"`):''}</div>`;
      const check=!s||catalogue?.status==='失败'?'目录失效':!matched?(!r.pair&&!options.length?'未匹配':!r.pair?'未选择':'未匹配'):'通过';
      return `<tr><td>${edit?`<select class="control" data-binding="${key}" data-index="${i}" data-key="source">${state.sources.map(x=>`<option value="${x.id}" ${r.source===x.id?'selected':''}>${esc(x.name+(x.planName?' · '+x.planName:''))}</option>`).join('')}</select>`:`<button class="btn-link" data-cm-action="source-detail" data-id="${r.source}">${esc(label)}</button>`}</td><td>${esc(s?.category||'--')}</td><td>${esc(s?.scope||s?.type||'--')}</td><td>${esc((s?.capabilities||[]).join(' / ')||'--')}</td><td>${esc(entry?.type||(!r.pair?'未选择':'--'))}</td><td>${edit?selection:esc(r.pair)}</td><td>${edit?`<input class="control" type="number" min="0" step="any" data-binding="${key}" data-index="${i}" data-key="weight" value="${r.weight}" aria-label="${weightHead}">`:r.weight}</td><td>${edit?`<input class="cm-switch" type="checkbox" data-binding="${key}" data-index="${i}" data-key="enabled" ${r.enabled?'checked':''} aria-label="启用来源">`:tag(r.enabled?'启用':'停用')}</td><td>${tag(create?check:(!matched?'未匹配':s?.healthy&&s?.enabled?'支持':'不可用'))}</td><td>${edit?tool('移除来源','remove-binding','trash-2',`data-key="${key}" data-index="${i}"`):`<button class="btn-link" data-cm-action="source-detail" data-id="${r.source}">查看来源</button>`}</td></tr>`;
    }).join('')||'<tr><td colspan="10"><div class="cm-empty">暂无关联来源</div></td></tr>'}</tbody></table></div>${edit?`<div style="margin-top:10px">${button('关联来源','add-binding',`data-key="${key}"`)}</div>`:''}`;
  }
  function componentRows(m){return ['X1','X2','X3','X4'].map((x,i)=>({'分量名称':x+' '+['预言机价加溢价EMA','本地价格中位数','外部市场中间价','辅助EMA'][i],'分量角色':i===3?'辅助':'主要','当前价格':new D(m.price).plus(i*.1).toString(),'输入摘要':i===2?'Binance / OKX / Bybit':'价格快照 V1','形成时间':m.updated,'有效状态':m.quality==='不可用'?'无效':'有效','无效原因':m.quality==='不可用'?'报价过期':'--','是否参与本次计算':i===3?'否':'是'}));}
  function quoteRows(m){return ['oracle','external'].flatMap(key=>m[key].map((b,i)=>{const s=sourceById(b.source);return {'来源名称':s?.name,'用途':key==='oracle'?'预言机':'外部市场','来源交易对':b.pair,'最新报价':m.price,'最优买价／最优卖价':`${m.price} / ${new D(m.price).plus('.1')}`,'盘口中间价':new D(m.price).plus('.05').toString(),'权重':b.weight,'全局／合约启用状态':`${s?.enabled?'启用':'停用'} / ${b.enabled?'启用':'停用'}`,'运行状态':s?.healthy?'正常':'异常','报价生成时间':m.updated,'接收时间':m.updated,'报价年龄':String(i+.2),'有效状态及排除原因':b.enabled&&s?.enabled?'有效':'停用','聚合结果':m.price};}));}
  function recordRows(g,m){if(m.empty)return [];const count=47;const accts=accounts();return Array.from({length:count},(_,i)=>{const a=accts[i%accts.length],qty=new D(i+1).div(100),px=new D(m.price).mul(new D(1).plus(new D(i%5).div(1000))),time=new Date(Date.UTC(2026,8,10,2,40)-i*3600000).toISOString();const v={'账户地址':a.wallet,'账户类型':a.type==='MAIN'?'主账户':'子账户','合约':m.code,'保证金模式':'全仓','方向':i%2?'卖出':'买入','持仓方向':i%2?'空':'多','清算方向':i%2?'空':'多','结算仓位方向':i%2?'空':'多','订单类型':i%3?'限价':'市价','有效方式':i%3?'GTC':'IOC','只减仓':i%3?'否':'是','订单编号':m.code+'-ORD-'+String(1000+i),'成交编号':m.code+'-FILL-'+String(2000+i),'清算编号':m.code+'-LIQ-'+String(3000+i),'结算周期编号':m.code+'-FUND-'+String(4000+i),'创建时间':date(time),'完成时间':date(new Date(new Date(time).getTime()+30000)),'委托时间':date(time),'成交时间':date(time),'清算时间':date(time),'触发时间':date(time),'最近更新时间':date(time),'结算时间':date(time),'入账时间':date(time),'数据更新时间':m.updated,'规则版本':'V1','费率版本':'FEE-V1','资金费配置版本':'FUND-V1','杠杆':'10','持仓数量':qty.toString(),'结算仓位数量':qty.toString(),'委托数量':qty.toString(),'已成交数量':qty.div(2).toString(),'成交数量':qty.toString(),'剩余数量':qty.div(2).toString(),'清算数量':qty.toString(),'尝试后剩余仓位':'0','剩余仓位':'0','开仓均价':px.toString(),'标记价格':m.price,'委托价格':i%3?px.toString():'市价','成交均价':px.toString(),'成交价格':px.toString(),'清算价格':px.toString(),'清算均价':px.toString(),'结算预言机价格':m.price,'预估强平价格':px.mul('.82').toString(),'名义价值':qty.mul(px).toString(),'成交价值':qty.mul(px).toString(),'委托价值／成交价值':`${qty.mul(px).toFixed(2)} / ${qty.mul(px).div(2).toFixed(2)}`,'保证金':qty.mul(px).div(10).toString(),'维持保证金':qty.mul(px).mul('.01').toString(),'未实现盈亏':String((i%2?-1:1)*(i+1)*4.2),'已实现盈亏':String((i%2?-1:1)*(i+1)*2.2),'清算损益':String(-(i+1)*4.8),'手续费':qty.mul(px).mul(i%2?'.00015':'.00045').toString(),'账户保证金率':'12.5','保证金率':'12.5','未实现盈亏收益率':'2.4','委托收益率':'1.2','累计资金费':'-3.20','账户风险状态':i%8?'正常':'预警','仓位风险状态':i%8?'正常':'预警','仓位交易状态':'可交易','订单状态':g==='CM28'?(i%2?'开放中':'部分成交'):['已成交','已撤销','部分成交后取消','已过期'][i%4],'订单来源':i%9?'用户':'强平','成交来源':i%9?'普通':'强平','止盈止损':'--','终态原因':i%4?'用户撤单':'--','自成交保护取消对手':'否','Maker/Taker':i%2?'Maker':'Taker','实际适用费率':i%2?'0.015':'0.045','费率来源':'基础交易量阶梯','适用费率等级':'Tier 0','Maker返佣等级':'未达标','等级快照编号':'FEE-SNAPSHOT-0910','触发时账户权益':'1200','触发时维持保证金':'1300','尝试次数':'1 / 3','处理状态':i%3?'已结束':'处理中','路由结果':i%3?'停止清算':'继续分批强平','采样开始／结束时间':date(time)+' / '+date(new Date(new Date(time).getTime()+3600000)),'有效采样数':'5760','平均溢价率':'0.002','结算资金费率':i%2?'0.00125':'-0.00125','结算费率':'0.00125','收付方向':i%2?'多支付空':'空支付多','采样状态':'有效','结算账户数':String(accts.length),'已完成／未完成账户数':i%3?accts.length+' / 0':(accts.length-1)+' / 1','应支付总额':fundingTotal(m),'应收取总额':fundingTotal(m),'已入账净额':i%3?'0':fundingAccountAmount(m,0).abs().toFixed(6),'舍入差额':'0','结算状态':i%3?'已完成':'部分失败','计划／完成时间':date(time)+' / '+date(new Date(new Date(time).getTime()+60000)),'资金费余额变化':i%2?'-0.2':'0.2','入账状态':i%7?'已入账':'失败','关联账本业务编号':'LEDGER-'+(5000+i),'失败原因':i%7?'--':'账本确认超时','__accountId':a.id,'__index':i};if(g==='CM27')v['方向']=i%2?'空':'多';return v;});}
  const hiddenRecordFields={CM19:['资金费配置版本'],CM28:['规则版本'],CM29:['规则版本'],CM30:['费率版本']};
  function recordSurface(g,m){const hidden=hiddenRecordFields[g]||[],fields=M.fields(g).filter(f=>!hidden.includes(M.clean(f.name))),rows=recordRows(g,m);return renderTable(g,m,fields,rows,'records',g==='CM14'||g==='CM20');}
  const queryFields={CM14:['账户类型','清算方向','处理状态','路由结果'],CM19:['收付方向','采样状态'],CM20:['结算状态'],CM21:['账户类型','收付方向','入账状态'],CM26:['用途','有效状态及排除原因'],CM27:['账户类型','方向','账户风险状态','仓位交易状态'],CM28:['账户类型','方向','订单类型','订单状态','订单来源'],CM29:['账户类型','方向','订单类型','订单状态','订单来源'],CM30:['账户类型','方向','Maker/Taker','成交来源'],CM31:['变更类型','配置分组／管理项','变更状态'],CM36:['用途','合约关联启用状态'],CM37:['变更类型','变更状态']};
  function filterRecords(key,rows){const q=state.queries[key]||{};return rows.filter(r=>{if(q.keyword&&!Object.values(r).join(' ').toLowerCase().includes(q.keyword.toLowerCase()))return false;for(const name of queryFields[key]||[])if(q[name]&&String(r[name])!==q[name])return false;const time=r['创建时间']||r['成交时间']||r['触发时间']||r['结算时间']||r['提交时间']||r['时间']||r['提交／计划／实际时间']||'';return(!q.from||time.slice(0,10)>=q.from)&&(!q.to||time.slice(0,10)<=q.to);});}
  function renderTable(key,m,fields,all,filter='records',withAction=false){
    tableCache[key]={m,fields,all};
    const q=state.queries[key]||{},rows=filter==='none'?all:filterRecords(key,all),size=filter==='none'?rows:slice(key,rows);
    const keywords={CM19:'结算周期编号',CM20:'结算周期编号',CM26:'来源 / 交易对',CM36:'合约 / 来源交易对',CM37:'变更单号 / 操作人'};
    let filters='';
    if(filter!=='none'){
      const controls=(queryFields[key]||[]).map(name=>{
        const options=[...new Set(all.map(r=>r[name]).filter(v=>v!=null&&v!=='--'))];
        return '<select class="control" name="'+esc(name)+'" aria-label="'+esc(name)+'"><option value="">全部'+esc(name)+'</option>'+options.map(v=>'<option '+(q[name]===String(v)?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>';
      }).join('');
      const dates=['CM14','CM19','CM20','CM29','CM30','CM31','CM37'].includes(key)?'<input class="control" type="date" name="from" value="'+esc(q.from||'')+'" aria-label="开始日期"><input class="control" type="date" name="to" value="'+esc(q.to||'')+'" aria-label="结束日期">':'';
      filters='<form class="cm-search-filters" data-record-form="'+key+'"><input type="search" class="control" name="keyword" value="'+esc(q.keyword||'')+'" aria-label="'+groupTitle(key)+'关键字" placeholder="'+(keywords[key]||'账户地址 / 业务编号')+'">'+controls+dates+button('查询','query-record','data-key="'+key+'"',true)+button('重置','reset-record','data-key="'+key+'"')+tool('导出当前结果','export-record','download','data-key="'+key+'"')+'</form>';
    }
    const actionCell=r=>{
      const action=r.__action==='state'?'operations':r.__action==='version'?'versions':r.__event?'change-detail':key==='CM14'?'liquidation-detail':'funding-detail';
      return '<td class="cm-last"><button class="btn-link" data-cm-action="'+action+'" data-event="'+esc(r.__event||'')+'" data-index="'+(r.__index||0)+'">'+(r.__action==='state'?'调整':'查看详情')+'</button></td>';
    };
    return filters+'<div class="cm-table-scroll"><table class="cm-table" data-spec-group="'+key+'"><thead><tr>'+fields.map((f,i)=>'<th class="'+(i===0?'cm-sticky':'')+'" data-spec-field="'+esc(f.name)+'">'+esc(tableHeader(f,m))+'</th>').join('')+(withAction?'<th class="cm-last">操作</th>':'')+'</tr></thead><tbody>'+(
      size.map(r=>'<tr>'+fields.map((f,i)=>'<td class="'+(i===0?'cm-sticky':'')+'">'+recordCell(key,m,r,f)+'</td>').join('')+(withAction?actionCell(r):'')+'</tr>').join('')||
      '<tr><td colspan="'+(fields.length+(withAction?1:0))+'"><div class="cm-empty">暂无匹配数据</div></td></tr>'
    )+'</tbody></table></div>'+(filter==='none'?'':pager(key,rows.length));
  }
  function recordCell(g,m,r,f){const n=M.clean(f.name),v=r[n]??'--';if(n==='合约'&&g==='CM36'){const target=state.markets.find(x=>x.code===v);return target?'<button class="btn-link" data-cm-action="nav" data-route="#contracts/'+target.id+'/prices/CM23">'+esc(v)+'</button>':esc(v);}if(n==='变更单号')return '<button class="btn-link" data-cm-action="change-detail" data-event="'+esc(v)+'">'+esc(v)+'</button>';if(n==='关联订单编号')return '<button class="btn-link" data-cm-action="order-jump" data-order="'+esc(v)+'">'+esc(v)+'</button>';if(n==='账户地址')return `<div class="cm-inline-id"><button class="btn-link mono" data-cm-action="account" data-id="${r.__accountId}">${short(v)}</button>${tool('复制地址','copy','copy',`data-copy="${v}"`)}</div>`;if(n==='订单编号')return `<button class="btn-link mono" data-cm-action="order-jump" data-order="${esc(v)}">${esc(v)}</button>`;if(n==='清算编号'||n==='结算周期编号')return `<button class="btn-link mono" data-cm-action="${n==='清算编号'?'liquidation-detail':'funding-detail'}" data-index="${r.__index||0}">${esc(v)}</button>`;if(/状态/.test(n))return tag(v);if(/盈亏|损益|手续费|余额变化/.test(n)&&/^-?[\d.]+$/.test(v))return `<span class="${Number(v)<0?'negative':Number(v)>0?'positive':''}">${fmt(v,/手续费|余额变化/.test(n)?6:2)}</span>`;return display(v,f,m,true);}
  function renderChanges(m){
    const rows=m.events.map(e=>({'变更单号':e.id,'合约／价格源':m.code,'变更类型':e.kind,'配置分组／管理项':e.changes[0]?groupTitle(e.changes[0].group):'生命周期','变更前版本／状态':e.from,'变更后版本／目标状态':e.to,'操作原因':e.reason,'申请人':e.operator,'复核人':e.status==='已生效'?'风控复核员':'--','变更状态':e.status,'提交时间':e.time,'计划生效时间':e.scheduled?date(e.scheduled):'--','实际生效时间':e.applied||'--','失败原因':e.failure||'--','__event':e.id}));
    return renderTable('CM31',m,M.fields('CM31'),rows,'records',true);
  }
  function visibleChange(c){const name=M.clean(c.name);if(detailFieldNames[c.group])return detailFieldNames[c.group].includes(name);if(c.group==='CM10')return true;if(c.group==='CM18')return M.createRole('CM18',name)==='primary'||M.createRole('CM18',name)==='auto'||M.createRole('CM18',name)==='advanced';if(c.group==='CM23')return name==='Pyth喂价配置';if(c.group==='CM24')return name==='外部市场来源明细';return !M.configGroups.includes(c.group);}
  function dialog(title,body,footer='',wide=false){$('#toast').classList.remove('show');lastFocus=document.activeElement;overlay.hidden=false;overlay.innerHTML=`<div class="cm-dialog ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="cmDialogTitle"><div class="cm-dialog-header"><h2 id="cmDialogTitle">${esc(title)}</h2>${tool('关闭','close-dialog','x')}</div><div class="cm-dialog-body">${body}</div>${footer?`<div class="cm-dialog-footer">${footer}</div>`:''}</div>`;refreshIcons();$('button,input,select',overlay)?.focus();}
  function closeDialog(){if(window.ContractPrototype?.priceUI.canClose()===false)return;overlay.hidden=true;dialogContext=null;lastFocus?.focus?.();window.ContractPrototype?.priceUI.dismiss();}
  function feeDialog(){const tiers=[['0','基础档','0.015%','0.045%'],['1','> 5,000,000','0.012%','0.040%'],['2','> 25,000,000','0.008%','0.035%'],['3','> 100,000,000','0.004%','0.030%'],['4','> 500,000,000','0%','0.028%'],['5','> 2,000,000,000','0%','0.026%'],['6','> 7,000,000,000','0%','0.024%']];dialog('平台公共永续手续费规则',`<div class="cm-section-head"><span>FEE-V1 · 已生效</span><span class="muted">14天加权交易量 · 主子账户合并</span></div><div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>等级</th><th>交易量门槛（USD）</th><th>Maker费率</th><th>Taker费率</th></tr></thead><tbody>${tiers.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')}</tbody></table></div><h3 style="margin:20px 0 12px">Maker返佣</h3><div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>等级</th><th>Maker交易量占比</th><th>Maker费率</th></tr></thead><tbody><tr><td>M1</td><td>&gt; 0.5%</td><td>-0.001%</td></tr><tr><td>M2</td><td>&gt; 1.5%</td><td>-0.002%</td></tr><tr><td>M3</td><td>&gt; 3%</td><td>-0.003%</td></tr></tbody></table></div>`);}
  function formField(m,g,f){
    const create=isCreateEditor(),def=M.definition(g,f,m,{create:true,editing:!create,draft:state.editor.draft});
    const name=def.name,label=M.createLabel(g,name),error=state.editor.errors.find(e=>e.group===g&&e.field===name);
    const pending=m.base==='NEW'&&(['base','quote','settle','price'].includes(f.unit)||['价格展示精度','数量展示精度'].includes(name));
    const value=pending?'':configValue(m,g,f,state.editor.draft);
    const immutable=m.version>0&&g==='CM05'&&['合约代码','合约类型','标的资产','计价资产','结算资产'].includes(name);
    const attrs=`data-config-group="${g}" data-config-field="${esc(name)}" aria-label="${esc(label)}" ${pending?'disabled':''}`;
    let control;
    if(!def.editable||immutable)control=`<div class="cm-readonly" data-readonly-field="${esc(name)}">${pending?'待选择标的':display(value,f,m)}</div>`;
    else if(name==='图标')control='<input class="control" type="file" accept="image/png,image/jpeg,image/webp" data-contract-image aria-label="合约图标">'+(String(value).startsWith('data:image/')?'<img src="'+esc(value)+'" alt="合约图标" width="38" height="38">':'');
    else if(def.type==='toggle')control=`<input class="cm-switch" type="checkbox" ${attrs} ${value?'checked':''}>`;
    else if(def.type==='multi')control=`<div class="cm-checkboxes">${def.options.map(o=>`<label><input type="checkbox" ${attrs} data-option="${o}" ${(Array.isArray(value)?value:[]).includes(o)?'checked':''}>${esc(o)}</label>`).join('')}</div>`;
    else if(def.type==='select')control=`<select class="control" ${attrs}>${!def.options.includes(String(value))?'<option value="" selected disabled>待选择有效选项</option>':''}${def.options.map(o=>`<option value="${esc(o)}" ${String(value)===o?'selected':''}>${esc(o||'无')}</option>`).join('')}</select>`;
    else if(def.type==='textarea')control=`<textarea class="control" rows="3" ${attrs}>${esc(value)}</textarea>`;
    else if(def.type==='number') {
      const suffix=g==='CM18'&&name==='固定利率项 I'?'% / '+state.editor.draft.config.CM18['利率基准周期']+'小时':g==='CM18'&&name==='单次费率绝对值上限 cF'?'% / '+state.editor.draft.config.CM18['结算周期']+'小时':def.unit;
      control=`<div class="cm-input-unit"><input type="number" step="any" ${attrs} value="${esc(value)}"><span>${esc(suffix)}</span></div>`;
    } else control=`<input class="control" type="${def.type}" ${attrs} value="${esc(value)}">`;
    return `<div class="cm-field" data-spec-field="${esc(f.name)}" aria-invalid="${!!error}"><label>${esc(label)} ${def.required&&!immutable?'<span class="required">*</span>':''}</label>${control}${error?'<div class="cm-field-error">'+esc(error.message)+'</div>':''}</div>`;
  }
  function startEditor(id,group){if(!canWrite())return;let m=id?state.markets.find(x=>x.id===id):M.newMarket('NEW');if(!m)return;state.marketId=m.id;const draft=m.draft?M.clone(m.draft):M.snapshot(m);if(!id){draft.config.PYTH=B.initial();draft.oracle=[];draft.external=[];pyth.context(m).scenario='正常';pyth.invalidate(m);draft.config.CM05['合约代码']='';draft.config.CM05['合约名称']='';draft.config.CM05['标的资产']='';draft.config.CM05['客户端可见']='隐藏';draft.config.CM05['展示标签']=[];draft.config.CM05['首页推荐']=false;draft.config.CM05['风险提示开关']=false;draft.config.CM05['提示类型']='一般风险';draft.config.CM05['提示展示方式']='立即展示';m.version=0;m.trade='不适用';m.lifecycle='草稿';m.empty=true;m.activeOrders=0;m.positions=0;m.opened='';m.created='';for(const g of M.configGroups)for(const k of Object.keys(draft.config[g]||{}))if(M.isRuntimeFact(k))draft.config[g][k]='--';draft.config.RC11['准入状态与原因']='未校验';draft.config.RC10['当前有效权重占比']='--';draft.config.RC10['配置权重占比']='--';}let step=group?M.steps.findIndex(s=>s[1].includes(group)):0;if(step<0)step=0;state.editor={market:M.clone(m),origin:id?m:null,draft,existing:!!id,step,dirty:false,errors:[],advanced:{},prechecked:false};root.hidden=false;$('#listPage').classList.remove('active');$('#detailPage').classList.remove('active');if(B.isLocal(draft))pyth.syncExternal(state.editor.market,draft);renderEditor();}
  const createHints=['选择已登记标的与计价资产。合约代码、类型和结算规则由系统生成；客户端展示默认折叠。保存后不会立即开放交易。','填写价格/数量步长与委托上下限。订单容量限制和异常订单监控采用系统默认策略，不进入新增表单。','最大杠杆为合约总上限，可配置；各档杠杆不得超过该上限且升档不得增加。默认杠杆为用户初始偏好，须落在允许范围内。','直接配置账户、主账户组与市场限额，以及核心强平保护。集中度、价格异常、流动性、压力观察和预算等策略在详情或公共风控模块承载。','配置当前合约的Maker费率、Taker费率与收费币种。手续费方案和交易量分级不进入新增表单。','结算周期、单次资金费率上限和冲击名义金额可按品种配置；其余参数读取系统默认值。','预言机基础信息直接展示Feed、报价单位、报价时效与置信区间阈值；外部盘口只维护来源与行情映射。'];
  function splitCreateFields(g,draft){
    const groups={primary:[],auto:[],advanced:[]};
    for(const f of M.fields(g)){
      const role=M.createRole(g,M.clean(f.name),draft,!isCreateEditor());
      if(role!=='hidden')(groups[role]||groups.primary).push(f);
    }
    return groups;
  }
  function renderCreateGroup(g,m){
    if(g==='CM10')return `<h3>保证金档位</h3>${tiersTable(m,true)}`;
    const {primary,auto,advanced}=splitCreateFields(g,state.editor.draft);
    if(!primary.length&&!auto.length&&!advanced.length&&g!=='CM23'&&g!=='CM24')return '';
    const open=state.editor.advanced?.[g]?' open':'';
    if(!primary.length&&advanced.length)return `<details class="cm-advanced" data-advanced="${g}"${open}><summary>${esc(groupTitle(g))}</summary>${auto.length?`<div class="cm-summary-grid">${auto.map(f=>formField(m,g,f)).join('')}</div>`:''}<div class="cm-form-grid">${advanced.map(f=>formField(m,g,f)).join('')}</div></details>`;
    let html=`<h3>${esc(groupTitle(g))}</h3>`;
    if(primary.length)html+=`<div class="cm-form-grid" data-spec-group="${g}">${primary.map(f=>formField(m,g,f)).join('')}</div>`;
    if(auto.length)html+=`<div class="cm-summary-grid" data-spec-group="${g}-auto">${auto.map(f=>formField(m,g,f)).join('')}</div>`;
    if(advanced.length)html+=`<details class="cm-advanced" data-advanced="${g}"${open}><summary>高级配置</summary><div class="cm-form-grid">${advanced.map(f=>formField(m,g,f)).join('')}</div></details>`;
    if(g==='CM23'||g==='CM24')html+=renderSourcesBinding(m,g,true);
    return html;
  }
  function renderEditor(){
    const e=state.editor,m=e.market,create=isCreateEditor();
    $('#breadcrumb').textContent=e.existing?m.code+' / 编辑配置':'新增合约';
    const body=e.step===6
      ? (B.is(e.draft)?pythUI.form(m,e.draft,renderCreateGroup('CM25',m)):pythUI.legacy('CM22',m)+renderCreateGroup('CM25',m))
      : M.steps[e.step][1].map(g=>renderCreateGroup(g,m)).join('');
    root.innerHTML=`<div class="cm-heading"><div><h1>${create?'新增合约':'编辑合约配置'}</h1><div class="cm-heading-sub">${create?(m.base==='NEW'?'未保存草稿':esc(e.draft.config.CM05['合约代码'])+' · 未上线'):esc(m.code)+' · V'+m.version}${e.dirty?' · 未保存':''}</div></div><div class="cm-actions">${button('返回','nav','data-route="'+(e.existing?'#contracts/'+m.id:'#contracts')+'"')}${button('保存草稿','save-draft')}</div></div>${e.errors.length?`<div class="cm-notice danger">${e.errors.length}项配置未通过检查 <button class="btn-link" data-cm-action="precheck">查看检查结果</button></div>`:''}<div class="cm-form-layout"><div class="cm-step-nav">${M.steps.map((s,i)=>`<button class="cm-step ${i===e.step?'active':''}" data-cm-action="editor-step" data-step="${i}">${i+1}. ${s[0]}</button>`).join('')}</div><div class="cm-form-body">${body}</div><div class="cm-form-footer"><div class="cm-actions">${button('上一步','editor-step',`data-step="${e.step-1}" ${e.step===0?'disabled':''}`)}${button('下一步','editor-step',`data-step="${e.step+1}" ${e.step===M.steps.length-1?'disabled':''}`)}</div><div class="cm-actions">${button('配置预检','precheck')}${button('保存草稿','save-draft')}${button(create?'保存配置':'提交发布','prepare-publish','',true)}</div></div></div>`;
    refreshIcons();
  }
  function syncBindingPair(row,key,m){
    const s=sourceById(row.source),entries=M.sourceInstrumentOptions(s,m.base,m.quote,key);
    const entry=entries.find(e=>e.pair===row.pair) || (entries.length===1?entries[0]:null);
    if(entry)priceEngine.selectInstrument(row,entry,m.quote);
    else {row.pair='';delete row.catalogueId;delete row.catalogueVersion;delete row.catalogueEntryVersion;delete row.rule;}
  }
  function syncMetadata(){
    const e=state.editor,b=e.draft.config.CM05,prevBase=e.market.base,prevQuote=e.market.quote,prior=prevBase+prevQuote,feeWasFollowing=e.draft.config.CM16['收费币种']===prevQuote;
    e.market.base=String(b['标的资产']||'').toUpperCase()||'NEW';
    e.market.quote=b['计价资产']||'USDC';
    b['结算资产']=e.market.quote;
    e.market.settle=e.market.quote;
    if(!e.market.version){
      const prevCode=(prevBase&&prevBase!=='NEW'?prevBase:'')+(prevQuote||'');
      const nextCode=e.market.base==='NEW'?'':e.market.base+e.market.quote;
      if(!e.existing||!b['合约代码']||b['合约代码']===prevCode)b['合约代码']=nextCode;
      e.market.code=b['合约代码'];
      const prevName=(!prevBase||prevBase==='NEW'?'NEW':prevBase)+' / '+(prevQuote||'USDC')+' 永续';
      const nextName=e.market.base==='NEW'?'':e.market.base+' / '+e.market.quote+' 永续';
      if(!b['合约名称']||b['合约名称']===prevName||b['合约名称']==='NEW / USDC 永续')b['合约名称']=nextName;
      if(prevBase!==e.market.base&&e.market.base!=='NEW'){
        const tpl=M.assetTemplate(e.market.base);
        Object.assign(e.draft.config.CM08,tpl.trade);
        e.draft.config.CM18['冲击名义金额']=tpl.impact;
      }
    }
    const trade=e.draft.config.CM08;
    for(const [step,precision] of [['价格步长','价格展示精度'],['数量步长','数量展示精度']]){
      const digits=M.decimalsFromStep(trade[step]);
      if(!e.market.version||digits===''||Number(trade[precision])<Number(digits))trade[precision]=digits;
    }
    e.draft.config.CM13['标记价格交易时效']=trade['标记价格交易时效'];
    if(feeWasFollowing||!['USDC','USDT'].includes(e.draft.config.CM16['收费币种']))e.draft.config.CM16['收费币种']=e.market.settle;
    e.draft.config.RC08['关联保险基金']=e.draft.config.CM13['保险基金关联账户'];
    if(B.is(e.draft)){B.sync(e.market,e.draft);pyth.syncExternal(e.market,e.draft);}
    if(!e.market.version&&prior!==e.market.base+e.market.quote)for(const key of ['oracle','external'])for(const row of e.draft[key])syncBindingPair(row,key,e.market);
  }
  function saveDraft(silent=false){const e=state.editor;if(!e||!canWrite())return null;syncMetadata();const b=e.draft.config.CM05,iconMissing=!e.market.version&&!String(b['图标']||'').startsWith('data:image/');if(!/^[A-Z0-9]{3,24}$/.test(b['合约代码']||'')||!String(b['合约名称']||'').trim()||iconMissing){e.errors=[{group:'CM05',field:!b['合约名称']?'合约名称':!/^[A-Z0-9]{3,24}$/.test(b['合约代码']||'')?'合约代码':'图标',message:iconMissing?'请上传合约图标':'填写唯一大写合约代码与合约名称后可保存'}];e.step=0;renderEditor();return null;}if(state.markets.some(m=>m.id!==e.market.id&&m.code===b['合约代码'])){toast('合约代码已存在');return null;}if(!e.existing){e.market.id='market-'+b['合约代码'].toLowerCase();e.market.code=b['合约代码'];e.market.config=M.clone(e.draft.config);e.origin=M.clone(e.market);state.markets.push(e.origin);e.existing=true;state.marketId=e.market.id;}e.origin.draft=M.clone(e.draft);if(!e.origin.version){e.origin.config=M.clone(e.draft.config);e.origin.code=b['合约代码'];e.origin.base=e.market.base;e.origin.quote=e.market.quote;e.origin.settle=e.market.settle;}if(!e.origin.created)e.origin.created=date(new Date());e.market.draft=M.clone(e.draft);e.dirty=false;persist();if(!silent){toast('草稿已保存');renderEditor();}return e.origin;}
  function precheck(show=true){
    const e=state.editor,m=e?e.market:current(),draft=e?e.draft:m.draft||M.snapshot(m);
    if(e){syncMetadata();e.prechecked=true;}
    const errors=M.validate(m,draft,state.sources,{create:!m.version});
    if(state.markets.some(x=>x.id!==m.id&&x.code===draft.config.CM05['合约代码']))errors.push({group:'CM05',field:'合约代码',message:'合约代码已存在'});
    if(m.version&&draft.baseRevision!==m.revision)errors.push({group:'CM05',field:'数据状态',message:'当前数据已变化，请刷新后重试'});
    if(m.positions&&Number.isFinite(Number(draft.config.CM09['最大杠杆']))&&new D(draft.config.CM09['最大杠杆']).lt(10))errors.push({group:'CM09',field:'最大杠杆',message:'存量账户预计超限，需先完成处理安排'});
    if(B.is(draft))pyth.capture(m,draft);
    if(e){e.errors=errors;if(show)renderEditor();}
    if(show){
      if(B.is(draft))pythUI.precheck(m,draft,errors);
      else dialog('配置预检',errors.length?'<ul>'+errors.map(x=>'<li>'+esc(x.field+'：'+x.message)+'</li>').join('')+'</ul>':'<div class="cm-notice success">配置预检通过</div>');
    }
    return errors;
  }
  function publication(){if(!canWrite())return;const e=state.editor;if(!e)return;if(isCreateEditor())return saveCreateConfig();if(precheck(false).length){renderEditor();precheck();return;}dialog('提交配置发布',`<form id="cmPublishForm"><div class="cm-field"><label>生效方式</label><select class="control" name="mode"><option value="now">即时生效</option><option value="scheduled">定时生效</option></select></div><div class="cm-field"><label>计划生效时间（UTC+8）</label><input class="control" type="datetime-local" name="scheduled"></div><div class="cm-field"><label>操作原因 <span class="required">*</span></label><textarea name="reason" required maxlength="200"></textarea></div><div class="cm-field"><label>生效结果</label><select class="control" name="outcome"><option value="success">各业务域确认成功</option><option value="failure">价格服务确认失败</option></select></div><div id="cmPublishError" class="cm-field-error"></div></form>`,button('取消','close-dialog')+button('确认发布','confirm-publish','',true));}
  function saveCreateConfig(){
    if(precheck(false).length){renderEditor();precheck();return;}
    dialog('保存合约配置','<div class="cm-grid"><div class="cm-detail-field"><span>校验结果</span><div>通过</div></div><div class="cm-detail-field"><span>保存后状态</span><div>已配置但未上线</div></div></div><details class="cm-debug"><summary>调试设置</summary><label for="createSaveOutcome">保存结果</label><select id="createSaveOutcome" class="control"><option value="success">成功</option><option value="failure">失败</option></select></details><div id="createSaveError" class="cm-field-error" role="alert"></div>',button('取消','close-dialog')+button('确认保存','confirm-create-save','',true));
  }
  function confirmCreateSave(){
    if(!canWrite()||!isCreateEditor())return;
    if(precheck(false).length){closeDialog();precheck();return;}
    if($('#createSaveOutcome')?.value==='failure'){$('#createSaveError').textContent='保存失败，当前输入及原草稿保留';return;}
    const m=saveDraft(true);if(!m){closeDialog();return;}
    const draft=M.clone(state.editor.draft),event=recordEvent(m,'参数','新增合约配置保存',M.differences(m,draft),'已生效');
    applySnapshot(m,draft,event);
    m.lifecycle='待上线';m.created=m.created||date(new Date());m.opened='';
    state.editor=null;persist();closeDialog();go('#contracts/'+m.id);toast('配置已保存，合约尚未上线');
  }
  function recordEvent(m,kind,reason,changes=[],status='已生效'){const event={id:'CHG-'+Date.now()+'-'+m.events.length,market:m.code,kind,from:'V'+m.version,to:'V'+(m.version+1),reason,status,time:date(new Date()),operator:state.role,changes};m.events.unshift(event);return event;}
  function applySnapshot(m,d,event){m.config=M.clone(d.config);m.tiers=M.clone(d.tiers);m.oracle=M.clone(d.oracle);m.external=M.clone(d.external);m.code=m.config.CM05['合约代码'];m.base=m.config.CM05['标的资产'];m.quote=m.config.CM05['计价资产'];m.settle=m.config.CM05['结算资产'];m.version++;m.revision++;m.updated=date(new Date());event.status='已生效';event.applied=m.updated;event.to='V'+m.version;m.history.push({version:m.version,time:m.updated,...M.snapshot(m)});m.pending=null;m.draft=null;}
  function confirmPublish(){
    if(!canWrite())return;
    const form=new FormData($('#cmPublishForm')),reason=String(form.get('reason')||'').trim(),scheduled=String(form.get('scheduled')||'');
    if(!reason||reason.length>200){$('#cmPublishError').textContent='请填写200字以内操作原因';return;}
    const at=scheduled?new Date(scheduled+':00+08:00'):null;
    if(form.get('mode')==='scheduled'&&(!at||Number.isNaN(at.getTime())||at<=new Date())){$('#cmPublishError').textContent='计划时间必须晚于当前时间';return;}
    if(precheck(false).length){closeDialog();precheck();return;}
    const m=saveDraft(true);if(!m)return;
    const draft=M.clone(state.editor.draft),event=recordEvent(m,'参数',reason,M.differences(m,draft),'待生效');
    event.scheduled=form.get('mode')==='scheduled'?at.toISOString():null;
    m.pending={...event,draft,outcome:form.get('outcome')};
    const failure=event.scheduled?null:processPending(m);
    state.editor=null;persist();closeDialog();go('#contracts/'+m.id+'/overview/CM05');toast(failure|| (event.scheduled?'配置已保存，等待计划时间':'配置已更新'));
  }
  function operationDialog(){
    if(!canWrite())return;
    const m=current();
    const field=(label,control,forOp='')=>'<div class="cm-field" '+(forOp?'data-for-operation="'+forOp+'"':'')+'><label>'+label+'</label>'+control+'</div>';
    dialog('状态与配置操作','<div class="cm-grid">'+[['上线状态',m.lifecycle],['交易状态',m.trade],['当前版本','V'+m.version],['待处理变更',m.pending?.status||'无']].map(([k,v])=>'<div class="cm-detail-field"><span>'+k+'</span><div>'+tag(v)+'</div></div>').join('')+'</div><form id="cmOperationForm" style="margin-top:18px">'+
      field('操作','<select class="control" name="operation"><option value="trade">调整交易状态</option><option value="approve">复核通过</option><option value="reject">拒绝变更</option><option value="online">上线</option><option value="delist">发起下线</option><option value="close">确认下线</option><option value="apply">处理待生效变更</option><option value="cancel">取消待处理变更</option><option value="rollback">回滚配置</option></select>')+
      field('目标交易状态','<select class="control" name="trade">'+['正常交易','只减仓','已暂停'].map(v=>'<option '+(m.trade===v?'selected':'')+'>'+v+'</option>').join('')+'</select>','trade online')+
      field('计划上线时间（UTC+8）','<input class="control" name="onlineAt" type="datetime-local">','online')+
      field('计划停止增仓时间（UTC+8）','<input class="control" name="delistAt" type="datetime-local">','delist')+
      field('目标关闭时间（UTC+8）','<input class="control" name="closeAt" type="datetime-local">','delist')+
      field('历史版本','<select class="control" name="version">'+m.history.map(h=>'<option value="'+h.version+'">V'+h.version+' · '+h.time+'</option>').join('')+'</select>','rollback')+
      field('存量预检','<div>'+m.positions+'个仓位 · '+m.activeOrders+'笔委托 · 未结资金费：'+(m.unsettledFunding||0)+'</div>','close delist')+
      field('操作原因 <span class="required">*</span>','<textarea name="reason" maxlength="200" required></textarea>')+
      '<div id="cmOperationError" class="cm-field-error"></div></form>',button('取消','close-dialog')+button('确认操作','confirm-operation','',true));
    updateOperationFields();
  }
  function updateOperationFields(){const op=$('#cmOperationForm [name=operation]')?.value;$$('[data-for-operation]',overlay).forEach(el=>el.hidden=!el.dataset.forOperation.split(' ').includes(op));}
  function processPending(m){
    const pending=m.pending;if(!pending)return '没有待处理变更';
    if(pending.status==='待审批')return '变更尚未复核通过';
    if(pending.scheduled&&new Date(pending.scheduled)>new Date())return '尚未到达计划生效时间';
    const event=m.events.find(e=>e.id===pending.id);
    if(pending.kind==='上线'&&(M.validate(m,M.snapshot(m),state.sources).length||(B.is(m)?!pyth.online(m).ready:m.quality==='不可用')))return '上线复检失败：来源或价格不可用';
    if(pending.kind==='上线'){m.lifecycle='已上线';m.trade=pending.targetTrade;m.opened=date(new Date());m.pending=null;event.status='已生效';event.applied=m.opened;return '';}
    if(pending.kind==='下线'){m.lifecycle='下线中';m.trade='只减仓';m.closeAt=pending.closeAt;m.pending=null;event.status='已生效';event.applied=date(new Date());return '';}
    if(M.validate(m,pending.draft,state.sources).length)return '配置预检未通过，保持原有效数据';
    if(pending.draft.baseRevision!==m.revision)return '当前数据已经变化，需撤回并重新提交';
    if(pending.outcome==='failure'){event.status='生效失败';event.failure='价格服务确认失败，保留原有效数据';m.pending.status='生效失败';return event.failure;}
    applySnapshot(m,pending.draft,event);return '';
  }
  function confirmOperation(){
    if(!canWrite())return;
    const m=current(),f=new FormData($('#cmOperationForm')),op=f.get('operation'),reason=String(f.get('reason')||'').trim(),error=$('#cmOperationError');
    if(!reason||reason.length>200){error.textContent='操作原因必填，最多200字';return;}
    let event;
    if(op==='approve'||op==='reject'){
      if(state.role!=='风控复核员'){error.textContent='该操作需要风控复核员角色';return;}
      if(!m.pending||m.pending.status!=='待审批'){error.textContent='没有待审批变更';return;}
      if(m.pending.operator===state.role){error.textContent='申请人与复核人不可相同';return;}
      event=m.events.find(e=>e.id===m.pending.id);event.approver=state.role;event.reviewReason=reason;event.reviewed=date(new Date());
      if(op==='reject'){event.status='已拒绝';m.pending=null;}
      else {event.status='待生效';m.pending.status='待生效';if(!m.pending.scheduled||new Date(m.pending.scheduled)<=new Date()){const failure=processPending(m);if(failure&&m.pending){event.status='生效失败';event.failure=failure;m.pending.status='生效失败';}}}
    }else if(op==='trade'){
      if(['草稿','待上线','已下线'].includes(m.lifecycle)){error.textContent='当前上线状态不可调整交易';return;}
      if(m.trade===f.get('trade')){error.textContent='目标状态未变化';return;}
      if(m.lifecycle==='下线中'&&f.get('trade')==='正常交易'){error.textContent='下线中不能恢复增仓';return;}
      const before=m.trade;m.trade=f.get('trade');event=recordEvent(m,'状态',reason,[{group:'CM06',name:'市场交易状态',before,after:m.trade}]);event.to=event.from;
    }else if(op==='online'){
      if(!['草稿','待上线','已下线'].includes(m.lifecycle)){error.textContent='当前状态已上线';return;}
      if(m.pending){error.textContent='请先完成或取消待处理变更';return;}
      if(!m.version||M.validate(m,M.snapshot(m),state.sources).length){error.textContent='需先发布完整有效配置并通过来源检查';return;}
      if(B.is(m)){const check=pyth.online(m);if(!check.ready){error.textContent='上线复检失败：'+[...new Set(check.runtimeErrors)].join('；');persist();return;}}
      const requested=f.get('onlineAt'),at=requested?new Date(requested+':00+08:00'):null;
      if(at&&at<=new Date()){error.textContent='计划上线时间须晚于当前时间';return;}
      event=recordEvent(m,'上线',reason,[],at?'待生效':'已生效');event.to=event.from;
      if(at){m.lifecycle='待上线';event.scheduled=at.toISOString();m.pending={...event,targetTrade:f.get('trade')};}
      else {m.lifecycle='已上线';m.trade=f.get('trade');m.opened=date(new Date());}
    }else if(op==='delist'){
      if(m.lifecycle!=='已上线'){error.textContent='只有已上线合约可发起下线';return;}
      if(m.pending&&m.pending.status!=='生效失败'){error.textContent='请先完成或取消待处理变更';return;}
      const requested=f.get('delistAt'),at=requested?new Date(requested+':00+08:00'):null,closeAt=f.get('closeAt')?new Date(f.get('closeAt')+':00+08:00'):null;
      if(at&&at<=new Date()||closeAt&&closeAt<=(at||new Date())){error.textContent='停止增仓及目标关闭时间的先后关系无效';return;}
      if(m.pending){m.events.find(e=>e.id===m.pending.id).status='已取消';m.pending=null;}
      event=recordEvent(m,'下线',reason,[],at?'待生效':'已生效');event.to=event.from;
      if(at){event.scheduled=at.toISOString();m.pending={...event,closeAt:closeAt?.toISOString()};}
      else {m.lifecycle='下线中';m.trade='只减仓';m.closeAt=closeAt?.toISOString();}
    }else if(op==='close'){
      if(m.lifecycle!=='下线中'){error.textContent='需先发起下线';return;}
      if(m.positions||m.activeOrders||m.unsettledFunding||m.unconfirmedLiquidations){error.textContent='存量未收口：'+m.positions+'个仓位、'+m.activeOrders+'笔委托';return;}
      m.lifecycle='已下线';event=recordEvent(m,'确认下线',reason);event.to=event.from;
    }else if(op==='apply'){
      const failure=processPending(m);if(failure){error.textContent=failure;persist();return;}
    }else if(op==='cancel'){
      if(!m.pending){error.textContent='没有待处理变更';return;}
      event=m.events.find(e=>e.id===m.pending.id);event.status='已取消';event.cancelReason=reason;
      if(m.pending.kind==='上线')m.lifecycle='草稿';m.pending=null;
    }else if(op==='rollback'){
      if(m.pending){error.textContent='请先完成或取消待处理变更';return;}
      const h=m.history.find(h=>h.version===Number(f.get('version')));if(!h||h.version===m.version){error.textContent='请选择不同的历史版本';return;}
      const draft={config:M.clone(h.config),tiers:M.clone(h.tiers),oracle:M.clone(h.oracle),external:M.clone(h.external),baseRevision:m.revision};
      if(M.validate(m,draft,state.sources).length){error.textContent='历史配置不满足当前校验';return;}
      event=recordEvent(m,'回滚',reason,M.differences(m,draft),'待审批');m.pending={...event,draft,outcome:'success'};
    }
    if(event&&event.status==='已生效'&&!event.applied)event.applied=date(new Date());
    m.updated=date(new Date());persist();closeDialog();renderMarketDetail();toast(event?.status||'操作已记录');
  }
  function changeDialog(id){
    const market=state.markets.find(m=>m.events.some(e=>e.id===id)),source=state.sources.find(s=>s.events.some(e=>e.id===id));
    const event=market?.events.find(e=>e.id===id)||source?.events.find(e=>e.id===id);if(!event){toast('变更记录不存在');return;}
    const m=market||M.newMarket(),from=event.from||'V'+Math.max(0,(source?.revision||1)-1),to=event.to||'V'+(source?.revision||1),status=event.status||'已生效';
    const summary=[['变更对象',event.market||source.name],['变更类型',event.kind],['状态',status],['操作人',event.operator||'运营管理员'],['原版本',from],['目标版本',to],['操作原因',event.reason],['复核人',event.approver||'--'],['复核意见',event.reviewReason||'--'],['计划生效时间',event.scheduled?date(event.scheduled):'--'],['实际生效时间',event.applied||'--'],['失败原因',event.failure||'--']];
    const changes=(event.changes||[]).filter(visibleChange);
    const impact=market?[market]:related(source);
    dialog('变更详情 · '+id,'<div class="cm-grid">'+summary.map(([k,v])=>'<div class="cm-detail-field"><span>'+k+'</span><div>'+esc(v)+'</div></div>').join('')+'</div><h3 style="margin:20px 0 10px">字段差异</h3><div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>分组</th><th>字段</th><th>原值</th><th>新值</th><th>单位</th><th>校验结果</th></tr></thead><tbody>'+
      (changes.map(c=>'<tr><td>'+groupTitle(c.group)+'</td><td>'+esc(detailLabel(c.group,c.name))+'</td><td class="cm-wrap">'+esc(c.before)+'</td><td class="cm-wrap">'+esc(c.after)+'</td><td>'+esc(M.unit(M.fields(c.group).find(f=>M.clean(f.name)===M.clean(c.name))||{name:c.name},m))+'</td><td>'+tag('通过')+'</td></tr>').join('')||'<tr><td colspan="6">状态或当前一期展示范围外的配置变更</td></tr>')+
      '</tbody></table></div><h3 style="margin:20px 0 10px">影响评估</h3><div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>受影响合约</th><th>账户数</th><th>开放订单数</th><th>存量仓位数</th><th>预计超限数</th><th>处理方式</th><th>复检时间</th></tr></thead><tbody>'+impact.map(m=>'<tr><td>'+m.code+'</td><td>'+accounts().length+'</td><td>'+m.activeOrders+'</td><td>'+m.positions+'</td><td>0</td><td>兼容保留</td><td>'+event.time+'</td></tr>').join('')+'</tbody></table></div><h3 style="margin:20px 0 10px">生效结果</h3><div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>业务域</th><th>原版本</th><th>目标版本</th><th>确认结果</th><th>确认时间</th><th>失败原因</th></tr></thead><tbody>'+['配置','撮合','价格','风险','资金'].map(d=>'<tr><td>'+d+'</td><td>'+from+'</td><td>'+to+'</td><td>'+tag(status==='生效失败'&&d==='价格'?'失败':status==='已生效'?'已确认':'待确认')+'</td><td>'+(event.applied||'--')+'</td><td>'+(d==='价格'?esc(event.failure||'--'):'--')+'</td></tr>').join('')+'</tbody></table></div>',button('关闭','close-dialog'),true);
  }
  function detailRecords(kind,index){
    const m=current(),r=recordRows(kind==='liquidation'?'CM14':'CM20',m)[index];if(!r)return;
    const id=kind==='liquidation'?'CM15':'CM21';
    const summary=kind==='liquidation'?M.fields('CM14'):M.fields('CM20');
    let body='<div class="cm-grid">'+summary.map(f=>'<div class="cm-detail-field" data-spec-field="'+esc(f.name)+'"><span>'+esc(f.name)+'</span><div>'+display(r[f.name]??'--',f,m)+'</div></div>').join('')+'</div>';
    let rows;
    if(kind==='liquidation'){
      rows=Array.from({length:2},(_,i)=>({'尝试序号':String(i+1),'关联订单编号':m.code+'-ORD-'+(1000+index),'目标数量':'0.1','标记价格与保护价':m.price+' / '+new D(m.price).mul('.99'),'实际成交数量':'0.05','未成交取消数量':'0.05','成交均价':m.price,'手续费':'1.46','尝试后账户权益':'1300','尝试后剩余数量':i?'0':'0.05','复检路由':i?'停止清算':'继续分批强平','失败／受阻原因':'--','尝试时间':m.updated}));
      body+='<h3 style="margin:20px 0 12px">尝试明细</h3>'+renderTable(id,m,M.fields(id),rows,'none');
      const tail={'确认坏账':'0','保险基金覆盖金额':'0','剩余坏账':'0','关联账本业务编号':'--','ADL记录状态':'不适用','结果时间':m.updated};
      body+='<h3 style="margin:20px 0 12px">尾部处理结果</h3>'+renderTable('CM15-tail',m,M.fields('CM15',1),[tail],'none');
    }else{
      rows=recordRows('CM21',m).slice(0,accounts().length).map((x,i)=>({...x,'结算仓位方向':i<Math.ceil(accounts().length/2)?'多':'空','结算仓位数量':fundingQuantity(i).toString(),'结算预言机价格':r['结算预言机价格'],'结算资金费率':r['结算费率'],'入账时间':index%3===0&&i===0?'--':r['结算时间']||r['计划／完成时间'],'收付方向':fundingAccountAmount(m,i).lt(0)?'支付':'收取','资金费余额变化':fundingAccountAmount(m,i).toFixed(6),'入账状态':index%3===0&&i===0?'失败':'已入账','失败原因':index%3===0&&i===0?'账本确认超时':'--'}));
      body+='<h3 style="margin:20px 0 12px">账户收付明细</h3>'+renderTable(id,m,M.fields(id),rows,'records');
    }
    dialog(kind==='liquidation'?'清算详情 · '+r['清算编号']:'结算详情 · '+r['结算周期编号'],body,button('关闭','close-dialog'),true);dialogContext={kind,index};
  }
  function renderSources(){const q=state.queries.sources||{},rows=sourceListRows();$('#breadcrumb').textContent='价格源管理';root.innerHTML=`<div class="cm-heading"><div><h1>价格源管理</h1><div class="cm-heading-sub">${state.sources.length} 个来源 · ${state.sources.filter(s=>s.enabled).length} 个已启用</div></div><div class="cm-actions">${roleControl()}${button('新增价格源','new-source','',true)}</div></div><form class="cm-band cm-filters" id="cmSourceFilters">${fieldFilter('名称 / 代码','keyword',null,q.keyword)}${fieldFilter('启用状态','enabled',['启用','停用'],q.enabled)}${fieldFilter('市场类型','type',['现货','永续'],q.type)}${fieldFilter('支持用途','purpose',['预言机单价','外部双边盘口'],q.purpose)}${fieldFilter('运行健康状态','healthy',['正常','异常'],q.healthy)}<div class="cm-filter-foot">${button('重置','reset-sources')}${button('查询','query-sources','',true)}</div></form><div class="cm-workspace"><div class="cm-toolbar"><span>价格源列表</span>${tool('导出价格源','export-sources','download')}</div><div class="cm-table-scroll"><table class="cm-table" data-spec-group="CM33"><thead><tr>${M.fields('CM33').map(f=>'<th>'+esc(f.name)+'</th>').join('')}<th>操作</th></tr></thead><tbody>${slice('sources',rows).map(s=>`<tr>${M.fields('CM33').map(f=>`<td>${f.name==='关联合约数量'?related(s).length:esc(sourceValue(s,f.name))}</td>`).join('')}<td><div class="cm-actions"><button class="btn-link" data-cm-action="source-detail" data-id="${s.id}">详情</button><button class="btn-link" data-cm-action="edit-source" data-id="${s.id}">编辑</button><button class="btn-link" data-cm-action="toggle-source" data-id="${s.id}">${s.enabled?'停用':'启用'}</button></div></td></tr>`).join('')||'<tr><td colspan="10"><div class="cm-empty">暂无匹配来源</div></td></tr>'}</tbody></table></div>${pager('sources',rows.length)}</div>`;refreshIcons();}
  function related(s){return state.markets.filter(m=>m.oracle.some(r=>r.source===s.id)||m.external.some(r=>r.source===s.id));}
  function renderSourceDetail(id){const s=sourceById(id);if(!s){renderSources();return;}state.sourceId=id;$('#breadcrumb').textContent='价格源 / '+s.name;root.innerHTML=`<div class="cm-heading"><div class="cm-heading-id">${tool('返回价格源列表','nav','arrow-left','data-route="#sources"')}<div><h1>${esc(s.name)}</h1><div class="cm-heading-sub">${esc(s.code)} · ${tag(s.enabled?'启用':'停用')} · V${s.revision}</div></div></div><div class="cm-actions">${button('检查连接','check-source','data-id="'+s.id+'"')}${button('编辑来源','edit-source','data-id="'+s.id+'"')}</div></div><div class="cm-workspace cm-surface"><div class="cm-section-head"><h2>基础信息与接入状态</h2></div><div class="cm-grid" data-spec-group="CM35">${M.fields('CM35').map(f=>`<div class="cm-detail-field"><span>${f.name}</span><div>${esc(sourceValue(s,f.name))}</div></div>`).join('')}</div><h3 style="margin:24px 0 12px">关联合约</h3>${renderTable('CM36',M.newMarket(),M.fields('CM36'),related(s).map(m=>({'合约':m.code,'用途':'预言机 / 外部市场','来源交易对':m.code,'合约关联启用状态':'启用','当前权重':m.oracle.find(b=>b.source===s.id)?.weight||'2','报价时效要求':'5','当前有效源数／最少要求':'3 / 3','停用影响':'需检查独立来源数量','配置版本':'V'+m.version})), 'records')}<h3 style="margin:24px 0 12px">变更记录</h3>${renderTable('CM37',M.newMarket(),M.fields('CM37'),s.events.map(e=>({'变更单号':e.id,'来源名称':s.name,'变更类型':e.kind,'原版本／目标版本':'V'+(s.revision-1)+' / V'+s.revision,'受影响合约数':String(related(s).length),'操作原因':e.reason,'操作人／复核人':'运营管理员','变更状态':'已生效','提交／计划／实际时间':e.time,'失败原因':'--'})),'records')}</div>`;refreshIcons();}
  function sourceForm(id){if(!canWrite())return;const s=id?M.clone(sourceById(id).draft||sourceById(id)):{id:'source-'+Date.now(),name:'',code:'',platform:'Binance',group:'Binance',type:'现货',channel:'公开行情通道 A',interval:'10',enabled:false,healthy:false,proof:'',revision:0,events:[]};dialogContext={source:s,isNew:!id};const fields=[['code','来源代码'],['name','来源名称'],['platform','所属平台'],['group','来源独立分组'],['proof','独立性核对依据'],['type','市场类型'],['channel','数据接入通道'],['interval','健康检查间隔（秒）'],['reason','操作原因']];dialog(id?'编辑价格源':'新增价格源',`<form id="cmSourceForm" class="cm-form-grid">${fields.map(([k,n])=>`<div class="cm-field"><label>${n} *</label>${['platform','group','type','channel'].includes(k)?`<select class="control" name="${k}">${(k==='type'?['现货','永续']:k==='channel'?['公开行情通道 A','公开行情通道 B']:['Binance','OKX','Bybit','Coinbase','Kraken']).map(v=>`<option ${s[k]===v?'selected':''}>${v}</option>`).join('')}</select>`:`<input class="control" name="${k}" value="${esc(s[k]||'')}" ${k==='code'&&id?'readonly':''} ${k==='interval'?'type="number" min="1"':''}>`}</div>`).join('')}<div class="cm-field"><label>支持用途</label><div>预言机单价 / 外部双边盘口</div></div><div class="cm-field"><label>启用状态</label><div>${tag(s.enabled?'启用':'停用')}</div></div><div id="cmSourceError" class="cm-field-error"></div></form>`,button('取消','close-dialog')+button('检查连接','check-source-form')+button('保存草稿','save-source','data-mode="draft"')+button('提交生效','save-source','data-mode="publish"',true));dialogContext={source:s,isNew:!id};}
  function saveSource(mode='publish'){
    if(!canWrite())return;
    const ctx=dialogContext,f=new FormData($('#cmSourceForm'));
    for(const k of ['code','name','platform','group','proof','type','channel','interval','reason'])ctx.source[k]=String(f.get(k)||'').trim();
    const s=ctx.source,original=sourceById(s.id);
    if(!/^[A-Z0-9_]{3,40}$/.test(s.code)||!s.name){$('#cmSourceError').textContent='来源代码与名称必填，代码仅限大写字母、数字及下划线';return;}
    if(state.sources.some(x=>x.id!==s.id&&x.code===s.code)){$('#cmSourceError').textContent='来源代码已存在';return;}
    if(mode==='draft'){
      if(original)original.draft=M.clone(s);
      else {s.phase='草稿';s.enabled=false;const saved=M.clone(s);saved.draft=M.clone(s);state.sources.push(saved);}
      persist();closeDialog();go('#sources/'+s.id);toast('来源草稿已保存');return;
    }
    if(!s.proof||!s.reason||s.reason.length>200||!(Number(s.interval)>0)){$('#cmSourceError').textContent='请完成核对依据、操作原因和正数检查间隔';return;}
    if(original&&related(s).length&&original.group!==s.group){$('#cmSourceError').textContent='独立分组变更影响关联合约，需先完成关联变更';return;}
    const previous=original?M.clone(original):null;
    delete s.draft;s.phase='已发布';s.revision=(original?.revision||0)+1;s.updated=date(new Date());
    s.events.unshift({id:'SRC-'+Date.now(),kind:original?'编辑':'新增',reason:s.reason,time:s.updated,from:'V'+(s.revision-1),to:'V'+s.revision,status:'已生效',applied:s.updated,operator:state.role,changes:['name','platform','group','proof','interval'].filter(k=>previous?.[k]!==s[k]).map(k=>({group:'CM34',name:({name:'来源名称',platform:'所属平台',group:'来源独立分组',proof:'独立性核对依据',interval:'健康检查间隔'})[k],before:previous?.[k]||'--',after:s[k]}))});
    if(original)state.sources[state.sources.findIndex(x=>x.id===s.id)]=s;else state.sources.push(s);
    persist();closeDialog();go('#sources/'+s.id);toast('来源配置已生效');
  }
  function toggleSource(id){if(!canWrite())return;const s=sourceById(id);if(!s.enabled&&s.phase==='草稿'){toast('请先发布来源配置');return;}const impact=related(s).filter(m=>m.lifecycle==='已上线'&&m.oracle.some(r=>r.source===id&&r.enabled));dialog('来源'+(s.enabled?'停用':'启用')+'预检',`<p>${esc(s.name)}</p><div class="cm-notice ${impact.length?'danger':''}" style="margin-top:12px">${s.enabled&&impact.length?'停用会影响 '+impact.length+' 个已上线合约的独立来源要求。请先发布替代关联。':!s.enabled&&!s.healthy?'来源尚未通过连接检查。':'预检通过'}</div><label>操作原因</label><textarea id="cmSourceReason" maxlength="200"></textarea>`,button('取消','close-dialog')+button('确认','confirm-source-toggle',`data-id="${id}" ${s.enabled&&impact.length||!s.enabled&&!s.healthy?'disabled':''}`,true));}
  function exportData(filename,headers,rows){const safe=v=>{let s=String(v??'');if(/^[=+@\t\r]/.test(s)||(/^-(?!\d)/.test(s)))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const csv='\ufeff'+[headers,...rows].map(r=>r.map(safe).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('导出已生成');}
  function exportRecords(key){const data=tableCache[key];if(!data)return;const {m,fields,all}=data,rows=filterRecords(key,all);exportData(m.code+'-'+key+'.csv',fields.map(x=>tableHeader(x,m)),rows.map(r=>fields.map(x=>csvValue(x,m,r[M.clean(x.name)]??'--'))));}
  document.addEventListener('click',event=>{const b=event.target.closest('[data-cm-action]');if(!b||b.disabled)return;event.preventDefault();const action=b.dataset.cmAction;
    if(action==='nav')return navigate(b.dataset.route);if(action==='new-market')return navigate('#contracts/new');if(action==='detail')return navigate('#contracts/'+b.dataset.id);if(action==='source-detail')return navigate('#sources/'+b.dataset.id);if(action==='return-contract')return navigate(state.returnRoute||'#contracts');
    if(action==='close-dialog')return closeDialog();if(action==='fees')return feeDialog();if(action==='edit')return startEditor(b.dataset.id);if(action==='edit-group')return startEditor(current().id,b.dataset.group);if(action==='notice')return startEditor(b.dataset.id,'CM05');
    if(action==='discard-editor'){state.editor=null;const route=state.pendingNavigation;state.pendingNavigation=null;closeDialog();return go(route);}
    if(action==='tab')return navigate('#contracts/'+current().id+'/'+b.dataset.tab);if(action==='group')return navigate('#contracts/'+current().id+'/'+state.tab+'/'+b.dataset.group);
    if(action==='query-list'){state.queries.list=Object.fromEntries(new FormData($('#cmListFilters')));state.pages.list=1;return renderMarketList();}if(action==='reset-list'){state.queries.list={};state.pages.list=1;return renderMarketList();}
    if(action==='query-sources'){state.queries.sources=Object.fromEntries(new FormData($('#cmSourceFilters')));state.pages.sources=1;return renderSources();}if(action==='reset-sources'){state.queries.sources={};return renderSources();}
    if(action==='columns'){const all=allListFields(),selected=state.columns||defaultListColumns;return dialog('合约列表列设置',`<div class="cm-checklist">${all.map(f=>`<label><input type="checkbox" data-column="${esc(f.name)}" ${selected.includes(f.name)?'checked':''} ${f.name==='合约'?'disabled':''}>${esc(f.name)}</label>`).join('')}</div>`,button('取消','close-dialog')+button('应用','apply-columns','',true));}
    if(action==='apply-columns'){state.columns=$$('[data-column]:checked',overlay).map(i=>i.dataset.column);closeDialog();return renderMarketList();}
    if(action==='page'){state.pages[b.dataset.key]=Number(b.dataset.page);if(dialogContext?.kind)return detailRecords(dialogContext.kind,dialogContext.index);return renderRoute();}
    if(action==='query-record'||action==='reset-record'){const key=b.dataset.key,form=$(`[data-record-form="${key}"]`,overlay.hidden?root:overlay);state.queries[key]=action==='reset-record'?{}:Object.fromEntries(new FormData(form));state.pages[key]=1;if(dialogContext?.kind)return detailRecords(dialogContext.kind,dialogContext.index);return renderRoute();}
    if(action==='editor-step'){state.editor.step=Number(b.dataset.step);return renderEditor();}if(action==='save-draft')return saveDraft();if(action==='precheck')return precheck();if(action==='prepare-publish')return publication();if(action==='confirm-publish')return confirmPublish();if(action==='confirm-create-save')return confirmCreateSave();
    if(action==='locate-error'){const g=b.dataset.group;closeDialog();state.editor.step=Math.max(0,M.steps.findIndex(s=>s[1].includes(g)));state.editor.advanced[g]=true;return renderEditor();}
    if(action==='add-tier'){state.editor.draft.tiers.push({upper:'',leverage:'5',mmr:'10'});invalidateEditor();syncMetadata();return renderEditor();}if(action==='remove-tier'){state.editor.draft.tiers.splice(Number(b.dataset.index),1);invalidateEditor();syncMetadata();return renderEditor();}
    if(action==='add-binding'){const row={source:state.sources[0].id,pair:'',weight:'1',enabled:true};syncBindingPair(row,b.dataset.key,state.editor.market);state.editor.draft[b.dataset.key].push(row);invalidateEditor();return renderEditor();}if(action==='remove-binding'){state.editor.draft[b.dataset.key].splice(Number(b.dataset.index),1);invalidateEditor();return renderEditor();}
    if(action==='sync-initial-catalogue'){const result=priceEngine.catalogue.sync(sourceById(b.dataset.source));if(result.status==='成功')for(const key of ['oracle','external'])for(const row of state.editor.draft[key].filter(r=>r.source===b.dataset.source))syncBindingPair(row,key,state.editor.market);invalidateEditor();persist();renderEditor();toast(result.status==='成功'?'行情目录已同步':result.error);return;}
    if(action==='operations')return operationDialog();if(action==='confirm-operation')return confirmOperation();if(action==='change-detail')return changeDialog(b.dataset.event);
    if(action==='versions'){const m=current();return dialog('配置版本','<div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>版本</th><th>生效时间</th><th>操作</th></tr></thead><tbody>'+m.history.map(h=>'<tr><td>V'+h.version+'</td><td>'+h.time+'</td><td><button class="btn-link" data-cm-action="version-detail" data-version="'+h.version+'">查看</button></td></tr>').join('')+'</tbody></table></div>');}if(action==='version-detail')return versionDialog(b.dataset.version);
    if(action==='calculate-margin'){try{const m=current(),f=new FormData($('#cmMarginPreview')),version=f.get('version'),tiers=version==='draft'?m.draft.tiers:version==='current'?m.tiers:m.history.find(h=>h.version===Number(version)).tiers,res=M.marginPreview(tiers,f.get('notional'),f.get('leverage'));$('#cmMarginResult').innerHTML=grid('CM11',m,{'预览配置版本':version==='current'?'当前有效 V'+m.version:version==='draft'?'未发布草稿':'历史 V'+version,'持仓名义价值':f.get('notional')+' '+m.quote,'适用杠杆':f.get('leverage')+'x','命中档位':String(res.tier),'初始保证金':res.im+' '+m.settle,'维持保证金率':tiers[res.tier-1].mmr+'%','维持保证金速算额':res.deduction+' '+m.quote,'维持保证金':res.mm+' '+m.settle,'校验结果':'通过'});}catch(e){$('#cmMarginResult').innerHTML='<div class="cm-notice danger">'+esc(e.message)+'</div>';}return;}
    if(action==='reset-margin'){return renderMarketDetail();}if(action==='funding-preview')return dialog('资金费计算预览',`<label>周期平均溢价率</label><div class="cm-input-unit"><input id="cmPremium" type="number" step="any" value="0"><span>%</span></div><div id="cmFundingResult" style="margin-top:16px"></div>`,button('计算','calculate-funding','',true));if(action==='calculate-funding'){try{$('#cmFundingResult').textContent=M.fundingPreview($('#cmPremium').value,current().config.CM18)+'%';}catch(_){$('#cmFundingResult').textContent='参数无效';}return;}
    if(action==='liquidation-detail')return detailRecords('liquidation',Number(b.dataset.index));if(action==='funding-detail')return detailRecords('funding',Number(b.dataset.index));
    if(action==='account'){state.returnRoute=state.route;return navigate('#account='+b.dataset.id);}if(action==='order-jump'){state.queries.CM29={keyword:b.dataset.order};state.pages.CM29=1;return navigate('#contracts/'+current().id+'/records/CM29');}
    if(action==='new-source')return sourceForm();if(action==='edit-source')return sourceForm(b.dataset.id);if(action==='save-source')return saveSource(b.dataset.mode);if(action==='toggle-source')return toggleSource(b.dataset.id);
    if(action==='check-source-form'){dialogContext.source.healthy=true;$('#cmSourceError').textContent='公开行情通道检查通过';return;}
    if(action==='check-source'){const s=sourceById(b.dataset.id);s.healthy=true;persist();toast('公开行情通道检查通过');return renderSourceDetail(s.id);}
    if(action==='confirm-source-toggle'){const s=sourceById(b.dataset.id),reason=$('#cmSourceReason').value.trim();if(!reason){toast('请填写操作原因');return;}s.enabled=!s.enabled;s.revision++;s.events.unshift({id:'SRC-'+Date.now(),kind:s.enabled?'启用':'停用',reason,time:date(new Date())});persist();closeDialog();renderSources();return;}
    if(action==='copy'){navigator.clipboard?.writeText(b.dataset.copy).then(()=>toast('已复制')).catch(()=>toast('复制失败，请检查浏览器权限'));return;}
    if(action==='refresh'){if(current())current().updated=date(new Date());renderRoute();toast('数据已刷新');return;}
    if(action==='export-list'){const cols=listFields();return exportData('合约列表.csv',['合约代码',...cols.map(f=>f.name)],listRows().map(m=>[m.code,...cols.map(f=>csvValue(f,m,contractValue(m,f.name),true))]));}
    if(action==='export-config'){const m=current();return exportData(m.code+'-配置.csv',['分组','字段','值','单位'],M.configGroups.flatMap(g=>M.fields(g).map(f=>[groupTitle(g),f.name,configValue(m,g,f),M.unit(f,m)])));}
    if(action==='export-record')return exportRecords(b.dataset.key);if(action==='export-sources'){const fields=M.fields('CM33');return exportData('价格源.csv',fields.map(f=>f.name),sourceListRows().map(s=>fields.map(f=>f.name==='关联合约数量'?related(s).length:sourceValue(s,f.name))));}
  });
  function invalidateEditor(){
    if(!state.editor)return;
    state.editor.dirty=true;state.editor.prechecked=false;state.editor.errors=[];
    if(B.is(state.editor.draft))pyth.invalidate(state.editor.market);
    const status=$('[data-readonly-field="准入状态与原因"]');if(status)status.textContent='未校验';
  }
  document.addEventListener('input',e=>{
    const el=e.target,editor=state.editor;if(!editor)return;
    if(el.dataset.configGroup){
      const name=el.dataset.configField,g=el.dataset.configGroup;let value=el.type==='checkbox'?el.checked:el.value;
      if(el.dataset.option){const values=editor.draft.config[g][name]||[];value=el.checked?[...new Set([...values,el.dataset.option])]:values.filter(v=>v!==el.dataset.option);}
      editor.draft.config[g][name]=value;
      if(g==='CM09'&&name==='最大杠杆'){
        try{const cap=new D(value);if(cap.isFinite()&&cap.gt(0))for(const t of editor.draft.tiers)if(new D(t.leverage).gt(cap))t.leverage=String(cap);}catch(_){/* keep typed value; precheck reports invalid leverage */}
      }
      invalidateEditor();syncMetadata();
    }
    if(el.dataset.tier!=null){editor.draft.tiers[Number(el.dataset.tier)][el.dataset.key]=el.value;invalidateEditor();syncMetadata();}
    if(el.dataset.binding){
      const row=editor.draft[el.dataset.binding][Number(el.dataset.index)];row[el.dataset.key]=el.type==='checkbox'?el.checked:el.value;
      if(['source','pair'].includes(el.dataset.key))syncBindingPair(row,el.dataset.binding,editor.market);
      invalidateEditor();
    }
  });
  document.addEventListener('change',e=>{if(e.target.dataset.cmSize){const key=e.target.dataset.cmSize;state.sizes[key]=Number(e.target.value);state.pages[key]=1;if(dialogContext?.kind)detailRecords(dialogContext.kind,dialogContext.index);else renderRoute();}});
  document.addEventListener('submit',e=>{if(e.target.closest('.cm-root,.cm-overlay')){e.preventDefault();const b=$('[data-cm-action^="query"]',e.target);b?.click();}});
  document.addEventListener('change',e=>{if(e.target.dataset.versionGroup)versionDialog(e.target.dataset.versionGroup,e.target.value);if(e.target.hasAttribute('data-contract-image')){const file=e.target.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>500000){toast('图标须为500KB以内PNG、JPEG或WebP');return;}const editor=state.editor,reader=new FileReader();reader.onload=()=>{if(state.editor!==editor)return;editor.draft.config.CM05['图标']=reader.result;editor.dirty=true;renderEditor();};reader.readAsDataURL(file);}});
  document.addEventListener('change',e=>{if(e.target.matches('#cmOperationForm [name="operation"]'))updateOperationFields();if((e.target.dataset.tier!=null||e.target.dataset.binding||['标的资产','计价资产','结算资产','风险提示开关','提示展示方式','单账户持仓上限开关','市场持仓上限开关','价格步长','数量步长','利率基准周期','结算周期','最大杠杆'].includes(e.target.dataset.configField))&&state.editor)renderEditor();});
  document.addEventListener('toggle',e=>{if(e.target.isConnected&&e.target.dataset.advanced&&state.editor){state.editor.advanced||={};state.editor.advanced[e.target.dataset.advanced]=e.target.open;}},true);
  setInterval(()=>{let updated=false;for(const m of state.markets){if(m.pending?.status==='待生效'&&m.pending.scheduled&&new Date(m.pending.scheduled)<=new Date()){const failure=processPending(m);if(failure&&m.pending){m.pending.status='生效失败';const e=m.events.find(e=>e.id===m.pending.id);e.status='生效失败';e.failure=failure;}updated=true;}}if(updated){persist();if(!state.editor&&overlay.hidden)renderRoute();}},1000);
  document.addEventListener('keydown',e=>{if(!overlay.hidden){if(e.key==='Escape'){e.preventDefault();closeDialog();}if(e.key==='Tab'){const focusables=$$('button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',overlay);if(e.shiftKey&&document.activeElement===focusables[0]){e.preventDefault();focusables.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===focusables.at(-1)){e.preventDefault();focusables[0]?.focus();}}}else if((e.key==='Enter'||e.key===' ')&&e.target.matches('.nav-item[role=button]')){e.preventDefault();e.target.click();}});
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeDialog();});
  window.addEventListener('popstate',()=>{const route=location.hash||'#contracts';if(route===state.route)return;state.editor=null;state.route=route;renderRoute();});
  window.addEventListener('beforeunload',e=>{if(state.editor?.dirty){e.preventDefault();e.returnValue='';}});
  const baseMarketList=renderMarketList;
  renderMarketList=()=>{baseMarketList();for(const id of ['cm-filter-risk','cm-filter-notice'])$('#'+id,root)?.parentElement?.remove();$$('[data-cm-action="notice"]',root).forEach(el=>el.remove());};
  const baseEditorRender=renderEditor;
  renderEditor=()=>{baseEditorRender();const e=state.editor,subtitle=$('.cm-heading-sub',root);if(e&&subtitle)subtitle.textContent=(isCreateEditor()?(e.market.base==='NEW'?'未保存草稿':e.draft.config.CM05['合约代码']+' · 未上线'):e.market.code)+(e.dirty?' · 未保存':'');};
  const baseOperationDialog=operationDialog;
  operationDialog=()=>{baseOperationDialog();$$('.cm-dialog .cm-detail-field',overlay).find(el=>el.querySelector('span')?.textContent==='当前版本')?.remove();for(const value of ['approve','reject','rollback'])$('#cmOperationForm [name="operation"] option[value="'+value+'"]',overlay)?.remove();$('[data-for-operation="rollback"]',overlay)?.remove();};
  const baseMarketDetail=renderMarketDetail;
  renderMarketDetail=()=>{if(!M.tabs.some(t=>t[0]===state.tab)){state.tab='overview';state.group='CM05';}const m=current();ensureCurrentContract(m);baseMarketDetail();const subtitle=$('.cm-heading-sub > span:not(.tag)',root);if(m&&subtitle)subtitle.textContent=m.config.CM05['合约名称']+' · '+m.updated+' UTC+8';$('[data-cm-action="change-detail"]',root)?.remove();};
  // Price workflows share the existing shell, dialogs and persistence boundary.
  const priceUI=window.PriceUI.create({state,engine:priceEngine,root,overlay,esc,tag,dialog,persist,toast,roleControl,refreshIcons,navigate,close:closeDialog,render:()=>renderRoute(),exportData});
  const pythUI=window.PythUI.create({state,engine:pyth,priceEngine,esc,button,tool,tag,dialog,persist,current,toast,invalidate:invalidateEditor,renderEditor,renderDetail:renderMarketDetail});
  const baseRenderRoute=renderRoute;
  renderRoute=()=>{if(state.route.startsWith('#sources')){state.route='#contracts';try{history.replaceState({},'',state.route);}catch(_){}}priceUI.routeChanged(state.route);baseRenderRoute();};
  const originalSaveDraft=saveDraft;
  saveDraft=(silent=false)=>{const m=originalSaveDraft(silent);if(m&&!m.version){m.oracle=M.clone(state.editor.draft.oracle);m.external=M.clone(state.editor.draft.external);if(!B.is(m))priceEngine.syncUnpublished(m);persist();}return m;};
  const legacyGroup=renderGroup,legacyStart=startEditor,legacyField=formField,legacyBindings=renderSourcesBinding,legacyApply=applySnapshot,legacyValidate=M.validate;
  renderGroup=(g,m)=>{
    if(g==='CM05')return legacyGroup(g,m)+staticGrid('CM05-update',[
      ['创建时间',esc(m.created||'--')],['计划上线时间',esc(m.pending?.scheduled?date(m.pending.scheduled):'--')],['实际上线时间',esc(m.opened||'--')],['最近更新时间',esc(m.updated+' UTC+8')],['上线状态',tag(m.lifecycle)]
    ]);
    if(g==='CM09')return legacyGroup(g,m)+'<h3 style="margin:24px 0 12px">保证金档位</h3>'+tiersTable(m,false);
    if(g==='RISK_PARAMS')return '<div class="cm-section-head"><h2>参数设置</h2><div class="cm-actions"><small>'+esc(m.updated)+' UTC+8</small>'+button('编辑配置','edit-group','data-group="CM12"')+'</div></div><h3 style="margin:16px 0 12px">账户与市场限额</h3>'+grid('CM12',m)+'<h3 style="margin:24px 0 12px">主账户组限额</h3>'+grid('RC03',m)+'<h3 style="margin:24px 0 12px">清算保护</h3>'+grid('CM13',m);
    if(g==='CM16')return '<div class="cm-section-head"><h2>手续费配置</h2><div class="cm-actions"><small>'+esc(m.updated)+' UTC+8</small>'+button('编辑配置','edit-group','data-group="CM16"')+'</div></div>'+grid('CM16',m)+'<div class="cm-notice" style="margin-top:16px">当前展示为合约基础费率；账户实际成交费率按平台公共费率规则确定。</div>';
    return pythUI.detail(g,m) ?? legacyGroup(g,m);
  };
  renderSources=()=>priceUI.renderSources();
  renderSourceDetail=id=>priceUI.renderSource(id);
  const legacyChanges=renderChanges;
  renderChanges=m=>legacyChanges(m)+(priceEngine.db.changes.some(c=>c.scope==='plan'&&c.draft.market===m.id)?'<h3>价格方案变更</h3>'+priceUI.changesTable(priceEngine.db.changes.filter(c=>c.scope==='plan'&&c.draft.market===m.id)):'');
  sourceForm=id=>priceUI.handle(id?'source-edit':'source-new',{dataset:{id}});
  toggleSource=id=>priceUI.handle('source-toggle',{dataset:{id}});
  startEditor=(id,g)=>{const m=id?state.markets.find(x=>x.id===id):null;if(m){ensureCurrentContract(m);if(m.draft)ensureCurrentContract(m,m.draft);}legacyStart(id,g);if(state.editor)retireNoticeConfig(state.editor.draft);};
  formField=(m,g,f)=>m.version&&['CM23','CM24','RC10','RC11','RC12'].includes(g)?`<div class="cm-field"><label>${esc(f.name)}</label><div class="cm-readonly">${display(configValue(m,g,f),f,m)}</div></div>`:legacyField(m,g,f);
  renderSourcesBinding=(m,g,edit)=>edit&&m.version?`<div class="cm-notice">价格方案独立发布</div>${button('返回价格方案','nav','data-route="#contracts/'+m.id+'/prices/'+g+'"')}`:legacyBindings(m,g,edit);
  applySnapshot=(m,d,event)=>{legacyApply(m,d,event);if(!B.is(m))priceEngine.syncMarket(m);};
  M.validate=(m,d,sources,options)=>{
    const managed=['CM23','CM24','RC10','RC11','RC12'];
    const result=legacyValidate(m,d,sources,options);
    if(B.is(d)){
      const errors=result.filter(e=>!managed.includes(e.group));
      if(m.version&&!B.is(m))errors.push({group:'CM23',field:'定价模式',message:'旧合约不得自动迁移定价方案'});
      return errors.concat(pyth.validate(m,d));
    }
    if(B.is(m))return [{group:'CM23',field:'定价模式',message:'已发布Pyth模式不可删除'}];
    if(!m.version)return result;
    const errors=result.filter(e=>!managed.includes(e.group));
    for(const key of ['oracle','external'])if(JSON.stringify(m[key])!==JSON.stringify(d[key]))errors.push({group:key==='oracle'?'CM23':'CM24',field:'来源关联',message:'已发布价格关联须从独立方案编辑'});
    for(const g of managed)if(JSON.stringify(m.config[g])!==JSON.stringify(d.config[g]))errors.push({group:g,field:'价格配置',message:'价格配置须从定价方案独立发布'});
    for(const purpose of ['oracle','external'])priceEngine.validate(priceEngine.current(m,purpose),sources||state.sources).forEach(message=>errors.push({group:purpose==='oracle'?'CM23':'CM24',field:'定价方案',message}));
    return errors;
  };
  window.ContractPrototype={state,navigate,renderRoute,startEditor,precheck,recordRows,groupTitle,renderGroup,priceEngine,priceUI,pyth,pythUI,processPending};
  state.route=location.hash||'#contracts';renderRoute();refreshIcons();
})();
