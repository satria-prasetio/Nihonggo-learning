const JSON_PATH = "./kotoba.json";
const TOTAL_CHOICES = 4;      // 1 benar + 3 salah
const SESSION_SIZE = 20;      // 20 soal per batch

const elQuestion = document.getElementById("question");
const elChoices  = document.getElementById("choices");
const elScore    = document.getElementById("score");
const elProgress = document.getElementById("progress");
const elFeedback = document.getElementById("feedback");
const elHint     = document.getElementById("hint");
const btnNext    = document.getElementById("btnNext");
const btnReset   = document.getElementById("btnReset");

let bank = [];
let pool = [];          // <- antrian semua soal (sudah diacak), terus berkurang
let sessionOrder = [];  // <- 20 soal untuk sesi saat ini
let idx = 0;
let score = 0;
let locked = false;

// Fisher–Yates shuffle (unbiased permutation)
function shuffleInPlace(array) {
  for (let i = array.length - 1; i >= 1; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pickDistractors(correctAnswer, n) {
  const candidates = bank.map(q => q.id).filter(ans => ans !== correctAnswer);
  shuffleInPlace(candidates);
  return candidates.slice(0, n);
}

async function loadBank() {
  const res = await fetch(JSON_PATH);
  if (!res.ok) throw new Error(`Gagal load ${JSON_PATH}: ${res.status}`);
  return await res.json();
}

// Buat "run" baru: pool diisi ulang dan diacak sekali
function resetRun() {
  pool = [...bank.keys()];
  shuffleInPlace(pool); // acak sekali untuk seluruh run [web:12]
}

// Ambil batch berikutnya (20-20-20) dari pool
function startNextSession() {
  score = 0;
  idx = 0;
  locked = false;
  elScore.textContent = score;
  elFeedback.textContent = "";
  elFeedback.className = "feedback";
  btnNext.disabled = true;

  if (bank.length < TOTAL_CHOICES) {
    elQuestion.textContent = "Data kurang";
    elChoices.innerHTML = "";
    elProgress.textContent = `0/0`;
    elFeedback.textContent = `Butuh minimal ${TOTAL_CHOICES} data di kotoba.json.`;
    return;
  }

  // kalau pool kosong, otomatis mulai run baru
  if (pool.length === 0) resetRun();

  // splice: ambil 20 pertama sekaligus menghapusnya dari pool [web:79]
  sessionOrder = pool.splice(0, Math.min(SESSION_SIZE, pool.length));

  elHint.textContent = `Mode batch: sesi ini ${sessionOrder.length} soal. Sisa soal di run ini: ${pool.length}.`;
  render();
}

function render() {
  locked = false;
  btnNext.disabled = true;
  elFeedback.textContent = "";
  elFeedback.className = "feedback";

  const q = bank[sessionOrder[idx]];
  elQuestion.textContent = q.jp;
  elProgress.textContent = `${idx + 1}/${sessionOrder.length}`;

  const distractors = pickDistractors(q.id, TOTAL_CHOICES - 1);
  const options = shuffleInPlace([q.id, ...distractors]);

  elChoices.innerHTML = "";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = opt;
    btn.addEventListener("click", () => onPick(opt, q.id));
    elChoices.appendChild(btn);
  }
}

function onPick(chosen, correct) {
  if (locked) return;
  locked = true;

  if (chosen === correct) {
    score += 1;
    elScore.textContent = score;
    elFeedback.textContent = "Benar!";
    elFeedback.className = "feedback ok";
  } else {
    elFeedback.textContent = `Salah. Jawaban benar: ${correct}`;
    elFeedback.className = "feedback bad";
  }
  btnNext.disabled = false;
}

btnNext.addEventListener("click", () => {
  if (idx < sessionOrder.length - 1) {
    idx += 1;
    render();
  } else {
    elQuestion.textContent = "Sesi selesai!";
    elChoices.innerHTML = "";
    elProgress.textContent = `${sessionOrder.length}/${sessionOrder.length}`;
    elFeedback.textContent = `Skor sesi: ${score}/${sessionOrder.length}. Klik "Soal berikutnya" untuk batch selanjutnya.`;
    elFeedback.className = "feedback";
    btnNext.disabled = false;

    // trik: pada state selesai sesi, tombol Next akan memulai sesi berikutnya
    btnNext.onclick = () => {
      btnNext.onclick = null; // kembalikan handler normal (addEventListener tetap jalan)
      startNextSession();
    };
  }
});

btnReset.addEventListener("click", () => {
  // reset dari awal run (acak ulang) lalu mulai sesi pertama lagi
  resetRun();
  startNextSession();
});

(async () => {
  bank = await loadBank();
  resetRun();
  startNextSession();
})();
