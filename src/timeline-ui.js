/* Score-level time/key/tempo editing. Absolute ticks never move existing notes. */
(function () {
  'use strict';
  function init() {
    const host=document.getElementById('fw-panel-input');
    if (!host || document.getElementById('timeline-panel')) return;
    const box=document.createElement('section');box.id='timeline-panel';
    box.innerHTML='<h3>乐曲中途变化 / Score changes</h3><p>24 ticks = 四分音符。拍号与调号在小节线生效；速度可在任意整数 tick 生效。音符保持绝对位置，不自动转调。</p><form id="timeline-form"><label>位置 tick <input id="timeline-tick" type="number" min="0" step="1" value="96" required></label> <label>变化 <select id="timeline-kind"><option value="meter">拍号</option><option value="key">调号</option><option value="tempo">速度</option></select></label> <label>值 <input id="timeline-value" value="3/4" required aria-label="拍号如3/4、调号如Dm、速度如90"></label> <button type="submit">应用变化</button></form><p id="timeline-status" role="status"></p><ul id="timeline-list"></ul>';
    host.appendChild(box);
    const $=id=>document.getElementById(id);
    function refresh() {
      const score=window.FugueStudio.getScore();const list=$('timeline-list');list.replaceChildren();
      for (const kind of ['meter','key','tempo']) for(const e of score?.changes?.[kind] || []) {
        const li=document.createElement('li');
        li.append(document.createTextNode(`${e.tick}: ${kind} ${kind==='meter'?e.beats+'/'+e.beatType:kind==='key'?e.key:e.bpm} `));
        const remove=document.createElement('button');remove.type='button';remove.textContent='删除';
        remove.onclick=()=>apply(next=>{next.changes[kind]=next.changes[kind].filter(c=>c.tick!==e.tick);});
        li.appendChild(remove);list.appendChild(li);
      }
    }
    function apply(update) {
      try {
        const old=window.FugueStudio.getScore();if(!old)throw new Error('请先载入乐谱');
        const next=JSON.parse(JSON.stringify(old));next.changes=next.changes||{};
        update(next);
        const bars=window.FugueTimeline.measures(next);
        next.length=bars.at(-1).end;
        for(const sec of next.sections||[])if(sec.end===old.length)sec.end=next.length;
        window.FugueEngine.toMusicXML(next);window.FugueEngine.toMidi(next);
        window.ScoreEdit.commitScore(next);
        $('timeline-status').textContent='变化已应用。谱面/播放/MIDI/MusicXML使用同一时间轴，可撤销。';
      } catch(error) {$('timeline-status').textContent='未修改乐谱：'+error.message;}
    }
    $('timeline-form').onsubmit=event=>{
      event.preventDefault();
      const kind=$('timeline-kind').value, tick=Number($('timeline-tick').value), value=$('timeline-value').value.trim();
      apply(next=>{
        let entry={tick};
        if(kind==='meter') {
          const match=/^(\d+)\/(\d+)$/.exec(value);if(!match)throw new Error('拍号格式例如 3/4');
          entry.beats=Number(match[1]);entry.beatType=Number(match[2]);
        }else if(kind==='key')entry.key=value;
        else entry.bpm=Number(value);
        const events=(next.changes[kind]||[]).filter(e=>e.tick!==tick);events.push(entry);events.sort((a,b)=>a.tick-b.tick);next.changes[kind]=events;
      });
    };
    $('timeline-kind').onchange=()=>{$('timeline-value').value=({meter:'3/4',key:'Dm',tempo:'90'})[$('timeline-kind').value];};
    window.addEventListener('fugue:score',refresh);refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
