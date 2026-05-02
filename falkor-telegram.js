const VERSION = 'v1.6.0';
const AGENT_URL = 'https://falkor-agent.luckdragon.io';
const AI_URL    = 'https://asgard-ai.luckdragon.io';

function getUserId(from) {
  if (!from) return 'paddy';
  const u = (from.username || '').toLowerCase();
  const n = (from.first_name || '').toLowerCase();
  if (u.includes('jacky') || n.includes('jacky') || n.includes('jacqueline')) return 'jacky';
  if (u.includes('george') || n.includes('george')) return 'george';
  return 'paddy';
}

async function tgSend(token, chatId, text) {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

async function askFalkor(agentPin, userId, message, chatId) {
  try {
    const res = await fetch(`${AGENT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin': agentPin },
      body: JSON.stringify({ message, userId, sessionId: `tg_${chatId}`, platform: 'telegram' })
    });
    if (!res.ok) return `Sorry, Falkor had a ${res.status} error. Try again!`;
    const d = await res.json();
    return d.reply || d.text || d.message || 'No response from Falkor.';
  } catch (e) {
    return `Connection error: ${e.message}`;
  }
}

// ── Analyse image via asgard-ai /chat/vision ─────────────────────────────────
async function analyseImage(token, fileId, mimeType, prompt, aiPin) {
  try {
    // Step 1: get Telegram file path
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
    );
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result) return null;
    const filePath = fileData.result.file_path;

    // Step 2: download the file bytes
    const imgRes = await fetch(
      `https://api.telegram.org/file/bot${token}/${filePath}`
    );
    if (!imgRes.ok) return null;
    const imgBuffer = await imgRes.arrayBuffer();

    // Step 3: base64 encode
    const bytes = new Uint8Array(imgBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);

    // Step 4: call asgard-ai /chat/vision
    const visionRes = await fetch(`${AI_URL}/chat/vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin': aiPin },
      body: JSON.stringify({
        image_base64: b64,
        image_mime: mimeType,
        message: prompt || 'Describe this image in detail.',
        model: 'haiku',
      })
    });
    if (!visionRes.ok) {
      const errText = await visionRes.text().catch(() => '');
      console.error('Vision error:', visionRes.status, errText.slice(0, 200));
      return null;
    }
    const vd = await visionRes.json();
    return vd.reply || null;
  } catch (e) {
    console.error('analyseImage error:', e.message);
    return null;
  }
}

async function transcribeVoice(token, fileId, agentPin) {
  try {
    const fileRes = await fetch(
      'https://api.telegram.org/bot' + token + '/getFile?file_id=' + fileId
    );
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result) return null;
    const filePath = fileData.result.file_path;

    const audioRes = await fetch(
      'https://api.telegram.org/file/bot' + token + '/' + filePath
    );
    if (!audioRes.ok) return null;
    const audioBuffer = await audioRes.arrayBuffer();

    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
    form.append('audio', blob, 'voice.ogg');
    const sttRes = await fetch('https://asgard-ai.luckdragon.io/stt', {
      method: 'POST',
      headers: { 'X-Pin': agentPin },
      body: form
    });
    if (!sttRes.ok) return null;
    const sttData = await sttRes.json();
    return sttData.text || sttData.transcript || null;
  } catch (e) {
    return null;
  }
}

const SLASH_MAP = {
  '/afl':     'afl ladder and scores today',
  '/tip':     'show my tipping comp standings',
  '/racing':  'show racing tipping leaderboard',
  '/weather': 'what is the weather today',
  '/briefing':'give me my daily briefing',
  '/kbt':     'what kbt trivia events are coming up',
  '/pe':      'is it suitable for outdoor PE today at WPS?',
  '/lesson':   '__LESSON__',  // handled specially below
  '/xc':       '__XC__',      // handled specially below
  '/quiz':     '__QUIZ__',    // handled specially below
};

const HELP_TEXT = `<b>Falkor Commands</b>

/afl — AFL ladder and scores
/tip — Tipping comp standings
/racing — Racing tipping leaderboard
/weather — Current weather
/briefing — Daily briefing
/kbt — KBT trivia events
/pe — PE outdoor suitability
/lesson [yr] [min] [theme] — Plan a PE week
/xc [category] [place] [name] [time] — Record XC result (e.g. /xc 10boys 1st Elias 8:06)
/xc [category] — Show all results for that age group
/quiz [theme] — Start a 5-question trivia quiz (e.g. /quiz sport)
/help — This help message

Or ask me anything — including sending a photo for me to analyse.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        }
      });
    }

    if (path === '/health') {
      return new Response(JSON.stringify({
        ok: true, worker: 'falkor-telegram', version: VERSION,
        bot_configured: !!(env.TELEGRAM_BOT_TOKEN),
        agent_pin_set: !!(env.AGENT_PIN),
        vision_enabled: !!(env.AI_WORKER_PIN),
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (path === '/register-webhook' && method === 'POST') {
      if (request.headers.get('X-Pin') !== env.AGENT_PIN) {
        return new Response('Forbidden', { status: 403 });
      }
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) return new Response(
        JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
      const body = await request.json().catch(() => ({}));
      const webhookUrl = body.url || `https://falkor-telegram.luckdragon.io/webhook`;
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] })
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    }

    if (path === '/webhook' && method === 'POST') {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) return new Response('Bot token not configured', { status: 503 });

      let update;
      try { update = await request.json(); }
      catch { return new Response('Bad request', { status: 400 }); }

      const msg = update.message;
      if (!msg) return new Response('OK');

      const chatId   = msg.chat.id;
      const userId   = getUserId(msg.from);
      const agentPin = env.AGENT_PIN  || '';
      const aiPin    = env.AI_WORKER_PIN || env.AGENT_PIN || '';

      // ── Handle photo messages ─────────────────────────────────────────────
      if (msg.photo || (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/'))) {
        await tgSend(token, chatId, 'Analysing your image...');

        let fileId, mimeType;
        if (msg.photo) {
          // Telegram sends multiple sizes — pick the largest (last in array)
          const largest = msg.photo[msg.photo.length - 1];
          fileId   = largest.file_id;
          mimeType = 'image/jpeg';
        } else {
          fileId   = msg.document.file_id;
          mimeType = msg.document.mime_type;
        }

        // Caption becomes the vision prompt; fallback to generic describe
        const caption = (msg.caption || '').trim();
        const visionPrompt = caption
          ? `The user says: "${caption}". Analyse this image in that context. Be sharp and direct — Jarvis style.`
          : 'Describe this image clearly and concisely. Note anything interesting, unusual, or actionable. Be direct.';

        const description = await analyseImage(token, fileId, mimeType, visionPrompt, aiPin);

        if (!description) {
          await tgSend(token, chatId, 'Vision analysis failed — could not process that image. Try again or send a different one.');
        } else {
          const clean = description
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .substring(0, 4096);
          await tgSend(token, chatId, clean);
        }
        return new Response('OK');
      }

      // ── Handle voice notes ────────────────────────────────────────────────
      let text = msg.text ? msg.text.trim() : null;
      if (!text && msg.voice) {
        await tgSend(token, chatId, 'Transcribing voice note...');
        text = await transcribeVoice(token, msg.voice.file_id, agentPin);
        if (!text) {
          await tgSend(token, chatId, "Sorry, I couldn't transcribe that. Please try again.");
          return new Response('OK');
        }
        await tgSend(token, chatId, `<i>You said: ${text}</i>`);
      }
      if (!text) return new Response('OK');

      // Typing indicator (fire and forget)
      fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
      });

      // ── Slash commands ────────────────────────────────────────────────────
      if (text.startsWith('/')) {
        const cmdFull = text.split(' ')[0].split('@')[0].toLowerCase();
        const args    = text.split(' ').slice(1).join(' ');

        if (cmdFull === '/help' || cmdFull === '/start') {
          await tgSend(token, chatId, HELP_TEXT);
          return new Response('OK');
        }

        // /lesson — PE week planner
        if (cmdFull === '/lesson') {
          const args = text.slice('/lesson'.length).trim();
          // Parse: /lesson Year 5/6 45min Ball skills  OR  /lesson 3/4 30 Athletics
          const ylMatch = args.match(/year\s*(\d+(?:\/\d+)?|f(?:oundation)?)|\b(f(?:oundation)?|\d+\/\d+|\d+)\b/i);
          const yl = ylMatch ? 'Year ' + (ylMatch[1] || ylMatch[2]).charAt(0).toUpperCase() + (ylMatch[1] || ylMatch[2]).slice(1) : 'Mixed F-6';
          const durMatch = args.match(/(\d+)\s*min/i) || args.match(/\b(30|40|45|50|60)\b/);
          const dur = durMatch ? parseInt(durMatch[1]) : 45;
          const stopWords = ['year','yr','min','minute','f-6','mixed',yl.toLowerCase(),'foundation',String(dur)];
          const theme = args.replace(/year\s*[\d\/f]+|\d+\s*min/gi,'').split(' ').map(w=>w.trim()).filter(w=>w.length>2&&!stopWords.includes(w.toLowerCase())).join(' ').trim() || null;
          await tgSend(token, chatId, 'Planning your PE week (' + yl + ', ' + dur + 'min' + (theme ? ', ' + theme : '') + ')... give me a sec ⏳');
          try {
            const schoolPin = env.AGENT_PIN || '';
            const resp = await fetch('https://falkor-school.luckdragon.io/lesson-week', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Pin': schoolPin },
              body: JSON.stringify({ year_level: yl, duration: dur, theme: theme }),
            });
            const data = await resp.json();
            if (!data.ok || !data.days) throw new Error(data.error || 'No plan returned');
            let msg = '<b>PE Week Plan — ' + yl + ' (' + dur + 'min)</b>\n';
            if (data.theme) msg += '<i>' + data.theme + '</i>\n\n';
            for (const day of data.days) {
              msg += '<b>' + day.name + '</b>\n';
              const s = day.sections || {};
              const parts = [];
              if (s['warm-up'] || s.warm_up) parts.push('Warm-up: ' + (s['warm-up'] || s.warm_up).slice(0,80));
              if (s.main_activity) parts.push('Main: ' + s.main_activity.slice(0,100));
              if (s.game) parts.push('Game: ' + s.game.slice(0,80));
              if (parts.length === 0 && day.raw) parts.push(day.raw.slice(0,150));
              msg += parts.join('\n') + '\n\n';
            }
            if (msg.length > 3800) msg = msg.slice(0,3800) + '...';
            msg += (data.outdoor_recommended ? 'Conditions: Outdoor OK' : 'Note: Indoor recommended') + '\n' + (data.weather_note || '');
            await tgSend(token, chatId, msg.trim());
          } catch (e) {
            await tgSend(token, chatId, 'Could not generate plan: ' + e.message);
          }
          return new Response('ok');
        }

        // /xc — cross country result entry or results query
        if (cmdFull === '/xc') {
          const args = text.slice('/xc'.length).trim();
          const today = new Date().toISOString().slice(0, 10);
          // If just a category name — show results
          const tokens = args.trim().split(/\s+/);
          if (tokens.length === 1 && tokens[0]) {
            // Show results for this category
            const cat = tokens[0].toLowerCase();
            const r = await fetch('https://falkor-school.luckdragon.io/xc/results?category=' + encodeURIComponent(cat) + '&event_date=' + today, {
              headers: { 'X-Pin': env.AGENT_PIN }
            });
            const data = await r.json().catch(() => ({}));
            if (!data.ok || !data.results || data.results.length === 0) {
              await tgSend(token, chatId, '<b>No results yet for ' + cat + ' (' + today + ')</b>');
            } else {
              let msg = '<b>XC Results — ' + cat + ' (' + today + ')</b>\n';
              for (const res of data.results) {
                msg += (res.position || '?') + '. ' + res.name + (res.time ? ' — ' + res.time : '') + (res.school ? ' (' + res.school + ')' : '') + '\n';
              }
              await tgSend(token, chatId, msg);
            }
            return new Response('ok');
          }
          // All results for today
          if (!args) {
            const r = await fetch('https://falkor-school.luckdragon.io/xc/results?event_date=' + today, {
              headers: { 'X-Pin': env.AGENT_PIN }
            });
            const data = await r.json().catch(() => ({}));
            if (!data.ok || !data.categories || Object.keys(data.categories).length === 0) {
              await tgSend(token, chatId, '<b>No XC results recorded for ' + today + '</b>\nUse: /xc [category] [place] [name] [time]');
            } else {
              let msg = '<b>XC Results — ' + today + '</b>\n';
              for (const [cat, results] of Object.entries(data.categories)) {
                msg += '\n<b>' + cat + '</b>\n';
                for (const res of results) {
                  msg += (res.position || '?') + '. ' + res.name + (res.time ? ' — ' + res.time : '') + '\n';
                }
              }
              await tgSend(token, chatId, msg);
            }
            return new Response('ok');
          }
          // Record a result: /xc [category] [position] [name] [time?]
          // e.g. /xc 10boys 1st Elias 8:06
          //      /xc yr5girls 2 Sophie 12:34
          //      /xc open-boys 1 Marcus
          const catTok = tokens[0].toLowerCase();
          const posTok = tokens[1] ? tokens[1].replace(/[^0-9]/g, '') || tokens[1] : '1';
          const nameTok = tokens.slice(2, tokens.length > 3 ? tokens.length - 1 : undefined).join(' ') || 'Unknown';
          const timeTok = tokens.length > 3 ? tokens[tokens.length - 1] : '';
          const body = JSON.stringify({ category: catTok, position: posTok, name: nameTok, time: timeTok, event_date: today });
          const r = await fetch('https://falkor-school.luckdragon.io/xc/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN },
            body
          });
          const data = await r.json().catch(() => ({}));
          if (data.ok) {
            const pos = data.results.find(function(x) { return x.position === posTok; });
            await tgSend(token, chatId,
              '✅ <b>' + catTok + '</b> — ' + posTok + '. <b>' + nameTok + '</b>' + (timeTok ? ' (' + timeTok + ')' : '') + '\n' +
              '<i>' + data.results.length + ' result(s) recorded today</i>'
            );
          } else {
            await tgSend(token, chatId, '❌ ' + (data.error || 'Failed to record result'));
          }
          return new Response('ok');
        }

        
        // /quiz — KBT Telegram trivia quiz
        if (cmdFull === '/quiz') {
          const quizTheme = args.trim() || 'general knowledge';
          await tgSend(token, chatId, '<i>Generating a ' + quizTheme + ' quiz... give me a sec!</i>');
          const r = await fetch('https://falkor-kbt.luckdragon.io/quiz/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN },
            body: JSON.stringify({ chat_id: String(chatId), theme: quizTheme, num_questions: 5 })
          });
          const qdata = await r.json().catch(function() { return {}; });
          if (!qdata.ok) {
            await tgSend(token, chatId, '❌ Could not start quiz: ' + (qdata.error || 'unknown error'));
          } else {
            const fq = qdata.first_question;
            await tgSend(token, chatId,
              '<b>🎯 KBT Telegram Quiz — ' + quizTheme + '</b>' +
              '\n<i>5 questions — first to reply correctly wins the point!</i>\n\n' +
              '<b>Q1:</b> ' + fq.question +
              (fq.category ? '\n<i>Category: ' + fq.category + '</i>' : '')
            );
          }
          return new Response('ok');
        }

        const mapped = SLASH_MAP[cmdFull];
        if (mapped) {
          const query = mapped + (args ? ' ' + args : '');
          const reply = await askFalkor(agentPin, userId, query, chatId);
          const clean = reply
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .substring(0, 4096);
          await tgSend(token, chatId, clean);
          return new Response('OK');
        }

        await tgSend(token, chatId, 'Unknown command. Try /help for options.');
        return new Response('OK');
      }

      // ── Active quiz intercept ──────────────────────────────────────────────
      try {
        const qsResp = await fetch('https://falkor-kbt.luckdragon.io/quiz/status/' + encodeURIComponent(String(chatId)), {
          headers: { 'X-Pin': env.AGENT_PIN }
        });
        const quizStatus = await qsResp.json().catch(function() { return { ok: false }; });
        if (quizStatus.ok && quizStatus.active) {
          const ansResp = await fetch('https://falkor-kbt.luckdragon.io/quiz/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN },
            body: JSON.stringify({ chat_id: String(chatId), user_name: msg.from ? (msg.from.first_name || 'Someone') : 'Someone', answer: text })
          }).then(function(r) { return r.json(); }).catch(function() { return { ok: false }; });
          if (ansResp.ok && ansResp.correct) {
            const medals = ['🥇', '🥈', '🥉'];
            let replyMsg = '✅ <b>' + ansResp.scorer + '</b> got it! The answer was <b>' + ansResp.answer + '</b>';
            if (ansResp.fun_fact) replyMsg += '\n<i>💡 ' + ansResp.fun_fact + '</i>';
            if (ansResp.done) {
              replyMsg += '\n\n<b>🏆 Quiz Over! Final Scores:</b>\n';
              const sorted = Object.entries(ansResp.scores).sort(function(a, b) { return b[1] - a[1]; });
              sorted.forEach(function(entry, i) {
                replyMsg += (medals[i] || (i + 1) + '.') + ' ' + entry[0] + ' — ' + entry[1] + ' pt' + (entry[1] !== 1 ? 's' : '') + '\n';
              });
              replyMsg += '\n<i>Thanks for playing! Start another with /quiz [theme]</i>';
            } else {
              const nq = ansResp.next_question;
              replyMsg += '\n\n<b>Q' + (nq.idx + 1) + ':</b> ' + nq.question;
              if (nq.category) replyMsg += '\n<i>Category: ' + nq.category + '</i>';
              const sorted = Object.entries(ansResp.scores).sort(function(a, b) { return b[1] - a[1]; });
              if (sorted.length > 0) {
                replyMsg += '\n<i>Scores: ' + sorted.map(function(e) { return e[0] + ' ' + e[1]; }).join(' | ') + '</i>';
              }
            }
            await tgSend(token, chatId, replyMsg);
          }
          // Wrong answer — silently ignore so others can keep guessing
          return new Response('OK');
        }
      } catch (quizErr) { /* quiz check failed — continue to falkor-agent */ }

      // ── Plain text → falkor-agent ─────────────────────────────────────────
      const reply = await askFalkor(agentPin, userId, text, chatId);
      const clean = reply
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .substring(0, 4096);
      await tgSend(token, chatId, clean);
      return new Response('OK');
    }

    return new Response(
      JSON.stringify({ error: 'Not found', path }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
