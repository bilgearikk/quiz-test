(() => {
  const isAdmin = window.location.pathname.includes("/admin");
  const byId = (id) => document.getElementById(id);

  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${location.host}/ws`;
  let ws = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  // WebSocket bağlantı yönetimi
  function connectWebSocket() {
    ws = new WebSocket(wsUrl);
    
    ws.addEventListener('open', () => {
      console.log('WebSocket bağlantısı açıldı');
      reconnectAttempts = 0;
      
      // Admin ise hemen admin moduna geç
      if (isAdmin) {
        ws.send(JSON.stringify({ type: 'admin' }));
      }
    });

    ws.addEventListener('error', (e) => {
      console.error('WS error', e);
    });

    ws.addEventListener('close', (e) => {
      console.log('WebSocket bağlantısı kapandı', e.code, e.reason);
      
      const t = byId('feedback') || byId('loadInfo');
      if (t) t.textContent = 'Bağlantı koptu. Yeniden bağlanıyor...';
      
      // Otomatik yeniden bağlanma
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(() => {
          console.log(`Yeniden bağlanma denemesi ${reconnectAttempts}/${maxReconnectAttempts}`);
          connectWebSocket();
        }, 1000 * reconnectAttempts);
      } else {
        if (t) t.textContent = 'Bağlantı koptu. Sayfayı yenileyin.';
      }
    });

    // Message handler'ları ekle
    ws.addEventListener('message', handleWebSocketMessage);
  }

  // ---------- helpers ----------
  function safeParse(data) { 
    try { 
      return JSON.parse(data); 
    } catch { 
      return null; 
    } 
  }

  function handleMessage(event, handlers) {
    const parsed = safeParse(event.data);
    if (!parsed || !parsed.type) return;
    const fn = handlers[parsed.type];
    if (typeof fn === 'function') fn(parsed);
  }

  function hideWinner() {
    const overlay = document.getElementById('winner-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  function showWinner(name, score) {
    hideWinner();
    const el = document.createElement('div');
    el.id = 'winner-overlay';
    el.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70';
    el.innerHTML = `
      <div class="px-8 py-10 bg-gray-800 rounded-2xl shadow-2xl border border-indigo-600 text-center">
        <div class="text-xs tracking-widest text-indigo-300 mb-2">BİRİNCİ</div>
        <div class="text-3xl font-extrabold text-white">${escapeHtml(name)}</div>
        <div class="text-sm text-gray-400">${score} puan</div>
        <div class="mt-4 text-xs text-gray-500">(Kapatmak için tıkla)</div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', hideWinner);

    // Konfeti efekti
    if (window.confetti) {
      const end = Date.now() + 2500;
      (function frame() {
        confetti({ 
          particleCount: 6, 
          spread: 70, 
          origin: { x: Math.random(), y: 0.2 } 
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }
  }

  // XSS koruması için HTML escape
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Safe WebSocket send
  function safeSend(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    } else {
      console.warn('WebSocket bağlantısı kapalı, mesaj gönderilemedi:', data);
      const t = byId('feedback') || byId('loadInfo');
      if (t) t.textContent = 'Bağlantı sorunu. Lütfen bekleyin...';
      return false;
    }
  }

  // ================= Player =================
  if (!isAdmin) {
    const joinSection   = byId('join-section');
    const gameSection   = byId('game-section');
    const joinBtn       = byId('joinBtn');
    const nameInput     = byId('name');
    const me            = byId('me');
    const qProgress     = byId('q-progress');
    const questionEl    = byId('question');
    const timerEl       = byId('timer');
    const optionsEl     = byId('options');
    const feedbackEl    = byId('feedback');
    const leaderboardEl = byId('leaderboard');
    const infoSection   = byId('info-section') || byId('tips-section');

    let currentExpire = null;
    let countdownInterval = null;
    let answerSent = false; // Çift gönderim önleme
    let currentQuestionIndex = -1;

    function clearTimer() {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }

    function setTimer() {
      if (!currentExpire) return;
      clearTimer();
      
      countdownInterval = setInterval(() => {
        const now = Date.now() / 1000;
        const left = Math.max(0, Math.ceil(currentExpire - now));
        if (timerEl) timerEl.textContent = left.toString();
        
        if (left <= 0) {
          clearTimer();
          // Süre doldu, butonları devre dışı bırak
          const buttons = optionsEl?.querySelectorAll('button');
          if (buttons) {
            buttons.forEach(btn => btn.disabled = true);
          }
        }
      }, 100); // Daha hassas timer
    }

    function renderOptions(options) {
      if (!optionsEl) return;
      
      optionsEl.innerHTML = '';
      answerSent = false; // Yeni soru geldi, cevap gönderimini sıfırla
      
      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.disabled = false;
        
        // Hover efekti
        btn.onmousemove = (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          btn.style.setProperty('--x', (e.clientX - r.left) + 'px');
          btn.style.setProperty('--y', (e.clientY - r.top) + 'px');
        };
        
        // Click handler
        btn.onclick = () => {
          // Çift tıklama önleme
          if (answerSent || btn.disabled) return;
          
          // WebSocket bağlantı kontrolü
          if (!safeSend({ type: 'answer', choice: idx })) {
            return;
          }
          
          answerSent = true;
          
          // UI güncelleme
          const allButtons = optionsEl.querySelectorAll('button');
          allButtons.forEach(b => {
            b.classList.remove('chosen');
            b.disabled = true;
          });
          btn.classList.add('chosen');
        };
        
        optionsEl.appendChild(btn);
      });
    }

    // Join button handler
    joinBtn?.addEventListener('click', () => {
      const nm = (nameInput?.value || '').trim() || 'Misafir';
      if (nm.length > 24) {
        if (feedbackEl) feedbackEl.textContent = 'İsim çok uzun (max 24 karakter)';
        return;
      }
      safeSend({ type: 'join', name: nm });
    });

    // Enter tuşu ile join
    nameInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinBtn?.click();
      }
    });

    // Player message handlers
    function handleWebSocketMessage(event) {
      handleMessage(event, {
        joined: (data) => {
          hideWinner();
          if (me) me.textContent = `Hoş geldin, ${data.name}`;
          joinSection?.classList.add('hidden');
          gameSection?.classList.remove('hidden');
          infoSection?.classList.add('hidden');
          if (feedbackEl) feedbackEl.textContent = '';
        },

        question: (data) => {
          hideWinner();
          clearTimer();
          currentQuestionIndex = data.index;
          answerSent = false;
          
          if (qProgress) qProgress.textContent = `Soru ${data.index + 1} / ${data.q_total}`;
          if (questionEl) questionEl.textContent = data.question;
          currentExpire = data.expires_at;
          infoSection?.classList.add('hidden');
          if (feedbackEl) feedbackEl.textContent = '';
          leaderboardEl?.classList.add('hidden');
          
          setTimer();
          renderOptions(data.options);
        },

        answer_ack: (data) => {
          // Cevap onayı alındı
          console.log('Cevap kaydedildi:', data);
        },

        reveal: (data) => {
          clearTimer();
          const buttons = optionsEl?.children;
          if (!buttons) return;
          
          Array.from(buttons).forEach((btn, i) => {
            btn.disabled = true;
            const wasChosen = btn.classList.contains('chosen');
            btn.classList.remove('chosen');
            
            if (i === data.correct) {
              btn.classList.add('correct');
            } else if (wasChosen) {
              btn.classList.add('wrong');
            }
          });
        },

        leaderboard: (data) => {
          if (!leaderboardEl) return;
          
          leaderboardEl.classList.remove('hidden');
          const list = data.all || [];
          
          leaderboardEl.innerHTML = `
            <h3 class="text-xl font-bold mb-2">Skor Tablosu</h3>
            <ol class="space-y-1 max-h-80 overflow-y-auto pr-2">
              ${list.map(([name, score], i) => `
                <li class="flex items-center gap-3">
                  <span class="badge">${i + 1}</span>
                  <span>${escapeHtml(name)}</span>
                  <span class="ml-auto font-mono">${score} puan</span>
                </li>
              `).join('')}
            </ol>
          `;

          // Oyun bittiyse ve kazanan varsa göster
          if (data.game_over && list.length > 0) {
            const [winName, winScore] = list[0];
            setTimeout(() => showWinner(winName, winScore), 500);
          }
        },

        reset_done: () => {
          hideWinner();
          clearTimer();
          answerSent = false;
          currentQuestionIndex = -1;
          
          if (feedbackEl) feedbackEl.textContent = '';
          if (optionsEl) optionsEl.innerHTML = '';
          if (questionEl) questionEl.textContent = '';
          if (qProgress) qProgress.textContent = '';
          if (timerEl) timerEl.textContent = '10';
          leaderboardEl?.classList.add('hidden');
        },

        ping: () => {
          // Heartbeat response
          safeSend({ type: 'pong' });
        }
      });
    }

    // Sayfa kapanırken temizlik
    window.addEventListener('beforeunload', () => {
      clearTimer();
      if (ws) ws.close();
    });
  }

  // ================= Admin =================
  if (isAdmin) {
    const lobby     = byId('lobby');
    const qCount    = byId('qCount');
    const loadBtn   = byId('loadBtn');
    const startBtn  = byId('startBtn');
    const nextBtn   = byId('nextBtn');
    const resetBtn  = byId('resetBtn');
    const excelPath = byId('excelPath');
    const loadInfo  = byId('loadInfo');

    function renderLobby(list) {
      if (!lobby) return;
      lobby.innerHTML = list.map(name => 
        `<li class="px-3 py-2 bg-gray-700 rounded-lg">${escapeHtml(name)}</li>`
      ).join('');
    }

    // Button handlers
    loadBtn?.addEventListener('click', () => {
      const path = (excelPath?.value || '').trim() || 'questions.xlsx';
      safeSend({ type: 'load_questions', path: path });
    });

    startBtn?.addEventListener('click', () => {
      safeSend({ type: 'start_quiz' });
    });

    nextBtn?.addEventListener('click', () => {
      safeSend({ type: 'next' });
    });

    resetBtn?.addEventListener('click', () => {
      if (confirm('Oyunu sıfırlamak istediğinizden emin misiniz?')) {
        safeSend({ type: 'reset' });
      }
    });

    // Admin message handlers
    function handleWebSocketMessage(event) {
      handleMessage(event, {
        admin_ack: (data) => {
          renderLobby(data.players || []);
          if (qCount) qCount.textContent = `Soru sayısı: ${data.q_count || 0}`;
        },
        
        lobby: (data) => {
          renderLobby(data.players || []);
        },
        
        questions_loaded: (data) => {
          if (qCount) qCount.textContent = `Soru sayısı: ${data.count}`;
          if (loadInfo) loadInfo.textContent = `Yüklendi (${data.count} soru).`;
        },
        
        error: (data) => {
          if (loadInfo) loadInfo.textContent = `Hata: ${data.message}`;
          console.error('Server error:', data.message);
        },

        ping: () => {
          // Heartbeat response
          safeSend({ type: 'pong' });
        }
      });
    }
  }

  // WebSocket bağlantısını başlat
  connectWebSocket();
})();