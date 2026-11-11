(function () {
  'use strict';

  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const ENTRY_NAME = 'score.xml';

  function codec(format) {
    if (format === 'capx' && window.FugueCapXML) return window.FugueCapXML;
    if (format === 'tcax' && window.FugueTCAX) return window.FugueTCAX;
    throw new Error('未加载此谱面格式的转换器');
  }

  function unpack(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) throw new Error('谱面文件为空或超过 8 MiB');
    let content = bytes;
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      let scoreEntries = 0;
      const archive = window.fflate.unzipSync(bytes, {
        filter(entry) {
          if (entry.name.includes('\\') || entry.name.startsWith('/') ||
              entry.name.split('/').includes('..')) throw new Error('谱面压缩包含无效路径');
          if (entry.name !== ENTRY_NAME) return false;
          if (++scoreEntries > 1 || entry.originalSize > MAX_FILE_BYTES) throw new Error('score.xml 重复或超过 8 MiB');
          return true;
        }
      });
      content = archive[ENTRY_NAME];
      if (!content || content.length === 0 || content.length > MAX_FILE_BYTES) {
        throw new Error('谱面压缩包必须包含一个有效的 score.xml');
      }
    }
    const xml = new TextDecoder('utf-8', { fatal: true }).decode(content);
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('谱面文件含不允许的 DTD 或实体声明');
    return xml;
  }

  function parse(input, format) {
    return codec(format).parse(unpack(input));
  }

  function serialize(score, format) {
    const xml = new TextEncoder().encode(codec(format).serialize(score));
    if (xml.length > MAX_FILE_BYTES) throw new Error('谱面 XML 超过 8 MiB');
    return window.fflate.zipSync({ [ENTRY_NAME]: xml });
  }

  window.FugueCapFiles = { parse, serialize, unpack };

  function mount() {
    const workbench = document.getElementById('notation-workbench');
    if (!workbench) return;
    const panel = document.createElement('section');
    panel.id = 'cap-file-workbench';
    panel.className = 'glass-panel';
    panel.innerHTML = `
      <h3>CapXML 与 TCAX 文件</h3>
      <div class="export-group">
        <label>导入原厂谱面 <input type="file" accept=".capx,.tcax" data-file></label>
        <button type="button" class="btn btn-secondary" data-format="capx">下载 CapXML</button>
        <button type="button" class="btn btn-secondary" data-format="tcax">下载 TCAX</button>
      </div>
      <p role="status" aria-live="polite" data-status></p>
    `;
    workbench.insertAdjacentElement('afterend', panel);
    const status = panel.querySelector('[data-status]');
    const picker = panel.querySelector('[data-file]');

    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      picker.disabled = true;
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error('谱面文件超过 8 MiB');
        const format = file.name.split('.').pop().toLowerCase();
        const score = parse(await file.arrayBuffer(), format);
        window.FugueStudio.loadScore(score);
        const warnings = score.capxml?.warnings || score.warnings || score.importWarnings || [];
        status.textContent = `已导入 ${file.name}，共 ${score.voices.length} 个声部。` +
          (warnings.length ? ' ' + warnings.slice(0, 2).join('；') : '');
      } catch (error) {
        status.textContent = error.message;
      } finally {
        picker.value = '';
        picker.disabled = false;
      }
    });

    for (const button of panel.querySelectorAll('[data-format]')) {
      const format = button.dataset.format;
      button.addEventListener('click', () => {
        try {
          const score = window.FugueStudio.getScore();
          if (!score) throw new Error('请先载入或生成乐谱');
          const bytes = serialize(score, format);
          const name = (score.title || 'Fugue').replace(/[\\/:*?"<>|]/g, '_') + '.' + format;
          const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          status.textContent = '已导出 ' + name;
        } catch (error) {
          status.textContent = error.message;
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', mount, { once: true });
}());
