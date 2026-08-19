<script setup>
import { ref, computed } from 'vue'
import { CARDS, GROUPS, TILES, STOCKS, VEHICLES, METRO_FEE, GODS, LOTTERY_TILES, SHOPS } from '../game/index.js'

const props = defineProps({ state: Object })
const emit = defineEmits(['close'])

const search = ref('')
const activeTab = ref('overview')
const expandedGroup = ref(null)

// 分类
const tabs = [
  { id: 'overview', label: '概览', icon: '📖' },
  { id: 'cards', label: '卡片', icon: '🃏' },
  { id: 'lands', label: '地块', icon: '🏠' },
  { id: 'groups', label: '组合', icon: '🏙️' },
  { id: 'stocks', label: '股票', icon: '📊' },
  { id: 'special', label: '特殊', icon: '✨' },
  { id: 'rules', label: '规则', icon: '📜' },
]

// 搜索过滤
const searchLower = computed(() => search.value.toLowerCase().trim())

function matches(text) {
  if (!searchLower.value) return true
  return String(text).toLowerCase().includes(searchLower.value)
}

// 卡片搜索结果
const filteredCards = computed(() => {
  if (activeTab.value !== 'cards' && searchLower.value) {
    return CARDS.filter(c => matches(c.name) || matches(c.desc) || matches(c.howto) || matches(c.price))
  }
  return CARDS
})

// 地块搜索结果
const filteredLands = computed(() => {
  return TILES.filter(t => t && !t.removed && t.type !== 'start')
})

// 分组数据
const groupList = computed(() => {
  return Object.entries(GROUPS).map(([key, val]) => {
    const tiles = TILES.filter(t => t && t.group === key && !t.removed)
    return { key, ...val, tiles }
  })
})

// 特殊格
const specialTiles = computed(() => {
  const specials = []
  for (const t of TILES) {
    if (!t || t.removed) continue
    if (t.shop) specials.push({ ...t, label: '卡片商店', icon: '🛒', desc: '路过弹出卡片商店，可用积分购买卡片' })
    if (t.lottery) specials.push({ ...t, label: '彩票站', icon: '🎫', desc: '路过弹出彩票站，¥500购买彩票选号，每5回合开奖' })
    if (t.god) specials.push({ ...t, label: '神仙格', icon: '👻', desc: '踩中随机附身神仙，获得持续数回合的增益或减益效果' })
  }
  return specials
})

// 分岔路口数：3 个及以上邻居的格子（动态计算，避免硬编码漂移）
const forkCount = computed(() => TILES.filter((t) => t && !t.removed && t.neighbors && t.neighbors.length >= 3).length)
</script>

