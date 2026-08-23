// useSafeArea.js — 获取安全区尺寸（刘海/手势条）
// 布局层已用 CSS env() 变量处理，这里提供 JS 端读取方式
export function useSafeArea() {
  const getSafeArea = () => {
    const style = getComputedStyle(document.documentElement);
    const parse = (v) => parseInt(v) || 0;
    return {
      top: parse(style.getPropertyValue('--safe-top')),
      bottom: parse(style.getPropertyValue('--safe-bottom')),
      left: parse(style.getPropertyValue('--safe-left')),
      right: parse(style.getPropertyValue('--safe-right')),
    };
  };
  return { getSafeArea };
}
