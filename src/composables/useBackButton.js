// useBackButton.js — Capacitor 返回键 App 内导航
// 优先级：① 关闭当前弹窗/选择模式 → ② 游戏中回首页 → ③ 退出 App
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

let listener = null;

/**
 * 初始化返回键监听
 * @param {Function} handler — 返回 true 表示已处理（App内导航），false 表示退出 App
 * @returns {Function} cleanup
 */
export function initBackButton(handler) {
  // 非原生平台（网页版）不监听
  if (!Capacitor.isNativePlatform()) return () => {}

  let disposed = false // cleanup 先于 addListener 完成时，监听器注册后立即移除
  App.addListener('backButton', () => {
    const handled = handler();
    if (!handled) {
      App.exitApp();
    }
  }).then(l => {
    if (disposed) { l.remove(); return }
    listener = l
  });

  return () => {
    disposed = true
    listener?.remove();
    listener = null;
  };
}