<template>
  <div class="overlay-layer enc-overlay" @click.self="emit('close')">
    <div class="card-comic card-comic--pad-lg enc">
      <!-- 头部 -->
      <div class="enc__head">
        <h3 class="comic-title comic-title--md">📚 百科全书</h3>
        <button class="modal__close" @click="emit('close')" aria-label="关闭">✕</button>
      </div>

      <!-- 搜索框 -->
      <div class="enc__search">
        <input
          v-model="search"
          type="text"
          class="enc__search-input"
          placeholder="🔍 搜索卡片/地名/股票/关键词..."
        />
        <span v-if="search" class="enc__search-count">
          搜索 "{{ search }}" 中...
        </span>
      </div>

      <!-- 分类 Tab -->
      <div class="enc__tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="enc__tab"
          :class="{ 'enc__tab--active': activeTab === t.id }"
          @click="activeTab = t.id; expandedGroup = null"
        >
          <span>{{ t.icon }}</span> {{ t.label }}
        </button>
      </div>

      <!-- 内容区 -->
      <div class="enc__body">
        <!-- 概览 -->
        <div v-if="activeTab === 'overview'" class="enc__section">
          <div class="enc__intro">
            <h4 class="enc__h4">🎮 大富翁——重庆之旅</h4>
            <p>绕重庆主城区走一圈的棋盘大富翁。掷骰移动、买地建房、集齐商圈组合、用卡片互坑、买彩票、炒股、被神仙附身……最后剩下的人赢！</p>
          </div>
          <div class="enc__stats">
            <div class="enc__stat"><b>52</b><span>棋盘格数</span></div>
            <div class="enc__stat"><b>{{ CARDS.length }}</b><span>卡片种类</span></div>
            <div class="enc__stat"><b>{{ Object.keys(GROUPS).length }}</b><span>商圈组合</span></div>
            <div class="enc__stat"><b>{{ Object.keys(STOCKS).length }}</b><span>股票数量</span></div>
            <div class="enc__stat"><b>{{ forkCount }}</b><span>分岔路口</span></div>
            <div class="enc__stat"><b>{{ Object.keys(GODS).length }}</b><span>神仙种类</span></div>
          </div>
          <div class="enc__links">
            <h4 class="enc__h4">快速跳转</h4>
            <div class="enc__link-row">
              <button class="enc__link" @click="activeTab = 'cards'">🃏 查看卡片清单 →</button>
              <button class="enc__link" @click="activeTab = 'groups'">🏙️ 查看商圈组合 →</button>
              <button class="enc__link" @click="activeTab = 'stocks'">📊 查看股票列表 →</button>
              <button class="enc__link" @click="activeTab = 'rules'">📜 查看游戏规则 →</button>
            </div>
          </div>
        </div>

        <!-- 卡片 -->
        <div v-else-if="activeTab === 'cards'" class="enc__section">
          <div v-for="c in filteredCards" :key="c.type" class="enc__card-item">
            <div class="enc__card-icon">
              <span class="enc__card-tag" :class="{ 'enc__card-tag--high': c.price >= 100 }">¥{{ c.price }}</span>
            </div>
            <div class="enc__card-info">
              <b class="enc__card-name">{{ c.name }}</b>
              <span class="enc__card-desc">{{ c.desc }}</span>
              <span class="enc__card-howto">💡 {{ c.howto }}</span>
            </div>
          </div>
          <p v-if="!filteredCards.length" class="enc__empty">没有找到匹配的卡片</p>
        </div>

        <!-- 地块 -->
        <div v-else-if="activeTab === 'lands'" class="enc__section enc__lands">
          <div
            v-for="t in filteredLands"
            :key="t.id"
            class="enc__land-item"
            v-show="searchLower === '' || matches(t.name) || matches(t.id) || matches(t.group || '')"
          >
            <span class="enc__land-id">{{ t.id }}</span>
                <span class="enc__land-name">{{ t.name }}</span>
                <span class="enc__land-type-badge" :class="`enc__land-type--${t.type}`">
                  {{ ({ land:'地产', scenic:'景点', station:'轻轨', mall:'商圈', lottery:'彩票', god:'神仙', chance:'事件' })[t.type] || t.type }}
                </span>
                <span v-if="t.group" class="enc__land-group">{{ GROUPS[t.group]?.name }}</span>
                <span v-if="t.price" class="enc__land-price">¥{{ t.price }}</span>
                <span v-if="t.rent" class="enc__land-rent">租¥{{ t.rent }}</span>
                <span v-if="t.points" class="enc__land-pts">{{ t.points }}分</span>
          </div>
        </div>

        <!-- 组合 -->
        <div v-else-if="activeTab === 'groups'" class="enc__section">
          <div v-for="g in groupList" :key="g.key" class="enc__group-item">
            <div class="enc__group-head" @click="expandedGroup = expandedGroup === g.key ? null : g.key">
              <span class="enc__group-dot" :style="{ background: g.color }"></span>
              <b class="enc__group-name">{{ g.name }}</b>
              <span class="enc__group-count">{{ g.tiles.length }}块 · 需{{ g.threshold }}块达成</span>
              <span class="enc__group-arrow">{{ expandedGroup === g.key ? '▲' : '▼' }}</span>
            </div>
            <div v-if="expandedGroup === g.key" class="enc__group-tiles">
              <span v-for="t in g.tiles" :key="t.id" class="enc__group-tile">
                {{ t.id }}.{{ t.name }}
                <em>¥{{ t.price }}</em>
              </span>
            </div>
          </div>
        </div>

        <!-- 股票 -->
        <div v-else-if="activeTab === 'stocks'" class="enc__section enc__stocks">
          <div class="enc__stock-note">📈 每回合结束（一圈后）股价变动 · 买入收1%手续费 · 持股上限5家 · 限价±20%~250%</div>
          <div v-for="(s, code) in STOCKS" :key="code" class="enc__stock-item">
            <span class="enc__stock-icon">{{ s.icon }}</span>
            <span class="enc__stock-name">{{ s.name }}</span>
            <span class="enc__stock-code">{{ code }}</span>
            <span class="enc__stock-price">¥{{ s.price }}</span>
            <span class="enc__stock-range">¥{{ s.min }} ~ ¥{{ s.max }}</span>
            <span class="enc__stock-vol">波动 {{ (s.range[0]*100).toFixed(0) }}%~{{ (s.range[1]*100).toFixed(0) }}%</span>
          </div>
        </div>

        <!-- 特殊 -->
        <div v-else-if="activeTab === 'special'" class="enc__section">
          <h4 class="enc__h4">神仙系统（{{ Object.keys(GODS).length }}种）</h4>
          <div v-for="(g, id) in GODS" :key="id" class="enc__special-item">
            <span class="enc__special-icon">{{ g.icon }}</span>
            <div class="enc__special-info">
              <b>{{ g.name }}</b>
              <span>{{ g.desc }}</span>
              <em>持续 {{ g.duration }} 回合</em>
            </div>
          </div>
          <h4 class="enc__h4" style="margin-top:14px">💰 随机奖金</h4>
          <div class="enc__special-item">
            <span class="enc__special-icon">💰</span>
            <div class="enc__special-info">
              <b>随机奖金</b>
              <span>随机出现在某个无主地产格（金色发光边框+💰标记）。玩家踩中后先到先得，金额随机（¥1000-5000，整千或整五百），领取前不知道具体金额。领取后奖金立即刷新到另一个随机无主地产格。</span>
            </div>
          </div>
          <h4 class="enc__h4" style="margin-top:14px">彩票系统</h4>
          <div class="enc__special-item">
            <span class="enc__special-icon">🎫</span>
            <div class="enc__special-info">
              <b>彩票规则</b>
              <span>¥500/张，选1-100数字（全局唯一）。每5回合开奖，有人中奖→拿全部奖池（基础¥10000+购票金额），无人中奖→下回合换号继续。中奖后下回合直接新一轮。</span>
            </div>
          </div>
          <h4 class="enc__h4" style="margin-top:14px">银行系统</h4>
          <div class="enc__special-item">
            <span class="enc__special-icon">🏦</span>
            <div class="enc__special-info">
              <b>银行贷款</b>
              <span>手头紧时可向银行借款。最多可借总资产的 50%（含已借未还）。还款时加收 20% 利息（借 100 还 120）。贷款期限 10 回合，到期未还强制变卖地产。</span>
            </div>
          </div>
          <h4 class="enc__h4" style="margin-top:14px">特殊格子</h4>
          <div v-for="s in specialTiles" :key="s.id + s.label" class="enc__special-item">
            <span class="enc__special-icon">{{ s.icon }}</span>
            <div class="enc__special-info">
              <b>{{ s.name }} · {{ s.label }}</b>
              <span>{{ s.desc }}</span>
            </div>
          </div>
        </div>

