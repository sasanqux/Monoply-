// game 模块前端出口 —— 唯一事实来源在 shared/game（浏览器与 Node 共用，服务器直接 import 同一包）
// 前端历史路径 '../game/index.js'、'./game/index.js' 继续可用；请勿在此目录再放实现文件。
export * from '../../shared/game/index.js'
