(() => {
  const isAdmin = window.location.pathname.includes("/admin");
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${location.host}/ws`;
  const ws = new WebSocket(wsUrl);

  const byId = (id) => document.getElementById(id);

  function safeParse(data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.warn("Non-JSON WS message ignored:", typeof data === 'string' ? data.slice(0, 60) : data);
      return null;
    }
  }

  function handleMessage(event, handlers) {
    const parsed = safeParse(event.data);
    if (!parsed || !parsed.type) return;
    const fn = handlers[parsed.type];
    if (typeof fn === 'function') fn(parsed);
  }

  ws.addEventListener('error', (e) => {
    console.error('WebSocket error', e);
  });
  ws.addEventListener('close', () => {
    const el = byId('feedback') || byId('loadInfo');
    if (el) el.textContent = 'Bağlantı kapandı. Sayfayı yenilemeyi deneyin.';
  });

  // Player page
  if (!isAdmin) {
    const joinSection = byId('join-section');
    const gameSection = byId('game-section');
    const joinBtn = byId('joinBtn');
    const nameInput = byId('name');
    const me = byId('me');
    const qProgress = byId('q-progress');
    const questionEl = byId('question');
    const timerEl = byId('timer');
    const optionsEl = byId('options');
    const feedbackEl = byId('feedback');
    const leaderboardEl = byId('leaderboard');

    let currentExpire = null;
    let countdownInterval = null;

    function setTimer() {
      if (!currentExpire) return;
      clearInterval(countdownInterval);
      countdownInterval = setInterval(() => {
        const now = Date.now() / 1000;
        const left = Math.max(0, Math.ceil(currentExpire - now));
        timerEl.textContent = left.toString();
        if (left <= 0) clearInterval(countdownInterval);
      }, 200);
    }

    function renderOptions(options) {
      optionsEl.innerHTML = '';
      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onclick = () => {
          ws.send(JSON.stringify({ type: 'answer', choice: idx }));
          Array.from(optionsEl.querySelectorAll('button')).forEach(b => b.disabled = true);
        };
        optionsEl.appendChild(btn);
      });
    }

    joinBtn?.addEventListener('click', () => {
      const nm = nameInput.value.trim() || 'Misafir';
      ws.send(JSON.stringify({ type: 'join', name: nm }));
    });

    ws.addEventListener('message', (event) => handleMessage(event, {
      joined: (data) => {
        me.textContent = `Hoş geldin, ${data.name}`;
        joinSection.classList.add('hidden');
        gameSection.classList.remove('hidden');
        feedbackEl.textContent = '';
      },
      question: (data) => {
        qProgress.textContent = `Soru ${data.index + 1} / ${data.q_total}`;
        questionEl.textContent = data.question;
        currentExpire = data.expires_at;
        setTimer();
        feedbackEl.textContent = '';
        leaderboardEl.classList.add('hidden');
        renderOptions(data.options);
      },
      answer_ack: (data) => {
        feedbackEl.textContent = data.correct ? 'Doğru! Puanın: ' + data.score : 'Yanlış :(';
      },
      reveal: (data) => {
        Array.from(optionsEl.children).forEach((b, idx) => {
          b.disabled = true;
          if (idx === data.correct) b.classList.add('correct');
        });
      },
      leaderboard: (data) => {
        leaderboardEl.classList.remove('hidden');
        const top = data.top3 || [];
        leaderboardEl.innerHTML = `
          <h3 class="text-xl font-bold mb-2">Kazananlar</h3>
          <ol class="space-y-1">
            ${top.map((t, i) => `<li class="flex items-center gap-3"><span class="badge">${i+1}</span><span>${t[0]}</span><span class="ml-auto font-mono">${t[1]} puan</span></li>`).join('')}
          </ol>
        `;
      },
      reset_done: () => {
        feedbackEl.textContent = '';
        optionsEl.innerHTML = '';
        questionEl.textContent = '';
        qProgress.textContent = '';
        timerEl.textContent = '10';
        leaderboardEl.classList.add('hidden');
      },
    }));
  }

  // Admin page
  if (isAdmin) {
    const lobby = byId('lobby');
    const qCount = byId('qCount');
    const loadBtn = byId('loadBtn');
    const startBtn = byId('startBtn');
    const nextBtn = byId('nextBtn');
    const resetBtn = byId('resetBtn');
    const excelPath = byId('excelPath');
    const loadInfo = byId('loadInfo');

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'admin' }));
    });

    function renderLobby(list) {
      lobby.innerHTML = list.map(n => `<li class="px-3 py-2 bg-gray-700 rounded-lg">${n}</li>`).join('');
    }

    loadBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'load_questions', path: excelPath.value.trim() || 'questions.xlsx' }));
    });

    startBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'start_quiz' }));
    });

    nextBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'next' }));
    });

    resetBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'reset' }));
    });

    ws.addEventListener('message', (event) => handleMessage(event, {
      admin_ack: (data) => {
        renderLobby(data.players || []);
        qCount.textContent = `Soru sayısı: ${data.q_count || 0}`;
      },
      lobby: (data) => {
        renderLobby(data.players || []);
      },
      questions_loaded: (data) => {
        qCount.textContent = `Soru sayısı: ${data.count}`;
        loadInfo.textContent = `Yüklendi (${data.count}).`;
      },
      error: (data) => {
        loadInfo.textContent = `Hata: ${data.message}`;
      },
    }));
  }
})();
