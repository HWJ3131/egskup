import fetch from "node-fetch";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

// ▶ 카테고리별 단어 풀(예시) — 많을수록 더 다양해집니다.
const WORDS = {
  fruits: ["apple","banana","grape","orange","mango","peach","pear","kiwi","lemon","lime","papaya","plum","apricot","cherry","melon","coconut","fig","guava","blueberry","raspberry","strawberry","pineapple","pomegranate"],
  sports: ["soccer","baseball","basketball","tennis","golf","boxing","running","skiing","swimming","volleyball","rugby","badminton","cricket","hockey","cycling","fencing","surfing","archery","wrestling","skating"],
  objects:["table","chair","computer","pencil","bottle","phone","clock","book","camera","scissors","keyboard","monitor","backpack","umbrella","wallet","glasses","laptop","toothbrush","microwave","refrigerator"],
  animals:["tiger","elephant","monkey","rabbit","zebra","giraffe","panda","fox","bear","lion","dog","cat","horse","dolphin","whale","eagle","shark","kangaroo","penguin","owl"]
};

const shuffle = (arr)=> arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
const pickN = (arr, n)=> shuffle(arr).slice(0, n);

function genChoices(word){
  const correct = word[0].toLowerCase();
  const pool = ALPHABET.filter(c=>c!==correct);
  const wrongs = pickN(pool, 3);
  return shuffle([correct, ...wrongs]);
}

// ▶ 간단 메모리 캐시(서버리스에서도 짧게 유지됨)
const cache = new Map(); // key: `${category}:${word}`, val: { url, until }
const TTL = 1000 * 60 * 60 * 12; // 12시간

function catHint(category){
  return category === "animals" ? "animal"
       : category === "sports"  ? "sport"
       : category === "objects" ? "object item"
       : "fruit";
}

// ▶ Unsplash에서 단어에 맞는 이미지를 '랜덤 페이지 + 랜덤 인덱스'로 가져오기
async function fetchImageForWord(word, category){
  const key = `${category}:${word}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.url;

  const hint = catHint(category);
  const page = Math.floor(Math.random() * 5) + 1; // 1~5페이지 중 랜덤
  const perPage = 10; // 상위 10개 받아서 그중 하나 랜덤 선택
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(`${word} ${hint}`)}&per_page=${perPage}&page=${page}&content_filter=high`;

  const res = await fetch(url, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }});
  if (!res.ok) return null;

  const data = await res.json();
  const results = data?.results || [];
  if (results.length === 0) return null;

  const idx = Math.floor(Math.random() * results.length); // 결과 중 랜덤
  const chosen = results[idx];
  const img = chosen?.urls?.small || chosen?.urls?.regular || null;

  if (img) cache.set(key, { url: img, until: Date.now() + TTL });
  return img;
}

const FALLBACK = {
  fruits:  "https://images.unsplash.com/photo-1502741126161-b048400d0853?auto=format&w=800&q=80",
  sports:  "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&w=800&q=80",
  objects: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?auto=format&w=800&q=80",
  animals: "https://images.unsplash.com/photo-1511203466129-824e631920d4?auto=format&w=800&q=80"
};

export default async function handler(req, res) {
  try {
    const { category = "fruits", n = 10 } = req.query;
    if (!WORDS[category]) return res.status(400).json({ ok:false, error:"INVALID_CATEGORY" });

    const count = Math.min(parseInt(n, 10) || 10, 20);
    const words = pickN(WORDS[category], count);

    const items = await Promise.all(words.map(async (word) => {
      let img = null;
      try { img = await fetchImageForWord(word, category); } catch {}
      return {
        word,
        shown: "_" + word.slice(1),
        img: img || FALLBACK[category] || `https://via.placeholder.com/300x300?text=${encodeURIComponent(word)}`,
        choices: genChoices(word)
      };
    }));

    // ▶ 캐시 방지 헤더(선택): 클라/프록시가 응답을 오래 캐싱하지 않도록
    res.setHeader('Cache-Control', 'no-store');

    res.status(200).json({ ok:true, category, count: items.length, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:String(e) });
  }
}
