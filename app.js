/* ── Kibbe Type Calculator · app.js ── */

const files = {};

/* ── Режим работы ──
   На Vercel (https://) → /api/analyze, ключ живёт на сервере.
   Локально (file://)   → прямой запрос в Anthropic, ключ вводится один раз.
── */
const IS_LOCAL = (
  location.protocol === 'file:' ||
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'
);

function getLocalApiKey() {
  let key = localStorage.getItem('kibbe_api_key');
  if (!key) {
    key = prompt(
      'Для локального тестирования введите Anthropic API-ключ.\n\n' +
      'Получить: console.anthropic.com → API Keys\n' +
      'Ключ сохранится в браузере — вводить повторно не нужно.'
    );
    if (key && key.trim()) localStorage.setItem('kibbe_api_key', key.trim());
  }
  return key ? key.trim() : null;
}

/* ── Draw placeholder example images on canvas ── */
function drawExample(canvasId, mode) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.width  = 240;
  canvas.height = 300;
  const W = 240, cx = W / 2;
  const ctx = canvas.getContext('2d');

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  ctx.fillStyle = isDark ? '#2a2a28' : '#f0ede8';
  ctx.fillRect(0, 0, W, 300);
  ctx.strokeStyle = isDark ? '#6a6a64' : '#a09890';
  ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (mode === 'body') {
    ctx.beginPath(); ctx.ellipse(cx, 50, 20, 26, 0, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-8,76); ctx.lineTo(cx-8,88); ctx.moveTo(cx+8,76); ctx.lineTo(cx+8,88); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-45,100); ctx.quadraticCurveTo(cx-25,90,cx-8,90);
    ctx.moveTo(cx+8,90); ctx.quadraticCurveTo(cx+25,90,cx+45,100); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-45,100); ctx.lineTo(cx-38,162); ctx.moveTo(cx+45,100); ctx.lineTo(cx+38,162);
    ctx.moveTo(cx-38,162); ctx.lineTo(cx,166); ctx.lineTo(cx+38,162); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-20,166); ctx.lineTo(cx-22,248); ctx.moveTo(cx+20,166); ctx.lineTo(cx+22,248); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-45,100); ctx.lineTo(cx-55,168); ctx.moveTo(cx+45,100); ctx.lineTo(cx+55,168); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-22,248); ctx.lineTo(cx-30,256); ctx.moveTo(cx+22,248); ctx.lineTo(cx+30,256); ctx.stroke();
    ctx.fillStyle = isDark ? '#7a7a74' : '#a09890';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Полный рост, прямо', cx, 282);
  } else {
    ctx.beginPath(); ctx.ellipse(cx,128,62,82,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-44,90); ctx.quadraticCurveTo(cx-28,84,cx-14,88);
    ctx.moveTo(cx+14,88); ctx.quadraticCurveTo(cx+28,84,cx+44,90); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx-26,108,14,9,0,0,Math.PI*2); ctx.ellipse(cx+26,108,14,9,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx-26,108,4,0,Math.PI*2); ctx.arc(cx+26,108,4,0,Math.PI*2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx,120); ctx.lineTo(cx-10,148); ctx.quadraticCurveTo(cx,152,cx+10,148); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,166,16,0.12*Math.PI,0.88*Math.PI); ctx.stroke();
    ctx.fillStyle = isDark ? '#7a7a74' : '#a09890';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Анфас, дневной свет', cx, 282);
  }
}

/* ── File pick ── */
function setupFilePicker(n) {
  const input = document.getElementById('f' + n);
  input.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    files[n] = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('prev' + n).src = e.target.result;
      document.getElementById('box' + n).classList.add('ready');
    };
    reader.readAsDataURL(file);
    updateButton();
  });
  document.getElementById('box' + n).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
}

function updateButton() {
  document.getElementById('gobtn').disabled = !(files[1] && files[2]);
}

