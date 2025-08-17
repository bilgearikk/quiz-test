(() => {
  const isAdmin = window.location.pathname.includes("/admin");
  const byId = (id) => document.getElementById(id);

  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${location.host}/ws`;
  const ws = new WebSocket(wsUrl);

  function safeParse(data) {
    try { return JSON.parse(data); }
    catch { return null; }
  }
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

  // ================= PLAYER =================
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
    const infoSection = byId('info-section') || byId('tips-section');

    // Winner UI
    const winnerBanner = byId('winner-banner');
    const winnerNameEl = byId('winner-name');
    let winnerShown = false;

    function runConfetti(duration = 4500){
      if (!window.confetti) return;
      const end = Date.now() + duration;
      (function frame(){
        confetti({ particleCount: 4, angle: 60,  spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }

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

        btn.onmousemove = (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          btn.style.setProperty('--x', (e.clientX - r.left) + 'px');
          btn.style.setProperty('--y', (e.clientY - r.top) + 'px');
        };

        btn.onclick = () => {
          Array.from(optionsEl.querySelectorAll('button')).forEach(b => b.classList.remove('chosen'));
          btn.classList.add('chosen');
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

    // enter ile katılma
    nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinBtn?.click();
    });

    ws.addEventListener('message', (event) => handleMessage(event, {
      joined: (data) => {
        me.textContent = `Hoş geldin, ${data.name}`;
        joinSection.classList.add('hidden');
        gameSection.classList.remove('hidden');
        infoSection?.classList.add('hidden');   // bilgi kutusunu gizle
        feedbackEl.textContent = '';
      },

      question: (data) => {
        qProgress.textContent = `Soru ${data.index + 1} / ${data.q_total}`;
        questionEl.textContent = data.question;
        currentExpire = data.expires_at;
        infoSection?.classList.add('hidden');   // oyun başlayınca gizli kalsın
        setTimer();
        feedbackEl.textContent = '';
        leaderboardEl.classList.add('hidden');
        renderOptions(data.options);
      },

      answer_ack: (_d) => {
        // bireysel geri bildirim göstermek istemiyorsak boş bırakıyoruz
      },

      reveal: (d) => {
        Array.from(optionsEl.children).forEach((b, i) => {
          b.disabled = true;
          const wasChosen = b.classList.contains('chosen');
          b.classList.remove('chosen');
          if (i === d.correct) {
            b.classList.add('correct');
          } else if (wasChosen) {
            b.classList.add('wrong');
          }
        });
      },

      leaderboard: (data) => {
        leaderboardEl.classList.remove('hidden');
        const list = data.all || [];

        // Birincinin kutlamasını 1 kez göster
        if (list.length && !winnerShown) {
          winnerShown = true;
          const [firstName] = list[0]; // [isim, skor]
          if (winnerBanner && winnerNameEl) {
            winnerNameEl.textContent = firstName;
            winnerBanner.classList.remove('hidden');
            runConfetti(4500);
            setTimeout(() => winnerBanner.classList.add('hidden'), 5200);
          } else {
            runConfetti(4500);
          }
        }

        leaderboardEl.innerHTML = `
          <h3 class="text-xl font-bold mb-2">Skor Tablosu</h3>
          <ol class="space-y-1 max-h-80 overflow-y-auto pr-2">
            ${
              list.map(([name, score], i) => `
                <li class="flex items-center gap-3">
                  <span class="badge">${i + 1}</span>
                  <span>${name}</span>
                  <span class="ml-auto font-mono">${score} puan</span>
                </li>
              `).join('')
            }
          </ol>
        `;
      },

      reset_done: () => {
        // yeni oyun için sıfırla
        winnerShown = false;
        winnerBanner?.classList.add('hidden');

        feedbackEl.textContent = '';
        optionsEl.innerHTML = '';
        questionEl.textContent = '';
        qProgress.textContent = '';
        timerEl.textContent = '10';
        leaderboardEl.classList.add('hidden');
      },
    }));
  }

  // ================= ADMIN =================
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
      if (!lobby) return;
      lobby.innerHTML = list.map(n => `<li class="px-3 py-2 bg-gray-700 rounded-lg">${n}</li>`).join('');
    }

    loadBtn?.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'load_questions', path: (excelPath?.value.trim() || 'questions.xlsx') }));
    });
    startBtn?.addEventListener('click', () => ws.send(JSON.stringify({ type: 'start_quiz' })));
    nextBtn?.addEventListener('click', () => ws.send(JSON.stringify({ type: 'next' })));
    resetBtn?.addEventListener('click', () => ws.send(JSON.stringify({ type: 'reset' })));

    ws.addEventListener('message', (event) => handleMessage(event, {
      admin_ack: (d) => {
        renderLobby(d.players || []);
        if (qCount) qCount.textContent = `Soru sayısı: ${d.q_count || 0}`;
      },
      lobby: (d) => renderLobby(d.players || []),
      questions_loaded: (d) => {
        if (qCount) qCount.textContent = `Soru sayısı: ${d.count}`;
        if (loadInfo) loadInfo.textContent = `Yüklendi (${d.count}).`;
      },
      error: (d) => { if (loadInfo) loadInfo.textContent = `Hata: ${d.message}`; },
    }));
  }
})();
