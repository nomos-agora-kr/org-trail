(() => {
  'use strict';
  const Y0 = 2006, Y1 = 2027; // 축: 2006년 ~ 2026년 (각 연도는 한 칸)
  const SECTIONS = {
    a: { title: '이 단체, 어떤 활동을 했을까?', sub: '진보 진영에서 제기된 이슈' },
    b: { title: '이 단체, 이런 이슈에도 참여했을까?', sub: '보수 진영에서 제기된 이슈' }
  };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pos = (y) => ((y - Y0) / (Y1 - Y0) * 100).toFixed(3) + '%';
  const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };
  const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const FULL = /^\d{4}-\d{2}-\d{2}$/;

  let D, ISSUE = {}, EV = {}, UND = {}, YEARCOUNT = {}, LAST = {};
  const st = { sec: 'a', view: 'year', issue: {}, year: {}, org: null };

  fetch('data.json').then((r) => r.json()).then((data) => { D = data; prepare(); bind(); render(); })
    .catch(() => { document.querySelector('.wrap').insertAdjacentHTML('beforeend', '<div class="panel">데이터를 불러오지 못했습니다.</div>'); });

  function prepare() {
    D.issues.forEach((i) => { ISSUE[i.key] = i; });
    // 횟수 기준: 입장 '부합' 기록, 같은 단체·같은 사건·같은 날 = 1회
    D.records.filter((r) => r.stance === '부합').forEach((r) => {
      const k = r.org + '\u0000' + r.issue;
      if (r.date && FULL.test(r.date)) {
        (EV[k] ||= {});
        (EV[k][r.date] ||= []).push(r);
        const y = +r.date.slice(0, 4);
        LAST[r.issue] = Math.max(LAST[r.issue] || 0, y);
      } else {
        (UND[k] ||= []).push(r);
      }
    });
    Object.entries(EV).forEach(([k, byDate]) => {
      const issue = k.split('\u0000')[1];
      Object.keys(byDate).forEach((d) => {
        const y = +d.slice(0, 4);
        ((YEARCOUNT[issue] ||= {})[y] = (YEARCOUNT[issue][y] || 0) + 1);
      });
    });
    D.issues.forEach((i) => { st.issue[i.section] ??= null; });
  }

  const issuesOf = (sec) => D.issues.filter((i) => i.section === sec);
  const nEv = (org, ik) => Object.keys(EV[org + '\u0000' + ik] || {}).length;
  const nUnd = (org, ik) => new Set((UND[org + '\u0000' + ik] || []).map((r) => r.source)).size;
  const orgsIn = (ik) => {
    const s = new Set();
    Object.keys(EV).concat(Object.keys(UND)).forEach((k) => { const [o, i] = k.split('\u0000'); if (i === ik) s.add(o); });
    return [...s];
  };
  const endOf = (i) => (i.open ? Math.max(i.start, LAST[i.key] || i.start) : i.end);
  const curIssue = () => {
    const list = issuesOf(st.sec);
    let k = st.issue[st.sec];
    if (!k || !ISSUE[k]) { k = list.slice().sort((a, b) => orgsIn(b.key).length - orgsIn(a.key).length)[0].key; st.issue[st.sec] = k; st.year[st.sec] = ISSUE[k].start; }
    return ISSUE[k];
  };

  function bind() {
    document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => { st.view = b.dataset.view; render(); }));
    $('cross-btn').addEventListener('click', () => {
      const other = st.sec === 'a' ? 'b' : 'a';
      const hit = issuesOf(other).find((i) => nEv(st.org, i.key) || nUnd(st.org, i.key));
      st.sec = other;
      if (hit) { st.issue[other] = hit.key; st.year[other] = hit.start; }
      render();
      $('org').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function render() {
    const issue = curIssue();
    renderStats(); renderTabs(); renderTimeline(issue); renderField(issue); renderOrg(issue);
  }

  function renderStats() {
    const orgs = new Set(D.records.filter((r) => r.stance === '부합').map((r) => r.org));
    const total = Object.values(EV).reduce((a, b) => a + Object.keys(b).length, 0);
    $('stats').innerHTML = [['사건', D.issues.length], ['단체', orgs.size], ['참여 기록', total], ['출처', Object.keys(D.sources).length]]
      .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    $('foot-note').textContent = D.note || '';
  }

  function renderTabs() {
    $('tabs').innerHTML = Object.entries(SECTIONS).map(([k, s]) =>
      `<button type="button" class="tab" data-sec="${k}" aria-pressed="${k === st.sec}"><b>${esc(s.title)}</b><span>${esc(s.sub)} ${issuesOf(k).length}개</span></button>`).join('');
    $('tabs').querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { st.sec = b.dataset.sec; render(); }));
    window.onresize ||= (() => { let t; return () => { clearTimeout(t); t = setTimeout(render, 200); }; })();
  }

  function renderTimeline(issue) {
    const list = issuesOf(st.sec);
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
    $('view-year').hidden = st.view !== 'year';
    $('view-flow').hidden = st.view !== 'flow';
    $('tl-hint').textContent = st.view === 'year' ? '연도를 누르면 그해 발생한 사건이 아래에 나옵니다' : '사건별로 이어진 기간을 한눈에 봅니다';

    // 연도별
    const selYear = st.year[st.sec] ?? issue.start;
    const starts = [...new Set(list.map((i) => i.start))].sort((a, b) => a - b);
    let h = '<div class="axis"></div>';
    for (let y = Y0 + 1; y < Y1; y++) h += `<div class="tick" style="left:${pos(y)}"></div>`;
    h += `<div class="edge" style="left:0">${Y0}</div><div class="edge" style="right:0">${Y1 - 1}</div>`;
    const end = issue.open ? Y1 : endOf(issue) + 1;
    h += `<div class="span${issue.open ? ' open' : ''}" style="left:${pos(issue.start)};width:${((end - issue.start) / (Y1 - Y0) * 100).toFixed(3)}%"></div>`;
    h += `<div class="span-lab" style="left:${pos((issue.start + end) / 2)}">${issue.open ? issue.start + '~' : issue.start === endOf(issue) ? issue.start : issue.start + '–' + endOf(issue)}</div>`;
    starts.forEach((y) => {
      const n = list.filter((i) => i.start === y).length, on = y === selYear;
      const d = on ? 16 : n > 1 ? 13 : 10;
      h += `<button type="button" class="yr${n > 1 ? ' multi' : ''}" data-year="${y}" aria-pressed="${on}" aria-label="${y}년 사건 ${n}개" style="left:${pos(y + 0.5)}"><span class="lab">${y}</span><span class="dot" style="width:${d}px;height:${d}px;margin-top:${(16 - d) / 2}px"></span></button>`;
    });
    $('tl').innerHTML = h;
    $('tl').querySelectorAll('.yr').forEach((b) => b.addEventListener('click', () => {
      const y = +b.dataset.year, idx = list.filter((i) => i.start === y);
      st.year[st.sec] = y;
      if (!idx.some((i) => i.key === issue.key)) st.issue[st.sec] = idx[0].key;
      st.org = null; render();
    }));
    const chipList = list.filter((i) => i.start === selYear);
    $('chips').innerHTML = `<span class="dim" style="font-size:14px;margin-right:4px">${selYear}년 발생 사건 ${chipList.length}개</span>` +
      chipList.map((i) => `<button type="button" class="chip" data-k="${i.key}" aria-pressed="${i.key === issue.key}">${esc(i.short)}<small>${esc(i.period)}</small></button>`).join('');
    $('chips').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { st.issue[st.sec] = b.dataset.k; st.org = null; render(); }));

    // 사건 흐름
    let f = '<div class="frow headr"><span></span>';
    for (let y = Y0; y < Y1; y++) f += `<span>${y % 2 === 0 ? String(y).slice(2) : ''}</span>`;
    f += '<span></span></div>';
    list.forEach((i) => {
      const on = i.key === issue.key, last = i.open ? Y1 - 1 : endOf(i), yc = YEARCOUNT[i.key] || {};
      const mx = Math.max(1, ...Object.values(yc));
      f += `<button type="button" class="frow" data-k="${i.key}" aria-pressed="${on}" aria-label="${esc(i.name)} ${esc(i.period)}"><span class="nm">${esc(i.short)}</span>`;
      for (let y = Y0; y < Y1; y++) {
        if (y >= i.start && y <= last) {
          const a = 0.16 + 0.84 * ((yc[y] || 0) / mx);
          f += `<span class="cell" style="background:rgba(var(--rgb),${a.toFixed(2)})${on ? ';outline:1px solid var(--accent);outline-offset:-1px' : ''}" title="${y}년 기록 ${yc[y] || 0}건"></span>`;
        } else f += '<span class="cell"></span>';
      }
      f += `<span class="pd">${esc(i.period)}</span></button>`;
    });
    $('flow').innerHTML = f;
    $('flow').querySelectorAll('.frow[data-k]').forEach((b) => b.addEventListener('click', () => {
      st.issue[st.sec] = b.dataset.k; st.year[st.sec] = ISSUE[b.dataset.k].start; st.org = null; render();
    }));
  }

  const mobile = () => window.innerWidth < 640;
  function layout(items, seed, H) {
    const W = 1000;
    const total = items.reduce((a, o) => a + o.w, 0) || 1;
    for (let fill = Math.min(0.34, 0.05 + 0.035 * items.length); fill > 0.05; fill *= 0.85) {
      const k = Math.sqrt((W * H * fill) / (Math.PI * total)), r1 = rnd(seed), placed = [];
      let ok = true;
      for (const o of items) {
        const r = Math.max(mobile() ? 26 : 16, Math.min(120, Math.sqrt(o.w) * k));
        let best = null;
        for (let t = 0; t < 900 && !best; t++) {
          const x = r + r1() * (W - 2 * r), y = r + r1() * (H - 2 * r);
          if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 6)) best = { x, y };
        }
        if (!best) { ok = false; break; }
        placed.push({ ...o, r, x: best.x, y: best.y });
      }
      if (ok) return placed;
    }
    return [];
  }

  function renderField(issue) {
    $('issue-over').textContent = `${SECTIONS[st.sec].title} · ${issue.period}`;
    $('issue-name').textContent = issue.name;
    $('issue-rule').textContent = issue.rule;
    const items = orgsIn(issue.key).map((o) => ({ name: o, n: nEv(o, issue.key), u: nUnd(o, issue.key) }))
      .map((o) => ({ ...o, w: o.n || 0.6 })).sort((a, b) => b.w - a.w || a.name.localeCompare(b.name, 'ko'));
    $('issue-over').textContent += ` · 참여 단체 ${items.length}곳`;
    if (!items.length) { $('field').innerHTML = '<div class="empty">아직 수집된 기록이 없습니다.</div>'; return; }
    const H = mobile() ? 1000 : 520;
    $('field').style.aspectRatio = `1000/${H}`;
    const placed = layout(items, hash(issue.key), H);
    if (!st.org || !inSection(st.org)) {
      const score = (o) => issuesOf(st.sec).reduce((a, i) => a + nEv(o, i.key), 0);
      st.org = items.slice().sort((a, b) => b.n - a.n || score(b.name) - score(a.name))[0].name;
    }
    $('field').innerHTML = placed.map((p) => {
      const W = 1000, d = p.r * 2;
      const fs = (Math.max(1.05, Math.min(1.7, p.r / 38)) * (mobile() ? 1.9 : 1)).toFixed(2);
      const label = p.r >= (mobile() ? 40 : 30) ? `${p.name}\n${p.n ? p.n + '회' : '날짜 미확인'}` : '';
      const title = `${p.name} · ${p.n ? p.n + '회' : ''}${p.u ? (p.n ? ' · ' : '') + '날짜 미확인 ' + p.u + '건' : ''}`;
      return `<button type="button" class="bub${p.n ? '' : ' undated'}" data-o="${esc(p.name)}" aria-pressed="${p.name === st.org}" title="${esc(title)}" aria-label="${esc(title)}" style="left:${((p.x - p.r) / W * 100).toFixed(2)}%;top:${((p.y - p.r) / H * 100).toFixed(2)}%;width:${(d / W * 100).toFixed(2)}%;height:${(d / H * 100).toFixed(2)}%;font-size:${fs}cqw">${esc(label)}</button>`;
    }).join('');
    $('field').querySelectorAll('.bub').forEach((b) => b.addEventListener('click', () => {
      st.org = b.dataset.o; render();
      if (window.innerWidth < 900) $('org').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  const inSection = (org) => issuesOf(st.sec).some((i) => nEv(org, i.key) || nUnd(org, i.key));

  function renderOrg(issue) {
    const org = st.org, list = issuesOf(st.sec);
    const cnt = list.map((i) => nEv(org, i.key));
    const k = cnt.filter((x) => x).length, tot = cnt.reduce((a, b) => a + b, 0);
    $('org-name').textContent = org;
    $('org-sum').textContent = `· 사건 ${k}개 · 총 ${tot}회`;
    $('org-cells').innerHTML = list.map((i, idx) => {
      const n = cnt[idx], u = nUnd(org, i.key);
      const cls = i.key === issue.key ? 'oc cur' : n || u ? 'oc' : 'oc zero';
      return `<button type="button" class="${cls}" data-k="${i.key}" aria-label="${esc(i.name)} ${n}회"><span style="font-size:14px;font-weight:500">${esc(i.short)}</span><br><span style="font-size:12px;opacity:.8">${esc(i.period)}</span><b>${n}<small>회</small></b>${u ? `<span style="font-size:12px;opacity:.8">+날짜 미확인 ${u}</span>` : ''}</button>`;
    }).join('');
    $('org-cells').querySelectorAll('.oc').forEach((b) => b.addEventListener('click', () => {
      st.issue[st.sec] = b.dataset.k; st.year[st.sec] = ISSUE[b.dataset.k].start; render();
    }));

    // 활동 목록 (이 섹션)
    const rows = [];
    list.forEach((i) => {
      const byDate = EV[org + '\u0000' + i.key] || {};
      Object.entries(byDate).forEach(([d, rs]) => rows.push({ d, i, rs }));
      const und = UND[org + '\u0000' + i.key];
      if (und) rows.push({ d: null, i, rs: und });
    });
    rows.sort((a, b) => (b.d || '0000') .localeCompare(a.d || '0000'));
    $('org-evs').innerHTML = rows.length ? rows.map(({ d, i, rs }) => {
      const r0 = rs[0];
      const meta = [r0.location, [...new Set(rs.map((r) => r.type))].join('/'), [...new Set(rs.map((r) => r.role))].join('/')].filter(Boolean).map(esc).join(' · ');
      const srcs = [...new Set(rs.map((r) => r.source))].map((sk) => {
        const s = D.sources[sk];
        return `<div class="src"><q>${esc(s.quote)}</q><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.outlet)} · ${esc(s.title)}</a></div>`;
      }).join('');
      return `<div class="ev"><div class="d">${d ? esc(d) : '날짜 미확인'}</div><div><b style="color:var(--strong)">${esc(i.short)}</b> <span class="muted">· ${meta}</span>${srcs}</div></div>`;
    }).join('') : '<div class="muted" style="padding:10px 0">이 섹션에서 확인된 기록 없음</div>';

    const other = st.sec === 'a' ? 'b' : 'a';
    const oc = issuesOf(other).map((i) => nEv(org, i.key));
    const ok = oc.filter((x) => x).length, ot = oc.reduce((a, b) => a + b, 0);
    const ou = issuesOf(other).reduce((a, i) => a + nUnd(org, i.key), 0);
    $('cross-txt').innerHTML = `「${esc(SECTIONS[other].title)}」에서는 · <b style="color:var(--strong)">${ok ? `사건 ${ok}개 · 총 ${ot}회` : ou ? `날짜 미확인 기록 ${ou}건` : '확인된 기록 없음'}</b>`;
  }
})();