/* ── Convert file to base64 ── */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Analyze ── */
async function analyze() {
  document.getElementById('errmsg').textContent = '';
  document.getElementById('main-section').style.display = 'none';
  document.getElementById('ldiv').classList.add('on');

  try {
    const [data1, data2] = await Promise.all([toBase64(files[1]), toBase64(files[2])]);

    const systemPrompt = `Ты эксперт по методу Кибби. Проанализируй фото (полный рост + лицо) и определи ОДИН из 6 типов по классической системе Кибби: Dramatic, Soft Dramatic, Natural, Classic, Gamine, Romantic.
Отвечай ТОЛЬКО в формате JSON без markdown-обёрток и без пояснений. Структура:
{
  "type": "название типа на английском",
  "type_ru": "название на русском",
  "subtitle": "1 предложение — суть этого типа, тепло и понятно",
  "features": "2-3 предложения о том, что видно на этих конкретных фото — линии тела, черты лица",
  "style": ["что идёт 1", "что идёт 2", "что идёт 3", "что идёт 4"],
  "avoid": ["что избегать 1", "что избегать 2", "что избегать 3"],
  "celebs": ["Имя Фамилия (ж)", "Имя Фамилия (ж)", "Имя Фамилия (м)", "Имя Фамилия (м)", "Имя Фамилия"]
}
Если не можешь уверенно определить по фото — дай наиболее вероятный тип и отметь это в subtitle.`;

    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: files[1].type || 'image/jpeg', data: data1 } },
          { type: 'image', source: { type: 'base64', media_type: files[2].type || 'image/jpeg', data: data2 } },
          { type: 'text', text: 'Определи мой тип внешности по Кибби.' },
        ],
      }],
    };

    let response;

    if (IS_LOCAL) {
      /* Локальный режим: прямой запрос в Anthropic с ключом из браузера */
      const apiKey = getLocalApiKey();
      if (!apiKey) {
        document.getElementById('ldiv').classList.remove('on');
        document.getElementById('main-section').style.display = '';
        document.getElementById('errmsg').textContent = 'API-ключ не введён. Обновите страницу и попробуйте снова.';
        return;
      }
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(requestBody),
      });
      /* Если ключ неверный — очистить, чтобы при следующей попытке запросить снова */
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('kibbe_api_key');
      }
    } else {
      /* Режим Vercel: запрос на серверный прокси — ключ на сервере */
      response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    }

    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message || 'api_error');

    const raw = json.content.map(item => item.text || '').join('');
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    renderResult(result);

  } catch (err) {
    console.error(err);
    document.getElementById('ldiv').classList.remove('on');
    document.getElementById('main-section').style.display = '';
    document.getElementById('errmsg').textContent = 'Что-то пошло не так — попробуйте ещё раз.';
  }
}

/* ── Render result ── */
function renderResult(r) {
  document.getElementById('ldiv').classList.remove('on');
  document.getElementById('rname').textContent  = r.type + ' · ' + r.type_ru;
  document.getElementById('rsub').textContent   = r.subtitle;
  document.getElementById('rfeat').textContent  = r.features;
  document.getElementById('rstyle').innerHTML   = r.style.map(s => `<li>${s}</li>`).join('');
  document.getElementById('ravoid').innerHTML   = r.avoid.map(a => `<li>${a}</li>`).join('');
  document.getElementById('rcelebs').innerHTML  = r.celebs.map(c => `<span class="celeb">${c}</span>`).join('');
  document.getElementById('rdiv').classList.add('on');
  document.getElementById('rdiv').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Reset ── */
function reset() {
  [1, 2].forEach(n => {
    files[n] = null;
    document.getElementById('box'  + n).classList.remove('ready');
    document.getElementById('prev' + n).src = '';
    document.getElementById('f'    + n).value = '';
  });
  document.getElementById('rdiv').classList.remove('on');
  document.getElementById('ldiv').classList.remove('on');
  document.getElementById('main-section').style.display = '';
  document.getElementById('errmsg').textContent = '';
  document.getElementById('gobtn').disabled = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  drawExample('ex1', 'body');
  drawExample('ex2', 'face');
  setupFilePicker(1);
  setupFilePicker(2);
  document.getElementById('gobtn').addEventListener('click', analyze);
  document.getElementById('resetbtn').addEventListener('click', reset);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    drawExample('ex1', 'body');
    drawExample('ex2', 'face');
  });
});
