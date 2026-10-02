/**
 * Static dashboard page for token-usage-stats. The page is deliberately
 * dependency-free: one HTML document fetches the sibling JSON endpoint and
 * renders cards, a series chart, a bucket breakdown, and a per-model table.
 *
 * @module @deepseek-ai/dsh-token-usage-stats-web/dashboard
 */
import type { ModelPricing } from './types.ts'

/**
 * HTML document rendered at `/token-usage-stats`.
 * @param builtinPricing - the plugin's built-in price book, embedded as the
 *   editor's fallback so the page still lists models when the JSON endpoint is
 *   unreachable.
 * @returns the complete self-contained dashboard document.
 */
export function renderUsageDashboard(
  builtinPricing: Readonly<Record<string, ModelPricing>>,
): string {
  const builtinJson = JSON.stringify(builtinPricing).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Token 用量统计</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f6f7f9;
    --panel: #ffffff;
    --text: #1c2333;
    --muted: #6b7280;
    --line: #e5e7eb;
    --accent: #2563eb;
    --green: #16a34a;
    --amber: #d97706;
    --purple: #7c3aed;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111827;
      --panel: #1f2937;
      --text: #f9fafb;
      --muted: #9ca3af;
      --line: #374151;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      overflow-x: hidden;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 18px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    box-sizing: border-box;
    flex-wrap: nowrap;
  }
  header h1 {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 30px;
  }
  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
    flex-wrap: nowrap;
    flex-shrink: 1;
  }
  .controls label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    line-height: 30px;
  }
  select {
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
    border-radius: 6px;
    height: 30px;
    padding: 0 6px;
    font: inherit;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
    cursor: pointer;
  }
  select:focus {
    border-color: var(--accent);
  }
  #model {
    max-width: 120px;
    text-overflow: ellipsis;
  }
  button {
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
    border-radius: 6px;
    font: inherit;
    cursor: pointer;
  }
  @media (max-width: 680px) {
    header {
      flex-wrap: wrap;
      padding: 10px 14px;
    }
    .controls {
      flex-wrap: wrap;
      gap: 6px;
    }
    #model {
      max-width: 110px;
    }
  }
  main { padding: 20px 24px 32px; display: grid; gap: 16px; max-width: 1200px; margin: 0 auto; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
  .card h2 { margin: 0 0 12px; font-size: 15px; }
  .metric .label { color: var(--muted); font-size: 12px; }
  .metric .value { font-size: 26px; font-weight: 600; margin-top: 6px; }
  .metric .unit { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .chart { min-height: 0; }
  .chart-tabs {
    display: flex;
    gap: 8px;
    margin: 0 0 12px;
    border-bottom: 1px solid var(--line);
  }
  .chart-tab {
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--muted);
    padding: 6px 10px;
    margin-bottom: -1px;
    border-radius: 0;
    font: inherit;
    cursor: pointer;
  }
  .chart-tab.active {
    color: var(--text);
    border-bottom-color: var(--accent);
    font-weight: 600;
  }
  .chart-panel[hidden] { display: none; }
  .chart svg { width: 100%; height: 230px; display: block; }
  .axis { stroke: var(--line); }
  .axis text { fill: var(--muted); font-size: 10px; }
  .bar { fill: var(--accent); }
  .bar:hover { opacity: 0.85; }
  .chart-wrap { position: relative; }
  .chart-tip {
    position: absolute;
    pointer-events: none;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.14);
    opacity: 0;
    transition: opacity 0.1s;
    z-index: 5;
    white-space: nowrap;
  }
  .chart-tip .tip-head { font-weight: 600; margin-bottom: 6px; display: flex; gap: 16px; justify-content: space-between; }
  .chart-tip .tip-row { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
  .chart-tip .dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .chart-tip .tip-val { margin-left: auto; padding-left: 16px; font-variant-numeric: tabular-nums; }

  .empty { color: var(--muted); padding: 40px 0; text-align: center; }
  .bars { display: grid; gap: 10px; }
  .bar-row { display: grid; grid-template-columns: 130px 1fr 175px; gap: 10px; align-items: center; font-size: 12px; }
  .bar-row .name { color: var(--muted); }
  .bar-track { height: 14px; background: var(--line); border-radius: 7px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 7px; }
  .bar-row .value { text-align: right; font-variant-numeric: tabular-nums; }
  .bar-row .pct { color: var(--muted); font-size: 11px; margin-left: 10px; white-space: nowrap; }
  .tableWrap { width: 100%; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
  th, td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; word-break: break-word; }
  th:first-child, td:first-child { text-align: left; }
  th { color: var(--muted); font-weight: 500; }
  tbody tr:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
  .foot { color: var(--muted); font-size: 12px; }

  /* 统一 Header 与操作按钮 */
  .ui-icon {
    width: 14px !important;
    height: 14px !important;
    min-width: 14px;
    min-height: 14px;
    max-width: 14px;
    max-height: 14px;
    display: inline-block !important;
    vertical-align: middle;
    flex-shrink: 0;
  }
  .modal-title-row .ui-icon {
    width: 18px !important;
    height: 18px !important;
    min-width: 18px;
    min-height: 18px;
    max-width: 18px;
    max-height: 18px;
  }
  .btn-text .ui-icon, .btn-icon-danger .ui-icon, .tier-badge .ui-icon {
    width: 12px !important;
    height: 12px !important;
    min-width: 12px;
    min-height: 12px;
    max-width: 12px;
    max-height: 12px;
  }

  .btn-header {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    height: 30px;
    padding: 0 9px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .btn-header:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--panel));
  }
  .btn-header .ui-icon {
    transition: transform 0.25s ease;
  }
  #refresh:hover .ui-icon {
    transform: rotate(180deg);
  }

  .btn-secondary {
    background: var(--panel);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .btn-secondary:hover {
    background: color-mix(in srgb, var(--line) 30%, transparent);
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--accent);
    padding: 4px 8px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-weight: 500;
    border-radius: 4px;
    transition: background 0.15s;
  }
  .btn-text:hover {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .btn-icon-danger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: 1px solid transparent;
    color: var(--muted);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-icon-danger:hover {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.25);
    background: rgba(239, 68, 68, 0.08);
  }
  .btn-icon-restore {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--muted);
    border: 1px solid var(--line);
    background: transparent;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-icon-restore:hover {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  /* 模型条目的来源标记：内置默认 / 已覆盖 / 自定义 */
  .model-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }
  .model-badge-builtin {
    color: var(--muted);
    background: color-mix(in srgb, var(--muted) 12%, transparent);
    border: 1px solid var(--line);
  }
  .model-badge-override {
    color: #d97706;
    background: rgba(217, 119, 6, 0.12);
    border: 1px solid rgba(217, 119, 6, 0.28);
  }
  .model-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .btn-save {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--accent);
    color: #ffffff;
    border: 1px solid transparent;
    padding: 7px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
    transition: all 0.15s ease;
  }
  .btn-save:hover {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
  }

  /* 模态框 Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .modal-backdrop[hidden] { display: none !important; }
  .modal-dialog {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    width: 100%;
    max-width: 780px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4);
    animation: modalIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.96) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 22px;
    border-bottom: 1px solid var(--line);
  }
  .modal-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .modal-title-row h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .modal-subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .modal-close {
    background: none;
    border: none;
    font-size: 20px;
    line-height: 1;
    color: var(--muted);
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .modal-close:hover { color: var(--text); background: var(--line); }
  .modal-body {
    padding: 20px 22px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 22px;
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--panel) 92%, var(--bg));
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }

  /* 时段与模型配置内部组件 */
  .schedule-box {
    background: color-mix(in srgb, var(--bg) 60%, transparent);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px 16px;
  }
  .schedule-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 500;
  }
  .schedule-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .interval-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
  }
  .time-input {
    width: 76px;
    text-align: center;
    padding: 4px 6px;
    font-variant-numeric: tabular-nums;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--panel);
    color: var(--text);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .time-input.input-invalid,
  .model-name-input.input-invalid {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25) !important;
    background-color: rgba(239, 68, 68, 0.05) !important;
  }

  .model-card {
    background: color-mix(in srgb, var(--bg) 50%, transparent);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 12px;
  }
  .pricing-filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .pricing-filter-row .model-search-input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    font-size: 13px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--panel);
    color: var(--text);
  }
  .pricing-count {
    flex: none;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .pricing-hint {
    margin: 0 0 12px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--muted);
  }
  .pricing-hint code {
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--bg) 70%, transparent);
    border: 1px solid var(--line);
  }

  .model-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .model-name-input {
    font-weight: 600;
    font-size: 13px;
    width: 220px;
    padding: 5px 10px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--panel);
    color: var(--text);
  }
  
  /* 精致分段胶囊控制 Segmented Control */
  .segmented-control {
    display: inline-flex;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .segmented-control label {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    margin: 0;
  }
  .segmented-control input[type="radio"] {
    display: none;
  }
  .segmented-control .seg-btn {
    padding: 3px 10px;
    font-size: 12px;
    color: var(--muted);
    border-radius: 4px;
    transition: all 0.15s;
    user-select: none;
  }
  .segmented-control input[type="radio"]:checked + .seg-btn {
    background: var(--accent);
    color: #ffffff;
    font-weight: 500;
  }

  .pricing-grids-container {
    display: grid;
    gap: 12px;
  }
  .pricing-grids-container.is-split {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 640px) {
    .pricing-grids-container.is-split { grid-template-columns: 1fr; }
  }
  .tier-block {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 12px 14px;
  }
  .tier-block-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
  }

  /* 标签徽标 */
  .tier-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }
  .tier-badge-peak {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }
  .tier-badge-offpeak {
    background: rgba(139, 92, 246, 0.12);
    color: #8b5cf6;
    border: 1px solid rgba(139, 92, 246, 0.25);
  }
  .tier-badge-flat {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.25);
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .price-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .price-field label {
    font-size: 11px;
    color: var(--muted);
  }
  .price-field input {
    width: 100%;
    padding: 5px 8px;
    font-variant-numeric: tabular-nums;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
  }

  /* Toast 提示 */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #10b981;
    color: #ffffff;
    padding: 8px 18px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    z-index: 1000;
    animation: toastFade 0.2s ease-out;
  }
  .toast.error { background: #ef4444; }
  .toast[hidden] { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>Token 用量统计</h1>
  <div class="controls">
    <label>范围
      <select id="range">
        <option value="today">今天</option>
        <option value="3d">近 3 天</option>
        <option value="7d">近 7 天</option>
        <option value="30d">近 30 天</option>
        <option value="all">全部</option>
      </select>
    </label>
    <label>粒度
      <select id="granularity">
        <option value="hour">按小时</option>
        <option value="day">按天</option>
      </select>
    </label>
    <label>模型
      <select id="model"><option value="">全部</option></select>
    </label>
    <button id="refresh" class="btn-header" type="button" title="刷新数据">
      <svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
        <path d="M16 21h5v-5"/>
      </svg>
      <span>刷新</span>
    </button>
    <button id="openPricingModal" class="btn-header" type="button" title="配置模型价格与峰谷时段">
      <svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <span>价格配置</span>
    </button>
  </div>
</header>
<main>
  <section class="cards">
    <article class="card metric">
      <div class="label">消费金额</div>
      <div class="value" id="cost">--</div>
      <div class="unit" id="currency"></div>
    </article>
    <article class="card metric">
      <div class="label">API 请求次数</div>
      <div class="value" id="requests">--</div>
      <div class="unit">次</div>
    </article>
    <article class="card metric">
      <div class="label">Tokens</div>
      <div class="value" id="totalTokens">--</div>
      <div class="unit">输入 + 输出 + 缓存</div>
    </article>
    <article class="card metric">
      <div class="label">输出 Tokens</div>
      <div class="value" id="outputTokens">--</div>
      <div class="unit">输出</div>
    </article>
  </section>

  <section class="card chart">
    <div class="chart-tabs" role="tablist" aria-label="趋势图">
      <button id="tabTokens" class="chart-tab active" type="button" role="tab" aria-selected="true" aria-controls="series">Tokens 趋势</button>
      <button id="tabCost" class="chart-tab" type="button" role="tab" aria-selected="false" aria-controls="costChart">消费金额（<span id="costCurrency" style="text-transform:uppercase">CNY</span>）</button>
    </div>
    <div id="series" class="chart-panel" role="tabpanel" aria-labelledby="tabTokens"></div>
    <div id="costChart" class="chart-panel" role="tabpanel" aria-labelledby="tabCost" hidden></div>
  </section>

  <section class="card">
    <h2>Token 构成</h2>
    <div class="bars" id="breakdown"></div>
  </section>

  <section class="card">
    <h2>按模型统计</h2>
    <div class="tableWrap">
        <table>
      <thead>
        <tr>
          <th>模型</th>
          <th>Provider</th>
          <th>请求数</th>
          <th>输入（未命中）</th>
          <th>输入（命中缓存）</th>
          <th>输出</th>
          <th>Tokens</th>
          <th>成本</th>
        </tr>
      </thead>
      <tbody id="modelRows"></tbody>
    </table>
      </div>
  </section>

  <section class="card">
    <h2>消耗 TOP 5 对话</h2>
    <div class="tableWrap">
        <table>
      <thead>
        <tr>
          <th>会话</th>
          <th>最后请求</th>
          <th>请求数</th>
          <th>输入（未命中）</th>
          <th>输入（命中缓存）</th>
          <th>输出</th>
          <th>Tokens</th>
          <th>成本</th>
        </tr>
      </thead>
      <tbody id="topSessions"></tbody>
    </table>
      </div>
  </section>

  <p class="foot">数据来自当前进程内的 <code>ctx.tokenUsageStats</code>，页面自动每 10 秒刷新一次。成本按插件内置价目表计算，未收录的模型显示「未配置定价」。</p>
</main>

<div id="pricingModal" class="modal-backdrop" hidden>
  <div class="modal-dialog">
    <div class="modal-header">
      <div class="modal-title-group">
        <div class="modal-title-row">
          <svg class="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <h2>模型价格策略配置</h2>
        </div>
        <p class="modal-subtitle">自定义各模型的 Token 计费单价及高峰/闲时分时规则</p>
      </div>
      <button type="button" class="modal-close" id="closePricingModal" aria-label="关闭">&times;</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;align-items:center;gap:16px;">
        <span style="font-weight:600;font-size:13px;">计费货币：</span>
        <div class="segmented-control">
          <label><input type="radio" name="pricingCurrency" value="CNY" checked><span class="seg-btn">人民币 (CNY / ¥)</span></label>
          <label><input type="radio" name="pricingCurrency" value="USD"><span class="seg-btn">美元 (USD / $)</span></label>
        </div>
      </div>

      <div class="schedule-box">
        <div class="schedule-head">
          <div class="schedule-title">
            <svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>峰谷分时时段规则（仅对开启分时计价的模型生效）</span>
          </div>
          <label style="cursor:pointer;font-weight:normal;display:inline-flex;align-items:center;gap:4px;font-size:12px;">
            <input type="checkbox" id="weekendOffpeak" checked> 周末全天视为闲时
          </label>
        </div>
        <div id="intervalsList"></div>
        <button type="button" class="btn-text" id="addIntervalBtn" style="margin-top:6px;">
          <svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>添加高峰时段</span>
        </button>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px;flex-wrap:wrap;">
          <h3 style="margin:0;font-size:13px;font-weight:600;">模型计费配置（每 1,000,000 Tokens）</h3>
          <button type="button" class="btn-text" id="addModelBtn">
            <svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>添加模型</span>
          </button>
        </div>
        <div class="pricing-filter-row">
          <input type="search" id="modelSearch" class="model-search-input" placeholder="搜索模型名称，如 claude / deepseek / glm">
          <span class="pricing-count" id="modelCount"></span>
        </div>
        <p class="pricing-hint">
          插件内置默认价目表，未修改的模型直接按内置价计费，无需配置。带「已覆盖」标记的条目会随保存写入 <code>token-usage-pricing.json</code>，并覆盖内置价；「恢复默认」可撤销覆盖。
        </p>
        <div id="modelList"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" id="resetDefaultBtn" class="btn-secondary">恢复官方默认</button>
      <div style="display:flex;gap:8px;">
        <button type="button" id="cancelPricingBtn" class="btn-secondary">取消</button>
        <button type="button" id="savePricingBtn" class="btn-save">
          <svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>保存并立即生效</span>
        </button>
      </div>
    </div>
  </div>
</div>
<div id="toast" class="toast" hidden></div>

<script>
(function () {
  'use strict'
  try {
    if (window.self !== window.top) {
      document.body.classList.add('is-embedded')
    }
  } catch (_) {
    document.body.classList.add('is-embedded')
  }
  function $(id) { return document.getElementById(id) }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    })
  }
  function number(value) { return Number(value || 0).toLocaleString('en-US') }
  function costText(snapshot, totals) {
    if (totals.cost === undefined) return '未配置定价'
    var prefix = snapshot.currency === 'CNY' ? '¥' : ''
    return prefix + Number(totals.cost).toFixed(2) + (snapshot.currency ? ' ' + esc(snapshot.currency) : '')
  }
  function bucketLabel(startTime, granularity) {
    var d = new Date(startTime)
    if (granularity === 'month') {
      return (d.getMonth() + 1) + '月'
    }
    if (granularity === 'week') {
      return (d.getMonth() + 1) + '/' + d.getDate()
    }
    if (granularity === 'day') {
      return (d.getMonth() + 1) + '/' + d.getDate()
    }
    return String(d.getHours()).padStart(2, '0') + ':00'
  }
  function tooltipHead(p, granularity) {
    var d = new Date(p.startTime)
    if (granularity === 'month') {
      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月'
    }
    if (granularity === 'week') {
      var endD = new Date(p.endTime - 1)
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ~ ' + (endD.getMonth() + 1) + '/' + endD.getDate() + ' (周)'
    }
    var start = bucketLabel(p.startTime, granularity)
    if (granularity === 'day') return start
    return start + ' ~ ' + bucketLabel(p.endTime, granularity)
  }
  function renderBreakdown(totals) {
    var rows = [
      ['输入（命中缓存）', totals.cacheReadTokens],
      ['输入（未命中缓存）', totals.uncachedInputTokens],
      ['输出', totals.outputTokens],
    ]
    var total = rows.reduce(function (sum, row) { return sum + row[1] }, 0)
    var max = Math.max(1, total)
    $('breakdown').innerHTML = rows.map(function (row) {
      var label = row[0]
      var value = row[1]
      var pct = total > 0 ? value / max * 100 : 0
      var width = value > 0 ? Math.max(0.8, pct) : 0
      return '<div class="bar-row">'
        + '<div class="name">' + esc(label) + '</div>'
        + '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%;background:' + tokenColor(label) + '"></div></div>'
        + '<div class="value">' + number(value) + '<span class="pct">' + pct.toFixed(1) + '%</span></div>'
        + '</div>'
    }).join('')
  }
  function tokenColor(label) {
    var palette = { '输入（命中缓存）': '#7cb8e8', '输入（未命中缓存）': '#3b82f6', '输出': '#1d4ed8' }
    return palette[label] || '#3b82f6'
  }
  function renderSeries(series, granularity) {
    var host = $('series')
    if (!series || series.length === 0) {
      host.innerHTML = '<div class="empty">当前范围暂无数据</div>'
      return
    }
    var width = 900
    var height = 220
    var padX = 44
    var padY = 22
    var max = Math.max.apply(null, series.map(function (point) { return point.totals.totalTokens }))
    if (max <= 0) max = 1
    var step = (width - padX * 2) / Math.max(1, series.length - 1)
    var points = series.map(function (point, index) {
      var x = padX + step * index
      var y = height - padY - point.totals.totalTokens / max * (height - padY * 2)
      return { x: x, y: y, point: point }
    })
    var barWidth = Math.min(step * 0.72, 48)
    var bars = points.map(function (entry, index) {
      var barHeight = height - padY - entry.y
      var x = entry.x - barWidth / 2
      return '<rect class="bar" data-index="' + index + '" x="' + x.toFixed(1) + '" y="' + entry.y.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + Math.max(0.5, barHeight).toFixed(1) + '" rx="2"></rect>'
    }).join('')
    var labelEvery = Math.max(1, Math.ceil(points.length / 12))
    var labels = points.filter(function (_, index) { return index % labelEvery === 0 }).map(function (entry) {
      return '<text x="' + entry.x.toFixed(1) + '" y="' + (height - 5) + '" text-anchor="middle" fill="var(--muted)" font-size="10">'
        + esc(bucketLabel(entry.point.startTime, granularity)) + '</text>'
    }).join('')
    host.innerHTML = '<div class="chart-wrap">'
      + '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Tokens 趋势">'
      + '<line class="axis" x1="' + padX + '" y1="' + (height - padY) + '" x2="' + (width - padX) + '" y2="' + (height - padY) + '"></line>'
      + bars + labels + '</svg>'
      + '<div class="chart-tip" id="seriesTip"></div></div>'
    var wrap = host.querySelector('.chart-wrap')
    var tip = $('seriesTip')
    function showTip(index) {
      var p = series[index]
      var t = p.totals
      var head = tooltipHead(p, granularity)
      var rows = [
        ['输入（命中缓存）', t.cacheReadTokens],
        ['输入（未命中缓存）', t.uncachedInputTokens],
        ['输出', t.outputTokens],
      ].filter(function (row) { return row[1] > 0 }).map(function (row) {
        return '<div class="tip-row"><span class="dot" style="background:' + tokenColor(row[0]) + '"></span>'
          + esc(row[0]) + '<span class="tip-val">' + number(row[1]) + '</span></div>'
      }).join('')
      tip.innerHTML = '<div class="tip-head"><span>' + esc(head) + '</span><span>' + number(t.totalTokens) + '</span></div>' + rows
      tip.style.opacity = '1'
    }
    Array.prototype.forEach.call(host.querySelectorAll('rect.bar'), function (rect) {
      rect.addEventListener('mouseover', function () { showTip(Number(rect.getAttribute('data-index'))) })
      rect.addEventListener('mouseout', function () { tip.style.opacity = '0' })
      rect.addEventListener('mousemove', function (e) {
        var r = wrap.getBoundingClientRect()
        tip.style.left = (Math.min(e.clientX - r.left + 12, r.width - tip.offsetWidth - 8)) + 'px'
        tip.style.top = (e.clientY - r.top - tip.offsetHeight - 10) + 'px'
      })
    })
  }
  function renderModels(snapshot) {
    var select = $('model')
    var current = select.value
    var options = '<option value="">全部</option>'
    snapshot.models.forEach(function (entry) {
      var sel = entry.model === current ? ' selected' : ''
      options += '<option value="' + esc(entry.model) + '"' + sel + '>' + esc(entry.model) + '</option>'
    })
    select.innerHTML = options

    var host = $('modelRows')
    if (!snapshot.models || snapshot.models.length === 0) {
      host.innerHTML = '<tr><td colspan="8" class="empty">暂无数据</td></tr>'
      return
    }
    host.innerHTML = snapshot.models.map(function (entry) {
      var t = entry.totals
      return '<tr>'
        + '<td style="text-align:left">' + esc(entry.model) + '</td>'
        + '<td style="text-align:left">' + esc(entry.provider) + '</td>'
        + '<td>' + number(t.requestCount) + '</td>'
        + '<td>' + number(t.uncachedInputTokens) + '</td>'
        + '<td>' + number(t.cacheReadTokens) + '</td>'
        + '<td>' + number(t.outputTokens) + '</td>'
        + '<td>' + number(t.totalTokens) + '</td>'
        + '<td>' + esc(costText(snapshot, t)) + '</td>'
        + '</tr>'
    }).join('')
  }
  function modelColor(index) {
    var palette = [
      '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#14b8a6',
    ]
    return palette[index % palette.length]
  }
  function renderCostChart(series, granularity, snapshot) {
    var host = $('costChart')
    $('costCurrency').textContent = snapshot.currency || 'CNY'
    if (!series || series.length === 0) {
      host.innerHTML = '<div class="empty">当前范围暂无数据</div>'
      return
    }
    var hasCost = series.some(function (p) { return p.totals.cost !== undefined && p.totals.cost > 0 })
    if (!hasCost) {
      host.innerHTML = '<div class="empty">当前范围未产生费用（或未配置模型定价）</div>'
      return
    }
    var width = 900
    var height = 220
    var padX = 44
    var padY = 22
    var modelColorMap = {}
    var colorIndex = 0
    series.forEach(function (p) {
      (p.models || []).forEach(function (m) {
        if (modelColorMap[m.model] === undefined) {
          modelColorMap[m.model] = modelColor(colorIndex++)
        }
      })
    })
    var max = Math.max.apply(null, series.map(function (p) { return p.totals.cost || 0 }))
    if (max <= 0) max = 1
    var step = (width - padX * 2) / Math.max(1, series.length - 1)
    var barWidth = Math.min(step * 0.72, 48)
    var bars = series.map(function (point, index) {
      var x = padX + step * index - barWidth / 2
      var stackY = height - padY
      var segments = (point.models || []).filter(function (m) { return m.cost > 0 }).map(function (m) {
        var segHeight = (m.cost / max) * (height - padY * 2)
        stackY -= segHeight
        return '<rect class="bar" data-index="' + index + '" x="' + x.toFixed(1) + '" y="' + stackY.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + Math.max(0.5, segHeight).toFixed(1) + '" fill="' + modelColorMap[m.model] + '" rx="1"></rect>'
      }).join('')
      return segments
    }).join('')
    var labelEvery = Math.max(1, Math.ceil(series.length / 12))
    var labels = series.filter(function (_, index) { return index % labelEvery === 0 }).map(function (p, index) {
      var origIndex = index * labelEvery
      var x = padX + step * origIndex
      return '<text x="' + x.toFixed(1) + '" y="' + (height - 5) + '" text-anchor="middle" fill="var(--muted)" font-size="10">'
        + esc(bucketLabel(p.startTime, granularity)) + '</text>'
    }).join('')
    host.innerHTML = '<div class="chart-wrap">'
      + '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="消费金额趋势">'
      + '<line class="axis" x1="' + padX + '" y1="' + (height - padY) + '" x2="' + (width - padX) + '" y2="' + (height - padY) + '"></line>'
      + bars + labels + '</svg>'
      + '<div class="chart-tip" id="costTip"></div></div>'
    var wrap = host.querySelector('.chart-wrap')
    var tip = $('costTip')
    var prefix = snapshot.currency === 'CNY' ? '¥' : ''
    function showTip(index) {
      var p = series[index]
      var head = tooltipHead(p, granularity)
      var total = p.totals.cost || 0
      var rows = (p.models || []).filter(function (m) { return m.cost > 0 }).map(function (m) {
        return '<div class="tip-row"><span class="dot" style="background:' + modelColorMap[m.model] + '"></span>'
          + esc(m.model) + '<span class="tip-val">' + prefix + m.cost.toFixed(4) + '</span></div>'
      }).join('')
      tip.innerHTML = '<div class="tip-head"><span>' + esc(head) + '</span><span>' + prefix + Number(total).toFixed(4) + '</span></div>' + rows
      tip.style.opacity = '1'
    }
    Array.prototype.forEach.call(host.querySelectorAll('rect.bar'), function (rect) {
      rect.addEventListener('mouseover', function () { showTip(Number(rect.getAttribute('data-index'))) })
      rect.addEventListener('mouseout', function () { tip.style.opacity = '0' })
      rect.addEventListener('mousemove', function (e) {
        var r = wrap.getBoundingClientRect()
        tip.style.left = (Math.min(e.clientX - r.left + 12, r.width - tip.offsetWidth - 8)) + 'px'
        tip.style.top = (e.clientY - r.top - tip.offsetHeight - 10) + 'px'
      })
    })
  }
  function adaptSeriesForDisplay(rawSeries, currentGranularity, range) {
    if (!rawSeries || rawSeries.length <= 30 || range !== 'all' || currentGranularity !== 'day') {
      return { series: rawSeries || [], granularity: currentGranularity }
    }
    if (rawSeries.length <= 180) {
      return { series: aggregateSeriesByWeek(rawSeries), granularity: 'week' }
    }
    return { series: aggregateSeriesByMonth(rawSeries), granularity: 'month' }
  }

  function aggregateSeriesByWeek(series) {
    var groups = new Map()
    for (var i = 0; i < series.length; i++) {
      var p = series[i]
      var d = new Date(p.startTime)
      d.setHours(0, 0, 0, 0)
      var day = d.getDay()
      var diff = (day === 0 ? -6 : 1) - day
      d.setDate(d.getDate() + diff)
      var weekStart = d.getTime()
      var group = groups.get(weekStart)
      if (!group) {
        group = {
          startTime: weekStart,
          endTime: weekStart + 7 * 86400000,
          totals: {
            requestCount: 0,
            uncachedInputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          modelsMap: {},
        }
        groups.set(weekStart, group)
      }
      var gt = group.totals
      var pt = p.totals
      gt.requestCount += pt.requestCount || 0
      gt.uncachedInputTokens += pt.uncachedInputTokens || 0
      gt.cacheReadTokens += pt.cacheReadTokens || 0
      gt.cacheWriteTokens += pt.cacheWriteTokens || 0
      gt.outputTokens += pt.outputTokens || 0
      gt.totalTokens += pt.totalTokens || 0
      if (pt.cost !== undefined) {
        gt.cost = (gt.cost || 0) + pt.cost
      }
      if (p.models) {
        for (var j = 0; j < p.models.length; j++) {
          var m = p.models[j]
          group.modelsMap[m.model] = (group.modelsMap[m.model] || 0) + (m.cost || 0)
        }
      }
    }
    var result = []
    groups.forEach(function (group) {
      var models = []
      for (var modelName in group.modelsMap) {
        models.push({ model: modelName, cost: group.modelsMap[modelName] })
      }
      result.push({
        startTime: group.startTime,
        endTime: group.endTime,
        totals: group.totals,
        models: models,
      })
    })
    result.sort(function (a, b) { return a.startTime - b.startTime })
    return result
  }

  function aggregateSeriesByMonth(series) {
    var groups = new Map()
    for (var i = 0; i < series.length; i++) {
      var p = series[i]
      var d = new Date(p.startTime)
      var monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
      var monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
      var group = groups.get(monthStart)
      if (!group) {
        group = {
          startTime: monthStart,
          endTime: monthEnd,
          totals: {
            requestCount: 0,
            uncachedInputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          modelsMap: {},
        }
        groups.set(monthStart, group)
      }
      var gt = group.totals
      var pt = p.totals
      gt.requestCount += pt.requestCount || 0
      gt.uncachedInputTokens += pt.uncachedInputTokens || 0
      gt.cacheReadTokens += pt.cacheReadTokens || 0
      gt.cacheWriteTokens += pt.cacheWriteTokens || 0
      gt.outputTokens += pt.outputTokens || 0
      gt.totalTokens += pt.totalTokens || 0
      if (pt.cost !== undefined) {
        gt.cost = (gt.cost || 0) + pt.cost
      }
      if (p.models) {
        for (var j = 0; j < p.models.length; j++) {
          var m = p.models[j]
          group.modelsMap[m.model] = (group.modelsMap[m.model] || 0) + (m.cost || 0)
        }
      }
    }
    var result = []
    groups.forEach(function (group) {
      var models = []
      for (var modelName in group.modelsMap) {
        models.push({ model: modelName, cost: group.modelsMap[modelName] })
      }
      result.push({
        startTime: group.startTime,
        endTime: group.endTime,
        totals: group.totals,
        models: models,
      })
    })
    result.sort(function (a, b) { return a.startTime - b.startTime })
    return result
  }

  function render(snapshot) {
    $('cost').textContent = costText(snapshot, snapshot.totals)
    $('currency').textContent = snapshot.currency || ''
    $('requests').textContent = number(snapshot.totals.requestCount)
    $('totalTokens').textContent = number(snapshot.totals.totalTokens)
    $('outputTokens').textContent = number(snapshot.totals.outputTokens)
    renderBreakdown(snapshot.totals)
    var range = $('range').value
    var adapted = adaptSeriesForDisplay(snapshot.series, $('granularity').value, range)
    renderSeries(adapted.series, adapted.granularity)
    renderCostChart(adapted.series, adapted.granularity, snapshot)
    renderModels(snapshot)
    renderTopSessions(snapshot)
  }
  function renderTopSessions(snapshot) {
    var host = $('topSessions')
    var rows = snapshot.topSessions || []
    if (rows.length === 0) {
      host.innerHTML = '<tr><td colspan="8" class="empty">暂无对话数据</td></tr>'
      return
    }
    host.innerHTML = rows.map(function (entry) {
      var t = entry.totals
      var label = entry.title ? entry.title : ('会话 ' + String(entry.id).replace(/^session-/, '').slice(0, 8))
      var when = entry.lastTime
        ? new Date(entry.lastTime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : ''
      return '<tr>'
        + '<td style="text-align:left; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + esc(label) + '">' + esc(label) + '</td>'
        + '<td>' + esc(when) + '</td>'
        + '<td>' + number(t.requestCount) + '</td>'
        + '<td>' + number(t.uncachedInputTokens) + '</td>'
        + '<td>' + number(t.cacheReadTokens) + '</td>'
        + '<td>' + number(t.outputTokens) + '</td>'
        + '<td>' + number(t.totalTokens) + '</td>'
        + '<td>' + esc(costText(snapshot, t)) + '</td>'
        + '</tr>'
    }).join('')
  }
  function initChartTabs() {
    var tabs = [
      { tab: $('tabTokens'), panel: $('series') },
      { tab: $('tabCost'), panel: $('costChart') },
    ]
    function select(tabId) {
      tabs.forEach(function (entry) {
        var active = entry.tab.id === tabId
        entry.tab.classList.toggle('active', active)
        entry.tab.setAttribute('aria-selected', active ? 'true' : 'false')
        entry.panel.hidden = !active
      })
    }
    tabs.forEach(function (entry) {
      entry.tab.addEventListener('click', function () { select(entry.tab.id) })
    })
    select('tabTokens')
  }
  function rangeParams() {
    var range = $('range').value
    if (range === 'all') return new URLSearchParams()
    var from = new Date()
    from.setHours(0, 0, 0, 0)
    if (range === '3d') from.setDate(from.getDate() - 2)
    if (range === '7d') from.setDate(from.getDate() - 6)
    if (range === '30d') from.setDate(from.getDate() - 29)
    return new URLSearchParams({ from: String(from.getTime()) })
  }
  var rangeForcedDay = false
  function syncGranularity() {
    var g = $('granularity')
    var range = $('range').value
    var hourOpt = g.querySelector('option[value="hour"]')
    if (range === 'all' || range === '7d' || range === '30d') {
      rangeForcedDay = true
      if (hourOpt) hourOpt.disabled = true
      g.value = 'day'
      g.disabled = true
    } else {
      if (hourOpt) hourOpt.disabled = false
      g.disabled = false
      if (rangeForcedDay) {
        g.value = 'hour'
        rangeForcedDay = false
      }
    }
  }
  async function load() {
    try {
      syncGranularity()
      var granularity = $('granularity').value
      var model = $('model').value
      var params = rangeParams()
      params.set('granularity', granularity)
      if (model) params.set('model', model)
      var response = await fetch('/api/token-usage-stats?' + params.toString(), { cache: 'no-store' })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      render(await response.json())
    } catch (error) {
      console.error(error)
    }
  }

  // 内置价目表随页面下发，兜底 JSON 接口不可用时编辑器仍能列出全部模型
  var builtinPricingFallback = ${builtinJson}

  // 价格配置 Modal 控制逻辑
  var defaultPricingConfig = {
    currency: 'CNY',
    peakSchedule: {
      weekendOffpeak: true,
      intervals: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' }
      ]
    },
    pricing: builtinPricingFallback
  }

  /** 内置价目表：判断「已覆盖」与「恢复默认」的基准。 */
  var builtinPricing = builtinPricingFallback

  /** 当前编辑中的完整价目表（内置 + 用户覆盖），按模型名索引。 */
  var currentPricing = {}

  /** 数值比较：缺省字段等价于 0，与宿主的判定保持一致。 */
  function sameTier(a, b) {
    var keys = ['uncachedInputPerMillion', 'cacheReadPerMillion', 'cacheWritePerMillion', 'outputPerMillion']
    for (var i = 0; i < keys.length; i++) {
      if ((Number(a && a[keys[i]]) || 0) !== (Number(b && b[keys[i]]) || 0)) return false
    }
    return true
  }

  function samePricing(a, b) {
    a = a || {}
    b = b || {}
    var tieredA = !!(a.peak || a.offpeak)
    var tieredB = !!(b.peak || b.offpeak)
    if (tieredA !== tieredB) return false
    if (tieredA && (!sameTier(a.peak, b.peak) || !sameTier(a.offpeak, b.offpeak))) return false
    return sameTier(a, b)
  }

  /** 「已覆盖」= 用户配置与内置价不同；不在内置表中的自建模型同样算已覆盖。 */
  function isOverridden(model) {
    var builtin = builtinPricing[model]
    var current = currentPricing[model]
    if (current === undefined) return false
    if (builtin === undefined) return true
    return !samePricing(current, builtin)
  }

  function showToast(msg, isError) {
    var t = $('toast')
    t.textContent = msg
    t.className = isError ? 'toast error' : 'toast'
    t.hidden = false
    clearTimeout(t._timer)
    t._timer = setTimeout(function () { t.hidden = true }, 2800)
  }

  function normalizeTime(str) {
    if (!str) return null
    var s = String(str).replace(/：/g, ':').trim().replace(/\s+/g, '')
    if (!s) return null
    var parts = s.split(':')
    if (parts.length === 1) {
      var h = parseInt(parts[0], 10)
      if (!isNaN(h) && h >= 0 && h <= 23) {
        return String(h).padStart(2, '0') + ':00'
      }
    } else if (parts.length === 2) {
      var h = parseInt(parts[0], 10)
      var m = parseInt(parts[1], 10)
      if (!isNaN(h) && h >= 0 && h <= 23 && !isNaN(m) && m >= 0 && m <= 59) {
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
      }
    }
    return null
  }

  function renderIntervals(intervals) {
    var container = $('intervalsList')
    if (!intervals || intervals.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:6px 0;">当前未设置高峰时段（全天按闲时计费）</div>'
      return
    }
    container.innerHTML = intervals.map(function (it, idx) {
      return '<div class="interval-row" data-idx="' + idx + '">'
        + '<span style="font-size:12px;color:var(--muted);">时段 ' + (idx + 1) + '：</span>'
        + '<input type="text" class="time-input start-time" value="' + esc(it.start) + '" placeholder="09:00" maxlength="5">'
        + '<span style="color:var(--muted);font-size:12px;">至</span>'
        + '<input type="text" class="time-input end-time" value="' + esc(it.end) + '" placeholder="12:00" maxlength="5">'
        + '<button type="button" class="btn-icon-danger del-interval-btn" data-idx="' + idx + '" title="删除此时段">'
        + '  <svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '    <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>'
        + '  </svg>'
        + '  <span>删除</span>'
        + '</button>'
        + '</div>'
    }).join('')

    // 绑定删除按钮
    container.querySelectorAll('.del-interval-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10)
        var res = collectIntervals()
        res.intervals.splice(idx, 1)
        renderIntervals(res.intervals)
      })
    })

    // 绑定时段输入框失焦自动规范化
    container.querySelectorAll('.time-input').forEach(function (inp) {
      inp.addEventListener('blur', function () {
        var val = inp.value.trim()
        if (!val) {
          inp.classList.remove('input-invalid')
          return
        }
        var norm = normalizeTime(val)
        if (norm) {
          inp.value = norm
          inp.classList.remove('input-invalid')
        }
      })
      inp.addEventListener('input', function () {
        inp.classList.remove('input-invalid')
      })
    })
  }

  function collectIntervals() {
    var rows = document.querySelectorAll('#intervalsList .interval-row')
    var result = []
    var hasInvalid = false
    rows.forEach(function (row) {
      var startInput = row.querySelector('.start-time')
      var endInput = row.querySelector('.end-time')
      startInput.classList.remove('input-invalid')
      endInput.classList.remove('input-invalid')

      var rawStart = startInput.value.trim()
      var rawEnd = endInput.value.trim()

      // 若整行均留空，视作用户已清空该时段，平滑忽略不报错
      if (!rawStart && !rawEnd) return

      var normStart = normalizeTime(rawStart)
      var normEnd = normalizeTime(rawEnd)

      if (!normStart) {
        startInput.classList.add('input-invalid')
        hasInvalid = true
      } else {
        startInput.value = normStart
      }

      if (!normEnd) {
        endInput.classList.add('input-invalid')
        hasInvalid = true
      } else {
        endInput.value = normEnd
      }

      if (normStart && normEnd) {
        result.push({ start: normStart, end: normEnd })
      }
    })
    return { intervals: result, hasInvalid: hasInvalid }
  }

  function renderPriceFields(prefix, tier) {
    var t = tier || {}
    return '<div class="field-grid">'
      + '<div class="price-field"><label>未缓存输入</label><input type="number" step="any" min="0" class="inp-' + prefix + '-uncached" value="' + (t.uncachedInputPerMillion != null ? t.uncachedInputPerMillion : '') + '"></div>'
      + '<div class="price-field"><label>缓存命中读取</label><input type="number" step="any" min="0" class="inp-' + prefix + '-cache-read" value="' + (t.cacheReadPerMillion != null ? t.cacheReadPerMillion : '') + '"></div>'
      + '<div class="price-field"><label>缓存写入</label><input type="number" step="any" min="0" class="inp-' + prefix + '-cache-write" value="' + (t.cacheWritePerMillion != null ? t.cacheWritePerMillion : '0') + '"></div>'
      + '<div class="price-field"><label>思考 / 输出</label><input type="number" step="any" min="0" class="inp-' + prefix + '-output" value="' + (t.outputPerMillion != null ? t.outputPerMillion : '') + '"></div>'
      + '</div>'
  }

  /** 把当前 DOM 中可见卡片的值写回 currentPricing；隐藏的条目保持不变。 */
  function syncFromDom() {
    var cards = document.querySelectorAll('#modelList .model-card')
    cards.forEach(function (card) {
      var nameInput = card.querySelector('.model-name-input')
      var name = nameInput ? nameInput.value.trim() : ''
      // 名称为空或已被拒绝时，沿用卡片当前的键，避免把整张卡片写丢
      if (!name || nameInput.classList.contains('input-invalid')) {
        name = card.getAttribute('data-model') || ''
      }
      if (!name) return
      var original = card.getAttribute('data-model') || ''
      if (original !== '' && original !== name) delete currentPricing[original]
      var mode = currentMode(card)
      if (mode === 'tiered') {
        currentPricing[name] = {
          peak: collectTierFromFields(card, 'peak'),
          offpeak: collectTierFromFields(card, 'offpeak'),
        }
      } else {
        currentPricing[name] = collectTierFromFields(card, 'flat')
      }
    })
    return currentPricing
  }

  function matchesQuery(model, query) {
    if (query === '') return true
    return model.toLowerCase().indexOf(query) !== -1
  }

  /** 读取某张卡片当前的计价模式。 */
  function currentMode(card) {
    var radio = card.querySelector('.segmented-control input:checked, .tier-mode-toggle input:checked')
    return radio ? radio.value : 'flat'
  }

  /** 徽标与操作按钮：整表重绘和就地改名共用同一份生成逻辑。 */
  function cardChrome(model) {
    var inBuiltin = builtinPricing[model] !== undefined
    var overridden = isOverridden(model)
    var badge = !inBuiltin
      ? '<span class="model-badge model-badge-override">自定义</span>'
      : (overridden
        ? '<span class="model-badge model-badge-override">已覆盖</span>'
        : '<span class="model-badge model-badge-builtin">内置默认</span>')

    // 内置价目表里的模型删除即等于回退默认价，因此提供「恢复默认」；
    // 自建模型没有内置价可回退，仍是删除。
    var action = inBuiltin
      ? (overridden
        ? '<button type="button" class="btn-icon-restore restore-model-btn" data-model="' + esc(model) + '" title="恢复该模型的内置默认价">'
          + '<svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
          + '  <path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path>'
          + '</svg>'
          + '<span>恢复默认</span>'
          + '</button>'
        : '')
      : '<button type="button" class="btn-icon-danger del-model-btn" data-model="' + esc(model) + '" title="删除该自建模型">'
        + '<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '  <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>'
        + '</svg>'
        + '<span>删除</span>'
        + '</button>'
    return { badge: badge, action: action }
  }

  /** 就地刷新单张卡片的徽标与操作按钮，不重排列表。 */
  function refreshCardChrome(card) {
    var chrome = cardChrome(card.getAttribute('data-model') || '')
    var title = card.querySelector('.model-card-title')
    if (title) {
      var oldBadge = title.querySelector('.model-badge')
      if (oldBadge) oldBadge.parentNode.removeChild(oldBadge)
      if (chrome.badge) title.insertAdjacentHTML('beforeend', chrome.badge)
    }
    var head = card.querySelector('.model-card-head')
    if (head) {
      var oldAction = head.querySelector('.restore-model-btn, .del-model-btn')
      if (oldAction) oldAction.parentNode.removeChild(oldAction)
      if (chrome.action) head.insertAdjacentHTML('beforeend', chrome.action)
    }
  }

  /** 刷新「共 N 个模型」计数，供整表重绘与就地改名共用。 */
  function updateModelCount() {
    var count = $('modelCount')
    if (!count) return
    var names = Object.keys(currentPricing)
    var search = $('modelSearch')
    var query = search ? search.value.trim().toLowerCase() : ''
    if (query === '') {
      count.textContent = '共 ' + names.length + ' 个模型，' + names.filter(isOverridden).length + ' 个已覆盖'
    } else {
      count.textContent = '匹配 ' + names.filter(function (name) { return matchesQuery(name, query) }).length
        + ' / ' + names.length + ' 个模型'
    }
  }

  /**
   * 提交模型改名。列表按名称排序，若在此整表重绘，刚添加的卡片会立刻跳到
   * 排序后的位置并滚出视野，看起来就像"卡片消失"；因此改为就地改名：只
   * 更新该卡片的键、单选项分组与徽标，列表顺序和焦点都保持不变。
   */
  function commitModelRename(card) {
    var input = card.querySelector('.model-name-input')
    if (!input) return
    var prev = card.getAttribute('data-model') || ''
    var next = input.value.trim()
    input.classList.remove('input-invalid')

    if (next === prev) {
      input._rejected = ''
      return
    }

    // 失焦与 change 会为同一次编辑各触发一次，错误提示只报一次
    var announce = input._rejected !== next
    input._rejected = next

    if (!next) {
      input.classList.add('input-invalid')
      if (announce) showToast('模型名称不能为空，请填写后再移开焦点', true)
      return
    }

    // 同名条目会互相覆盖，先拦下来，避免静默丢掉其中一个的价格。
    // 只标红提示、不抢焦点：失焦时强行 focus 会把焦点锁死在输入框里。
    // 该卡片仍以 data-model 为准，保存前的校验也会再次拦截。
    if (Object.prototype.hasOwnProperty.call(currentPricing, next)) {
      input.classList.add('input-invalid')
      if (announce) showToast('模型名称「' + next + '」已存在，请换一个名称', true)
      return
    }

    input._rejected = ''
    syncFromDom()
    card.setAttribute('data-model', next)
    card.querySelectorAll('input[type="radio"]').forEach(function (radio) {
      radio.setAttribute('name', 'mode_' + next)
    })
    refreshCardChrome(card)

    // 改名后可能不再匹配当前搜索词，只有这种情况才需要重绘
    var search = $('modelSearch')
    var query = search ? search.value.trim().toLowerCase() : ''
    if (query !== '' && !matchesQuery(next, query)) {
      renderModelCards()
    } else {
      updateModelCount()
    }
  }

  function renderModelCards() {
    var container = $('modelList')
    var search = $('modelSearch')
    var query = search ? search.value.trim().toLowerCase() : ''
    var names = Object.keys(currentPricing).sort()
    var shown = names.filter(function (name) { return matchesQuery(name, query) })

    updateModelCount()

    if (shown.length === 0) {
      container.innerHTML = names.length === 0
        ? '<div style="color:var(--muted);font-size:12px;padding:12px 0;">暂无模型配置，点击上方「添加模型」添加</div>'
        : '<div style="color:var(--muted);font-size:12px;padding:12px 0;">没有匹配「' + esc(query) + '」的模型</div>'
      return
    }

    container.innerHTML = shown.map(function (model) {
      var val = currentPricing[model] || {}
      var isTiered = !!(val.peak || val.offpeak)
      var flat = !isTiered ? val : (val.peak || {})
      var peak = val.peak || {}
      var offpeak = val.offpeak || {}
      var chrome = cardChrome(model)
      var badge = chrome.badge
      var action = chrome.action

      return '<div class="model-card" data-model="' + esc(model) + '">'
        + '<div class="model-card-head">'
        + '  <div class="model-card-title">'
        + '    <input type="text" class="model-name-input" value="' + esc(model) + '" placeholder="模型名称 (如 deepseek-chat)">'
        + badge
        + '  </div>'
        + '  <div class="segmented-control">'
        + '    <label><input type="radio" name="mode_' + esc(model) + '" value="flat" ' + (!isTiered ? 'checked' : '') + '><span class="seg-btn">统一固定价格</span></label>'
        + '    <label><input type="radio" name="mode_' + esc(model) + '" value="tiered" ' + (isTiered ? 'checked' : '') + '><span class="seg-btn">分时峰谷计价</span></label>'
        + '  </div>'
        + action
        + '</div>'
        + '<div class="pricing-grids-container ' + (isTiered ? 'is-split' : '') + '">'
        + (isTiered
          ? ('<div class="tier-block">'
            + '<div class="tier-block-title">'
            + '  <span class="tier-badge tier-badge-peak">'
            + '    <svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            + '      <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
            + '    </svg>'
            + '    高峰时段单价'
            + '  </span>'
            + '</div>'
            + renderPriceFields('peak', peak)
            + '</div>'
            + '<div class="tier-block">'
            + '<div class="tier-block-title">'
            + '  <span class="tier-badge tier-badge-offpeak">'
            + '    <svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            + '      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
            + '    </svg>'
            + '    闲时 / 周末单价'
            + '  </span>'
            + '</div>'
            + renderPriceFields('offpeak', offpeak)
            + '</div>')
          : ('<div class="tier-block">'
            + '<div class="tier-block-title">'
            + '  <span class="tier-badge tier-badge-flat">全天统一单价</span>'
            + '</div>'
            + renderPriceFields('flat', flat)
            + '</div>')
        )
        + '</div>'
        + '</div>'
    }).join('')

  }

  /**
   * 列表内的事件全部走事件委托：卡片会被就地改名并重建徽标/按钮，逐个绑定
   * 会在下次重绘或就替换节点后失效。此函数只在启动时调用一次。
   */
  function bindModelListEvents() {
    var container = $('modelList')

    container.addEventListener('click', function (e) {
      var restore = e.target.closest ? e.target.closest('.restore-model-btn') : null
      if (restore) {
        var restoreName = restore.getAttribute('data-model')
        syncFromDom()
        if (builtinPricing[restoreName] !== undefined) currentPricing[restoreName] = builtinPricing[restoreName]
        renderModelCards()
        return
      }
      var del = e.target.closest ? e.target.closest('.del-model-btn') : null
      if (del) {
        var delName = del.getAttribute('data-model')
        syncFromDom()
        delete currentPricing[delName]
        renderModelCards()
      }
    })

    container.addEventListener('change', function (e) {
      var target = e.target
      if (target.classList && target.classList.contains('model-name-input')) {
        commitModelRename(target.closest('.model-card'))
        return
      }
      if (target.type === 'radio') {
        syncFromDom()
        renderModelCards()
      }
    })

    // 改名只在失焦/回车时落盘，逐字输入不重绘，避免编辑过程被打断
    container.addEventListener('blur', function (e) {
      var target = e.target
      if (target.classList && target.classList.contains('model-name-input')) {
        commitModelRename(target.closest('.model-card'))
      }
    }, true)

    container.addEventListener('keydown', function (e) {
      var target = e.target
      if (e.key === 'Enter' && target.classList && target.classList.contains('model-name-input')) {
        e.preventDefault()
        target.blur()
      }
    })
  }

  function collectTierFromFields(card, prefix) {
    var uncached = parseFloat(card.querySelector('.inp-' + prefix + '-uncached') ? card.querySelector('.inp-' + prefix + '-uncached').value : NaN)
    var cacheRead = parseFloat(card.querySelector('.inp-' + prefix + '-cache-read') ? card.querySelector('.inp-' + prefix + '-cache-read').value : NaN)
    var cacheWrite = parseFloat(card.querySelector('.inp-' + prefix + '-cache-write') ? card.querySelector('.inp-' + prefix + '-cache-write').value : NaN)
    var output = parseFloat(card.querySelector('.inp-' + prefix + '-output') ? card.querySelector('.inp-' + prefix + '-output').value : NaN)
    var res = {}
    if (!isNaN(uncached)) res.uncachedInputPerMillion = uncached
    if (!isNaN(cacheRead)) res.cacheReadPerMillion = cacheRead
    if (!isNaN(cacheWrite)) res.cacheWritePerMillion = cacheWrite
    if (!isNaN(output)) res.outputPerMillion = output
    return res
  }

  async function openPricingModal() {
    try {
      var resp = await fetch('/api/token-usage-stats/pricing', { cache: 'no-store' })
      var data = resp.ok ? await resp.json() : defaultPricingConfig
      populateModalForm(data)
      $('pricingModal').hidden = false
    } catch (e) {
      populateModalForm(defaultPricingConfig)
      $('pricingModal').hidden = false
    }
  }

  function closePricingModal() {
    $('pricingModal').hidden = true
  }

  function populateModalForm(data) {
    var curr = data.currency || 'CNY'
    var radios = document.querySelectorAll('input[name="pricingCurrency"]')
    radios.forEach(function (r) { r.checked = (r.value === curr) })

    var ps = data.peakSchedule || defaultPricingConfig.peakSchedule
    $('weekendOffpeak').checked = ps.weekendOffpeak !== false
    renderIntervals(ps.intervals || defaultPricingConfig.peakSchedule.intervals)

    // 接口下发的是「生效价目表」（内置 + 覆盖）与内置表本身；两者都拿到时
    // 才能准确标记「已覆盖」。若宿主未下发内置表（旧版本），以页面内置的
    // 价目表为底再叠加配置项，仍能列出全部模型。
    var hasBuiltin = !!data.builtinPricing
    builtinPricing = data.builtinPricing || builtinPricingFallback
    var configured = data.pricing || {}
    // 浅拷贝一层，避免编辑中的价目表与内置基准共享顶层引用
    currentPricing = hasBuiltin ? Object.assign({}, configured) : Object.assign({}, builtinPricing, configured)
    var search = $('modelSearch')
    if (search) search.value = ''
    renderModelCards()
  }

  bindModelListEvents()

  $('addIntervalBtn').addEventListener('click', function () {
    var res = collectIntervals()
    res.intervals.push({ start: '09:00', end: '12:00' })
    renderIntervals(res.intervals)
  })

  $('modelSearch').addEventListener('input', function () {
    syncFromDom()
    renderModelCards()
  })

  $('addModelBtn').addEventListener('click', function () {
    syncFromDom()
    var index = 1
    var newKey = 'custom-model-' + index
    while (currentPricing[newKey] !== undefined) {
      index += 1
      newKey = 'custom-model-' + index
    }
    currentPricing[newKey] = {
      uncachedInputPerMillion: 2.0,
      cacheReadPerMillion: 0.5,
      cacheWritePerMillion: 0,
      outputPerMillion: 8.0,
    }
    // 新建的模型可能被当前搜索词过滤掉，清空搜索保证它可见
    var search = $('modelSearch')
    if (search) search.value = ''
    renderModelCards()

    // 自动聚焦新模型卡片的输入框并全选名称，提升输入体验
    setTimeout(function () {
      var firstInput = document.querySelector('#modelList .model-card[data-model="' + newKey + '"] .model-name-input')
      if (firstInput) {
        firstInput.focus()
        firstInput.select()
        firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 40)
  })

  $('resetDefaultBtn').addEventListener('click', function () {
    if (confirm('确认把所有模型恢复为内置默认价与默认时段配置吗？')) {
      populateModalForm(defaultPricingConfig)
    }
  })

  $('savePricingBtn').addEventListener('click', async function () {
    var currencyRadio = document.querySelector('input[name="pricingCurrency"]:checked')
    var currency = currencyRadio ? currencyRadio.value : 'CNY'
    var weekendOffpeak = $('weekendOffpeak').checked
    var intervalResult = collectIntervals()

    // 检查是否有任何模型处于分时峰谷计价模式
    var hasTieredModel = false
    var cards = document.querySelectorAll('#modelList .model-card')
    cards.forEach(function (card) {
      var modeRadio = card.querySelector('.segmented-control input:checked, .tier-mode-toggle input:checked')
      if (modeRadio && modeRadio.value === 'tiered') hasTieredModel = true
    })

    // 如果有时段输入不合法：高亮标红并平滑滚动到出错位置
    if (intervalResult.hasInvalid) {
      var firstInvalid = document.querySelector('#intervalsList .input-invalid')
      if (firstInvalid) {
        firstInvalid.focus()
        firstInvalid.select()
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      showToast('高峰时段格式错误，已自动定位标红输入框，请输入正确时间（如 09:00）', true)
      return
    }

    // 校验模型名称是否填入
    var nameInputs = document.querySelectorAll('#modelList .model-name-input')
    var seenNames = {}
    for (var i = 0; i < nameInputs.length; i++) {
      var inp = nameInputs[i]
      inp.classList.remove('input-invalid')
      var trimmed = inp.value.trim()
      if (!trimmed) {
        inp.classList.add('input-invalid')
        inp.focus()
        inp.scrollIntoView({ behavior: 'smooth', block: 'center' })
        showToast('模型名称不能为空，请填写标红的模型名称', true)
        return
      }
      // 同名条目会互相覆盖，必须拦下来
      if (Object.prototype.hasOwnProperty.call(seenNames, trimmed)) {
        inp.classList.add('input-invalid')
        inp.focus()
        inp.select()
        inp.scrollIntoView({ behavior: 'smooth', block: 'center' })
        showToast('模型名称「' + trimmed + '」重复，请修改标红的名称', true)
        return
      }
      seenNames[trimmed] = true
    }

    // 提交完整生效价目表；宿主会剔除与内置价相同的条目，只存真正的覆盖。
    var pricing = syncFromDom()
    var payload = {
      currency: currency,
      peakSchedule: {
        weekendOffpeak: weekendOffpeak,
        intervals: intervalResult.intervals
      },
      pricing: pricing
    }

    try {
      var resp = await fetch('/api/token-usage-stats/pricing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      var res = await resp.json()
      if (res.ok) {
        showToast('✅ 价格策略已保存并立即生效！', false)
        closePricingModal()
        load()
      } else {
        showToast('保存失败：' + (res.error || '未知错误'), true)
      }
    } catch (err) {
      showToast('网络保存失败：' + String(err), true)
    }
  })

  $('openPricingModal').addEventListener('click', openPricingModal)
  $('closePricingModal').addEventListener('click', closePricingModal)
  $('cancelPricingBtn').addEventListener('click', closePricingModal)
  $('pricingModal').addEventListener('click', function (e) {
    if (e.target === $('pricingModal')) closePricingModal()
  })

  initChartTabs()
  $('refresh').addEventListener('click', load)
  $('range').addEventListener('change', load)
  $('granularity').addEventListener('change', load)
  $('model').addEventListener('change', load)
  load()
  setInterval(load, 10000)
})()
</script>
</body>
</html>
`
}
