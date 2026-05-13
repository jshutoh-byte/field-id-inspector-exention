(() => {
  'use strict';

  const NS = '__field_id_inspector__';
  if (window[NS]) return;
  window[NS] = true;

  let enabled = false;
  const collected = [];
  let highlighted = null;

  const fieldSelector = [
    'input',
    'textarea',
    'select',
    'button',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="button"]'
  ].join(',');

  const style = document.createElement('style');
  style.textContent = `
    .${NS}_panel {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 2147483647;
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 8px;
      background: #fff;
      color: #111;
      border: 1px solid #ccc;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(0,0,0,.2);
      font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .${NS}_panel button {
      cursor: pointer;
      padding: 4px 8px;
      border: 1px solid #aaa;
      border-radius: 6px;
      background: #f5f5f5;
      color: #111;
      font: inherit;
    }
    .${NS}_panel button.${NS}_active {
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
      font-weight: 700;
    }
    .${NS}_tooltip {
      position: fixed;
      z-index: 2147483647;
      display: none;
      max-width: 520px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(0,0,0,.88);
      color: #fff;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      white-space: pre-wrap;
      pointer-events: none;
      box-shadow: 0 4px 14px rgba(0,0,0,.3);
    }
    .${NS}_outline {
      outline: 3px solid #f59e0b !important;
      outline-offset: 2px !important;
    }
    .${NS}_clicked {
      outline: 4px solid #22c55e !important;
      outline-offset: 2px !important;
    }
  `;
  document.documentElement.appendChild(style);

  const panel = document.createElement('div');
  panel.className = `${NS}_panel`;

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '🔍 ID調査OFF';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = '一覧コピー';

  const csvBtn = document.createElement('button');
  csvBtn.textContent = 'CSVコピー';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'クリア';

  const countLabel = document.createElement('span');
  countLabel.textContent = '0件';

  panel.append(toggleBtn, copyBtn, csvBtn, clearBtn, countLabel);
  document.documentElement.appendChild(panel);

  const tooltip = document.createElement('div');
  tooltip.className = `${NS}_tooltip`;
  document.documentElement.appendChild(tooltip);

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body && parts.length < 5) {
      let part = current.tagName.toLowerCase();
      const name = current.getAttribute('name');
      if (name) {
        part += `[name="${String(name).replace(/"/g, '\\"')}"]`;
        parts.unshift(part);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const sameTagSiblings = [...parent.children].filter(child => child.tagName === current.tagName);
        if (sameTagSiblings.length > 1) {
          part += `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
        }
      }
      parts.unshift(part);
      current = parent;
    }
    return parts.join(' > ');
  }

  function nearestField(target) {
    if (!(target instanceof Element)) return null;
    const field = target.closest(fieldSelector);
    if (field) return field;
    return target.querySelector?.(fieldSelector) || null;
  }

  function infoFor(el) {
    const label = findLabel(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      name: el.getAttribute('name') || '',
      type: el.getAttribute('type') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      label,
      className: typeof el.className === 'string' ? el.className : '',
      selector: cssPath(el)
    };
  }

  function findLabel(el) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label?.innerText?.trim()) return label.innerText.trim();
    }
    const parentLabel = el.closest('label');
    if (parentLabel?.innerText?.trim()) return parentLabel.innerText.trim();
    const aria = el.getAttribute('aria-labelledby');
    if (aria) {
      const text = aria.split(/\s+/).map(id => document.getElementById(id)?.innerText?.trim()).filter(Boolean).join(' ');
      if (text) return text;
    }
    return '';
  }

  function textFor(info) {
    return [
      `<${info.tag}>`,
      `id: ${info.id || '(なし)'}`,
      `name: ${info.name || '(なし)'}`,
      `type: ${info.type || '(なし)'}`,
      `label: ${info.label || '(なし)'}`,
      `placeholder: ${info.placeholder || '(なし)'}`,
      `aria-label: ${info.ariaLabel || '(なし)'}`,
      `title: ${info.title || '(なし)'}`,
      `class: ${info.className || '(なし)'}`,
      `selector: ${info.selector || '(なし)'}`
    ].join('\n');
  }

  function addCollected(el) {
    const info = infoFor(el);
    const key = `${info.selector}|${info.id}|${info.name}|${info.tag}`;
    if (!collected.some(item => item.key === key)) {
      collected.push({ key, ...info });
      countLabel.textContent = `${collected.length}件`;
    }
  }

  function toTsv() {
    const header = ['tag', 'id', 'name', 'type', 'label', 'placeholder', 'ariaLabel', 'title', 'className', 'selector'];
    const rows = collected.map(item => header.map(key => String(item[key] ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'));
    return [header.join('\t'), ...rows].join('\n');
  }

  function toCsv() {
    const header = ['tag', 'id', 'name', 'type', 'label', 'placeholder', 'ariaLabel', 'title', 'className', 'selector'];
    const esc = value => `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const rows = collected.map(item => header.map(key => esc(item[key])).join(','));
    return [header.join(','), ...rows].join('\n');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert('コピーしました。Excelに貼り付けできます。');
    } catch (_) {
      prompt('コピーできなかったので、手動でコピーしてください。', text);
    }
  }

  toggleBtn.addEventListener('click', () => {
    enabled = !enabled;
    toggleBtn.textContent = enabled ? '🛑 ID調査ON' : '🔍 ID調査OFF';
    toggleBtn.classList.toggle(`${NS}_active`, enabled);
    if (!enabled) {
      tooltip.style.display = 'none';
      if (highlighted) highlighted.classList.remove(`${NS}_outline`);
      highlighted = null;
    }
  });

  copyBtn.addEventListener('click', () => {
    if (collected.length === 0) return alert('まだ項目をクリックしていません。');
    copyText(toTsv());
  });

  csvBtn.addEventListener('click', () => {
    if (collected.length === 0) return alert('まだ項目をクリックしていません。');
    copyText(toCsv());
  });

  clearBtn.addEventListener('click', () => {
    collected.length = 0;
    countLabel.textContent = '0件';
    document.querySelectorAll(`.${NS}_clicked`).forEach(el => el.classList.remove(`${NS}_clicked`));
  });

  document.addEventListener('mousemove', event => {
    if (!enabled) return;
    const el = nearestField(event.target);
    if (highlighted && highlighted !== el) highlighted.classList.remove(`${NS}_outline`);
    highlighted = el;
    if (!el) {
      tooltip.style.display = 'none';
      return;
    }
    el.classList.add(`${NS}_outline`);
    tooltip.textContent = textFor(infoFor(el));
    tooltip.style.display = 'block';
    tooltip.style.left = `${Math.min(event.clientX + 16, window.innerWidth - 540)}px`;
    tooltip.style.top = `${Math.min(event.clientY + 16, window.innerHeight - 260)}px`;
  }, true);

  document.addEventListener('click', event => {
    if (!enabled) return;
    const el = nearestField(event.target);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    addCollected(el);
    el.classList.add(`${NS}_clicked`);
  }, true);
})();
