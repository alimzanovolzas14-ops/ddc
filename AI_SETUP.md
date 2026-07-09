# AI-ассистент через OpenRouter (бесплатно, без карты)

OpenRouter даёт доступ к десяткам моделей по одному ключу. Бесплатный тариф:
20 запросов/мин, **карта не нужна**. Воркер уже у вас есть — нужно только
заменить в нём код и добавить ключ OpenRouter.

---

## Шаг 1. Ключ OpenRouter (бесплатно)
1. Зайдите на **https://openrouter.ai** → войдите (email или Google/GitHub).
2. Слева **Keys** (или https://openrouter.ai/keys) → **Create Key** → имя любое → создать.
3. Скопируйте ключ (начинается с `sk-or-v1-...`).

## Шаг 2. Добавить ключ в воркер как секрет
1. Cloudflare → ваш воркер (`ancient-surf-1cc4…`) → **Settings → Variables and Secrets → Add**.
2. Type: **Secret**, Name: `OPENROUTER_API_KEY`, Value: ваш ключ `sk-or-v1-...` → **Deploy**.
   *(Старый секрет GEMINI_API_KEY можно оставить или удалить — воркер его больше не использует.)*

## Шаг 3. Заменить код воркера
1. Воркер → **Edit code** → удалите весь код → вставьте код из «Шаг 5» → **Deploy**.

## Шаг 4. Подключение к сайту (уже сделано)
В `config.js` адрес воркера уже прописан:
```js
window.DDC_AI_ENDPOINT = 'https://ancient-surf-1cc4.alimzanovolzas14.workers.dev';
```
Менять ничего не нужно — воркер сам выбирает бесплатную модель.

## Шаг 5. Код воркера (вставьте целиком)

```js
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });

    const out = (o, s = 200) =>
      new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

    try {
      if (!env.OPENROUTER_API_KEY) return out({ reply: 'Не задан секрет OPENROUTER_API_KEY в воркере.' });

      const body = await request.json();
      const system = body.system || 'Ты — вежливый ассистент Центра цифрового развития (ЦЦР). Отвечай по-русски, кратко и по делу.';
      const messages = [{ role: 'system', content: system }].concat(
        (body.messages || []).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || '')
        }))
      );

      // openrouter/free сам подбирает доступную бесплатную модель; дальше — запасные
      const models = ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'];
      let lastErr = 'нет ответа';

      for (const model of models) {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY,
            'HTTP-Referer': 'https://ddcnb.kz',
            'X-Title': 'DDC Portal'
          },
          body: JSON.stringify({ model, messages, max_tokens: body.max_tokens || 700 })
        });
        const raw = await r.text();
        let data = {};
        try { data = JSON.parse(raw); } catch (e) {}

        const txt = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (r.ok && txt) return out({ reply: txt });

        lastErr = (data.error && (data.error.message || JSON.stringify(data.error))) || ('HTTP ' + r.status + ': ' + raw.slice(0, 200));
        // если модель занята/не найдена — пробуем следующую, иначе выходим
        if (!/not a valid model|not found|404|no endpoints|429|rate/i.test(lastErr)) break;
      }
      return out({ reply: 'OpenRouter: ' + lastErr });
    } catch (e) {
      return out({ reply: 'Ошибка воркера: ' + (e && e.message ? e.message : e) });
    }
  }
};
```

## Проверка
- Откройте адрес воркера в браузере → **`POST only`**.
- В портале спросите «привет» → должен прийти нормальный ответ 
- Если «OpenRouter: …» — пришлите текст:
  - `User not found` / `No auth credentials` → неверный ключ (проверьте секрет `OPENROUTER_API_KEY`).
  - `Rate limit` / `429` → воркер сам переберёт модели; подождите минуту и повторите.

> Никаких данных карты OpenRouter для бесплатных моделей не требует.
> Лимит: ~20 запросов/мин — для портала более чем достаточно.
