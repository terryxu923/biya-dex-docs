(function(){
  'use strict';
  function create(ctx){
    const {state,engine:P,esc,button,tool,tag,dialog,persist}=ctx,B=window.PythPricing;
    const date=n=>n?new Date(n).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'})+' UTC+8':'--';
    const num=n=>n==null?'--':new window.Decimal(n).toFixed(new window.Decimal(n).abs().lt('.001')&&!new window.Decimal(n).isZero()?10:4);
    const grid=rows=>'<div class="cm-summary-grid">'+rows.map(([label,value])=>'<div class="cm-field"><label>'+esc(label)+'</label><div class="cm-readonly">'+value+'</div></div>').join('')+'</div>';
    const writable=()=>state.role!=='只读角色';
    const expand=(key,title,body)=>'<details class="cm-advanced" data-advanced="'+key+'" '+(state.editor?.advanced?.[key]?'open':'')+'><summary>'+title+'</summary>'+body+'</details>';
    function field(label,key,value,unit){return '<div class="cm-field"><label for="pyth-'+key+'">'+label+'</label><div class="cm-input-unit"><input id="pyth-'+key+'" type="number" step="any" min="0" data-pyth-field="'+key+'" value="'+esc(value)+'" '+(!writable()?'disabled':'')+'><span>'+unit+'</span></div></div>';}
    function inlineField(key,value,unit){return '<div class="cm-input-unit"><input id="pyth-'+key+'" type="number" step="any" min="0" data-pyth-field="'+key+'" value="'+esc(value)+'" '+(!writable()?'disabled':'')+'><span>'+unit+'</span></div>';}
    function config(m,draft,edit){
      const p=draft.config.PYTH,f=B.feeds.find(f=>f.id===p.feedId),rule=B.mappings[p.target];
      const qualityRows=edit?[['报价最大年龄',inlineField('maxAge',p.maxAge,'秒')],['最大置信区间占比',inlineField('confidenceCap',p.confidenceCap,'%')]]:[['报价最大年龄',esc(p.maxAge)+' 秒'],['最大置信区间占比',esc(p.confidenceCap)+'%']];
      const main=grid([['供应商及产品','Pyth Core'],['喂价项目','<span id="pyth-feed-name">'+esc(f?f.name:'请先选择标的资产')+'</span>'],
        ['Feed标识','<span class="pyth-feed-id">'+esc(p.feedId||'--')+'</span>'+(p.feedId?tool('复制Feed标识','pyth-copy','copy','data-value="'+esc(p.feedId)+'"'):'')],
        ['原始报价单位',f?'USD/'+esc(f.base):'--'],['目标报价单位',p.base?esc(p.target+'/'+p.base):'--'],
        ['单位处理方案',rule?esc(rule.id)+' · '+(p.target==='USD'?'恒等':'USD价格 ÷ '+esc(p.target)+'/USD汇率'):'--'],...qualityRows]);
      return main;
    }
    function external(m,draft=m,edit=false){
      const rows=P.externalRows(m,draft),disabled=!writable()?'disabled':'';
      const sourceControl=r=>!edit?esc(r.name):'<select class="control pyth-source-select" data-book-field="source" data-pyth-row="'+esc(r.rowId)+'" aria-label="来源交易所" '+disabled+'><option value="">选择交易所</option>'+B.providers.map(s=>'<option value="'+s.id+'" '+(r.source===s.id?'selected':'')+' '+(rows.some(other=>other.rowId!==r.rowId&&other.source===s.id)?'disabled':'')+'>'+s.name+'</option>').join('')+'</select>';
      const pairControl=r=>!edit?esc(r.pair||'未配置'):'<select class="control pyth-external-select" data-book-field="pair" data-pyth-row="'+esc(r.rowId)+'" aria-label="'+esc(r.name)+'永续交易对" '+(!r.options.length?'disabled':disabled)+'><option value="" '+(!r.configured?'selected':'')+'>'+(!r.source?'先选择交易所':!m.base||m.base==='NEW'?'先选择标的':!r.configured&&r.catalogueId?'重新选择交易对':'选择永续交易对')+'</option>'+r.options.map(e=>'<option value="'+esc(e.id)+'" '+(r.configured&&r.catalogueId===e.id?'selected':'')+'>'+esc(e.pair)+' · '+esc(e.quote+'/'+e.base)+'</option>').join('')+'</select>';
      const weightControl=r=>!edit?esc(r.weight):'<input class="control pyth-book-weight" type="number" step="any" min="0" aria-label="'+esc(r.name)+'配置权重" data-book-field="weight" data-pyth-row="'+esc(r.rowId)+'" value="'+esc(r.weight)+'" '+disabled+'>';
      const enabledControl=r=>!edit?tag(r.enabled?'启用':'停用'):'<input class="cm-switch" type="checkbox" aria-label="'+esc(r.name)+'关联启用" data-book-field="enabled" data-pyth-row="'+esc(r.rowId)+'" '+(r.enabled?'checked':'')+' '+disabled+'>';
      return '<div class="cm-section-head"><h3>来源与行情映射</h3>'+(edit?button('新增来源行','pyth-row-add',(rows.length>=B.providers.length||!writable())?'disabled':''):'')+'</div>'+
        '<div class="pyth-book-meta"><span>报价最大年龄 '+B.template.maxAge+' 秒</span></div>'+
        '<div class="cm-table-scroll"><table class="cm-table" data-pyth-table="external"><thead><tr><th>来源交易所</th><th>市场类型</th><th>永续交易对</th><th>配置权重</th><th>配置占比（%）</th><th>关联启用</th><th>单位处理</th><th>关联检查</th>'+(edit?'<th class="cm-last">操作</th>':'')+'</tr></thead><tbody>'+
        (rows.map(r=>'<tr data-book-row="'+esc(r.rowId)+'"><td>'+sourceControl(r)+'</td><td>永续</td><td>'+pairControl(r)+'</td><td>'+weightControl(r)+'</td><td><span data-book-share="'+esc(r.rowId)+'">'+r.share+'</span></td><td>'+enabledControl(r)+'</td><td>'+esc(r.conversion?(r.quote===m.quote?'同币种':r.quote+' → '+m.quote):'待配置')+'</td><td>'+tag(!r.enabled?'不参与':r.configured?'已匹配':'待配置')+'</td>'+(edit?'<td class="cm-last">'+tool('移除来源行','pyth-row-remove','trash-2','data-row="'+esc(r.rowId)+'" '+disabled)+'</td>':'')+'</tr>').join('')||'<tr><td colspan="'+(edit?9:8)+'"><div class="cm-empty">暂无关联来源</div></td></tr>')+'</tbody></table></div>';
    }
    function checkView(r,m){
      if(!r)return '<div class="cm-notice">尚未检查</div>';
      return grid([['检查时间',date(r.at)],['配置完整性',tag(r.configErrors.length?'未通过':'通过')],['输入状态',tag(r.ready?'可用':'不可用')],['当前情景',esc(r.scenario||'正常')]])+
        (r.configErrors.length?'<ul>'+r.configErrors.map(e=>'<li>'+esc(e.message)+'</li>').join('')+'</ul>':'')+
        (r.runtimeErrors.length?'<ul class="negative">'+[...new Set(r.runtimeErrors)].map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'')+
        grid([['预检预言机价格',r.oracle?num(r.oracle)+' '+esc(m.quote+'/'+m.base):'--'],['预检标记价格',r.mark?num(r.mark)+' '+esc(m.quote+'/'+m.base):'--'],['置信区间占比',r.ratio==null?'--':num(r.ratio)+'%'],['换算倍率',r.rate?num(r.rate)+' '+esc(m.quote)+'/USD':'--']]);
    }
    function scenario(m){return '';}
    function historicalPyth(m){
      const p=m.config.PYTH,rows=p.externalBindings||[];
      return '<div class="cm-notice">Pyth价格配置 · 只读</div>'+grid([['喂价项目',esc(p.base+'/USD')],['Feed标识','<span class="pyth-feed-id">'+esc(p.feedId)+'</span>'],['目标单位',esc(p.target+'/'+p.base)]])+
        '<div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>来源</th><th>已保存交易对</th><th>配置权重</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>'+esc(B.providers.find(s=>s.id===r.source)?.name||r.source)+'</td><td>'+esc(r.pair)+'</td><td>'+esc(r.weight??[3,2,2][i]??'--')+'</td></tr>').join('')+'</tbody></table></div>';
    }
    function form(m,draft,markBody){
      if(!B.isLocal(draft))return historicalPyth(m)+markBody;
      return '<h3>预言机配置</h3>'+config(m,draft,true)+'<h3>外部盘口</h3>'+external(m,draft,true)+
        '<h3>配置预检</h3><div id="pyth-check-result">'+checkView(P.context(m).check,m)+'</div>'+scenario(m);
    }
    function legacy(g,m){
      const purposes=g==='CM24'?['external']:g==='CM23'?['oracle']:['oracle','external'];
      return purposes.map(purpose=>{
        const p=ctx.priceEngine.current(m,purpose);
        return '<h3>'+(purpose==='oracle'?'预言机来源':'外部永续盘口')+'</h3>'+grid([['目标单位',esc(p.target+'/'+m.base)],['报价最大年龄',esc(p.maxAge)+' 秒'],['当前配置','只读']])+
          '<div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>来源</th><th>行情</th><th>权重</th><th>启用</th></tr></thead><tbody>'+p.bindings.map(b=>'<tr><td>'+esc(ctx.priceEngine.source(b.source)?.name||b.source)+'</td><td>'+esc(b.pair)+'</td><td>'+esc(b.weight)+'</td><td>'+(b.enabled?'是':'否')+'</td></tr>').join('')+'</tbody></table></div>';
      }).join('');
    }
    function detail(g,m){
      if(!['CM22','CM23','CM24','CM25','CM26','RC10','RC11','RC12'].includes(g))return null;
      if(!B.is(m))return g==='CM25'?null:legacy(g,m);
      if(!B.isLocal(m))return historicalPyth(m);
      if(g==='CM23')return '<div class="cm-section-head"><h2>预言机配置</h2>'+button('编辑配置','edit-group','data-group="CM23"')+'</div>'+config(m,window.ContractModel.snapshot(m),false);
      if(g==='CM24')return '<div class="cm-section-head"><h2>外部盘口</h2>'+button('编辑配置','edit-group','data-group="CM24"')+'</div>'+external(m);
      if(g==='CM25')return '<div class="cm-section-head"><h2>标记价格</h2>'+button('编辑配置','edit-group','data-group="CM25"')+'</div>'+grid([['本地溢价平滑周期',esc(m.config.CM25['本地溢价EMA周期 tau1'])+' 秒'],['辅助价格平滑周期',esc(m.config.CM25['辅助价格EMA周期 tau2'])+' 秒']]);
      const r=m.priceObservation,fresh=P.fresh(m),last=m.priceAdoption;
      return '<div class="cm-section-head"><h2>价格状态</h2>'+tool('刷新价格','pyth-refresh','refresh-cw')+'</div>'+
        grid([['当前预言机价格',fresh&&r.oracle?num(r.oracle)+' '+esc(m.quote+'/'+m.base):'--'],['当前标记价格',fresh&&r.mark?num(r.mark)+' '+esc(m.quote+'/'+m.base):'--'],
          ['可用状态',!r?'尚未采纳':!fresh?'待重新检查':r.ready?'正常':r.mark?'降级':'不可用'],
          ['最近检查时间',date(r?.at)],['最后有效时间',date(last?.at)],['最后有效预言机价格',last?.oracle?num(last.oracle)+' '+esc(m.quote+'/'+m.base):'--'],
          ['异常原因',!r?'尚未采纳':!fresh?'配置或情景已变化':[...new Set(r.runtimeErrors)].map(esc).join('；')||'--']])+
        (r?'<div class="cm-table-scroll"><table class="cm-table"><thead><tr><th>分量</th><th>当前价格（'+esc(m.quote+'/'+m.base)+'）</th><th>状态</th></tr></thead><tbody>'+
          ['预言机 + 本地溢价EMA','本地盘口与成交中位数','外部永续盘口聚合','本地辅助EMA'].map((n,i)=>'<tr><td>'+(i+1)+'. '+n+'</td><td>'+(fresh?num(r.components[i]):'--')+'</td><td>'+(fresh&&r.components[i]?'有效':'不可用')+'</td></tr>').join('')+'</tbody></table></div>':'')+scenario(m);
    }
    function precheck(m,draft,errors){const r=P.capture(m,draft);dialog('配置预检',checkView({...r,configErrors:errors},m),button('返回配置','close-dialog'));}
    function rememberExpansion(){
      if(!state.editor)return;state.editor.advanced||={};
      document.querySelectorAll('.cm-form-body details[data-advanced]').forEach(d=>state.editor.advanced[d.dataset.advanced]=d.open);
      state.editor.bookScroll=document.querySelector('[data-pyth-table="external"]')?.parentElement.scrollLeft||0;
    }
    function renderEditor(){ctx.renderEditor();const table=document.querySelector('[data-pyth-table="external"]');if(table)table.parentElement.scrollLeft=state.editor?.bookScroll||0;}
    function invalidateView(){
      ctx.invalidate();const el=document.querySelector('#pyth-check-result');
      if(el)el.innerHTML='<div class="cm-notice">尚未检查</div>';
    }
    document.addEventListener('input',e=>{
      const el=e.target,editor=state.editor;if(!editor||!B.isLocal(editor.draft)||!writable())return;
      if(el.dataset.pythField){editor.draft.config.PYTH[el.dataset.pythField]=el.value;invalidateView();}
      if(el.dataset.bookField==='weight'){
        P.updateExternal(editor.market,editor.draft,el.dataset.pythRow,'weight',el.value);invalidateView();
        const rows=P.externalRows(editor.market,editor.draft);
        document.querySelectorAll('[data-book-share]').forEach(span=>{span.textContent=rows.find(r=>r.rowId===span.dataset.bookShare)?.share||'--';});
      }
    });
    document.addEventListener('change',e=>{
      const editor=state.editor,el=e.target;
      if(el.dataset.bookField&&el.dataset.bookField!=='weight'&&editor&&B.isLocal(editor.draft)&&writable()){
        try{rememberExpansion();P.updateExternal(editor.market,editor.draft,el.dataset.pythRow,el.dataset.bookField,el.type==='checkbox'?el.checked:el.value);invalidateView();renderEditor();}
        catch(error){ctx.toast(error.message);renderEditor();}
      }
      if(el.id==='pyth-scenario'){
        const m=editor?.market||ctx.current();rememberExpansion();P.setScenario(m,el.value);
        if(editor)renderEditor();else ctx.renderDetail();
      }
    });
    document.addEventListener('click',async e=>{
      const b=e.target.closest('[data-cm-action]');if(!b)return;
      const action=b.dataset.cmAction,editor=state.editor;
      if(action==='pyth-row-add'||action==='pyth-row-remove'){
        if(!editor||!B.isLocal(editor.draft)||!writable())return;
        try{rememberExpansion();if(action==='pyth-row-add')P.addExternal(editor.market,editor.draft);else P.removeExternal(editor.market,editor.draft,b.dataset.row);
          invalidateView();renderEditor();if(action==='pyth-row-add')document.querySelector('[data-pyth-table="external"] tbody tr:last-child select')?.focus();}
        catch(error){ctx.toast(error.message);}
      }
      if(action==='pyth-copy'){try{await navigator.clipboard.writeText(b.dataset.value);ctx.toast('Feed标识已复制');}catch(_){ctx.toast('无法访问剪贴板');}}
      if(action==='pyth-refresh'){P.adopt(ctx.current());persist();ctx.renderDetail();}
    });
    return {form,detail,precheck,legacy,checkView};
  }
  window.PythUI={create};
})();
