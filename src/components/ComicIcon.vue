<script setup>
// ComicIcon.vue — 自绘漫画风 SVG 图标集（统一粗墨描边 + 纯色填充 + 硬边阴影）
// 用法：<ComicIcon name="dice" :size="18" />
const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 16 },
})
</script>

<template>
  <svg
    class="comic-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <!-- 卡牌 -->
    <g v-if="name === 'card'">
      <rect x="8" y="3.5" width="12.5" height="15" rx="2.5" fill="#ef4444" stroke="#1a1a1a" stroke-width="2" />
      <rect x="3.5" y="5.5" width="12.5" height="15" rx="2.5" fill="#facc15" stroke="#1a1a1a" stroke-width="2" />
      <circle cx="8" cy="10" r="1.4" fill="#1a1a1a" />
      <circle cx="8" cy="14" r="1.4" fill="#1a1a1a" />
      <circle cx="8" cy="18" r="1.4" fill="#1a1a1a" />
    </g>

    <!-- 地产（小房子） -->
    <g v-else-if="name === 'home'">
      <path d="M3.5 11 L12 4 L20.5 11" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" fill="#3b82f6" />
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5" fill="#facc15" stroke="#1a1a1a" stroke-width="2" />
      <rect x="10" y="14" width="4" height="6" fill="#1a1a1a" />
      <circle cx="15.5" cy="6.5" r="1.6" fill="#ef4444" />
    </g>

    <!-- 其它（星形） -->
    <g v-else-if="name === 'more'">
      <path
        d="M12 2.5 L14.2 8 L20 8.2 L15.4 12 L17.2 17.8 L12 14.6 L6.8 17.8 L8.6 12 L4 8.2 L9.8 8 Z"
        fill="#a855f7" stroke="#1a1a1a" stroke-width="1.8" stroke-linejoin="round"
      />
      <circle cx="12" cy="10.2" r="1.6" fill="#fff" stroke="#1a1a1a" stroke-width="1.4" />
    </g>

    <!-- 骰子 -->
    <g v-else-if="name === 'dice'">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="#fff" stroke="#1a1a1a" stroke-width="2.2" />
      <circle cx="9" cy="9" r="1.7" fill="#ef4444" stroke="#1a1a1a" stroke-width="0.8" />
      <circle cx="15" cy="15" r="1.7" fill="#ef4444" stroke="#1a1a1a" stroke-width="0.8" />
      <circle cx="9" cy="15" r="1.7" fill="#ef4444" stroke="#1a1a1a" stroke-width="0.8" />
      <circle cx="15" cy="9" r="1.7" fill="#ef4444" stroke="#1a1a1a" stroke-width="0.8" />
    </g>

    <!-- 轻轨 -->
    <g v-else-if="name === 'metro'">
      <rect x="2.5" y="6" width="15" height="10" rx="2.5" fill="#22c55e" stroke="#1a1a1a" stroke-width="2" />
      <rect x="5" y="8" width="3.2" height="3.2" rx="0.8" fill="#fff" stroke="#1a1a1a" stroke-width="1.4" />
      <rect x="10" y="8" width="3.2" height="3.2" rx="0.8" fill="#fff" stroke="#1a1a1a" stroke-width="1.4" />
      <circle cx="6" cy="17.5" r="2.2" fill="#1a1a1a" />
      <circle cx="14" cy="17.5" r="2.2" fill="#1a1a1a" />
      <path d="M19.5 9 L19.5 14" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
    </g>

    <!-- 桥 -->
    <g v-else-if="name === 'bridge'">
      <path d="M2.5 16.5 Q12 5 21.5 16.5" fill="none" stroke="#1a1a1a" stroke-width="2.4" stroke-linecap="round" />
      <path d="M2.5 16.5 H21.5" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" />
      <path d="M8 16.5 V20.5 M16 16.5 V20.5" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
      <circle cx="5" cy="13.5" r="1.4" fill="#ef4444" />
      <circle cx="12" cy="10" r="1.4" fill="#facc15" />
      <circle cx="19" cy="13.5" r="1.4" fill="#3b82f6" />
    </g>

    <!-- 水波 -->
    <g v-else-if="name === 'wave'">
      <path d="M2.5 10 Q6 5.5 9.5 10 T16.5 10 T23.5 10" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" />
      <path d="M2.5 16 Q6 11.5 9.5 16 T16.5 16 T23.5 16" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" opacity="0.55" />
    </g>

    <!-- 封桥施工牌 -->
    <g v-else-if="name === 'closed'">
      <rect x="6" y="3" width="12" height="9" rx="1.5" fill="#facc15" stroke="#1a1a1a" stroke-width="2" transform="rotate(-8 12 7.5)" />
      <text x="12" y="10.4" text-anchor="middle" font-size="9" font-weight="900" fill="#1a1a1a" transform="rotate(-8 12 7.5)">!</text>
      <rect x="10.5" y="10" width="3" height="11" rx="1" fill="#ef4444" stroke="#1a1a1a" stroke-width="1.8" />
    </g>

    <!-- 自行车 -->
    <g v-else-if="name === 'bike'">
      <circle cx="6.5" cy="16" r="3.6" fill="#fff" stroke="#1a1a1a" stroke-width="2" />
      <circle cx="17.5" cy="16" r="3.6" fill="#fff" stroke="#1a1a1a" stroke-width="2" />
      <path d="M6.5 16 L12 16 L14 8 L10 8 M14 8 L17.5 16 M6.5 16 L10 13 M12 16 L9 8" stroke="#1a1a1a" stroke-width="1.9" fill="none" stroke-linejoin="round" />
      <path d="M14 8 L17 5.5" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round" />
      <path d="M14.6 6.5 H17" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round" />
    </g>

    <!-- 摩托 -->
    <g v-else-if="name === 'moto'">
      <circle cx="5.5" cy="17" r="3.2" fill="#fff" stroke="#1a1a1a" stroke-width="2" />
      <circle cx="17.5" cy="17" r="3.2" fill="#fff" stroke="#1a1a1a" stroke-width="2" />
      <path d="M5.5 17 L14 17 L17.5 17 M11 17 L10 12.5 H7.5 M10 12.5 L13.5 9.5 L17.5 12.5 V17" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linejoin="round" />
      <rect x="13.5" y="6" width="5" height="3.4" rx="1.2" fill="#3b82f6" stroke="#1a1a1a" stroke-width="1.8" />
    </g>

    <!-- 汽车 -->
    <g v-else-if="name === 'car'">
      <path d="M4 16 V11.5 Q4 10 5.5 9.5 L8 8 Q10.5 6.5 13 6.5 H15 Q18.5 6.5 19 9.5 L20 10 Q20.5 11 20.5 12 V16" fill="#3b82f6" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <rect x="7.5" y="9.5" width="9.5" height="4" rx="1" fill="#bfdbfe" stroke="#1a1a1a" stroke-width="1.5" />
      <circle cx="8" cy="17" r="2.6" fill="#1a1a1a" />
      <circle cx="16.5" cy="17" r="2.6" fill="#1a1a1a" />
      <circle cx="8" cy="17" r="1.2" fill="#facc15" />
      <circle cx="16.5" cy="17" r="1.2" fill="#facc15" />
    </g>

    <!-- 飞机 -->
    <g v-else-if="name === 'plane'">
      <path d="M12 2.5 L13.5 8.5 L21 11.5 L21 13.5 L13.5 12 L12 21 L10.5 12 L3 13.5 L3 11.5 L10.5 8.5 Z" fill="#a855f7" stroke="#1a1a1a" stroke-width="1.8" stroke-linejoin="round" />
    </g>

    <!-- 轮渡船 -->
    <g v-else-if="name === 'ferry'">
      <path d="M3 12 H21 L19 18 Q18.5 19 17 19 H7 Q5.5 19 5 18 Z" fill="#3b82f6" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <path d="M4.5 12 L12 9 L19.5 12" stroke="#1a1a1a" stroke-width="1.8" fill="none" stroke-linejoin="round" />
      <path d="M2.5 21 H21.5" stroke="#1a1a1a" stroke-width="2.4" stroke-linecap="round" />
      <path d="M12 9 V5.5" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" />
      <path d="M12 5.5 L14 3.5" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" />
    </g>

    <!-- 小面馆（碗+筷子） -->
    <g v-else-if="name === 'noodle'">
      <path d="M4 12 Q4 7.5 12 7.5 Q20 7.5 20 12 L19.5 15 Q19.4 17.5 16 17.5 H8 Q4.6 17.5 4.5 15 Z" fill="#facc15" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <path d="M4.5 14.5 Q12 13 19.5 14.5" stroke="#1a1a1a" stroke-width="1.6" fill="none" />
      <path d="M7 7.5 Q7 5 8.5 5 M10.5 7.5 Q10.5 5 12 5" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" />
    </g>

    <!-- 火锅店（锅） -->
    <g v-else-if="name === 'hotpot'">
      <path d="M4 12.5 Q4 10 12 10 Q20 10 20 12.5 L19.5 16.5 Q19.4 18.5 16 18.5 H8 Q4.6 18.5 4.5 16.5 Z" fill="#ef4444" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <path d="M12 10 V7" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
      <path d="M6.5 7.5 H17.5" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" />
      <path d="M12 7 L14 5 M12 7 L10 5" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" />
      <path d="M9 15.5 V14.8 M12 15.8 V15 M15 15.5 V14.8" stroke="#1a1a1a" stroke-width="1.4" stroke-linecap="round" />
    </g>

    <!-- 串串店（串） -->
    <g v-else-if="name === 'skewer'">
      <path d="M5 20 L14 7" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="10.5" cy="12.5" r="2.3" fill="#ef4444" stroke="#1a1a1a" stroke-width="1.8" />
      <circle cx="12.8" cy="9.8" r="2.3" fill="#facc15" stroke="#1a1a1a" stroke-width="1.8" />
      <circle cx="15.2" cy="7.2" r="2.3" fill="#22c55e" stroke="#1a1a1a" stroke-width="1.8" />
    </g>

    <!-- 标签（购地） -->
    <g v-else-if="name === 'tag'">
      <path d="M4 5.5 H13 L20 12.5 L13 19.5 L6 12.5 Z" fill="#facc15" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <circle cx="9.5" cy="10" r="1.7" fill="#ef4444" stroke="#1a1a1a" stroke-width="1.4" />
      <path d="M4 5.5 L4 3 H8" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" />
    </g>

    <!-- 交换箭头 -->
    <g v-else-if="name === 'swap'">
      <path d="M5 8 H18 M5 8 L8 5 M5 8 L8 11" stroke="#3b82f6" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M19 16 H6 M19 16 L16 13 M19 16 L16 19" stroke="#ef4444" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- 天平（均富） -->
    <g v-else-if="name === 'equalize'">
      <path d="M12 3.5 V20.5 M7.5 20.5 H16.5" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" />
      <path d="M5 7.5 H19 M12 7.5 L10.5 12 H13.5 Z" fill="#f59e0b" stroke="#1a1a1a" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M7.5 5 V10 M16.5 5 V10" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
      <circle cx="7.5" cy="4" r="1.6" fill="#facc15" stroke="#1a1a1a" stroke-width="1.4" />
      <circle cx="16.5" cy="4" r="1.6" fill="#facc15" stroke="#1a1a1a" stroke-width="1.4" />
    </g>

    <!-- 拳头（抢夺） -->
    <g v-else-if="name === 'steal'">
      <path d="M7 14.5 L4 11.5 Q2.8 10.3 4 9 Q5.2 7.8 6.5 9 L8.5 10.5 Q9 8.5 10.8 8.5 Q11.5 7 13 7.5 Q14 6 15.5 6.5 Q16 5 17.5 5.5 L18.5 11.5 Q19 15.5 15.5 18 L11.5 19.5 Q8.5 20.5 6.5 18 Z" fill="#f59e0b" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
    </g>

    <!-- 锤子（拆除） -->
    <g v-else-if="name === 'demolish'">
      <rect x="3" y="14.5" width="9" height="6.5" rx="1.5" fill="#f59e0b" stroke="#1a1a1a" stroke-width="2" transform="rotate(-35 7.5 17.5)" />
      <path d="M12.5 14 L20 6.5 L21.5 8 L14 15.5 Z" fill="#facc15" stroke="#1a1a1a" stroke-width="1.8" stroke-linejoin="round" />
    </g>

    <!-- 手铐（陷害） -->
    <g v-else-if="name === 'frame'">
      <circle cx="8" cy="16.5" r="3.6" fill="none" stroke="#1a1a1a" stroke-width="2.2" />
      <circle cx="16" cy="16.5" r="3.6" fill="none" stroke="#1a1a1a" stroke-width="2.2" />
      <path d="M11.5 16.5 H12.5" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
      <path d="M8 12.9 V10.5 M16 12.9 V10.5 M8 10.5 H16" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
    </g>

    <!-- 盾牌（免租） -->
    <g v-else-if="name === 'shield'">
      <path d="M12 3 L19 5.5 V12 Q19 17.5 12 21 Q5 17.5 5 12 V5.5 Z" fill="#3b82f6" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <path d="M9 12 L11.2 14.2 L15.5 9.8" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- 转向（回转箭头） -->
    <g v-else-if="name === 'reverse'">
      <path d="M18.5 10 A8.5 8.5 0 1 0 19 14" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" />
      <path d="M19 6 V14 H11" stroke="#1a1a1a" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M15.5 8.5 L11 13 L15.5 17.5" stroke="#ef4444" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- 停留（暂停） -->
    <g v-else-if="name === 'hold'">
      <circle cx="12" cy="12" r="8.5" fill="#facc15" stroke="#1a1a1a" stroke-width="2.2" />
      <rect x="9.2" y="8.5" width="2.2" height="7" rx="1" fill="#1a1a1a" />
      <rect x="12.6" y="8.5" width="2.2" height="7" rx="1" fill="#1a1a1a" />
    </g>

    <!-- 面具（嫁祸） -->
    <g v-else-if="name === 'transfer'">
      <path d="M4 8 Q8 4.5 12 4.5 Q16 4.5 20 8 L18 16 Q14 20 12 20 Q10 20 6 16 Z" fill="#a855f7" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <ellipse cx="8.5" cy="12" rx="2.6" ry="3.4" fill="#1a1a1a" />
      <ellipse cx="15.5" cy="12" rx="2.6" ry="3.4" fill="#1a1a1a" />
      <circle cx="8.5" cy="11" r="0.9" fill="#fff" />
      <circle cx="15.5" cy="11" r="0.9" fill="#fff" />
    </g>

    <!-- 怪兽 -->
    <g v-else-if="name === 'monster'">
      <rect x="4" y="7" width="16" height="10" rx="4" fill="#22c55e" stroke="#1a1a1a" stroke-width="2" />
      <path d="M4 9.5 L2 7 M4 11 L2 10" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
      <path d="M20 9.5 L22 7 M20 11 L22 10" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
      <circle cx="9" cy="12" r="1.6" fill="#fff" stroke="#1a1a1a" stroke-width="1.4" />
      <circle cx="15" cy="12" r="1.6" fill="#fff" stroke="#1a1a1a" stroke-width="1.4" />
      <circle cx="9" cy="12" r="0.7" fill="#1a1a1a" />
      <circle cx="15" cy="12" r="0.7" fill="#1a1a1a" />
      <path d="M12 15 L13.5 16.8 H10.5 Z" fill="#1a1a1a" />
    </g>

    <!-- 核弹（辐射） -->
    <g v-else-if="name === 'nuke'">
      <circle cx="12" cy="12" r="6.5" fill="#facc15" stroke="#1a1a1a" stroke-width="2" />
      <circle cx="12" cy="12" r="2.4" fill="#1a1a1a" />
      <path d="M12 6 V3.5 M12 20.5 V18 M6 12 H3.5 M20.5 12 H18 M7.8 7.8 L6 6 M18 18 L16.2 16.2 M7.8 16.2 L6 18 M18 6 L16.2 7.8" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
    </g>

    <!-- 奖杯 -->
    <g v-else-if="name === 'trophy'">
      <path d="M7 3.5 H17 V8 Q17 13 12 13 Q7 13 7 8 Z" fill="#facc15" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <path d="M7 5 H4 Q3.5 5 3.5 6 Q3.5 9 7 9.5 M17 5 H20 Q20.5 5 20.5 6 Q20.5 9 17 9.5" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
      <path d="M12 13 V17.5 M8.5 20.5 H15.5 M10 17.5 H14 L15.5 20.5 H8.5 Z" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="10.2" y="9.8" width="3.6" height="3" rx="0.8" fill="#ef4444" />
    </g>

    <!-- 旗帜（起点） -->
    <g v-else-if="name === 'flag'">
      <path d="M5.5 21.5 V3.5" stroke="#1a1a1a" stroke-width="2.4" stroke-linecap="round" />
      <path d="M5.5 4 Q9 2.5 12.5 4 Q16 5.5 19.5 4 V11.5 Q16 13 12.5 11.5 Q9 10 5.5 11.5 Z" fill="#ef4444" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
    </g>

    <!-- 锤子（升级） -->
    <g v-else-if="name === 'hammer'">
      <rect x="3.5" y="14" width="10" height="7" rx="1.8" fill="#f59e0b" stroke="#1a1a1a" stroke-width="2" transform="rotate(-32 8.5 17.5)" />
      <path d="M13 13.5 L19.5 7 L21 8.5 L14.5 15 Z" fill="#facc15" stroke="#1a1a1a" stroke-width="1.8" stroke-linejoin="round" />
    </g>

    <!-- 瞄准（选择目标） -->
    <g v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8" fill="none" stroke="#1a1a1a" stroke-width="2.2" />
      <circle cx="12" cy="12" r="4.6" fill="none" stroke="#1a1a1a" stroke-width="2" />
      <circle cx="12" cy="12" r="1.8" fill="#ef4444" />
      <path d="M12 1.5 V5 M12 19 V22.5 M1.5 12 H5 M19 12 H22.5" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" />
    </g>

    <!-- 百科全书（书本） -->
    <g v-else-if="name === 'book'">
      <path d="M4 5 Q12 3 20 5 V19 Q12 17 4 19 Z" fill="#a855f7" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <path d="M12 3 V19" stroke="#1a1a1a" stroke-width="1.8" />
      <path d="M7 8 H11 M7 11 H11 M7 14 H10" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0.6" />
      <path d="M13 8 H17 M13 11 H17 M13 14 H16" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0.6" />
    </g>

    <!-- 银行（建筑+柱子） -->
    <g v-else-if="name === 'bank'">
      <rect x="3" y="9" width="18" height="11" fill="#3b82f6" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <rect x="6" y="5" width="12" height="5" fill="#3b82f6" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" />
      <path d="M3 9 H21" stroke="#1a1a1a" stroke-width="2" />
      <rect x="8" y="12" width="2.5" height="5" fill="#fff" opacity="0.5" />
      <rect x="13.5" y="12" width="2.5" height="5" fill="#fff" opacity="0.5" />
      <circle cx="12" cy="7" r="1.8" fill="#facc15" stroke="#1a1a1a" stroke-width="1.2" />
    </g>

    <!-- 未知兜底 -->
    <g v-else>
      <circle cx="12" cy="12" r="8.5" fill="#facc15" stroke="#1a1a1a" stroke-width="2.2" />
      <text x="12" y="15.5" text-anchor="middle" font-size="11" font-weight="900" fill="#1a1a1a">?</text>
    </g>
  </svg>
</template>

<style scoped>
.comic-icon {
  display: inline-block;
  vertical-align: -0.125em;
  /* 硬边阴影（漫画感） */
  filter: drop-shadow(1.2px 1.2px 0 rgba(26, 26, 26, 0.9));
  flex-shrink: 0;
}
</style>
