/* ── Kibbe Type Calculator · app.js ── */

const files = {};

const IS_LOCAL = (
  location.protocol === 'file:' ||
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'
);

function getLocalApiKey() {
  let key = localStorage.getItem('kibbe_api_key');
  if (!key) {
    key = prompt('Для локального тестирования введите Anthropic API-ключ.\n\nПолучить: console.anthropic.com → API Keys');
    if (key && key.trim()) localStorage.setItem('kibbe_api_key', key.trim());
  }
  return key ? key.trim() : null;
}


/* ── File pick ── */
function setupFilePicker(n) {
  const input = document.getElementById('f' + n);
  const box = document.getElementById('box' + n);

  // Click anywhere on box opens file dialog
  box.addEventListener('click', function(e) {
    input.click();
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  input.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    files[n] = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('prev' + n).src = e.target.result;
      box.classList.add('ready');
    };
    reader.readAsDataURL(file);
    updateButton();
  });
}

function updateButton() {
  document.getElementById('gobtn').disabled = !(files[1] && files[2]);
}

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

    const systemPrompt = `Ты эксперт-стилист по методу Кибби. Проанализируй два фото (полный рост + лицо) и определи ОДИН из 6 типов: Dramatic, Soft Dramatic, Natural, Classic, Gamine, Romantic.

Отвечай ТОЛЬКО в формате JSON без markdown. Структура:
{
  "type": "название на английском",
  "type_ru": "название на русском",
  "subtitle": "1 тёплое предложение — суть этого типа",
  "features": "2-3 предложения о конкретных чертах, видимых на этих фото",
  "style_names": ["Название стиля 1", "Название стиля 2", "Название стиля 3"],
  "style": ["конкретная рекомендация 1", "конкретная рекомендация 2", "конкретная рекомендация 3", "конкретная рекомендация 4"],
  "outfit_refs": [
    {"title": "Образ 1", "desc": "короткое описание образа — ткани, силуэт, детали"},
    {"title": "Образ 2", "desc": "короткое описание образа"},
    {"title": "Образ 3", "desc": "короткое описание образа"},
    {"title": "Образ 4", "desc": "короткое описание образа"}
  ],
  "avoid": ["что избегать 1", "что избегать 2", "что избегать 3"],
  "celebs": [
    {"name": "Имя Фамилия", "note": "актриса / певица / etc"},
    {"name": "Имя Фамилия", "note": "актриса / певица / etc"},
    {"name": "Имя Фамилия", "note": "актёр / музыкант / etc"},
    {"name": "Имя Фамилия", "note": "актёр / музыкант / etc"},
    {"name": "Имя Фамилия", "note": "модель / etc"}
  ]
}`;

    const requestBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
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
      const apiKey = getLocalApiKey();
      if (!apiKey) {
        document.getElementById('ldiv').classList.remove('on');
        document.getElementById('main-section').style.display = '';
        document.getElementById('errmsg').textContent = 'API-ключ не введён.';
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
      if (response.status === 401 || response.status === 403) localStorage.removeItem('kibbe_api_key');
    } else {
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

  document.getElementById('rname').textContent = r.type + ' · ' + r.type_ru;
  document.getElementById('rsub').textContent  = r.subtitle;
  document.getElementById('rfeat').textContent = r.features;

  // Теги стилей
  document.getElementById('rstyle-names').innerHTML =
    (r.style_names || []).map(s => `<span class="style-tag">${s}</span>`).join('');

  // Рекомендации
  document.getElementById('rstyle').innerHTML =
    r.style.map(s => `<li>${s}</li>`).join('');

  // Референсы образов
  document.getElementById('rrefs').innerHTML =
    (r.outfit_refs || []).map(ref => `
      <div class="ref-card">
        <div class="ref-icon"><i class="ti ti-shirt"></i></div>
        <div class="ref-body">
          <div class="ref-title">${ref.title}</div>
          <div class="ref-desc">${ref.desc}</div>
        </div>
      </div>`).join('');

  // Избегать
  document.getElementById('ravoid').innerHTML =
    r.avoid.map(a => `<li>${a}</li>`).join('');

  // Знаменитости с поиском фото
  const celebsEl = document.getElementById('rcelebs');
  celebsEl.innerHTML = (r.celebs || []).map((c, i) => `
    <div class="celeb-card" id="celeb-${i}">
      <div class="celeb-img-wrap">
        <img class="celeb-img" src="" alt="${c.name}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          style="display:none" />
        <div class="celeb-placeholder"><i class="ti ti-user"></i></div>
      </div>
      <div class="celeb-name">${c.name}</div>
      <div class="celeb-note">${c.note}</div>
    </div>`).join('');

  // Загружаем фото знаменитостей через Wikipedia API
  (r.celebs || []).forEach((c, i) => loadCelebPhoto(c.name, i));

  document.getElementById('rdiv').classList.add('on');
  document.getElementById('rdiv').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Загрузка фото знаменитостей через Wikipedia ── */
async function loadCelebPhoto(name, idx) {
  try {
    const encoded = encodeURIComponent(name.split('(')[0].trim());
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const thumb = data.thumbnail?.source;
    if (!thumb) return;
    const card = document.getElementById(`celeb-${idx}`);
    if (!card) return;
    const img = card.querySelector('.celeb-img');
    const placeholder = card.querySelector('.celeb-placeholder');
    img.src = thumb;
    img.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } catch (e) {
    // тихо — просто остаётся placeholder
  }
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
  setupFilePicker(1);
  setupFilePicker(2);
  document.getElementById('gobtn').addEventListener('click', analyze);
  document.getElementById('resetbtn').addEventListener('click', reset);

});
