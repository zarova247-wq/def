(function () {
    'use strict';
    
    const state = {
    orders: window.ORDERS.map(o => ({ ...o })),
    filter: 'ALL',
    query: '',
    sort: 'none',
    selectedId: null,
    message: '',
    error: ''
    };
    
    const callLog = { render: 0, handlers: {}, transitions: [] };
    function bump(name) { callLog.handlers[name] = (callLog.handlers[name] || 0) + 1; updateLog(); }
    function updateLog() {
    const el = document.getElementById('log');
    if (!el) return;
    el.textContent =
    'render: ' + callLog.render + '\n' +
    'handlers: ' + JSON.stringify(callLog.handlers) + '\n' +
    'transitions: ' + callLog.transitions.join(', ');
    }
    
    const P05 = {
    ACCEPTED:  ['READY'],
    READY:     ['ISSUED', 'CHECK'],
    CHECK:     ['READY'],
    ISSUED:    [],
    CANCELLED: []
    };
    
    function tryTransition(id, expectedVersion, to) {
    bump('transition');
    const order = state.orders.find(o => o.id === id);
    if (!order) { state.message = 'Заказ не найден'; render(); return; }
    if (order.version !== expectedVersion) {
    state.message = 'Устаревшая версия заказа: обновите данные и повторите.';
    render();
    return;
    }
    const allowed = P05[order.status] || [];
    if (!allowed.includes(to)) {
    state.message = 'Переход ' + order.status + ' → ' + to + ' не разрешён (P05).';
    render();
    return;
    }
    order.status = to;
    order.version += 1;
    state.message = 'Учебное локальное изменение: ' + order.code + ' → ' + to + ' (v' + order.version + ')';
    callLog.transitions.push(order.code + '→' + to);
    render();
    focusCardOrButton();
    }
    
    function focusCardOrButton() {
    const card = document.getElementById('card');
    const btn = card.querySelector('button.transition-btn:not([disabled])');
    if (btn) { btn.focus(); return; }
    card.setAttribute('tabindex', '-1');
    card.focus();
    }
    
    function visibleOrders() {
    let list = state.orders.slice();
    if (state.filter !== 'ALL') list = list.filter(o => o.status === state.filter);
    if (state.query) {
    const q = state.query.toLowerCase();
    list = list.filter(o => o.code.toLowerCase().includes(q));
    }
    if (state.sort === 'asc')  list.sort((a, b) => a.totalCents - b.totalCents);
    if (state.sort === 'desc') list.sort((a, b) => b.totalCents - a.totalCents);
    return list;
    }
    
    const money = c => (c / 100).toLocaleString('ru-RU') + ' ₽';
    
    const els = {
    list:       document.getElementById('orders-list'),
    empty:      document.getElementById('empty'),
    card:       document.getElementById('card'),
    cardBody:   document.getElementById('card-body'),
    message:    document.getElementById('global-message'),
    queryError: document.getElementById('query-error'),
    query:      document.getElementById('query'),
    filter:     document.getElementById('filter'),
    sort:       document.getElementById('sort'),
    form:       document.getElementById('search-form')
    };
    
    function render() {
    callLog.render++;
    
    els.list.textContent = '';
    const items = visibleOrders();
    if (items.length === 0) {
      els.empty.hidden = false;
      els.empty.textContent = state.query
        ? 'По запросу «' + state.query + '» ничего не найдено.'
        : 'Нет заказов, соответствующих фильтру.';
    } else {
      els.empty.hidden = true;
      els.empty.textContent = '';
      for (const o of items) {
        const li = document.createElement('li');
        li.className = 'order';
        li.dataset.id = String(o.id);
        li.setAttribute('role', 'option');
        li.setAttribute('tabindex', '0');
        li.setAttribute('aria-selected', String(o.id === state.selectedId));
    
        const codeEl = document.createElement('strong');
        codeEl.textContent = o.code;
        const st = document.createElement('span');
        st.textContent = ' ' + o.status;
        const sum = document.createElement('span');
        sum.textContent = ' · ' + money(o.totalCents);
    
        li.appendChild(codeEl);
        li.appendChild(st);
        li.appendChild(sum);
        els.list.appendChild(li);
      }
    }
    els.cardBody.textContent = '';
    const sel = state.orders.find(o => o.id === state.selectedId);
    if (!sel) {
      els.cardBody.className = 'empty';
      els.cardBody.textContent = 'Выберите заказ';
    } else {
      els.cardBody.className = '';
      const fields = [
        ['Код', sel.code], ['Статус', sel.status], ['Ячейка', sel.cell],
        ['Сумма', money(sel.totalCents)], ['Версия', String(sel.version)],
        ['Готов к', new Date(sel.dueAt).toLocaleString('ru-RU')]
      ];
      for (const [k, v] of fields) {
        const p = document.createElement('p');
        const b = document.createElement('b'); b.textContent = k + ': ';
        const t = document.createElement('span'); t.textContent = v;
        p.appendChild(b); p.appendChild(t);
        els.cardBody.appendChild(p);
      }
      const tw = document.createElement('div');
      tw.className = 'transitions';
      const allowed = P05[sel.status] || [];
      if (allowed.length === 0) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.disabled = true;
        btn.textContent = 'Учебное локальное изменение недоступно';
        btn.title = 'Терминальный статус: ' + sel.status;
        btn.setAttribute('aria-describedby', 'terminal-reason-' + sel.id);
        const hint = document.createElement('p');
        hint.id = 'terminal-reason-' + sel.id;
        hint.className = 'stale';
        hint.textContent = 'Причина: статус ' + sel.status + ' терминальный, переходы по P05 не предусмотрены.';
        tw.appendChild(btn);
        tw.appendChild(hint);
      } else {
        for (const to of allowed) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'transition-btn';
          btn.dataset.id = String(sel.id);
          btn.dataset.expectedVersion = String(sel.version);
          btn.dataset.to = to;
          btn.textContent = 'Учебное локальное изменение → ' + to;
          btn.setAttribute('aria-label',
            'Учебное локальное изменение: перевести ' + sel.code + ' в ' + to);
          tw.appendChild(btn);
        }
      }
      els.cardBody.appendChild(tw);
    }
    
    els.message.textContent = state.message || '';
    els.queryError.textContent = state.error || '';
    els.query.setAttribute('aria-invalid', state.error ? 'true' : 'false');
    els.query.classList.toggle('error', !!state.error);
    updateLog();}
    
    els.form.addEventListener('submit', function (e) {
    e.preventDefault();          
    bump('submit');
    const raw = els.query.value;
    if (raw.length > 100) {
    state.error = 'Запрос слишком длинный (макс. 100 символов).';
    render();
    els.query.focus();
    return;
    }
    state.error = '';
    state.query = raw.trim();
    state.message = '';
    render();
    els.query.focus();           
    });
    
    els.filter.addEventListener('change', function () {
    bump('filter');
    state.filter = els.filter.value;
    render();
    });
    
    els.sort.addEventListener('change', function () {
    bump('sort');
    state.sort = els.sort.value;
    render();
    });
    
    els.list.addEventListener('click', function (e) {
    const li = e.target.closest('li.order');
    if (!li) return;
    bump('list-click');
    console.log('[delegation] target=', e.target, '| currentTarget=', e.currentTarget);
    const id = Number(li.dataset.id);
    state.selectedId = id;
    render();
    const again = els.list.querySelector('li.order[data-id="' + id + '"]');
    if (again) again.focus();
    });
    
    els.list.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('li.order');
    if (!li) return;
    e.preventDefault();
    bump('list-key');
    const id = Number(li.dataset.id);
    state.selectedId = id;
    render();
    const again = els.list.querySelector('li.order[data-id="' + id + '"]');
    if (again) again.focus();
    });
    
    els.card.addEventListener('click', function (e) {
    const btn = e.target.closest('button.transition-btn');
    if (!btn) return;
    bump('transition-click');
    tryTransition(Number(btn.dataset.id),
    Number(btn.dataset.expectedVersion),
    btn.dataset.to);
    });
    
    window.__lab = {bumpVersion(id) {           
        const o = state.orders.find(x => x.id === id);
        if (o) { o.version += 1; render(); }
        },
        silentBump(id) {            
        const o = state.orders.find(x => x.id === id);
        if (o) o.version += 1;
        },
        getState() { return state; },
        log() { return callLog; },
        render
        };
        
        render();                     
        })();