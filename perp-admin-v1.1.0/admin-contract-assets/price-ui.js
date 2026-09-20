(function () {
  'use strict';
  function create(ctx) {
    const {state,engine:E,root,overlay,esc,tag,persist,toast,roleControl,refreshIcons}=ctx;
    const $=s=>document.querySelector(s), D=window.Decimal;
    const ui={purpose:'oracle',sourceTab:'基础与接入',queries:{},pages:{},scenario:'正常',auto:false,last:{},syncError:'',form:null,dirty:false};
    const dialog=(...args)=>{ui.ownsDialog=true;ctx.dialog(...args);};
    const date=v=>v?new Date(v).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'})+' UTC+8':'--';
    const num=(v,n=6)=>v==null?'--':new D(v).toDecimalPlaces(n).toString();
    const unit=q=>q.quote+'/'+q.base;
    const text=v=>esc(v==null?'--':v);
    const button=(label,action,attrs='',primary=false)=>`<button type="button" class="btn ${primary?'primary':''}" data-price="${action}" ${attrs}>${esc(label)}</button>`;
    const tool=(label,action,icon,attrs='')=>`<button type="button" class="cm-icon-button" data-price="${action}" title="${label}" aria-label="${label}" ${attrs}><i data-lucide="${icon}"></i></button>`;
    const link=(label,action,attrs='')=>`<button type="button" class="btn-link" data-price="${action}" ${attrs}>${text(label)}</button>`;
    const attrs=(key,value)=>`data-${key}="${esc(value)}"`;
    const purposeName=p=>p==='oracle'?'预言机输入':'外部盘口';
    const pair=(label,value)=>[label,value];
    const grid=items=>'<div class="cm-grid">'+items.map(([k,v])=>`<div class="cm-detail-field"><span>${text(k)}</span><div>${text(v)}</div></div>`).join('')+'</div>';
    const sourceLabel=s=>s?(s.name||s.id)+(s.planName?' · '+s.planName:''):'--';
    const skipDiff=k=>['fixtureOutcome','catalogueScenario','healthy','events','draft','phase','check','connection'].includes(k);
    function selectPairs(label,name,value,options,disabled=false) {
      const id='px-'+name;
      return `<div class="cm-field"><label for="${id}">${label}</label><select class="control" id="${id}" name="${name}" ${disabled?'disabled':''}>${options.map(o=>`<option value="${esc(o.id)}" ${String(value)===String(o.id)?'selected':''}>${text(o.label)}</option>`).join('')}</select></div>`;
    }
    function input(label,name,value,options=null,type='text',suffix='',idPrefix='px-') {
      const id=idPrefix+name;
      return `<div class="cm-field"><label for="${id}">${label}</label>${options?`<select class="control" id="${id}" name="${name}">${options.map(o=>`<option value="${esc(o)}" ${String(value)===String(o)?'selected':''}>${text(o)}</option>`).join('')}</select>`:`<div class="cm-input-unit"><input class="control" id="${id}" name="${name}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(value ?? '')}">${suffix?'<span>'+suffix+'</span>':''}</div>`}</div>`;
    }
    function selectSource(name,value,fx=false) {
      return `<select class="control" name="${name}" aria-label="${fx?'汇率':'报价'}来源">${state.sources.filter(s=>!fx || s.capabilities?.includes('汇率')).map(s=>`<option value="${s.id}" ${s.id===value?'selected':''}>${text(sourceLabel(s))}</option>`).join('')}</select>`;
    }
    function table(key,heads,rows,{paged=true,search=true}={}) {
      ui.filters ||= {};
      const filterColumns=key==='来源列表'?[['供应方',2],['来源类别',3],['接入方案',4],['启用状态',8],['接入状态',9]]:key==='支持行情'?[['市场类型',2],['计价资产',4],['状态',7]]:key==='聚合历史'?[['状态',6]]:key==='配置变更'?[['状态',4]]:[];
      const q=ui.queries[key] || '', filtered=rows.filter(r=>r.map(c=>typeof c==='object'?c.label:c).join(' ').toLowerCase().includes(q.toLowerCase())&&filterColumns.every(([name,index])=>!ui.filters[key]?.[name]||String(r[index])===ui.filters[key][name]));
      const page=ui.pages[key]=Math.min(ui.pages[key] || 1,Math.max(1,Math.ceil(filtered.length/10))), visible=paged?filtered.slice((page-1)*10,page*10):filtered;
      ui.tables ||= {}; ui.tables[key]={heads,rows:filtered};
      const filterControls=filterColumns.map(([name,index])=>`<select class="control" name="${name}" aria-label="${name}"><option value="">全部${name}</option>${[...new Set(rows.map(r=>String(r[index])))].map(v=>`<option value="${esc(v)}" ${ui.filters[key]?.[name]===v?'selected':''}>${text(v)}</option>`).join('')}</select>`).join('');
      return `${search?`<form class="cm-search-filters" data-p-query="${key}"><input class="control" type="search" name="keyword" value="${esc(q)}" aria-label="${key}关键字" placeholder="编号 / 来源 / 交易对 / 状态">${filterControls}${button('查询','query',attrs('key',key))}${button('重置','reset',attrs('key',key))}${tool('导出查询结果','export','download',attrs('key',key))}</form>`:''}<div class="cm-table-scroll"><table class="cm-table" data-price-table="${key}"><thead><tr>${heads.map(h=>'<th>'+text(h)+'</th>').join('')}</tr></thead><tbody>${visible.map(r=>'<tr>'+r.map((c,i)=>`<td class="${i===0?'cm-sticky':''}">${typeof c==='object'?c.html:text(c)}</td>`).join('')+'</tr>').join('')||`<tr><td colspan="${heads.length}"><div class="cm-empty">暂无匹配数据</div></td></tr>`}</tbody></table></div>${paged?`<div class="cm-pager"><span>共 ${filtered.length} 条 · 第 ${page} / ${Math.max(1,Math.ceil(filtered.length/10))} 页</span><div class="cm-actions">${tool('上一页','page','chevron-left',attrs('key',key)+` data-page="${page-1}" ${page===1?'disabled':''}`)}${tool('下一页','page','chevron-right',attrs('key',key)+` data-page="${page+1}" ${page*10>=filtered.length?'disabled':''}`)}</div></div>`:''}`;
    }
    const cell=(label,html)=>({label,html});
    function rerender() { persist(); ctx.render(); refreshIcons(); }
    function header(title,actions='') { return `<div class="cm-section-head"><h2>${title}</h2><div class="cm-actions">${actions}</div></div>`; }
    function connection(s) { return tag(s.connection || '未检查'); }
    function renderSources() {
      $('#breadcrumb').textContent='价格源管理';
      root.innerHTML=`<div class="cm-heading"><div><h1>价格源管理</h1><div class="cm-heading-sub">${state.sources.filter(s=>s.enabled).length} 个启用 · 演示行情</div></div><div class="cm-actions">${roleControl()}${button('新增价格源','source-new','',true)}</div></div><div class="cm-workspace cm-surface">${table('来源列表',['来源代码','来源名称','供应方','来源类别','接入方案','接入范围','支持能力','独立分组','启用状态','接入状态','关联合约数','操作'],state.sources.map(s=>[s.code,cell(s.name,link(s.name,'source',attrs('id',s.id))),s.platform,s.category,s.planName || '--',s.scope || s.type,(s.capabilities || []).join(' / ') || '待补全',s.group,s.enabled?'启用':'停用',s.connection,new Set(E.impacts(s.id,{}).map(i=>i.market)).size,cell('详情 编辑 启停',link('详情','source',attrs('id',s.id))+' '+link('编辑','source-edit',attrs('id',s.id))+' '+link(s.enabled?'停用':'启用','source-toggle',attrs('id',s.id)))]))}</div>`;
    }
    function renderSource(id) {
      const s=E.source(id); if (!s) { renderSources(); return; } ui.source=id;
      if (!['基础与接入','支持行情','引用关系'].includes(ui.sourceTab)) ui.sourceTab='基础与接入';
      $('#breadcrumb').textContent='价格源 / '+s.name;
      const cat=E.catalogue.get(s);
      const alert=s.check?.result==='失败' || cat.status==='失败' ? `<div class="cm-notice danger" role="alert">${text(s.check?.reason || cat.error || '当前接入或目录异常')}</div>` : '';
      let body='';
      if(ui.sourceTab==='支持行情')body=catalogueView(s);
      if (ui.sourceTab==='基础与接入') {
        body=alert+header('供应方与接入方案')+grid([pair('供应方',s.platform),pair('接入方案',s.planName || '--'),pair('来源名称',s.name),pair('来源代码',s.code),pair('启用状态',s.enabled?'启用':'停用')])+
          header('自动读取属性')+grid([pair('来源类别',s.category),pair('接入范围',s.scope || s.type),pair('支持能力',s.capabilities.join(' / ') || '待补全'),pair('独立分组',s.group),pair('独立性核对依据',s.proof),pair('技术通道',s.channel)])+
          header('运行检查')+grid([pair('连接状态',s.connection),pair('最近检查时间',date(s.check?.at)),pair('当前异常原因',s.check?.result==='失败'?s.check.reason:cat.status==='失败'?cat.error:'--')]);
      }
      if (ui.sourceTab==='引用关系') body=table('引用关系',['合约','用途','引用类型','有效源数','独立源数','价格状态','影响原因'],E.impacts(id,{}).map(i=>[cell(i.code,link(i.code,'plan-go',attrs('market',i.market)+attrs('purpose',i.purpose))),purposeName(i.purpose),i.reference,i.valid,i.independent,i.status,i.reason || '--']));
      root.innerHTML=`<div class="cm-heading"><div class="cm-heading-id">${tool('返回价格源列表','sources','arrow-left')}<div><h1>${text(s.name)}</h1><div class="cm-heading-sub">${tag(s.enabled?'启用':'停用')} ${connection(s)}</div></div></div><div class="cm-actions">${roleControl()}${button('编辑','source-edit',attrs('id',id))}${button('检查连接','source-check',attrs('id',id))}${button(s.enabled?'停用':'启用','source-toggle',attrs('id',id))}</div></div><div class="cm-workspace"><div class="cm-tabs" role="tablist">${['基础与接入','支持行情','引用关系'].map(t=>`<button class="cm-tab ${ui.sourceTab===t?'active':''}" role="tab" aria-selected="${ui.sourceTab===t}" data-price="source-tab" data-tab="${t}">${t}</button>`).join('')}</div><div class="cm-surface">${body}</div></div>`;
    }
    function entryRefs(s,entry) {
      return Object.values(E.db.plans).flatMap(groups=>Object.values(groups)).filter(b=>b.current.status==='已生效').flatMap(({current:p})=>p.bindings.filter(b=>b.enabled).flatMap(b=>{
        const direct=b.source===s.id && E.catalogue.resolve(s,b)?.id===entry.id;
        const fx=b.rule.legs.some(l=>l.source===s.id && l.base===entry.base && l.quote===entry.quote && entry.basis==='汇率');
        return direct||fx?[{market:p.market,purpose:p.purpose,plan:p.id,kind:direct?'直接取价':'汇率依赖'}]:[];
      }));
    }
    function catalogueView(s) {
      const c=E.catalogue.get(s),scenario=ui.catalogueScenarios?.[s.id] || '正常';
      return header('支持行情',`<span class="cm-unit">按接入方案同步目录</span>${button(c.status==='失败'?'重试同步':'同步目录','catalogue-sync',attrs('id',s.id),true)}`)+grid([pair('同步状态',c.status),pair('最近成功同步',date(c.lastSuccess)),pair('可关联行情数',c.entries.filter(e=>e.status==='可关联').length),pair('接入方案',s.planName || '--')])+`<div class="cm-search-filters" style="margin-top:16px">${input('演示调试 · 目录样例情景','catalogueScenario',scenario,['正常','同步失败','移除BTC现货','新增行情','空目录'])}<label class="price-auto"><input type="checkbox" data-catalogue-auto ${ui.catalogueAuto?'checked':''}>自动同步（60秒）</label></div>${c.error?'<div class="cm-notice danger" role="alert">'+text(c.error)+' · 保留上次成功目录</div>':''}`+
        table('支持行情',['行情标识','交易对 / 喂价名称','市场类型','标的资产','计价资产','输入能力','单位倍率','状态','引用数','操作'],c.entries.map(e=>[e.nativeId,e.pair,e.type,e.base,e.quote,e.basis,e.multiplier,e.status,entryRefs(s,e).length,cell('详情',link('详情','catalogue-entry',attrs('id',s.id)+attrs('entry',e.id)))]));
    }
    function entryDialog(s,entry,version) {
      const c=E.catalogue.get(s);
      dialog('来源行情 · '+entry.pair,grid([pair('来源',s.name),pair('来源行情标识',entry.nativeId),pair('目录版本','V'+c.version),pair('行情版本','V'+entry.version),pair('状态',entry.status),pair('市场类型',entry.type),pair('标的资产',entry.base),pair('计价资产',entry.quote),pair('资产映射标识',entry.assetId),pair('输入能力',entry.basis),pair('单位倍率',entry.multiplier),pair('最近成功同步',date(c.lastSuccess))])+header('生效方案引用')+table('行情引用',['合约','用途','引用类型','方案'],entryRefs(s,entry).map(r=>[cell(E.market(r.market).code,link(E.market(r.market).code,'plan-go',attrs('market',r.market)+attrs('purpose',r.purpose))),purposeName(r.purpose),r.kind,r.plan]),{paged:false,search:false}),button('关闭','close'),true);
      if(version){const history=c.history.find(h=>h.version===version);const fields=overlay.querySelectorAll('.cm-detail-field');for(const field of fields){const name=field.firstElementChild.textContent;if(name==='目录版本')field.lastElementChild.textContent='V'+version;if(name==='最近成功同步'){field.firstElementChild.textContent='目录快照时间';field.lastElementChild.textContent=date(history?.at);}}}
      overlay.querySelector('.cm-dialog-body').insertAdjacentHTML('beforeend',grid([pair('引用口径','当前生效方案，不回放历史引用数量')]));
    }
    function planGrid(p) { return grid([pair('方案标识',p.id),pair('方案版本','V'+p.version),pair('用途',purposeName(p.purpose)),pair('发布状态',p.status),pair('目标计价单位',p.target+'/'+E.market(p.market).base),pair('聚合方式','加权中位数 · 公式'+(p.purpose==='oracle'?'45':'46')),pair('最大报价年龄',p.maxAge+' 秒'),pair('最少独立源数',p.minSources ?? '不适用'),pair('单组权重上限',p.groupCap+'%'),pair('准入策略',p.admission),pair('异常策略',p.outlier),pair('运行模式',p.mode),pair('创建时间',date(p.created)),pair('生效时间',date(p.effectiveAt))]); }
    function bindingTable(p,search=true) {
      ui.planVersions ||= {}; ui.planVersions[p.id+'@'+p.version]=E.copy(p);
      return table('方案来源'+p.purpose,['来源','来源交易对','输入口径','原始单位','配置权重','启用状态','换算规则','映射状态'],p.bindings.map(b=>[cell(sourceLabel(E.source(b.source)),link(sourceLabel(E.source(b.source)),'source',attrs('id',b.source))),b.pair,b.basis,b.quote+'/'+b.base,b.weight,b.enabled?'启用':'停用',cell(b.rule.id,link(b.rule.id+' V'+b.rule.version,'rule',attrs('plan',p.id+'@'+p.version)+attrs('binding',b.id))),b.needsMapping?'待补全':'已配置']),{paged:false,search});
    }
    function renderGroup(g,m) {
      if (!['CM22','CM23','CM24','CM26','RC10','RC11','RC12'].includes(g)) return null;
      E.ensure(m);
      if(g.startsWith('RC')) {
        const p=E.current(m,ui.purpose),snap=latest(m,ui.purpose),names=window.ContractModel.fields(g).map(f=>f.name),values={
          '适用来源用途':purposeName(p.purpose),'来源独立分组':[...new Set(p.bindings.map(b=>E.source(b.source)?.group))].join(' / '),'单来源组最大权重占比':p.groupCap+'%',
          '配置权重占比':p.bindings.filter(b=>b.enabled).map(b=>E.source(b.source)?.group+'：'+b.weight).join('；')+'（原始系数）',
          '当前有效权重占比':snap.inputs.filter(i=>i.accepted).map(i=>i.group+'：'+num(i.share,4)+'%').join('；') || '--',
          '独立来源关系版本':snap.inputs.map(i=>i.group+' V'+i.sourceConfig?.groupVersion).join('；'),'权重超限处理':'发布阻塞；运行时集中风险告警',
          '准入策略模板':p.admission,'当前双边深度与数据时间':'未接入深度样例','准入状态与原因':'基础能力及质量校验；深度准入未启用',
          '异常报价策略与版本':p.outlier,'独立参考集合规则':'排除被评估来源整个独立组','报价异常偏离阈值':p.threshold+'%','恢复偏离阈值':p.recovery+'%',
          '运行模式':p.mode,'当前偏离与参考价':snap.inputs.map(i=>(i.sourceConfig?.name || '--')+'：'+(i.deviation==null?'参考不可用':num(i.deviation,4)+'% / '+num(i.reference)+' '+snap.unit)).join('；'),
          '来源处理状态':snap.inputs.map(i=>(i.sourceConfig?.name || '--')+'：'+(i.reason || i.observation)).join('；')
        };
        const configured={},effective={};let total=new D(0);
        for(const b of p.bindings.filter(b=>b.enabled)){const group=E.source(b.source)?.group || b.source;configured[group]=(configured[group] || new D(0)).plus(b.weight);total=total.plus(b.weight);}
        for(const i of snap.inputs.filter(i=>i.accepted))effective[i.group]=(effective[i.group] || new D(0)).plus(i.share);
        values['配置权重占比']=Object.entries(configured).map(([k,v])=>k+'：'+(total.gt(0)?num(v.div(total).mul(100),4):'--')+'%').join('；');
        values['当前有效权重占比']=Object.entries(effective).map(([k,v])=>k+'：'+num(v,4)+'%').join('；') || '--';
        return header(window.ContractModel.schema[g].title,button('编辑所属方案','plan-edit',attrs('market',m.id)+attrs('purpose',p.purpose)))+`<div class="cm-search-filters">${input('用途','purpose',purposeName(ui.purpose),['预言机输入','外部盘口'])}</div>`+grid(names.map(n=>[n,values[n] || '不适用：当前基础观察模板未启用此参数']));
      }
      if (g==='CM23' || g==='CM24') {
        const purpose=g==='CM23'?'oracle':'external',p=E.current(m,purpose),b=E.bucket(m,purpose);
        return header(purposeName(purpose)+'定价方案',button(b.draft?'继续编辑草稿':'编辑方案','plan-edit',attrs('market',m.id)+attrs('purpose',purpose),true))+planGrid(p)+header('关联配置')+bindingTable(p)+header('方案版本')+table('方案版本'+purpose,['版本','生效时间','目标单位','关联数','操作'],b.history.slice().reverse().map(h=>['V'+h.version,date(h.effectiveAt),h.target+'/'+m.base,h.bindings.length,cell('查看 回滚',link('查看','plan-version',attrs('market',m.id)+attrs('purpose',purpose)+attrs('version',h.version))+' '+link('回滚','plan-rollback',attrs('market',m.id)+attrs('purpose',purpose)+attrs('version',h.version)))]))+header('配置变更')+changesTable(E.db.changes.filter(c=>c.scope==='plan' && c.target===p.id));
      }
      const p=E.current(m,ui.purpose),snap=latest(m,ui.purpose);
      if (g==='CM22') return header('协议价格与采集价格')+grid([pair('合约规格版本','V'+m.version),pair('抵押币种',m.settle),pair('结算币种',m.settle),pair('协议样例预言机价格',m.quality==='不可用'?'--':new D(m.price).mul('1.0001').toString()+' '+m.quote+'/'+m.base),pair('协议样例标记价格',m.quality==='不可用'?'--':m.price+' '+m.quote+'/'+m.base),pair('协议快照时间',m.protocolPriceAt+' UTC+8'),pair('协议快照时效','历史样例，非实时协议价格'),pair('协议数据来源','独立协议样例'),pair('采集结果','查看采集聚合监控')])+header('采集聚合摘要',button('打开监控','monitor',attrs('market',m.id)))+summary(snap);
      return header('采集聚合监控',`<span class="cm-unit">演示行情</span>${tool('刷新采集数据','capture','refresh-cw')}<label class="price-auto"><input type="checkbox" data-price-auto ${ui.auto?'checked':''}>自动刷新</label>`)+`<div class="cm-search-filters">${input('用途','purpose',purposeName(ui.purpose),['预言机输入','外部盘口'])}${input('样例情景','scenario',ui.scenario,['正常','报价过期','汇率过期','缺失报价','未来时间','盘口倒挂','偏离观察','读取失败'])}</div>${ui.syncError?'<div class="cm-notice danger" role="alert">'+text(ui.syncError)+'</div>':''}`+summary(snap)+header('当前取价明细')+inputsTable(snap)+header('历史采集聚合快照')+table('聚合历史',['快照编号','方案版本','计算时间','有效源数','独立源数','采集价格','状态'],E.db.snapshots.filter(s=>s.plan.id===p.id).slice().reverse().map(s=>[cell(s.id,link(s.id,'snapshot',attrs('id',s.id))),'V'+s.plan.version,date(s.time),s.valid,s.independent,s.price?num(s.price)+' '+s.unit:'--',s.status]));
    }
    function latest(m,purpose) {
      const p=E.current(m,purpose),last=E.db.snapshots.filter(s=>s.plan.id===p.id && s.plan.version===p.version).at(-1);
      if (last) return last;
      if (!E.db.demoSeeded && !E.db.migration) {
        E.db.demoSeeded=true;
        for(let i=12;i>0;i--)E.evaluate(p,{time:Date.now()-i*60000,scenario:i===3?'报价过期':i===7?'汇率过期':'正常',save:true});
      }
      const snapshot=E.capture(m,purpose,'正常');persist();return snapshot;
    }
    function summary(s) { return `<div class="price-summary">${[['采集聚合价格',s.price?num(s.price,4):'--',s.unit],['采集可用状态',s.status,s.reason || '正常'],['有效源 / 启用源',s.valid+' / '+s.enabled,'有效独立源 '+s.independent],['快照形成时间',date(s.time),s.id+' · V'+s.plan.version]].map(([k,v,u])=>`<div><span>${k}</span><strong>${text(v)}</strong><small>${text(u)}</small></div>`).join('')}</div>`; }
    function inputsTable(s) { return table('当前取价',['来源','交易对','原始报价','归一化报价','报价年龄（秒）','配置权重','有效占比（%）','连接状态','采用结论','详情'],s.inputs.map(i=>[i.sourceConfig?.name || i.binding.source,i.binding.pair,num(i.raw.price)+' '+unit(i.raw),i.normalized?num(i.normalized)+' '+s.unit:'--',i.age,i.weight,num(i.share,4),i.raw.connection,i.accepted?(i.observation==='正常'?'采用':i.observation):i.reason,cell('查看',link('查看','input',attrs('snapshot',s.id)+attrs('id',i.id)))]),{paged:false}); }
    function changesTable(changes) { return table('配置变更',['变更编号','作用域','原因','提交时间','状态','复核人','操作'],changes.slice().reverse().map(c=>[cell(c.id,link(c.id,'change',attrs('id',c.id))),c.scope==='plan'?'合约方案':'价格源',c.reason,date(c.created),c.status,c.reviewer || '--',cell('详情',link('详情','change',attrs('id',c.id)))])); }
    function showSnapshot(id) {
      const s=E.db.snapshots.find(s=>s.id===id); if (!s) throw Error('快照不存在');
      dialog('采集聚合快照 · '+id,summary(s)+planGrid(s.plan)+inputsTable(s),button('关闭','close'),true);
    }
    function showQuote(id,parent) {
      const q=E.db.quotes.find(q=>q.id===id); if (!q) throw Error('原始报价不存在');
      dialog('原始报价 · '+q.id,grid([pair('快照编号',q.id),pair('来源',q.sourceConfig?.name),pair('来源配置版本','V'+q.sourceVersion),pair('交易对',q.pair),pair('输入口径',q.basis),pair('原始报价',num(q.price)+' '+unit(q)),pair('最优买价',num(q.bid)+' '+unit(q)),pair('最优卖价',num(q.ask)+' '+unit(q)),pair('生成时间',date(q.generatedAt)),pair('接收时间',date(q.receivedAt)),pair('置信度比例',q.basis==='供应商单价'?q.quality.confidencePct+'%':'不适用'),pair('数据充分性',q.quality.sufficient?'充分':'不足'),pair('来源',q.provenance)]),parent?button('返回聚合快照','snapshot',attrs('id',parent)):button('关闭','close'),true);
      overlay.querySelector('.cm-dialog-body').insertAdjacentHTML('beforeend',grid([pair('目录版本',q.catalogueVersion?'V'+q.catalogueVersion:'旧快照未记录'),pair('来源行情标识',q.catalogueEntry?.nativeId),pair('行情版本',q.catalogueEntry?'V'+q.catalogueEntry.version:'--'),pair('当时目录状态',q.catalogueEntry?.status)]));
    }
    function showInput(snapshot,id) {
      const s=E.db.snapshots.find(s=>s.id===snapshot),i=s?.inputs.find(i=>i.id===id); if (!i) throw Error('取价快照不存在');
      dialog('取价快照 · '+id,grid([pair('判定时间',date(i.at)),pair('来源配置版本','V'+i.sourceConfig?.revision),pair('独立分组',i.group),pair('关系版本','V'+i.sourceConfig?.groupVersion),pair('关联版本',i.binding.id+' V'+i.binding.version),pair('换算规则',i.binding.rule.id+' V'+i.binding.rule.version),pair('实际汇率',i.rate),pair('归一化报价',i.normalized?num(i.normalized)+' '+s.unit:'--'),pair('独立参考价',i.reference?num(i.reference)+' '+s.unit:'不可用'),pair('偏离',i.deviation==null?'--':num(i.deviation,4)+'%'),pair('采用结论',i.accepted?'采用':'排除'),pair('排除原因',i.reason || '--')])+header('输入依据')+table('快照输入',['类型','快照编号','来源','交易对','原始报价','生成时间'],[i.raw,...i.fx].map((q,n)=>[n?'汇率报价':'标的报价',cell(q.id,link(q.id,'quote',attrs('id',q.id)+attrs('parent',s.id))),q.sourceConfig?.name,q.pair,num(q.price)+' '+unit(q),date(q.generatedAt)]),{paged:false,search:false}),button('返回聚合快照','snapshot',attrs('id',s.id)),true);
    }
    function editPlan(m,purpose,rollback=null) {
      if (state.role!=='运营管理员') throw Error('仅运营管理员可编辑方案');
      if(!m.version)throw Error('请先完成新增合约配置发布');
      const b=E.bucket(m,purpose),p=E.copy(rollback || b.draft || b.current);
      if(rollback)p.version=b.current.version;
      ui.form={kind:'plan',m:m.id,purpose,draft:p}; ui.dirty=false; drawPlan();
    }
    function drawPlan() {
      const p=ui.form.draft;
      dialog('编辑定价方案 · '+purposeName(p.purpose),`<form id="pricePlanForm"><div class="cm-form-grid">${input('目标计价资产','target',p.target,['USDC','USDT','USD'])}${input('最大报价年龄','maxAge',p.maxAge,null,'number','秒')}${p.purpose==='oracle'?input('最少独立源数','minSources',p.minSources,null,'number','个'):''}${input('单组权重上限','groupCap',p.groupCap,null,'number','%')}${input('异常偏离阈值','threshold',p.threshold,null,'number','%')}${input('恢复偏离阈值','recovery',p.recovery,null,'number','%')}</div></form>${header('关联配置',button('关联来源','binding-add'))}${table('编辑来源',['来源','交易对','输入口径','权重','启用','换算','操作'],p.bindings.map((b,i)=>[sourceLabel(E.source(b.source)),b.pair,b.basis,b.weight,b.enabled?'启用':'停用',b.rule.mode,cell('编辑 移除',link('编辑','binding-edit',attrs('index',i))+' '+link('移除','binding-remove',attrs('index',i)))]),{search:false,paged:false})}<div id="priceError" class="cm-field-error" role="alert"></div>`,button('取消','close')+button('配置预检','plan-check')+button('保存草稿','plan-save')+button('提交发布','plan-submit','',true),true);
    }
    function collectPlan() { const f=$('#pricePlanForm'); if (f) Object.assign(ui.form.draft,Object.fromEntries(new FormData(f))); }
    function editBinding(index) {
      collectPlan(); const p=ui.form.draft,b=p.bindings[index]; ui.form.binding=index;
      const s=E.source(b.source),entries=E.available(s,E.market(p.market).base,p.target,p.purpose),selected=entries.find(e=>e.id===b.catalogueId) || (!b.catalogueId?entries.find(e=>e.pair===b.pair&&e.basis===b.basis):null);
      if(selected)E.catalogue.select(s,b,selected);
      const c=E.catalogue.get(s),placeholder=c.status==='失败'?'目录读取失败':!c.version?'目录尚未同步':entries.length?'请选择来源行情':'无可用行情';
      dialog('来源关联与换算',`<form id="priceBindingForm"><div class="cm-form-grid"><div class="cm-field"><label>价格源</label>${selectSource('source',b.source)}</div><div class="cm-field"><label for="priceInstrument">来源交易对 / 喂价标识</label><select class="control" id="priceInstrument" name="instrument" ${!entries.length?'disabled':''}><option value="" disabled ${!selected?'selected':''}>${placeholder}</option>${entries.map(e=>`<option value="${esc(e.id)}" ${selected?.id===e.id?'selected':''}>${text(e.pair)} · ${text(e.type)} · ${text(e.quote+'/'+e.base)}</option>`).join('')}</select></div>${input('配置权重','weight',b.weight,null,'number')}${input('关联启用','enabled',b.enabled?'启用':'停用',['启用','停用'])}${input('换算方式','mode',b.rule.mode,['恒等','单位转换'])}${input('汇率最大年龄','maxAge',b.rule.maxAge,null,'number','秒')}</div>${header('方案与行情属性',button('刷新目录','binding-sync'))}${grid([pair('来源类别',s?.category),pair('接入范围',s?.scope || s?.type),pair('支持能力',(s?.capabilities||[]).join(' / ')),pair('接入方案',s?.planName),pair('目录版本','V'+c.version),pair('来源市场类型',selected?.type),pair('原始标的资产',selected?.base),pair('原始计价资产',selected?.quote),pair('输入口径',selected?.basis),pair('单位倍率',selected?.multiplier)])}<h3>汇率路径</h3><div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>汇率来源</th><th>来源行情</th><th>方向</th><th>操作</th></tr></thead><tbody>${b.rule.legs.map((l,j)=>`<tr><td>${selectSource('fxSource'+j,l.source,true)}</td><td>${fxSelect(l,j)}</td><td><select class="control" name="fxDirection${j}" aria-label="汇率方向"><option ${l.direction==='乘'?'selected':''}>乘</option><option ${l.direction==='除'?'selected':''}>除</option></select></td><td>${tool('移除汇率路径','fx-remove','trash-2',attrs('index',j))}</td></tr>`).join('')}</tbody></table></div>${button('增加汇率路径','fx-add')}<div id="priceError" class="cm-field-error" role="alert">${c.error?text(c.error):''}</div></form>`,button('返回方案','binding-cancel')+button('确认关联','binding-save','',true),true);
    }
    function fxSelect(leg,index) {
      const s=E.source(leg.source),entries=s&&E.catalogue.usable(s)?E.catalogue.get(s).entries.filter(e=>e.status==='可关联'&&e.basis==='汇率'):[];
      const selected=entries.find(e=>e.base===leg.base&&e.quote===leg.quote);
      return `<select class="control" name="fxInstrument${index}" aria-label="汇率来源行情" ${!entries.length?'disabled':''}><option value="" ${!selected?'selected':''} disabled>选择汇率行情</option>${entries.map(e=>`<option value="${esc(e.id)}" ${e.id===selected?.id?'selected':''}>${text(e.pair)} · ${text(e.quote+'/'+e.base)}</option>`).join('')}</select>`;
    }
    function collectBindingSettings() {
      const f=new FormData($('#priceBindingForm')),b=ui.form.draft.bindings[ui.form.binding];
      b.weight=String(f.get('weight') || '').trim();b.enabled=f.get('enabled')==='启用';b.rule.mode=f.get('mode');b.rule.maxAge=f.get('maxAge');
      return f;
    }
    function collectBinding() {
      const f=collectBindingSettings(),p=ui.form.draft,b=p.bindings[ui.form.binding],s=E.source(f.get('source'));
      const entry=E.available(s,E.market(p.market).base,p.target,p.purpose).find(e=>e.id===f.get('instrument'));
      if(!entry)throw Error('请选择当前目录中的可用来源行情');
      E.catalogue.select(s,b,entry);b.rule.from=b.quote;b.rule.to=p.target;b.rule.base=b.base;
      b.rule.legs=b.rule.legs.map((l,j)=>{
        const fs=E.source(f.get('fxSource'+j)),fx=fs&&E.catalogue.get(fs).entries.find(e=>e.id===f.get('fxInstrument'+j)&&e.status==='可关联'&&e.basis==='汇率');
        if(!fx || !E.catalogue.usable(fs))throw Error('请选择有效目录中的汇率行情');
        return {source:fs.id,base:fx.base,quote:fx.quote,direction:f.get('fxDirection'+j),catalogueId:fx.id,catalogueEntryVersion:fx.version,catalogueVersion:E.catalogue.get(fs).version};
      });
    }
    function publication(scope,target,draft) {
      ui.form={kind:'publish',scope,target,draft:E.copy(draft)};
      const before=scope==='plan'?E.current(E.market(draft.market),draft.purpose):E.source(target);
      const keys=[...new Set([...Object.keys(draft),...Object.keys(before||{})])].filter(k=>!skipDiff(k) && JSON.stringify(draft[k])!==JSON.stringify(before?.[k]));
      dialog('提交价格配置变更',grid([pair('作用域',scope==='plan'?'合约方案':'价格源'),pair('变更字段',keys.join('、') || '发布当前草稿'),pair('接入方案版本',scope==='source'?(draft.planName || '--')+' V'+(draft.planVersion || '--'):'--'),pair('当前版本','V'+(scope==='plan'?before.version:before.revision))])+`<form id="pricePublishForm">${input('操作原因','reason','')} ${input('生效方式','mode','即时生效',['即时生效','定时生效'])}${input('计划生效时间（本地时区）','scheduled','',null,'datetime-local')}</form><div id="priceError" class="cm-field-error" role="alert"></div>`,button('取消','close')+button('提交审批','submit','',true),true);
    }
    function sourceForm(id,rollback=null) {
      if (state.role!=='运营管理员') throw Error('仅运营管理员可编辑来源');
      const original=id?E.source(id):null;
      const s=E.copy(rollback || original?.draft || original || {id:E.id('SOURCE'),enabled:false,healthy:false,connection:'未检查',capabilities:[],revision:0,groupVersion:1,created:E.stamp(),events:[]});
      if (!original) { E.applyPlan(s, E.plansFor('Binance')[0], {resetCheck:false, rename:true}); s.code=E.nextCode(s.platform); }
      else if (!s.planId && E.resolvePlan(s)) E.applyPlan(s, E.resolvePlan(s), {resetCheck:false, rename:false});
      if (rollback && original) { s.check=original.check; s.revision=original.revision; s.code=original.code; }
      ui.form={kind:'source',draft:s,isNew:!original};
      drawSource();
    }
    function drawSource() {
      const s=ui.form.draft, published=s.revision>0, plans=E.plansFor(s.platform), impact=E.sourceImpactKind(E.source(s.id), s);
      dialog(ui.form.isNew?'新增价格源':'编辑价格源',`<form id="priceSourceForm" class="cm-form-grid">${selectPairs('供应方','platform',s.platform,E.providers.map(p=>({id:p.id,label:p.name})),published)}${selectPairs('接入方案','planId',s.planId,plans.map(p=>({id:p.id,label:p.name})))}${input('来源名称','name',s.name)}<div class="cm-field"><label for="px-code">来源代码</label><input class="control" id="px-code" name="code" value="${esc(s.code || '')}" readonly></div>${impact=== '更换接入方案'?input('操作原因','reason',s.reason || ''):''}</form>${header('方案带出属性')}${grid([pair('来源类别',s.category),pair('接入范围',s.scope || s.type),pair('支持能力',(s.capabilities||[]).join(' / ') || '待补全'),pair('独立分组',s.group),pair('独立性核对依据',s.proof),pair('技术通道',s.channel)])}${header('连接与目录检查结果')}<div id="priceCheck" class="cm-notice">${text(sourceCheckSummary(s))}</div><details class="cm-debug"><summary>演示调试</summary><form id="priceDebugForm" class="cm-form-grid">${input('样例通道结果','fixtureOutcome',s.fixtureOutcome || 'success',['success','failure'])}${input('样例目录结果','catalogueScenario',s.catalogueScenario || '正常',['正常','同步失败'])}</form></details><div id="priceError" class="cm-field-error" role="alert"></div>`,button('取消','close')+button('检查连接','source-form-check')+button('保存','source-save','',true),true);
    }
    function collectSource() {
      const form=$('#priceSourceForm');
      if (form) {
        const f=Object.fromEntries(new FormData(form));
        ui.form.draft.name=f.name;
        if (!ui.form.draft.revision) ui.form.draft.platform=f.platform;
        ui.form.draft.planId=f.planId;
        if (f.reason!=null) ui.form.draft.reason=f.reason;
      }
      const debug=$('#priceDebugForm');
      if (debug) Object.assign(ui.form.draft, Object.fromEntries(new FormData(debug)));
    }
    function sourceCheckSummary(s) {
      const c=E.catalogue.get(s);return (s.check?.result || '未检查')+' · 目录'+c.status+' · '+c.entries.filter(e=>e.status==='可关联').length+' 项行情'+(c.error?' · '+c.error:'');
    }
    function changeDialog(id) {
      const c=E.db.changes.find(c=>c.id===id); if(!c) throw Error('配置变更不存在');
      const fields=[...new Set([...Object.keys(c.previous || {}),...Object.keys(c.draft)])].filter(k=>!skipDiff(k) && JSON.stringify(c.previous?.[k])!==JSON.stringify(c.draft[k]));
      const diff=table('变更差异',['字段','变更前','变更后'],fields.map(k=>[k,JSON.stringify(c.previous?.[k]) ?? '--',JSON.stringify(c.draft[k]) ?? '--']),{paged:false,search:false});
      dialog('配置变更 · '+c.id,grid([pair('状态',c.status),pair('作用域',c.scope==='plan'?'合约方案':'价格源'),pair('操作原因',c.reason),pair('申请人',c.actor),pair('复核人',c.reviewer),pair('复核意见',c.reviewReason),pair('创建时间',date(c.created)),pair('计划时间',date(c.scheduled)),pair('实际生效时间',date(c.applied)),pair('失败原因',c.failure)])+header('配置差异')+diff+header('发布尝试')+table('发布尝试',['编号','开始时间','完成时间','结果','失败原因'],c.attempts.map(a=>[a.id,date(a.start),date(a.end),a.status,a.reason]),{paged:false,search:false})+`<form id="priceReviewForm">${input('复核 / 处理意见','comment','')}${input('样例服务确认','outcome','success',['success','failure'])}</form><div id="priceError" class="cm-field-error" role="alert"></div>`,button('关闭','close')+(c.status==='待审批'?button('驳回','review',attrs('id',id)+' data-approve="false"')+button('复核通过','review',attrs('id',id)+' data-approve="true"',true):'')+(['待生效','生效失败'].includes(c.status)?button('撤销变更','cancel-change',attrs('id',id))+button(c.status==='生效失败'?'重试生效':'执行生效','apply',attrs('id',id),true):''),true);
    }
    function redraw() { if (!overlay.hidden && $('#cmDialogTitle')?.textContent.startsWith('配置变更')) return; rerender(); }
    function close() { ctx.close(); }
    function canClose() {
      if(ui.confirming)return false;
      if(ui.ownsDialog && ui.form && ui.dirty){
        ui.cancelContent=overlay.firstElementChild;ui.confirming=true;
        dialog('离开未保存的价格配置','<p>当前修改尚未保存。</p>',button('继续编辑','keep-editing')+button('放弃修改','discard-price'));
        return false;
      }
      return true;
    }
    function dismiss() {
      const owned=ui.ownsDialog;ui.form=null;ui.dirty=false;ui.ownsDialog=false;ui.confirming=false;ui.cancelContent=null;
      if(owned && !state.editor)ctx.render();
    }
    function routeChanged(route) {
      if(ui.lastRoute!==route){ui.form=null;ui.dirty=false;ui.ownsDialog=false;ui.confirming=false;ui.cancelContent=null;ui.bindingAdded=false;ui.bindingBackup=null;ui.lastRoute=route;}
    }
    function capture() {
      const m=E.market(state.marketId); if(!m)return;
      try { E.capture(m,ui.purpose,ui.scenario);ui.syncError=''; } catch(e) { ui.syncError=e.message; }
      rerender();
    }
    function handle(action,b) {
      if(action==='keep-editing'){overlay.replaceChildren(ui.cancelContent);ui.confirming=false;ui.cancelContent=null;return;}
      if(action==='discard-price'){ui.dirty=false;ui.confirming=false;close();return;}
      if(action==='close'){close();return;}
      if(action==='sources'){ui.sourceTab='基础与接入';ctx.navigate('#sources');return;}
      if(action==='source'){ui.sourceTab='基础与接入';ctx.navigate('#sources/'+b.dataset.id);return;}
      if(action==='source-tab'){ui.sourceTab=b.dataset.tab;rerender();return;}
      if(action==='catalogue-sync'){const s=E.source(b.dataset.id);E.catalogue.sync(s,ui.catalogueScenarios?.[s.id] || '正常');rerender();return;}
      if(action==='catalogue-entry'){const s=E.source(b.dataset.id),c=E.catalogue.get(s),version=Number(b.dataset.version)||null,entries=version?c.history.find(h=>h.version===version)?.entries:c.entries,entry=entries?.find(e=>e.id===b.dataset.entry);if(!entry)throw Error('来源行情不存在');entryDialog(s,entry,version);return;}
      if(action==='plan-go'){ctx.navigate('#contracts/'+b.dataset.market+'/prices/'+(b.dataset.purpose==='oracle'?'CM23':'CM24'));return;}
      if(action==='monitor'){ctx.navigate('#contracts/'+b.dataset.market+'/prices/CM26');return;}
      if(action==='query'){const filters=Object.fromEntries(new FormData(b.closest('form')));ui.queries[b.dataset.key]=filters.keyword;delete filters.keyword;ui.filters[b.dataset.key]=filters;ui.pages[b.dataset.key]=1;rerender();return;}
      if(action==='reset'){ui.queries[b.dataset.key]='';ui.filters[b.dataset.key]={};ui.pages[b.dataset.key]=1;rerender();return;}
      if(action==='page'){ui.pages[b.dataset.key]=Number(b.dataset.page);rerender();return;}
      if(action==='export'){const t=ui.tables[b.dataset.key];ctx.exportData(b.dataset.key+'.csv',t.heads,t.rows.map(r=>r.map(c=>typeof c==='object'?c.label:c)));return;}
      if(action==='snapshot'){showSnapshot(b.dataset.id);return;}
      if(action==='quote'){showQuote(b.dataset.id,b.dataset.parent);return;}
      if(action==='input'){showInput(b.dataset.snapshot,b.dataset.id);return;}
      if(action==='capture'){capture();return;}
      if(action==='plan-edit'){editPlan(E.market(b.dataset.market),b.dataset.purpose);return;}
      if(action==='plan-version' || action==='plan-rollback') {
        const m=E.market(b.dataset.market),p=E.bucket(m,b.dataset.purpose).history.find(p=>p.version===Number(b.dataset.version));
        if(action==='plan-rollback')editPlan(m,b.dataset.purpose,p);else dialog('历史方案 · V'+p.version,planGrid(p)+bindingTable(p,false),button('关闭','close'),true);return;
      }
      if(action==='rule'){const p=ui.planVersions[b.dataset.plan],r=p?.bindings.find(r=>r.id===b.dataset.binding)?.rule;if(!r)throw Error('规则不存在');dialog('换算规则 · '+r.id,grid([pair('规则版本','V'+r.version),pair('处理方式',r.mode),pair('原始单位',r.from+'/'+r.base),pair('目标单位',r.to+'/'+r.base),pair('换算倍率',r.multiplier),pair('汇率最大年龄',r.maxAge+' 秒'),pair('失败处理',r.failure)])+table('汇率路径',['来源','供应方','接入方案','标的币','计价币','方向'],r.legs.map(l=>{const fs=E.source(l.source);return [sourceLabel(fs),fs?.platform || '--',fs?.planName || '--',l.base,l.quote,l.direction];}),{paged:false,search:false}),button('关闭','close'));return;}
      if(action==='binding-add'){collectPlan();const p=ui.form.draft,m=E.market(p.market),s=state.sources.find(s=>E.available(s,m.base,p.target,p.purpose).length);if(!s)throw Error('没有已同步且匹配的来源行情');const entry=E.available(s,m.base,p.target,p.purpose).find(e=>e.quote===p.target)||E.available(s,m.base,p.target,p.purpose)[0],row={id:E.id('BIND'),version:p.version,source:s.id,weight:'1',enabled:true};E.selectInstrument(row,entry,p.target);p.bindings.push(row);ui.bindingAdded=true;ui.bindingBackup=null;editBinding(p.bindings.length-1);return;}
      if(action==='binding-edit'){ui.bindingBackup=E.copy(ui.form.draft.bindings[Number(b.dataset.index)]);editBinding(Number(b.dataset.index));return;}
      if(action==='binding-remove'){collectPlan();ui.form.draft.bindings.splice(Number(b.dataset.index),1);ui.dirty=true;drawPlan();return;}
      if(action==='binding-cancel'){if(ui.bindingAdded)ui.form.draft.bindings.splice(ui.form.binding,1);else if(ui.bindingBackup)ui.form.draft.bindings[ui.form.binding]=ui.bindingBackup;ui.bindingAdded=false;ui.bindingBackup=null;drawPlan();return;}
      if(action==='binding-sync'){collectBindingSettings();E.catalogue.sync(E.source(ui.form.draft.bindings[ui.form.binding].source));persist();editBinding(ui.form.binding);return;}
      if(action==='fx-add' || action==='fx-remove'){collectBinding();const binding=ui.form.draft.bindings[ui.form.binding];if(action==='fx-add')binding.rule.legs.push({source:'src-fx',base:binding.quote,quote:ui.form.draft.target,direction:'乘'});else binding.rule.legs.splice(Number(b.dataset.index),1);editBinding(ui.form.binding);return;}
      if(action==='binding-save'){collectBinding();ui.bindingAdded=false;ui.bindingBackup=null;ui.dirty=true;drawPlan();return;}
      if(action==='plan-check' || action==='plan-save' || action==='plan-submit') {
        collectPlan();const p=ui.form.draft,errors=E.validate(p);
        if(action==='plan-save'){E.bucket(E.market(p.market),p.purpose).draft=E.copy(p);persist();ui.dirty=false;toast('方案草稿已保存');return;}
        if(errors.length)throw Error(errors.join('；'));
        if(action==='plan-check'){$('#priceError').textContent='配置预检通过';return;}
        publication('plan',p.id,p);return;
      }
      if(action==='source-new' || action==='source-edit'){sourceForm(b.dataset.id);return;}
      if(action==='source-check'){E.checkConnection(E.source(b.dataset.id));persist();rerender();toast('连接检查：'+E.source(b.dataset.id).check.result);return;}
      if(action==='source-form-check'){collectSource();E.checkConnection(ui.form.draft);$('#priceCheck').textContent=sourceCheckSummary(ui.form.draft);return;}
      if(action==='source-save' || action==='source-submit') {
        collectSource();const s=ui.form.draft, before=E.source(s.id)?E.copy(E.source(s.id)):null;
        try {
          E.applySource(s,state.role,s.reason || '');
        } catch (error) {
          if (before && E.source(s.id)) Object.assign(E.source(s.id), before);
          throw error;
        }
        persist();ui.dirty=false;ui.form=null;close();toast('来源已保存并生效');ctx.render();return;
      }
      if(action==='source-toggle') {
        const s=E.source(b.dataset.id);if(!s)throw Error('来源不存在');
        if(state.role!=='运营管理员')throw Error('仅运营管理员可调整来源');
        const next={...E.copy(s),enabled:!s.enabled},impacts=E.impacts(s.id,next),blocked=impacts.some(i=>i.blocked);ui.form={kind:'toggle',draft:next,target:s.id};
        dialog('来源'+(next.enabled?'启用':'停用')+'预检',table('影响分析',['合约','用途','引用类型','有效源数','独立源数','价格状态','阻塞原因'],impacts.map(i=>[i.code,purposeName(i.purpose),i.reference,i.valid,i.independent,i.status,i.reason || '--']),{search:false,paged:false})+(next.enabled?'':`<form id="priceToggleForm">${input('操作原因','reason','')}</form>`)+`<div id="priceError" class="cm-field-error">${blocked?'预检未通过，请先调整关联合约或汇率路径':'依赖影响预检通过'}</div>`,button('取消','close')+button(next.enabled?'确认启用':'确认停用','toggle-submit',blocked?'disabled':'',true),true);return;
      }
      if(action==='toggle-submit'){const reason=$('#priceToggleForm [name=reason]')?.value || '';E.applySource(ui.form.draft,state.role,reason);persist();ui.form=null;close();toast('来源状态已更新');ctx.render();return;}
      if(action==='submit'){const f=new FormData($('#pricePublishForm')),scheduled=f.get('mode')==='定时生效'?new Date(f.get('scheduled')).toISOString():null,c=E.submit(ui.form.scope,ui.form.target,ui.form.draft,f.get('reason'),state.role,scheduled);persist();ui.form=null;changeDialog(c.id);return;}
      if(action==='change'){changeDialog(b.dataset.id);return;}
      if(action==='review' || action==='apply' || action==='cancel-change') {
        const c=E.db.changes.find(c=>c.id===b.dataset.id),f=new FormData($('#priceReviewForm'));
        if(action==='review') {E.review(c,state.role,b.dataset.approve==='true',f.get('comment'));if(c.status==='待生效' && !c.scheduled)E.apply(c,state.role,f.get('outcome'));}
        else if(action==='apply') E.apply(c,state.role,f.get('outcome'));
        else {if(state.role!=='运营管理员')throw Error('仅申请方可撤销');if(!f.get('comment')?.trim())throw Error('撤销原因必填');c.status='已撤销';c.cancelReason=f.get('comment');}
        persist();changeDialog(c.id);return;
      }
    }
    document.addEventListener('click',e=>{const b=e.target.closest('[data-price]');if(!b)return;e.preventDefault();try{handle(b.dataset.price,b);refreshIcons();}catch(error){const target=overlay.hidden?null:$('#priceError');if(target)target.textContent=error.message;else toast(error.message);}});
    document.addEventListener('submit',e=>{if(e.target.matches('[data-p-query]')){e.preventDefault();e.target.querySelector('[data-price=query]').click();}});
    document.addEventListener('input',e=>{if(e.target.closest('#pricePlanForm,#priceBindingForm,#priceSourceForm,#priceDebugForm'))ui.dirty=true;});
    document.addEventListener('change',e=>{if(e.target.id==='px-purpose' && !ui.form){ui.purpose=e.target.value==='预言机输入'?'oracle':'external';rerender();}if(e.target.id==='px-scenario'){ui.scenario=e.target.value;capture();}if(e.target.hasAttribute('data-price-auto'))ui.auto=e.target.checked;});
    document.addEventListener('change',e=>{
      const el=e.target;
      if(el.closest('#priceSourceForm') && (el.name==='platform' || el.name==='planId')) {
        collectSource();
        const s=ui.form.draft, plan=el.name==='platform'?(E.plansFor(s.platform).find(p=>p.id===s.planId) || E.plansFor(s.platform)[0]):E.planById(s.planId);
        if (plan) E.applyPlan(s, plan, {resetCheck:true, rename:false});
        if (ui.form.isNew && el.name==='platform') s.code=E.nextCode(s.platform);
        ui.dirty=true; drawSource(); return;
      }
      if(el.id==='px-catalogueScenario' && !ui.form){ui.catalogueScenarios ||= {};ui.catalogueScenarios[ui.source]=el.value;}
      if(el.hasAttribute('data-catalogue-auto'))ui.catalogueAuto=el.checked;
      if(!el.closest('#priceBindingForm') || !ui.form)return;
      if(el.name==='source' || el.name==='instrument') {
        collectBindingSettings();const p=ui.form.draft,b=p.bindings[ui.form.binding],s=E.source($('#priceBindingForm [name=source]').value),entries=E.available(s,E.market(p.market).base,p.target,p.purpose);
        const entry=el.name==='instrument'?entries.find(x=>x.id===el.value):entries.find(x=>x.quote===p.target)||(entries.length===1?entries[0]:null);
        b.source=s.id;
        if(entry)E.selectInstrument(b,entry,p.target);
        else {delete b.catalogueId;b.pair='';b.quote='';b.basis='';b.needsMapping=true;b.rule=E.rule(p.target,p.target,E.market(p.market).base);}
        ui.dirty=true;editBinding(ui.form.binding);
      }
      if(/^fxSource\d+$/.test(el.name)) {
        collectBindingSettings();const b=ui.form.draft.bindings[ui.form.binding],i=Number(el.name.slice(8)),s=E.source(el.value),entries=E.catalogue.get(s).entries.filter(x=>x.status==='可关联'&&x.basis==='汇率');
        const chosen=entries.find(x=>x.base===b.rule.legs[i].base&&x.quote===b.rule.legs[i].quote)||entries[0];
        b.rule.legs[i]={source:s.id,base:chosen?.base || '',quote:chosen?.quote || '',direction:b.rule.legs[i].direction};editBinding(ui.form.binding);
      }
    });
    const timer=setInterval(()=>{
      if(ui.auto && state.route.includes('/prices/CM26') && overlay.hidden && !state.editor && !document.hidden)capture();
      if(ui.catalogueAuto && state.route.startsWith('#sources/') && ui.sourceTab==='支持行情' && overlay.hidden && !document.hidden){const s=E.source(ui.source),c=s&&E.catalogue.get(s);if(c&&Date.now()-Date.parse(c.lastAttempt || '1970-01-01')>=60000){E.catalogue.sync(s,ui.catalogueScenarios?.[s.id] || '正常');rerender();}}
      for(const c of E.db.changes.filter(c=>c.status==='待生效' && c.scheduled && Date.parse(c.scheduled)<=Date.now())){E.apply(c,'运营管理员');persist();if(overlay.hidden)ctx.render();}
    },2000);
    return {ui,renderSources,renderSource,renderGroup,editPlan,changesTable,handle,canClose,dismiss,routeChanged,stop:()=>clearInterval(timer)};
  }
  window.PriceUI={create};
})();
