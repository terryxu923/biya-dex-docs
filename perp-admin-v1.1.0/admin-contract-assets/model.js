(function () {
  'use strict';
  const D = window.Decimal;
  const schema = window.BIYA_CONTRACT_SCHEMA.groups;
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const number = (value, places = 2) => new D(value || 0).toFixed(places);
  const clean = name => name.split('\u001f')[0].split('##优化')[0].replace(/（%）$/, '').trim();
  const configGroups = ['CM05','CM08','RC01','RC02','CM09','CM12','RC03','RC04','RC05','RC06','RC07','RC08','RC09','CM13','CM16','CM18','CM23','CM24','RC10','RC11','RC12','CM25'];
  const tabs = [
    ['overview','概览',['CM05','CM06']],
    ['trade','交易参数',['CM08']],
    ['margin','杠杆与保证金',['CM09']],
    ['risk','风险与清算',['RISK_PARAMS','CM14']],
    ['fees','手续费',['CM16']],
    ['funding','资金费',['CM17','CM18','CM19','CM20']],
    ['prices','价格与预言机',['CM22','CM23','CM24']],
    ['records','交易数据',['CM27','CM28','CM29','CM30']]
  ];
  const steps = [
    ['基础与展示',['CM05']], ['交易参数',['CM08']],
    ['杠杆与保证金',['CM09','CM10']], ['风险与清算',['CM12','RC03','CM13','RC09']],
    ['手续费',['CM16']], ['资金费',['CM18']], ['价格与预言机',['CM23','CM24','RC10','RC11','RC12','CM25']]
  ];
  const choices = {
    '合约类型':['U本位'], '保证金模式':['全仓'], '客户端可见':['显示','隐藏'],
    '结算资产':['USDC','USDT'], '计价资产':['USDC','USDT'],
    '标的资产':['','BTC','ETH','SOL','LINK','DOGE','XRP','AVAX','DOT','LTC','ADA','BCH','UNI','AAVE','SUI','NEAR','ATOM','ETC','FIL','TRX','APT','INJ','ARB','OP','PEPE','TRB','HYPE'],
    '支持订单类型':['限价','市价'], '类型与有效方式组合':['限价 GTC / 市价 IOC'],
    '统计方向':['多头、空头分别累计'], '恢复方式':['人工复核后恢复','自动恢复'],
    '对应处置动作':['告警','限制新增风险','只减仓','暂停用户新单'],
    '运行模式':['观察告警'], '适用来源用途':['预言机','外部市场'],
    '市场类型':['现货','永续'], '所属平台':['Binance','OKX','Bybit','Coinbase','Kraken'],
    '来源独立分组':['Binance','OKX','Bybit','Coinbase','Kraken'],
    '启用状态':['启用','停用'], '数据接入通道':['公开行情通道 A','公开行情通道 B'],
    '市场风险状态':['正常','预警'], '统计主体':['主账户及全部子账户']
  };
  const defaults = {
    '价格展示精度':'1','数量展示精度':'4','价格步长':'0.1','数量步长':'0.0001',
    '最小委托数量':'0.0001','最大委托数量':'100','最小委托价值':'10','单笔委托价值上限':'100000',
    '市价保护比例':'1','标记价格交易时效':'5','最大杠杆':'50','最小杠杆':'1','默认杠杆':'10','杠杆调整步长':'1',
    '单账户持仓名义价值上限':'1000000','市场持仓名义价值上限':'50000000',
    '主账户组多头名义价值上限':'2000000','主账户组空头名义价值上限':'2000000',
    '强平价格保护比例':'1','最大尝试次数':'3','重试冷却时间':'5',
    '首页推荐':false,'客户端可见':'显示','展示排序':'0','展示标签':['主流'],'保证金模式':'全仓',
    '利率基准周期':'8','溢价采样窗口':'8','采样间隔':'5','结算周期':'1',
    '结算时间基准':'00:00 UTC','固定利率项 I':'0.01','利率差限幅 cI':'0.05','单次费率绝对值上限 cF':'4','冲击名义金额':'20000',
    '最少有效源数量':'3','最大报价年龄':'5','最大盘口报价年龄':'5',
    '本地溢价EMA周期 tau1':'150','辅助价格EMA周期 tau2':'30','单来源组最大权重占比':'60',
    '深度评估价带':'1','买盘最低有效深度':'10000','卖盘最低有效深度':'10000','连续合格观察时长':'60','深度数据最大年龄':'5',
    '报价异常偏离阈值':'3','连续异常时长':'15','恢复偏离阈值':'1','恢复观察时长':'60','冷却时间':'30','运行模式':'观察告警',
    '主账户组最大活动委托数':'100','主账户组下单速率上限':'20','突发额度':'40',
    '监控统计窗口':'60','撤单率预警阈值':'80','订单成交比预警阈值':'100','最小订单样本数':'100','最小成交样本数':'10',
    'Top N主账户组数量':'5','多头集中度预警阈值':'60','空头集中度预警阈值':'60','连续超限时长':'30','最小有效市场持仓':'100000',
    '标记价／预言机价偏离预警阈值':'3','成交价／标记价偏离预警阈值':'3','成交价监测最大年龄':'10','连续偏离时长':'15',
    '最大买卖价差':'1','深度骤降观察窗口':'60','深度骤降比例阈值':'60',
    '待清算规模／有效深度预警倍数':'2','品种风险预算':'100000','预算占用预警比例':'80',
    '最小有效样本数':'12','恢复阈值':'1','健康检查间隔':'10',
    '统计方向':'多头、空头分别累计','统计主体':'主账户及全部子账户',
    '主账户组持仓限制':true,'单账户持仓上限开关':true,'市场持仓上限开关':true,
    '对应处置动作':'告警','恢复方式':'人工复核后恢复','告警路由':'全天候交易风控组',
    '关联关系版本':'ACCT-2026.09','独立来源关系版本':'SOURCE-2026.09','预算版本与批准状态':'BUDGET-001 · 已批准',
    '当前规则状态及生效版本':'正常 · RISK-001','适用来源用途':'预言机',
    '保险基金关联账户':'保险基金 · 0x9000...0001','手续费归集账户':'手续费归集 · 0x9000...0002',
    '手续费方案':'统一永续手续费方案','基础档Maker费率':'0.015','基础档Taker费率':'0.045',
    '交易量统计权重':'1','收费币种':'USDC','交易量分级规则':'滚动14天 · 主子合并 · UTC每日评估',
    'Maker返佣规则':'M1 / M2 / M3','账户风险预警倍数':'1.2','账户提现留存比例':'10',
    '基金最低余额阈值':'500000','基金回撤预警比例及窗口':'15% / 24小时',
    '聚合方式':'加权中位数','当前有效权重占比':'42.86','配置权重占比':'42.86',
    '有效性规则':'已启用、运行正常、正价格、正权重、报价未过期',
    '无有效采样处理':'本周期资金费率为0','来源处理状态':'正常',
    '支持订单类型':['限价','市价'],'类型与有效方式组合':'限价 GTC / 市价 IOC',
    '只减仓执行规则':'不得开仓或翻仓；超额部分取消','自成交保护规则':'同主账户组取消被动订单剩余',
    '价格与数量对齐规则':'买价向上、卖价向下、数量向下',
    '强平订单规则':'反向 · 只减仓 · IOC','ADL处理能力':'仅记录路由',
    '保险基金覆盖条件':'剩余仓位为0且权益为负','清算受阻规则':'有残仓、权益非负且深度不足或尝试次数耗尽',
    '撤单容量保障':'独立撤单通道 · 100笔/秒','超限处理':'拒绝新增超额请求，撤单保持可用',
    '超限处理规则':'拒绝新增风险，允许有效减仓及撤单','分量有效性规则版本':'PRICE-14-V1',
    '标记价计算规则':'三主要分量中位数及既定降级','独立参考集合规则':'排除被检查组后的合格来源集合',
    '权重超限处理':'阻止发布；运行时告警','预算使用量口径':'已确认坏账、在途承诺及压力损失去重',
    '有效源不足处理':'预言机价格不可用','盘口有效性规则':'正买价、卖价不低于买价、报价未过期',
    '无有效市场处理':'X3不可用，按既定分量降级','结算精度与舍入规则':'6位小数 · 向0截断',
    '当前双边深度与数据时间':'买盘 240,000 / 卖盘 260,000 USDC',
    '当前双边深度、价差及骤降比例':'240,000 / 260,000 USDC · 0.08% · 3%',
    '多头／空头当前使用量':'820,000 / 790,000 USDC',
    '当前Top N持仓及集中度':'420,000 USDC · 42%',
    '多头清算卖出压力':'100,000 / 240,000 USDC · 0.42倍',
    '空头清算买入压力':'90,000 / 260,000 USDC · 0.35倍',
    '当前预算占用及剩余额度':'占用 20,000 / 剩余 80,000 USDC',
    '当前偏离与参考价':'0.12% · 65,000 USDC/BTC',
    '当前偏离及输入时点':'0.12% / 0.08% · 2026-09-10 10:40:00',
    '当前活动委托数':'28','当前下单速率':'6','当前撤单率／订单成交比':'18% / 12',
    '实际撤单率／订单成交比':'18% / 12','准入状态与原因':'未校验','当前使用量':'820000',
    '合约参数覆盖项':'模板开放阈值','触发事件与等级':'价格、流动性、集中度、预算与订单异常',
    '运行模式':'观察告警','准入策略模板':'能力质量校验 V1','异常报价策略与版本':'独立参考观察 V1',
    '风控策略模板与版本':'永续风险策略 V1','容量限制策略':'标准容量模板 V1','异常订单监控策略':'标准订单监控 V1',
    '费率计算规则':'永续资金费方案 V1'
  };
  const createLabels = {
    '价格步长':'最小价格变动','标记价格交易时效':'交易使用标记价最大年龄',
    '最少有效源数量':'最少有效独立来源数','最大报价年龄':'预言机输入报价最大年龄',
    '参与权重':'配置权重','映射检查结果':'关联校验','固定利率项 I':'基准周期利率',
    '利率差限幅 cI':'利率调整限幅','单次费率绝对值上限 cF':'单次结算资金费率绝对值上限',
    '本地溢价EMA周期 tau1':'本地溢价平滑周期','辅助价格EMA周期 tau2':'辅助价格平滑周期',
    '强平价格保护比例':'强平委托价格保护比例',
    '基础档Maker费率':'Maker费率','基础档Taker费率':'Taker费率'
  };
  const createLayout = {
    CM05:{primary:['标的资产','计价资产','合约名称','合约代码','图标','展示排序','客户端可见','展示标签'],auto:['合约类型','结算资产','保证金模式'],advanced:[],hidden:['创建时间','计划上线时间','实际上线时间','首页推荐']},
    CM08:{primary:['价格步长','数量步长','最小委托数量','最大委托数量','最小委托价值','单笔委托价值上限','市价保护比例','标记价格交易时效'],auto:['支持订单类型','价格展示精度','数量展示精度'],advanced:[],hidden:['类型与有效方式组合','只减仓执行规则','自成交保护规则','价格与数量对齐规则']},
    RC01:{primary:[],auto:[],advanced:[],hidden:['容量限制策略','主账户组最大活动委托数','主账户组下单速率上限','突发额度','当前活动委托数','当前下单速率','撤单容量保障','超限处理']},
    RC02:{primary:[],auto:[],advanced:[],hidden:['异常订单监控策略','处置策略','监控统计窗口','连续异常时长','撤单率预警阈值','订单成交比预警阈值','最小订单样本数','最小成交样本数','实际撤单率／订单成交比']},
    CM09:{primary:['最小杠杆','最大杠杆','默认杠杆','杠杆调整步长'],auto:[],advanced:[],hidden:['保证金模式','保证金档位版本']},
    CM12:{primary:['单账户持仓上限开关','单账户持仓名义价值上限','市场持仓上限开关','市场持仓名义价值上限'],auto:[],advanced:[],hidden:['当前使用量','超限处理规则','账户风险预警倍数','账户提现留存比例','公共风险配置版本']},
    RC03:{primary:['主账户组持仓限制','主账户组多头名义价值上限','主账户组空头名义价值上限'],auto:[],advanced:[],hidden:['统计主体','统计方向','多头／空头当前使用量','关联关系版本']},
    RC04:{primary:[],auto:[],advanced:[],hidden:['Top N主账户组数量','连续超限时长','最小有效市场持仓','多头集中度预警阈值','空头集中度预警阈值','当前Top N持仓及集中度']},
    RC05:{primary:[],auto:[],advanced:[],hidden:['处置策略','标记价／预言机价偏离预警阈值','成交价／标记价偏离预警阈值','成交价监测最大年龄','连续偏离时长','当前偏离及输入时点']},
    RC06:{primary:[],auto:[],advanced:[],hidden:['深度评估价带','买盘最低有效深度','卖盘最低有效深度','最大买卖价差','深度骤降比例阈值','深度骤降观察窗口','连续异常时长','当前双边深度、价差及骤降比例']},
    RC07:{primary:[],auto:[],advanced:[],hidden:['压力情景模板','待清算规模／有效深度预警倍数','连续超限时长','多头清算卖出压力','空头清算买入压力','情景计算时间与状态']},
    RC08:{primary:[],auto:[],advanced:[],hidden:['预算占用预警比例','关联保险基金','品种风险预算','预算使用量口径','当前预算占用及剩余额度','基金最低余额阈值','基金回撤预警比例及窗口','预算版本与批准状态']},
    RC09:{primary:[],auto:[],advanced:[],hidden:['风控策略模板与版本','告警路由','对应处置动作','恢复方式','最小有效样本数','采样间隔','恢复观察时长','冷却时间','恢复阈值','合约参数覆盖项','触发事件与等级','当前规则状态及生效版本']},
    CM13:{primary:['强平价格保护比例'],auto:[],advanced:[],hidden:['保险基金关联账户','最大尝试次数','重试冷却时间','标记价格交易时效','强平订单规则','保险基金覆盖条件','清算受阻规则','ADL处理能力']},
    CM16:{primary:['基础档Maker费率','基础档Taker费率','收费币种'],auto:['手续费归集账户'],advanced:[],hidden:['手续费方案','交易量统计权重','交易量分级规则','Maker返佣规则','结算精度与舍入规则','手续费方案版本与生效时间','归集配置版本与生效时间']},
    CM18:{primary:['结算周期','单次费率绝对值上限 cF','冲击名义金额'],auto:['结算时间基准'],advanced:['利率基准周期','溢价采样窗口','采样间隔','固定利率项 I','利率差限幅 cI','周期换算系数 h'],hidden:['费率计算规则','无有效采样处理','结算精度与舍入规则']},
    CM23:{primary:['最少有效源数量','最大报价年龄'],auto:['聚合方式'],advanced:[],hidden:['有效性规则','有效源不足处理']},
    CM24:{primary:['最大盘口报价年龄'],auto:['聚合方式'],advanced:[],hidden:['盘口有效性规则','无有效市场处理']},
    RC10:{primary:['单来源组最大权重占比'],auto:['配置权重占比','来源独立分组'],advanced:[],hidden:['适用来源用途','当前有效权重占比','独立来源关系版本','权重超限处理']},
    RC11:{primary:[],auto:['准入策略模板','准入状态与原因'],advanced:[],hidden:['深度评估价带','买盘最低有效深度','卖盘最低有效深度','连续合格观察时长','深度数据最大年龄','当前双边深度与数据时间']},
    RC12:{primary:[],auto:['异常报价策略与版本','运行模式'],advanced:['报价异常偏离阈值','恢复偏离阈值'],hidden:['独立参考集合规则','连续异常时长','恢复观察时长','当前偏离与参考价','来源处理状态']},
    CM25:{primary:[],auto:['标记价计算规则'],advanced:['本地溢价EMA周期 tau1','辅助价格EMA周期 tau2'],hidden:['分量有效性规则版本','当前配置版本']}
  };
  function createLabel(group, name) { return createLabels[name] || name; }
  function createRole(group, name, draft, editing = false) {
    const layout = createLayout[group];
    if (!layout) return 'hidden';
    const role = layout.hidden?.includes(name) ? 'hidden' : layout.auto?.includes(name) ? 'auto' : layout.advanced?.includes(name) ? 'advanced' : layout.primary?.includes(name) ? 'primary' : 'hidden';
    const c = draft?.config || {};
    if(editing && group==='CM05' && name==='首页推荐')return 'advanced';
    if (group === 'CM12' && name === '单账户持仓名义价值上限' && !c.CM12?.['单账户持仓上限开关']) return 'hidden';
    if (group === 'CM12' && name === '市场持仓名义价值上限' && !c.CM12?.['市场持仓上限开关']) return 'hidden';
    return role;
  }
  function isRuntimeFact(name) { return /^(当前|实际撤单|实际成交|准入状态|情景计算|多头清算|空头清算|当前规则状态)/.test(name); }
  function decimalsFromStep(step) {
    try{const value=new D(step);return value.isFinite()&&value.gt(0)?String(value.decimalPlaces()):'';}catch(_){return '';}
  }
  function assetTemplate(base) {
    const major = ['BTC','ETH'].includes(base), mid = ['SOL','XRP','DOGE','BNB','LINK'].includes(base);
    const qtyStep = base === 'BTC' ? '0.0001' : major || mid ? '0.001' : '0.01';
    return {
      trade: {
        '数量步长': qtyStep,
        '最小委托数量': qtyStep,
        '数量展示精度': decimalsFromStep(qtyStep),
        '价格步长': base === 'BTC' ? '0.1' : major ? '0.01' : '0.001',
        '价格展示精度': base === 'BTC' ? '1' : major ? '2' : '3'
      },
      impact: major ? '20000' : mid ? '8000' : '3000'
    };
  }
  const locked = /^(当前|实际|配置权重|统计主体|统计方向|来源独立分组|独立参考集合|独立来源关系|关联关系|公共|基金最低|基金回撤|预算使用量|预算版本|多头清算|空头清算|结算精度|手续费方案|基础档|交易量统计|交易量分级|Maker返佣|收费币种|账户风险预警|账户提现留存|超限处理|撤单容量|有效性规则|有效源不足|盘口有效性|无有效市场|无有效采样|聚合方式|分量有效性|标记价计算|只减仓执行|自成交保护|价格与数量对齐|保险基金覆盖|清算受阻|强平订单规则|ADL处理|操作|创建时间|实际上线|权重超限|情景计算|触发事件|合约参数覆盖)/;
  const retiredNoticeFields=new Set(['风险提示开关','提示类型','风险提示文案','提示展示方式','提示开始时间','提示结束时间','关联公告']);
  function fields(group, index = 0) { return (schema[group]?.tables[index] || []).filter(f => clean(f.name) !== '操作' && !(group==='CM05'&&retiredNoticeFields.has(clean(f.name)))); }
  function unit(field, market) {
    const n = clean(field.name), m = market || {};
    const ready = m.base && m.base !== 'NEW';
    if (/订单成交比预警阈值/.test(n)) return '';
    if (/权重|系数 h/.test(n) && !/占比/.test(n)) return '';
    if (/时间|时点|版本|状态|方式|规则/.test(n) && !/冷却时间|观察时长|持续时间|最大年龄|交易时效/.test(n)) return '';
    if (/费率|比例|占比|保证金率|收益率|溢价率|限幅|利率项|价差|价带|偏离.*阈值|返佣门槛|撤单率|集中度/.test(n)) return '%';
    if (/精度/.test(n)) return '位小数';
    if (/杠杆|倍数/.test(n)) return '倍';
    if (/EMA周期|时效|年龄|采样间隔|健康检查|冷却时间|观察.*窗口|观察时长|统计窗口|连续.*时长/.test(n)) return '秒';
    if (/周期|溢价采样窗口/.test(n)) return '小时';
    if (/次数/.test(n)) return '次';
    if (/速率/.test(n)) return '笔/秒';
    if (/最小订单样本数|最小成交样本数/.test(n)) return '笔';
    if (/样本数|有效源数量|主账户组数量/.test(n)) return '个';
    if (/活动委托数|突发额度/.test(n)) return '笔';
    if (['price','base','quote','settle'].includes(field.unit)) {
      if (!ready) return '';
      return ({price:m.quote+'/'+m.base,base:m.base,quote:m.quote,settle:m.settle})[field.unit];
    }
    if (field.unit && !['USD'].includes(field.unit)) return field.unit;
    return '';
  }
  function definition(group, field, market, ctx = {}) {
    const name = clean(field.name);
    let editable = configGroups.includes(group) && (field.edit || /开关|主账户组持仓限制|运行模式|恢复方式|对应处置动作/.test(name)) && !locked.test(name);
    if (group === 'CM05') editable = !['创建时间','实际上线时间','保证金模式','合约类型','结算资产'].includes(name);
    if (group === 'CM09' && name === '保证金模式') editable = false;
    if (group === 'CM16') editable = ['基础档Maker费率','基础档Taker费率','收费币种'].includes(name);
    if (group === 'CM34') editable = !['支持用途','支持能力','来源类别','接入范围','来源独立分组','独立性核对依据','来源代码','健康检查间隔'].includes(name);
    if (name === '计划上线时间' && group === 'CM05') editable = false;
    if (name === '结算资产' || name === '合约类型' || name === '保证金模式') editable = false;
    if (ctx.create && name==='合约代码') editable = false;
    let options = choices[name];
    if (name === '准入策略模板') options = ['能力质量校验 V1'];
    else if (name === '异常报价策略与版本') options = ['独立参考观察 V1'];
    else if (name === '风控策略模板与版本') options = ['永续风险策略 V1'];
    else if (name === '容量限制策略') options = ['标准容量模板 V1'];
    else if (name === '异常订单监控策略') options = ['标准订单监控 V1'];
    else if (name === '收费币种') options = ['USDC','USDT'];
    else if(name==='压力情景模板')options=['清算压力观察模板 V1'];
    if (name === '处置策略') options = ['告警','限制新增风险'];
    if (name === '告警路由') options = ['全天候交易风控组','市场运营组'];
    if (/关联保险基金|保险基金关联账户/.test(name)) options = [defaults['保险基金关联账户']];
    if (name === '手续费归集账户') options = [defaults[name]];
    if (ctx.create) {
      const role = createRole(group, name, ctx.draft,ctx.editing);
      if (role === 'auto' || role === 'hidden') editable = false;
    }
    const suffix = unit(field, market);
    const toggle = /开关|首页推荐|主账户组持仓限制/.test(name);
    let type = toggle ? 'toggle' : options ? 'select' : /开始时间|结束时间/.test(name) ? 'datetime-local' : /文案/.test(name) ? 'textarea' : suffix ? 'number' : 'text';
    if (['支持订单类型','展示标签'].includes(name)) type = 'multi';
    if (name === '展示标签') options = ['主流','新上线','高波动','DeFi'];
    if (name === '展示排序' || name === '订单成交比预警阈值' || name === '恢复阈值') type = 'number';
    const optional = ['展示标签'].includes(name);
    return {name,unit:suffix,type,options,editable,required:editable&&!optional};
  }
  function initialValue(g, field, m) {
    const name=clean(field.name), def=definition(g,field,m);
    if (name in defaults) return clone(defaults[name]);
    if (name==='合约代码') return m.base && m.base !== 'NEW' ? m.code : '';
    if (name==='合约名称') return m.base && m.base !== 'NEW' ? m.base+' / '+m.quote+' 永续' : '';
    if (name==='标的资产') return m.base;
    if (name==='计价资产') return m.quote;
    if (name==='结算资产') return m.settle;
    if (name==='合约类型') return 'U本位';
    if (/版本/.test(name)) return 'V1';
    if (def.options) return def.type==='multi'?[def.options[0]]:def.options[0];
    if (def.type==='toggle') return true;
    if (def.type==='number') return /最少|最小/.test(name)?'1':'10';
    if (/时间/.test(name)) return '2026-09-10 10:40:00';
    if (/状态|结果/.test(name)) return '正常';
    if (/来源独立/.test(name)) return 'Binance / OKX / Bybit';
    if (name==='费率计算规则') return defaults['费率计算规则'];
    if (/规则|条件/.test(name)) return '公共规则 V1';
    return def.editable ? '标准配置 V1' : '--';
  }
  function newMarket(base='BTC', quote='USDC', index=0) {
    const m={id:'market-'+base.toLowerCase()+'-'+quote.toLowerCase(),code:base+quote,base,quote,settle:quote,
      lifecycle:'已上线',trade:'正常交易',version:1,updated:'2026-09-10 10:40:00',opened:'2026-08-20 12:00:00',
      price:String(base==='BTC'?65000:base==='ETH'?3400:base==='SOL'?145:10+index*1.2),quality:'正常',activeOrders:5,positions:3,
      revision:1,config:{},draft:null,pending:null,events:[],history:[],empty:false};
    for(const g of configGroups){m.config[g]={};for(const field of fields(g))m.config[g][clean(field.name)]=initialValue(g,field,m);}
    m.config.CM05['图标']=['BTC','ETH','SOL'].includes(base)?'vendor/'+base.toLowerCase()+'.png':'';
    m.config.CM05['合约代码']=m.code;m.config.CM05['合约名称']=base+' / '+quote+' 永续';m.config.CM05['标的资产']=base;m.config.CM05['计价资产']=quote;m.config.CM05['结算资产']=quote;
    m.config.CM08['数量展示精度']=base==='BTC'?'4':'3';m.config.CM08['数量步长']=base==='BTC'?'0.0001':'0.001';m.config.CM08['最小委托数量']=m.config.CM08['数量步长'];
    m.tiers=[{upper:'100000',leverage:'50',mmr:'1'},{upper:'500000',leverage:'20',mmr:'2'},{upper:'',leverage:'10',mmr:'5'}];
    m.oracle=['src-binance','src-okx','src-bybit'].map((source,i)=>({source,pair:base+quote,weight:String(i===0?3:2),enabled:true}));
    m.external=clone(m.oracle);
    return m;
  }
  function source(id,platform){return{id,name:platform+' 行情',code:platform.toUpperCase()+'_PUBLIC',platform,group:platform,type:'现货',channel:'公开行情通道 A',enabled:true,healthy:true,interval:'10',proof:'平台公开行情，独立撮合市场',revision:1,events:[]};}
  const sources=[source('src-binance','Binance'),source('src-okx','OKX'),source('src-bybit','Bybit'),source('src-coinbase','Coinbase'),source('src-kraken','Kraken')];
  sources[4].enabled=false;
  const symbols=['BTC','ETH','SOL','LINK','DOGE','XRP','AVAX','DOT','LTC','ADA','BCH','UNI','AAVE','SUI','NEAR','ATOM','ETC','FIL','TRX','APT','INJ','ARB','OP','PEPE'];
  const markets=symbols.map((base,i)=>newMarket(base,'USDC',i));
  markets[2].trade='只减仓';markets[3].quality='降级';markets[3].oracle[2].enabled=false;markets[4].quality='不可用';
  markets[5].lifecycle='下线中';markets[5].trade='只减仓';
  markets[6].lifecycle='草稿';markets[6].empty=true;markets[6].positions=0;markets[6].activeOrders=0;markets[6].version=0;
  markets[7].lifecycle='已下线';markets[7].positions=0;markets[7].activeOrders=0;
  markets[8].trade='已暂停';
  markets.forEach(m=>{m.history=[{version:m.version||1,time:m.updated,config:clone(m.config),tiers:clone(m.tiers),oracle:clone(m.oracle),external:clone(m.external)}];});
  const seedEvents=markets.slice(0,6).map((m,i)=>({id:'CHG-20260910-'+(1001+i),market:m.code,kind:i%2?'状态':'参数',from:'V1',to:'V2',reason:'周期性风险参数复核',status:i===2?'生效失败':'已生效',time:'2026-09-10 09:20:00',operator:'运营管理员',changes:[{group:'CM09',name:'最大杠杆',before:'75',after:'50'}],failure:i===2?'价格来源不足，保持原有效版本':''}));
  markets.forEach(m=>m.events=clone(seedEvents.filter(e=>e.market===m.code)));
  function snapshot(m){return{config:clone(m.config),tiers:clone(m.tiers),oracle:clone(m.oracle),external:clone(m.external),baseRevision:m.revision};}
  function tierValues(tiers){let lower=new D(0),deduction=new D(0),prior=new D(0);return tiers.map((t,i)=>{const rate=new D(t.mmr||0).div(100);if(i)deduction=deduction.plus(lower.mul(rate.minus(prior)));const row={...t,lower:lower.toString(),deduction:deduction.toString(),imr:new D(100).div(t.leverage||1).toString()};lower=t.upper?new D(t.upper):lower;prior=rate;return row;});}
  function marginPreview(tiers,notional,leverage){const n=new D(notional),l=new D(leverage);if(n.lt(0)||l.lte(0))throw Error('名义价值和杠杆无效');const ts=tierValues(tiers),index=ts.findIndex(t=>!t.upper||n.lte(t.upper));if(index<0)throw Error('超过末档名义价值上限');const t=ts[index];if(l.gt(t.leverage))throw Error('适用杠杆超过档位上限');return{tier:index+1,im:n.div(l).toFixed(2),mm:n.mul(new D(t.mmr).div(100)).minus(t.deduction).toFixed(2),deduction:t.deduction};}
  function fundingPreview(premium,c){const clamp=(x,a,b)=>D.max(a,D.min(b,x));const p=new D(premium).div(100),interest=new D(c['固定利率项 I']).div(100),limit=new D(c['利率差限幅 cI']).div(100),cap=new D(c['单次费率绝对值上限 cF']).div(100),h=new D(c['利率基准周期']).div(c['结算周期']);return clamp(p.plus(clamp(interest.minus(p),limit.neg(),limit)).div(h),cap.neg(),cap).mul(100).toString();}
  function sourcePairOptions(source,base,quote,purpose) {
    return (window.ContractModel.sourceInstrumentOptions?.(source,base,quote,purpose) || []).map(entry=>entry.pair);
  }
  function validate(m,draft,sourceList=sources,{identity=true,create=false}={}) {
    const errors=[];const fail=(group,field,message)=>errors.push({group,field,message});
    const c=draft.config, basic=c.CM05||{};
    if(identity){if(!/^[A-Z0-9]{3,24}$/.test(basic['合约代码']||''))fail('CM05','合约代码','请输入3至24位大写字母或数字');if(!String(basic['合约名称']||'').trim())fail('CM05','合约名称','合约名称必填');if(!basic['标的资产']||!choices['标的资产'].includes(basic['标的资产']))fail('CM05','标的资产','请选择已支持的标的资产');if(!m.version&&!String(basic['图标']||'').startsWith('data:image/'))fail('CM05','图标','请上传合约图标');}
    for(const g of configGroups)for(const f of fields(g)){
      const def=definition(g,f,m,{create,draft}),v=c[g]?.[def.name];
      if(create && createRole(g,def.name,draft)==='hidden') continue;
      if(g==='CM12' && ((def.name==='单账户持仓名义价值上限'&&!c.CM12['单账户持仓上限开关'])||(def.name==='市场持仓名义价值上限'&&!c.CM12['市场持仓上限开关'])))continue;
      if(!def.editable)continue;
      if(def.required&&(v===''||v==null||(Array.isArray(v)&&!v.length)))fail(g,def.name,'必填项未完成');
      if(def.type==='number'&&v!==''&&v!=null){try{const n=new D(v);if(!n.isFinite()||n.lt(0))throw Error();if(/步长|最低|最小|最大|上限|样本|间隔|周期|阈值|额度|预算|深度|速率|观察时长/.test(def.name)&&n.eq(0)&&!/冷却|恢复阈值/.test(def.name))fail(g,def.name,'必须大于0');if(/精度|杠杆|次数|样本数|活动委托数|主账户组数量|突发额度/.test(def.name)&&!n.isInteger())fail(g,def.name,'该字段必须为整数');if(/保护比例|评估价带/.test(def.name)&&n.gte(100))fail(g,def.name,'比例必须小于100%');if(def.unit==='%'&&n.gt(100))fail(g,def.name,'百分比不可超过100%');}catch(_){fail(g,def.name,'请输入有效非负数值');}}
    }
    try {const t=c.CM08;if(new D(t['价格步长']).lte(0)||new D(t['数量步长']).lte(0))fail('CM08','数量步长','步长必须大于0');else {for(const n of ['最小委托数量','最大委托数量'])if(!new D(t[n]).mod(t['数量步长']).eq(0))fail('CM08',n,'必须是数量步长的整数倍');}if(new D(t['最大委托数量']).lt(t['最小委托数量']))fail('CM08','最大委托数量','最大数量不能小于最小数量');if(new D(t['市价保护比例']).gte(100))fail('CM08','市价保护比例','保护比例必须小于100%');}catch(_){fail('CM08','价格步长','交易参数不完整');}
    try {const v=c.CM09,min=new D(v['最小杠杆']),cap=new D(v['最大杠杆']),tierMax=new D(draft.tiers[0]?.leverage || cap),limit=D.min(cap,tierMax),def=new D(v['默认杠杆']),step=new D(v['杠杆调整步长']);if(!cap.isFinite()||!cap.isInteger()||cap.lt(min))fail('CM09','最大杠杆','最大杠杆须为不小于最小杠杆的正整数');else if(def.lt(min)||def.gt(limit)||!def.minus(min).mod(step).eq(0))fail('CM09','默认杠杆','默认杠杆必须位于可选范围并符合步长');}catch(_){fail('CM09','默认杠杆','杠杆配置不完整');}
    try {let lower=new D(0),lastRate=new D(0),lastLev=new D(c.CM09['最大杠杆']);if(!draft.tiers.length)fail('CM10','档位','至少保留一个档位');if(draft.tiers[0]&&new D(draft.tiers[0].leverage).gt(c.CM09['最大杠杆']))fail('CM10','档位最大杠杆','首档杠杆不能超过合约最大杠杆');draft.tiers.forEach((t,i)=>{let lev=new D(t.leverage),rate=new D(t.mmr);if((!t.upper&&i<draft.tiers.length-1)||(t.upper&&new D(t.upper).lte(lower)))fail('CM10','名义价值上限','档位上限必须递增，仅末档可无上限');if(lev.gt(lastLev)||rate.lt(lastRate)||lev.lte(0)||rate.lte(0)||rate.gt(new D(100).div(lev)))fail('CM10','维持保证金率','杠杆须不递增，MMR须不递减且不超过初始保证金率');if(t.upper)lower=new D(t.upper);lastRate=rate;lastLev=lev;});if(draft.tiers.length&&new D(c.CM09['默认杠杆']).gt(draft.tiers[0].leverage))fail('CM09','默认杠杆','默认杠杆超过首档限制');}catch(_){fail('CM10','档位','档位数据无效');}
    for(const [key,g] of [['oracle','CM23'],['external','CM24']]){
      const rows=draft[key].filter(r=>r.enabled),ids=new Set();let total=new D(0),weights={};
      for(const r of rows)if(!sourcePairOptions(sourceList.find(s=>s.id===r.source),basic['标的资产'],basic['计价资产'],key).includes(r.pair))fail(g,'来源交易对','请选择当前价格源与用途支持的交易对');
      for(const r of rows){const error=window.ContractModel.sourceInstrumentError?.(sourceList.find(s=>s.id===r.source),r,basic['标的资产'],basic['计价资产'],key);if(error)fail(g,'来源交易对',error);}
      for(const r of draft[key]){if(ids.has(r.source))fail(g,'价格源名称','来源不能重复');ids.add(r.source);}
      rows.forEach(r=>{
        const source=sourceList.find(s=>s.id===r.source);
        if(!source||!source.enabled||!source.healthy)fail(g,'价格源名称','来源未启用或连接异常');
        if(r.pair!==basic['标的资产']+basic['计价资产'])fail(g,'来源交易对','来源交易对与合约标的或计价币种不一致');
        try{const w=new D(r.weight);if(!w.isFinite()||w.lte(0))throw Error();total=total.plus(w);const group=source?.group||r.source;weights[group]=(weights[group]||new D(0)).plus(w);}catch(_){fail(g,'参与权重','权重必须为有限正数');}
      });
      if(key==='oracle'&&Object.keys(weights).length<Number(c.CM23['最少有效源数量']))fail(g,'最少有效源数量','独立有效来源不足');
      try{const cap=new D(c.RC10['单来源组最大权重占比']);if(cap.isFinite()&&total.gt(0))for(const w of Object.values(weights))if(w.div(total).mul(100).gt(cap))fail('RC10','单来源组最大权重占比','单来源组归一化权重超过上限');}catch(_){fail('RC10','单来源组最大权重占比','请输入有效百分比');}
    }
    try{if(new D(c.RC12['恢复偏离阈值']).gte(c.RC12['报价异常偏离阈值']))fail('RC12','恢复偏离阈值','恢复阈值必须低于异常阈值');if(c.RC12['运行模式']==='执行已验证筛除')fail('RC12','运行模式','价格筛除执行版本尚未验证，仅可观察告警');if(new D(c.CM18['结算周期']).gt(c.CM18['利率基准周期']))fail('CM18','结算周期','结算周期不能大于利率基准周期');if(new D(c.RC08['品种风险预算']).gt(500000))fail('RC08','品种风险预算','超过公共预算可分配额度500,000');}catch(_){fail('CM18','结算周期','周期或阈值配置无效');}
    if(basic['结算资产']!==basic['计价资产'])fail('CM05','结算资产','当前只支持同币计价和结算');
    const validPositive=(value)=>{try{const n=new D(value);return n.isFinite()&&n.gt(0);}catch(_){return false;}};
    for(const [step,precision] of [['价格步长','价格展示精度'],['数量步长','数量展示精度']]) {
      const required=decimalsFromStep(c.CM08[step]);
      if(required!=='' && (!Number.isInteger(Number(c.CM08[precision]))||Number(c.CM08[precision])<Number(required)))fail('CM08',precision,'展示精度不能低于步长需要的小数位');
    }
    for(const tier of draft.tiers)if(!validPositive(tier.leverage)||!new D(tier.leverage).isInteger()||!validPositive(tier.mmr)||(tier.upper!==''&&!validPositive(tier.upper)))fail('CM10','档位','档位杠杆须为正整数，金额和保证金率须为有限正数');
    if(!Number.isInteger(Number(c.CM23['最少有效源数量']))||!validPositive(c.CM23['最少有效源数量']))fail('CM23','最少有效源数量','独立源数量必须为正整数');
    if(c.RC12['运行模式']!=='观察告警')fail('RC12','运行模式','当前只支持观察告警');
    try{const interval=new D(c.CM18['采样间隔']),windowSeconds=new D(c.CM18['溢价采样窗口']).mul(3600),settlement=new D(c.CM18['结算周期']).mul(3600);if(!interval.isFinite()||interval.lte(0)||!windowSeconds.isFinite()||windowSeconds.lt(interval)||!windowSeconds.mod(interval).eq(0)||!settlement.mod(interval).eq(0))fail('CM18','采样间隔','采样窗口与结算周期须容纳完整采样间隔');}catch(_){fail('CM18','采样间隔','采样周期配置无效');}
    if(!validPositive(c.RC10['单来源组最大权重占比'])||new D(c.RC10['单来源组最大权重占比']).gt(100))fail('RC10','单来源组最大权重占比','权重占比须为0至100%之间的正数');
    return errors;
  }
  function differences(m,d){const list=[];if(JSON.stringify(m.config.PYTH)!==JSON.stringify(d.config.PYTH))list.push({group:'CM23',name:'Pyth喂价配置',before:JSON.stringify(m.config.PYTH||null),after:JSON.stringify(d.config.PYTH||null)});for(const g of configGroups)for(const f of fields(g)){const n=clean(f.name);if(JSON.stringify(m.config[g]?.[n])!==JSON.stringify(d.config[g]?.[n]))list.push({group:g,name:n,before:m.config[g]?.[n]??'',after:d.config[g]?.[n]??''});}for(const key of ['tiers','oracle','external'])if(JSON.stringify(m[key])!==JSON.stringify(d[key]))list.push({group:key==='tiers'?'CM10':key==='oracle'?'CM23':'CM24',name:{tiers:'保证金档位表',oracle:'预言机来源明细',external:'外部市场来源明细'}[key],before:JSON.stringify(m[key]),after:JSON.stringify(d[key])});return list;}
  window.ContractModel={schema,clone,now,number,clean,fields,unit,definition,configGroups,tabs,steps,markets,sources,newMarket,snapshot,tierValues,marginPreview,fundingPreview,sourcePairOptions,validate,differences,createLabel,createRole,createLayout,isRuntimeFact,decimalsFromStep,assetTemplate,defaults,choices};
})();