<!-- 规则 -->
        <div v-else-if="activeTab === 'rules'" class="enc__section enc__rules">
          <h4 class="enc__h4">🎯 胜利条件</h4>
          <p>破产淘汰为主；房主可设回合上限（默认40），到点按总资产排名。</p>

          <h4 class="enc__h4">🎲 移动规则</h4>
          <ul>
            <li>按载具掷相应颗数骰子（走路1/摩托2/汽车3/飞机5）</li>
            <li>路径经过<strong>分岔路口</strong>且剩余步数>0时暂停选路</li>
            <li>朝天门岔路固定随机走；其他岔路玩家自选方向，AI直行</li>
            <li>选路后可链式再次暂停</li>
          </ul>

          <h4 class="enc__h4">🏠 地产规则</h4>
          <ul>
            <li>踩无主地弹出购买，放弃不扣钱</li>
            <li>对手踩到收租 = 地价 × 25% × 等级倍率（Lv0=×1 / Lv1=×2.2 / Lv2=×3.8 / Lv3=×5.5）</li>
            <li>商圈集齐→租金 ×1.5</li>
            <li>升级费用 = 地价 × 0.5，封顶3级</li>
            <li>卖地回收 = (地价 + 升级费×等级) × 0.5（升级投入不烧钱）</li>
          </ul>

          <h4 class="enc__h4">🚈 轻轨系统</h4>
          <ul>
            <li>踩中轻轨站可花 ¥{{ METRO_FEE }} 乘轻轨去其他任意站</li>
            <li>轻轨站可被购买，他人使用向拥有者付费</li>
            <li>已购轻轨站免费使用</li>
          </ul>

          <h4 class="enc__h4">🃏 卡片规则</h4>
          <ul>
            <li>初始发2张随机卡，手牌上限10张</li>
            <li>每回合限用1张卡片</li>
            <li>第一回合不能用卡</li>
            <li>每5回合全体送1张随机卡</li>
            <li>卡片积分 = 落地积分格（朝天门/事件格除外），商店买卡</li>
            <li>路过得积分；朝天门打卡满3次大礼包（¥5000+3卡+传送）</li>
          </ul>

          <h4 class="enc__h4">📊 股票规则</h4>
          <ul>
            <li>每圈结束股价波动（-15%~+30%不等）</li>
            <li>连续涨跌有微调修正</li>
            <li>买入收1%手续费，卖出免费</li>
            <li>持股上限5家不同股票</li>
            <li>限价：最低价20%，最高价250%</li>
            <li>黑市卡→指定股票下回合+20%；红市卡→+10%~30%</li>
          </ul>

          <h4 class="enc__h4">✨ 神仙系统</h4>
          <ul>
            <li>踩中神仙格（重庆大学）随机附身一只神仙</li>
            <li>已有神仙时新神仙覆盖旧的</li>
            <li>持续时间到自动离开；送神卡主动送走</li>
            <li>负面神仙：衰神/恶魔/穷神；正面：财神/土地公/天使/崔斯特</li>
          </ul>

          <h4 class="enc__h4">💰 随机奖金</h4>
          <ul>
            <li>随机出现在某个无主地产格（金色发光边框+💰标记）</li>
            <li>玩家踩中后先到先得，金额随机（¥1000-5000，整千或整五百）</li>
            <li>领取前不知道具体金额，领取后全员弹窗提示</li>
            <li>领取后奖金立即刷新到另一个随机无主地产格</li>
            <li>所有地产都有主人后，奖金消失</li>
          </ul>

          <h4 class="enc__h4">🎫 彩票规则</h4>
          <ul>
            <li>路过彩票站（两路口/南桥寺）弹出购买</li>
            <li>¥500/张，选1-100数字（全局唯一，不可重复）</li>
            <li>可一次选多张批量购买</li>
            <li>每5回合公布中奖数字</li>
            <li>有人中→拿全部奖池，下回合新一轮</li>
            <li>无人中→下回合换数字继续开</li>
          </ul>

          <h4 class="enc__h4">🏦 银行与贷款</h4>
          <ul>
            <li>点击百科全书旁的银行按钮打开借贷面板</li>
            <li>最多可借总资产的 50%（含已借未还部分）</li>
            <li>还款加收 20% 利息（借 ¥100 到期还 ¥120）</li>
            <li>贷款期限 10 回合</li>
            <li>到期未还：银行强制变卖地产（从最低价开始）</li>
            <li>卖光仍不够→标记违约，剩余挂账</li>
          </ul>
        </div>
      </div>

      <!-- 底部 -->
      <div class="enc__foot">
        <button class="btn-comic btn-comic--sm btn-comic--ghost" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.enc-overlay { z-index: 80; padding: 16px; }
