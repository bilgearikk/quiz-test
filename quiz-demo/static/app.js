(() => {
  const isAdmin = window.location.pathname.includes("/admin");
  const byId = (id) => document.getElementById(id);

  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${location.host}/ws`;
  const ws = new WebSocket(wsUrl);

  function safeParse(data) { try { return JSON.parse(data); } catch { return null; } }
  function handleMessage(event, handlers) {
    const parsed = safeParse(event.data);
    if (!parsed || !parsed.type) return;
    const fn = handlers[parsed.type];
    if (typeof fn === 'function') fn(parsed);
  }

  ws.addEventListener('error', (e) => console.error('WS error', e));
  ws.addEventListener('close', () => {
    const t = byId('feedback') || byId('loadInfo');
    if (t) t.textContent = 'Bağlantı kapandı. Sayfayı yenileyin.';
  });

  // ======== Player Page ========
  if (!isAdmin) {
    const joinSection = byId('join-section');
    const gameSection = byId('game-section');
    const joinBtn = byId('joinBtn');
    const nameInput = byId('name');
    const me = byId('me');

    const avatarsEl = byId('avatars');
    const miniBoardEl = byId('miniBoard');

    const qProgress = byId('q-progress');
    const qbarFill = byId('qbarFill');
    const questionEl = byId('question');

    const timerEl = byId('timer');
    const timerRing = byId('timerRing');
    const optionsEl = byId('options');

    const feedbackEl = byId('feedback');
    const leaderboardEl = byId('leaderboard');
    const streakBadge = byId('streakBadge');

    const QUESTION_DURATION = 10;

    let currentExpire = null;
    let countdownInterval = null;
    let lastChoice = null;
    let lastCorrect = false;
    let myStreak = 0;

    function setTimer() {
      if (!currentExpire) return;
      clearInterval(countdownInterval);
      countdownInterval = setInterval(() => {
        const now = Date.now() / 1000;
        const left = Math.max(0, currentExpire - now);
        timerEl.textContent = String(Math.ceil(left));
        const prog = Math.min(100, Math.max(0, ((QUESTION_DURATION - left) / QUESTION_DURATION) * 100));
        timerRing.style.setProperty('--prog', prog);
        if (left <= 0) clearInterval(countdownInterval);
      }, 200);
    }

    function renderOptions(options) {
      optionsEl.innerHTML = '';
      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onmousemove = (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          btn.style.setProperty('--x', (e.clientX - r.left) + 'px');
          btn.style.setProperty('--y', (e.clientY - r.top) + 'px');
        };
        btn.onclick = () => {
          lastChoice = idx;
          ws.send(JSON.stringify({ type: 'answer', choice: idx }));
          Array.from(optionsEl.querySelectorAll('button')).forEach(b => b.disabled = true);
        };
        optionsEl.appendChild(btn);
      });
    }

    function renderMiniBoard(list) {
      miniBoardEl.classList.remove('bump');
      void miniBoardEl.offsetWidth; // repaint
      miniBoardEl.classList.add('bump');
      miniBoardEl.innerHTML = (list || []).map((t, i) => {
        const [name, score] = t;
        return `
          <li class="mini-row">
            <span class="mini-rank">${i + 1}</span>
            <span class="mini-name">${name}</span>
            <span class="mini-score">${score}</span>
          </li>
        `;
      }).join('');
    }

    function renderAvatars(names) {
      if (!avatarsEl) return;
      avatarsEl.innerHTML = (names || []).map(n => {
        const ini = (n || '?').trim().slice(0, 1).toUpperCase();
        return `<div class="avatar">${ini}</div>`;
      }).join('');
    }

    function showStreakBadge(streak) {
      if (!streakBadge) return;
      if (streak >= 3) {
        streakBadge.textContent = `${streak} doğru üst üste!`;
        streakBadge.classList.remove('hidden');
        streakBadge.classList.remove('pop');
        void streakBadge.offsetWidth; // restart animation
        streakBadge.classList.add('pop');
        setTimeout(() => streakBadge.classList.add('hidden'), 2000);
      }
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

      lobby: (data) => {
        renderAvatars(data.players || []);
      },

      scores: (data) => {
        renderMiniBoard(data.top5 || []);
      },

      question: (data) => {
        qProgress.textContent = `Soru ${data.index + 1} / ${data.q_total}`;
        questionEl.textContent = data.question;
        const ratio = ((data.index + 1) / data.q_total) * 100;
        if (qbarFill) qbarFill.style.width = `${ratio}%`;

        currentExpire = data.expires_at;
        timerRing.style.setProperty('--prog', 0);
        setTimer();

        lastChoice = null;
        lastCorrect = false;
        feedbackEl.textContent = '';
        streakBadge?.classList.add('hidden');
        leaderboardEl.classList.add('hidden');

        renderOptions(data.options);
      },

      // Anında geri bildirim yazısı göstermiyoruz; sadece streak/sonuç state'i güncelleniyor
      answer_ack: (data) => {
        lastCorrect = !!data.correct;
        myStreak = data.streak ?? myStreak;
      },

      reveal: (data) => {
        Array.from(optionsEl.children).forEach((b, idx) => {
          b.disabled = true;
          if (idx === data.correct) b.classList.add('correct');
        });
        if (lastChoice !== null && lastChoice === data.correct && myStreak >= 3) {
          showStreakBadge(myStreak);
        }
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
        timerRing.style.setProperty('--prog', 0);
        leaderboardEl.classList.add('hidden');
        renderMiniBoard([]);
      },
    }));
  }

  // ======== Admin Page ========
  if (isAdmin) {
    const lobby = byId('lobby');
    const qCount = byId('qCount');
    const loadBtn = byId('loadBtn');
    const startBtn = byId('startBtn');
    const nextBtn = byId('nextBtn');
    const resetBtn = byId('resetBtn');
    const excelPath = byId('excelPath');
    const loadInfo = byId('loadInfo');

    // Upload kontrolleri
    const excelFile = byId('excelFile');
    const uploadBtn = byId('uploadBtn');

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'admin' }));
    });

    function renderLobby(list) {
      lobby.innerHTML = list.map(n => `<li class="px-3 py-2 bg-gray-700 rounded-lg">${n}</li>`).join('');
    }

    loadBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'load_questions', path: excelPath.value.trim() || 'questions.xlsx' }));
    });

    // Lokal dosyadan upload
    uploadBtn?.addEventListener('click', async () => {
      const f = excelFile?.files?.[0];
      if (!f) { loadInfo.textContent = 'Lütfen bir .xlsx dosyası seçin.'; return; }
      const fd = new FormData();
      fd.append('file', f, 'questions.xlsx');
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const j = await res.json();
        if (j.ok) {
          qCount.textContent = `Soru sayısı: ${j.count}`;
          loadInfo.textContent = `Yüklendi (${j.count}).`;
        } else {
          loadInfo.textContent = `Hata: ${j.error || 'Yüklenemedi'}`;
        }
      } catch (err) {
        loadInfo.textContent = 'Ağ hatası: ' + err;
      }
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