.enc { width: 100%; max-width: 660px; max-height: 72vh; display: flex; flex-direction: column; gap: 0; }

/* 头部 */
.enc__head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 3px solid var(--ink); margin-bottom: 10px; }
.modal__close { width: 30px; height: 30px; border: 3px solid var(--ink); border-radius: 8px; background: #fff; font-weight: 900; font-size: 14px; cursor: pointer; line-height: 1; }
.modal__close:hover { background: var(--pop-red); color: #fff; }

/* 搜索 */
.enc__search { position: relative; margin-bottom: 10px; }
.enc__search-input { width: 100%; border: 3px solid var(--ink); border-radius: 8px; padding: 8px 12px; font-weight: 900; font-size: 14px; background: #fffef0; box-sizing: border-box; }
.enc__search-input:focus { outline: none; background: #fff3c4; }
.enc__search-input::placeholder { opacity: 0.5; }
.enc__search-count { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 900; opacity: 0.5; }

/* Tab */
.enc__tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px; border-bottom: 2px solid var(--ink); padding-bottom: 6px; }
.enc__tab { border: 2px solid var(--ink); border-radius: 6px; padding: 4px 10px; font-weight: 900; font-size: 12px; cursor: pointer; background: #fff; font-family: inherit; transition: transform 0.1s; }
.enc__tab:hover { transform: translateY(-1px); }
.enc__tab--active { background: var(--pop-yellow); box-shadow: 2px 2px 0 0 var(--ink); }

/* 内容区 */
.enc__body { flex: 1; overflow-y: auto; min-height: 200px; }

/* 概览 */
.enc__intro { margin-bottom: 14px; }
.enc__intro p { font-size: 13px; font-weight: 700; line-height: 1.6; opacity: 0.8; }
.enc__h4 { font-size: 16px; font-weight: 900; margin-bottom: 8px; }
.enc__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
.enc__stat { border: 2.5px solid var(--ink); border-radius: 8px; padding: 8px; text-align: center; background: #fffef0; }
.enc__stat b { display: block; font-size: 22px; color: var(--pop-red); }
.enc__stat span { font-size: 11px; font-weight: 900; opacity: 0.6; }
.enc__links { margin-top: 10px; }
.enc__link-row { display: flex; flex-wrap: wrap; gap: 6px; }
.enc__link { border: 2px solid var(--ink); border-radius: 6px; padding: 5px 10px; font-weight: 900; font-size: 12px; cursor: pointer; background: #e0f2fe; font-family: inherit; }
.enc__link:hover { background: var(--pop-yellow); }

/* 卡片 */
.enc__card-item { display: flex; gap: 10px; padding: 10px; border: 2px solid var(--ink); border-radius: 8px; margin-bottom: 8px; background: #fff; }
.enc__card-icon { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 48px; }
.enc__card-tag { font-size: 11px; font-weight: 900; background: var(--pop-blue); color: #fff; border: 1.5px solid var(--ink); border-radius: 4px; padding: 1px 5px; }
.enc__card-tag--high { background: var(--pop-red); }
.enc__card-info { display: flex; flex-direction: column; gap: 2px; }
.enc__card-name { font-size: 14px; font-weight: 900; }
.enc__card-desc { font-size: 12px; font-weight: 900; opacity: 0.7; }
.enc__card-howto { font-size: 11px; font-weight: 900; opacity: 0.5; font-style: italic; }

/* 地块 */
.enc__lands { display: flex; flex-direction: column; gap: 4px; }
.enc__land-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1.5px solid var(--ink); border-radius: 6px; font-size: 12px; font-weight: 900; background: #fffef0; }
.enc__land-id { width: 24px; flex-shrink: 0; font-weight: 900; opacity: 0.5; }
.enc__land-name { flex: 1; }
.enc__land-type-badge { font-size: 10px; padding: 1px 5px; border: 1.5px solid var(--ink); border-radius: 4px; background: #e0e0e0; }
.enc__land-type--land { background: #e8e8e8; }
.enc__land-type--scenic { background: #bbf7d0; }
.enc__land-type--station { background: #a5f3fc; }
.enc__land-type--mall { background: #ddd6fe; }
.enc__land-type--lottery { background: #fed7aa; }
.enc__land-type--god { background: #e9d5ff; }
.enc__land-type--chance { background: #fef08a; }
.enc__land-group { font-size: 10px; opacity: 0.6; }
.enc__land-price { font-weight: 900; color: var(--pop-blue); }
.enc__land-rent { font-size: 10px; opacity: 0.5; }
.enc__land-pts { font-size: 10px; opacity: 0.4; }

/* 组合 */
.enc__group-item { border: 2.5px solid var(--ink); border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
.enc__group-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; background: #fff; font-size: 13px; }
.enc__group-head:hover { background: #fffef0; }
.enc__group-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--ink); flex-shrink: 0; }
.enc__group-name { font-weight: 900; flex: 1; }
.enc__group-count { font-size: 11px; font-weight: 900; opacity: 0.55; }
.enc__group-arrow { font-size: 10px; }
.enc__group-tiles { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; background: #fffef0; border-top: 2px dashed var(--ink); }
.enc__group-tile { font-size: 11px; font-weight: 900; border: 1.5px solid var(--ink); border-radius: 4px; padding: 2px 6px; background: #fff; }
.enc__group-tile em { font-style: normal; opacity: 0.5; margin-left: 2px; }

/* 股票 */
.enc__stock-note { font-size: 11px; font-weight: 900; opacity: 0.6; margin-bottom: 10px; padding: 6px; border: 2px dashed var(--ink); border-radius: 6px; background: #fffef0; }
.enc__stocks { display: flex; flex-direction: column; gap: 4px; }
.enc__stock-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1.5px solid var(--ink); border-radius: 6px; font-size: 12px; font-weight: 900; background: #fff; }
.enc__stock-icon { font-size: 18px; }
.enc__stock-name { flex: 1; font-weight: 900; }
.enc__stock-code { font-size: 10px; opacity: 0.45; }
.enc__stock-price { color: var(--pop-blue); min-width: 40px; }
.enc__stock-range { font-size: 10px; opacity: 0.55; }
.enc__stock-vol { font-size: 10px; opacity: 0.55; }

/* 特殊 */
.enc__special-item { display: flex; gap: 10px; padding: 10px; border: 2px solid var(--ink); border-radius: 8px; margin-bottom: 8px; background: #fff; }
.enc__special-icon { font-size: 24px; flex-shrink: 0; }
.enc__special-info { display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
.enc__special-info b { font-size: 13px; font-weight: 900; }
.enc__special-info span { font-weight: 700; opacity: 0.75; line-height: 1.5; }
.enc__special-info em { font-style: normal; font-weight: 900; opacity: 0.45; font-size: 11px; }

/* 规则 */
.enc__rules ul { padding-left: 20px; margin-bottom: 12px; }
.enc__rules li { font-size: 12.5px; font-weight: 700; line-height: 1.7; opacity: 0.8; }
.enc__rules p { font-size: 12.5px; font-weight: 700; opacity: 0.8; margin-bottom: 10px; line-height: 1.6; }

/* 通用 */
.enc__empty { font-size: 13px; font-weight: 900; opacity: 0.5; text-align: center; padding: 20px; }
.enc__foot { display: flex; justify-content: flex-end; padding-top: 10px; border-top: 3px solid var(--ink); margin-top: 10px; }
</style>
