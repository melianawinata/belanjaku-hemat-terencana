import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BelanjaKu — Belanja Bulanan Jadi Hemat, Terencana & Nggak Ada yang Kelupaan" },
      { name: "description", content: "BelanjaKu menggabungkan daftar belanja pintar, histori harga, estimasi total, manajemen stok, dan kontrol budget dalam satu aplikasi sederhana untuk rumah tangga Indonesia." },
      { property: "og:title", content: "BelanjaKu — Belanja Bulanan Pintar" },
      { property: "og:description", content: "Belanja bulanan jadi hemat, terencana, dan nggak ada yang kelupaan." },
    ],
  }),
  component: Index,
});

const STYLE = `
  /* ============ DESIGN TOKENS ============ */
  :root{
    --green:#1E9E6A; --green-dark:#127A50;
    --blue:#2563EB; --blue-light:#60A5FA;
    --white:#FFFFFF; --bg-soft:#F6FAF8;
    --ink:#14201B; --muted:#5B6B63;
    --border:#E4EFE9;
    --radius:18px; --radius-sm:14px;
    --shadow-sm:0 2px 8px rgba(18,122,80,.06);
    --shadow:0 10px 30px rgba(18,122,80,.10);
    --shadow-lg:0 24px 60px rgba(18,122,80,.16);
    --grad:linear-gradient(135deg,var(--green) 0%,var(--blue) 100%);
    --grad-soft:linear-gradient(135deg,#E8F5EF 0%,#E6EEFE 100%);
    --maxw:1180px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;scroll-padding-top:84px}
  body{font-family:'Inter',sans-serif;color:var(--ink);background:var(--white);line-height:1.65;-webkit-font-smoothing:antialiased}
  h1,h2,h3,h4{font-family:'Plus Jakarta Sans',sans-serif;line-height:1.2;color:var(--ink)}
  h1{font-size:clamp(2rem,5vw,3.4rem);font-weight:800;letter-spacing:-.02em}
  h2{font-size:clamp(1.6rem,3.5vw,2.5rem);font-weight:800;letter-spacing:-.01em}
  h3{font-size:1.25rem;font-weight:700}
  p{color:var(--muted)}
  a{color:inherit;text-decoration:none}
  img{max-width:100%;display:block}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 20px}
  section{padding:80px 0}
  .alt{background:var(--bg-soft)}
  .eyebrow{display:inline-block;font-family:'Plus Jakarta Sans';font-weight:700;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--green);background:#E8F5EF;padding:6px 14px;border-radius:999px;margin-bottom:16px}
  .sec-head{max-width:680px;margin:0 auto 50px;text-align:center}
  .sec-head p{margin-top:14px;font-size:1.05rem}
  .grad-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}

  /* ============ BUTTONS ============ */
  .btn{display:inline-flex;align-items:center;gap:9px;font-family:'Plus Jakarta Sans';font-weight:700;font-size:1rem;padding:14px 26px;border-radius:14px;border:none;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,background .2s ease;min-height:48px}
  .btn-primary{background:var(--grad);color:#fff;box-shadow:var(--shadow)}
  .btn-primary:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
  .btn-ghost{background:#fff;color:var(--green-dark);border:1.5px solid var(--border)}
  .btn-ghost:hover{transform:translateY(-2px);border-color:var(--green);box-shadow:var(--shadow-sm)}
  .btn-white{background:#fff;color:var(--green-dark)}
  .btn-white:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
  .btn-outline-white{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.6)}
  .btn-outline-white:hover{background:rgba(255,255,255,.12)}
  a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--blue-light);outline-offset:3px;border-radius:6px}

  /* ============ NAVBAR ============ */
  header.nav{position:fixed;top:0;left:0;right:0;z-index:100;transition:background .3s,box-shadow .3s,padding .3s;padding:16px 0}
  header.nav.scrolled{background:rgba(255,255,255,.92);backdrop-filter:blur(12px);box-shadow:0 2px 18px rgba(18,122,80,.08);padding:10px 0}
  .nav-inner{display:flex;align-items:center;justify-content:space-between;gap:20px}
  .logo{display:flex;align-items:center;gap:10px;font-family:'Plus Jakarta Sans';font-weight:800;font-size:1.3rem}
  .logo .mark{width:38px;height:38px;border-radius:11px;background:var(--grad);display:grid;place-items:center;box-shadow:var(--shadow-sm)}
  .nav-links{display:flex;align-items:center;gap:26px;list-style:none}
  .nav-links a{font-family:'Plus Jakarta Sans';font-weight:600;font-size:.95rem;color:var(--ink);transition:color .2s}
  .nav-links a:hover{color:var(--green)}
  .nav-cta{display:flex;align-items:center;gap:14px}
  .nav-cta .login{font-family:'Plus Jakarta Sans';font-weight:700;color:var(--ink)}
  .nav-cta .login:hover{color:var(--green)}
  .hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:8px}
  .hamburger span{width:24px;height:2.5px;background:var(--ink);border-radius:3px;transition:.3s}
  .hamburger.open span:nth-child(1){transform:translateY(7.5px) rotate(45deg)}
  .hamburger.open span:nth-child(2){opacity:0}
  .hamburger.open span:nth-child(3){transform:translateY(-7.5px) rotate(-45deg)}
  .mobile-menu{position:fixed;top:0;right:-100%;width:78%;max-width:320px;height:100vh;background:#fff;z-index:99;box-shadow:-10px 0 40px rgba(0,0,0,.12);padding:90px 28px 28px;transition:right .35s ease;display:flex;flex-direction:column;gap:8px}
  .mobile-menu.open{right:0}
  .mobile-menu a{font-family:'Plus Jakarta Sans';font-weight:600;font-size:1.05rem;padding:13px 0;border-bottom:1px solid var(--border)}
  .mobile-menu .btn{margin-top:16px;justify-content:center}
  .overlay{position:fixed;inset:0;background:rgba(20,32,27,.45);z-index:98;opacity:0;visibility:hidden;transition:.3s}
  .overlay.open{opacity:1;visibility:visible}

  /* ============ HERO ============ */
  .hero{position:relative;padding:140px 0 80px;overflow:hidden;background:var(--grad-soft)}
  .hero .blob{position:absolute;border-radius:50%;filter:blur(50px);opacity:.5;z-index:0}
  .hero .b1{width:380px;height:380px;background:#7FE3B6;top:-90px;right:-60px}
  .hero .b2{width:320px;height:320px;background:#9DC0FF;bottom:-100px;left:-80px}
  .hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.05fr 1fr;gap:50px;align-items:center}
  .hero-grid p.sub{font-size:1.12rem;margin:20px 0 28px;max-width:520px}
  .hero-cta{display:flex;flex-wrap:wrap;gap:14px}
  .trust{display:flex;flex-wrap:wrap;gap:18px;margin-top:28px}
  .trust span{display:flex;align-items:center;gap:7px;font-size:.88rem;font-weight:600;color:var(--green-dark)}
  .trust svg{flex:none}

  /* ============ BROWSER MOCKUP ============ */
  .browser{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;border:1px solid var(--border)}
  .browser-bar{display:flex;align-items:center;gap:8px;padding:11px 14px;background:#F1F6F3;border-bottom:1px solid var(--border)}
  .dot{width:11px;height:11px;border-radius:50%}
  .dot.r{background:#FF6058}.dot.y{background:#FFBD2E}.dot.g{background:#28C840}
  .url{flex:1;margin-left:10px;background:#fff;border-radius:8px;padding:5px 12px;font-size:.78rem;color:var(--muted);border:1px solid var(--border);font-family:'Inter'}
  .browser-body{padding:18px}

  /* dashboard mock */
  .dash-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  .dash-head h4{font-size:1.05rem}
  .pill{font-size:.72rem;font-weight:700;color:var(--green-dark);background:#E8F5EF;padding:4px 10px;border-radius:999px}
  .litem{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px dashed var(--border)}
  .chk{width:20px;height:20px;border-radius:6px;border:2px solid var(--border);flex:none;display:grid;place-items:center}
  .chk.on{background:var(--green);border-color:var(--green)}
  .litem .nm{flex:1;font-size:.92rem;font-weight:500;color:var(--ink)}
  .litem.done .nm{text-decoration:line-through;color:var(--muted)}
  .litem .pr{font-size:.85rem;font-weight:600;color:var(--muted)}
  .total{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:14px;border-radius:12px;background:var(--grad-soft)}
  .total .lbl{font-size:.82rem;color:var(--muted)}
  .total .amt{font-family:'Plus Jakarta Sans';font-weight:800;font-size:1.35rem;color:var(--green-dark)}

  /* ============ CARDS GRID ============ */
  .grid{display:grid;gap:24px}
  .g2{grid-template-columns:repeat(2,1fr)}
  .g3{grid-template-columns:repeat(3,1fr)}
  .card{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:26px;box-shadow:var(--shadow-sm);transition:transform .25s,box-shadow .25s}
  .card:hover{transform:translateY(-5px);box-shadow:var(--shadow)}
  .ic{width:52px;height:52px;border-radius:14px;background:var(--grad-soft);display:grid;place-items:center;margin-bottom:16px;color:var(--green-dark)}
  .card h3{margin-bottom:8px;font-size:1.12rem}
  .card p{font-size:.95rem}

  /* problem cards */
  .prob .ic{background:#FDECEC;color:#D64545}

  /* ============ ZIGZAG FEATURES ============ */
  .feat{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center;margin-bottom:80px}
  .feat:last-child{margin-bottom:0}
  .feat.rev .feat-txt{order:2}
  .feat-num{font-family:'Plus Jakarta Sans';font-weight:800;font-size:.85rem;color:var(--blue);letter-spacing:.06em;margin-bottom:8px}
  .feat-txt h3{font-size:1.6rem;margin-bottom:16px}
  .feat ul{list-style:none;margin:16px 0}
  .feat ul li{display:flex;gap:11px;padding:7px 0;font-size:.96rem;color:var(--ink)}
  .feat ul li svg{flex:none;color:var(--green);margin-top:3px}
  .value{display:inline-block;margin-top:10px;font-style:italic;font-weight:600;color:var(--green-dark);background:#E8F5EF;padding:9px 16px;border-radius:12px;font-size:.92rem}

  /* mini mocks */
  .mock-row{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-radius:11px;background:#F6FAF8;margin-bottom:9px;font-size:.88rem}
  .mock-row .tag{font-weight:600;color:var(--ink)}
  .trend-up{color:#D64545;font-weight:700}.trend-down{color:var(--green);font-weight:700}
  .bar-track{height:9px;border-radius:6px;background:#EAF2EE;overflow:hidden;margin-top:5px}
  .bar-fill{height:100%;border-radius:6px;background:var(--grad)}

  /* donut */
  .donut-wrap{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
  .legend{display:flex;flex-direction:column;gap:9px;font-size:.85rem}
  .legend div{display:flex;align-items:center;gap:8px;color:var(--ink);font-weight:500}
  .swatch{width:12px;height:12px;border-radius:4px}

  /* ============ STEPPER ============ */
  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
  .step{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:30px 24px;text-align:center;box-shadow:var(--shadow-sm);position:relative;transition:transform .25s,box-shadow .25s}
  .step:hover{transform:translateY(-5px);box-shadow:var(--shadow)}
  .step .no{width:48px;height:48px;border-radius:50%;background:var(--grad);color:#fff;font-family:'Plus Jakarta Sans';font-weight:800;font-size:1.2rem;display:grid;place-items:center;margin:0 auto 18px}
  .step h3{font-size:1.15rem;margin-bottom:10px}
  .step p{font-size:.93rem}
  .step .sic{margin:0 auto 14px;color:var(--green-dark)}

  /* ============ SCREENSHOT GALLERY ============ */
  .shots{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}
  .shot .cap{margin-top:14px;text-align:center}
  .shot .cap h4{font-size:1.02rem;margin-bottom:3px}
  .shot .cap p{font-size:.88rem}

  /* ============ PRICING ============ */
  .toggle-wrap{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:40px}
  .toggle-wrap span{font-family:'Plus Jakarta Sans';font-weight:700;font-size:.95rem;color:var(--muted);transition:color .2s}
  .toggle-wrap span.active{color:var(--ink)}
  .switch{position:relative;width:56px;height:30px;background:var(--green);border-radius:999px;cursor:pointer;border:none;transition:background .2s}
  .switch .knob{position:absolute;top:3px;left:3px;width:24px;height:24px;background:#fff;border-radius:50%;transition:left .25s;box-shadow:0 2px 5px rgba(0,0,0,.2)}
  .switch.year .knob{left:29px}
  .save-badge{font-size:.75rem;font-weight:700;color:var(--blue);background:#E6EEFE;padding:3px 9px;border-radius:999px}
  .price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;align-items:start}
  .plan{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:30px 26px;box-shadow:var(--shadow-sm);transition:transform .25s,box-shadow .25s;position:relative}
  .plan:hover{transform:translateY(-5px);box-shadow:var(--shadow)}
  .plan.pop{border:2px solid var(--green);box-shadow:var(--shadow);transform:scale(1.03)}
  .plan.pop:hover{transform:scale(1.03) translateY(-5px)}
  .pop-tag{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--grad);color:#fff;font-family:'Plus Jakarta Sans';font-weight:700;font-size:.75rem;padding:5px 16px;border-radius:999px;white-space:nowrap}
  .plan h3{font-size:1.25rem;margin-bottom:6px}
  .plan .desc{font-size:.85rem;min-height:38px}
  .plan .price{font-family:'Plus Jakarta Sans';font-weight:800;font-size:2.2rem;margin:14px 0 2px}
  .plan .price small{font-size:.95rem;font-weight:600;color:var(--muted)}
  .plan .per{font-size:.82rem;color:var(--muted);margin-bottom:20px}
  .plan ul{list-style:none;margin-bottom:24px}
  .plan ul li{display:flex;gap:10px;padding:7px 0;font-size:.9rem;color:var(--ink)}
  .plan ul li svg{flex:none;color:var(--green);margin-top:3px}
  .plan .btn{width:100%;justify-content:center}
  .note{text-align:center;margin-top:24px;font-size:.88rem}

  /* ============ FAQ ============ */
  .faq-list{max-width:760px;margin:0 auto}
  .faq-item{background:#fff;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:14px;overflow:hidden;transition:box-shadow .2s}
  .faq-item:hover{box-shadow:var(--shadow-sm)}
  .faq-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;cursor:pointer;text-align:left;font-family:'Plus Jakarta Sans';font-weight:700;font-size:1.02rem;color:var(--ink)}
  .faq-q .chev{flex:none;transition:transform .3s;color:var(--green)}
  .faq-item.open .chev{transform:rotate(180deg)}
  .faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease}
  .faq-a p{padding:0 22px 20px;font-size:.95rem}

  /* ============ FINAL CTA ============ */
  .final{background:var(--grad);border-radius:28px;padding:60px 40px;text-align:center;color:#fff;position:relative;overflow:hidden}
  .final h2{color:#fff}
  .final p{color:rgba(255,255,255,.9);max-width:520px;margin:14px auto 28px;font-size:1.05rem}
  .final .hero-cta{justify-content:center}
  .final .note{color:rgba(255,255,255,.85);margin-top:20px}
  .final .deco{position:absolute;border-radius:50%;background:rgba(255,255,255,.12)}
  .final .d1{width:200px;height:200px;top:-70px;left:-50px}
  .final .d2{width:260px;height:260px;bottom:-110px;right:-70px}

  /* ============ FOOTER ============ */
  footer{background:#0E1A15;color:#C7D4CD;padding:60px 0 26px}
  .foot-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:36px;margin-bottom:40px}
  footer .logo{color:#fff;margin-bottom:14px}
  footer .tagline{font-size:.92rem;color:#9DB0A7;max-width:280px}
  footer h4{color:#fff;font-size:1rem;margin-bottom:16px}
  footer ul{list-style:none}
  footer ul li{margin-bottom:10px}
  footer ul li a{font-size:.92rem;color:#9DB0A7;transition:color .2s}
  footer ul li a:hover{color:var(--green-light,#7FE3B6);color:#7FE3B6}
  .foot-bottom{border-top:1px solid rgba(255,255,255,.1);padding-top:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
  .foot-bottom p{font-size:.85rem;color:#9DB0A7}
  .socials{display:flex;gap:12px}
  .socials a{width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.08);display:grid;place-items:center;color:#C7D4CD;transition:.2s}
  .socials a:hover{background:var(--green);color:#fff;transform:translateY(-2px)}

  /* ============ SCROLL REVEAL ============ */
  .reveal{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease}
  .reveal.show{opacity:1;transform:none}

  /* ============ RESPONSIVE ============ */
  @media(max-width:900px){
    .nav-links,.nav-cta .login,.nav-cta .btn{display:none}
    .hamburger{display:flex}
    .hero-grid{grid-template-columns:1fr;gap:40px}
    .hero-grid .hero-visual{order:-1}
    .feat{grid-template-columns:1fr;gap:30px;margin-bottom:56px}
    .feat.rev .feat-txt{order:0}
    .g3,.steps,.price-grid{grid-template-columns:1fr}
    .shots{grid-template-columns:1fr}
    .plan.pop{transform:none}
    .plan.pop:hover{transform:translateY(-5px)}
    .foot-grid{grid-template-columns:1fr 1fr;gap:30px}
  }
  @media(max-width:560px){
    section{padding:56px 0}
    .g2{grid-template-columns:1fr}
    .foot-grid{grid-template-columns:1fr}
    .final{padding:44px 24px}
    .hero{padding:120px 0 60px}
    .hero-cta .btn{width:100%;justify-content:center}
  }
`;
const BODY = `

<!-- ============ NAVBAR ============ -->
<header class="nav" id="navbar">
  <div class="wrap nav-inner">
    <a href="#hero" class="logo" aria-label="BelanjaKu beranda">
      <span class="mark" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2C7 6 6 9 6 12a6 6 0 0 0 12 0c0-3-1-6-5-10z"/><path d="M11 22V12"/></svg>
      </span>
      BelanjaKu
    </a>
    <nav aria-label="Navigasi utama">
      <ul class="nav-links">
        <li><a href="#masalah">Masalah</a></li>
        <li><a href="#solusi">Solusi</a></li>
        <li><a href="#fitur">Fitur</a></li>
        <li><a href="#cara-kerja">Cara Kerja</a></li>
        <li><a href="#harga">Harga</a></li>
        <li><a href="#faq">FAQ</a></li>
      </ul>
    </nav>
    <div class="nav-cta">
      <a href="#" class="login">Masuk</a>
      <a href="#harga" class="btn btn-primary">Coba Gratis</a>
    </div>
    <button class="hamburger" id="hamburger" aria-label="Buka menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

<!-- Mobile menu -->
<div class="overlay" id="overlay"></div>
<nav class="mobile-menu" id="mobileMenu" aria-label="Navigasi mobile">
  <a href="#masalah">Masalah</a>
  <a href="#solusi">Solusi</a>
  <a href="#fitur">Fitur</a>
  <a href="#cara-kerja">Cara Kerja</a>
  <a href="#harga">Harga</a>
  <a href="#faq">FAQ</a>
  <a href="#" class="login" style="color:var(--green-dark)">Masuk</a>
  <a href="#harga" class="btn btn-primary">Coba Gratis</a>
</nav>

<!-- ============ HERO ============ -->
<section class="hero" id="hero">
  <div class="blob b1" aria-hidden="true"></div>
  <div class="blob b2" aria-hidden="true"></div>
  <div class="wrap hero-grid">
    <div class="hero-txt reveal">
      <span class="eyebrow">Belanja Bulanan Pintar</span>
      <h1>Belanja bulanan, kini lebih <span class="grad-text">hemat</span> dan <span class="grad-text">terencana</span>.</h1>
      <p class="sub">BelanjaKu menggabungkan daftar belanja pintar, histori harga, dan kontrol budget — supaya kamu nggak lagi lupa kebutuhan rumah atau kaget lihat total di kasir.</p>
      <div class="hero-cta">
        <a href="#harga" class="btn btn-primary">Coba Gratis Sekarang
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="#cara-kerja" class="btn btn-ghost">Lihat Cara Kerja</a>
      </div>
      <div class="trust">
        <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Gratis untuk fitur inti</span>
        <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Bisa dipakai offline</span>
        <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Data terenkripsi</span>
      </div>
    </div>
    <!-- Hero visual: dashboard mockup dalam frame browser -->
    <div class="hero-visual reveal">
      <div class="browser" role="img" aria-label="Mockup dashboard BelanjaKu menampilkan daftar belanja dan estimasi total">
        <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/daftar</span></div>
        <div class="browser-body">
          <div class="dash-head"><h4>Belanja Awal Bulan</h4><span class="pill">12 item</span></div>
          <div class="litem done"><span class="chk on"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="nm">Beras 5kg</span><span class="pr">Rp 68.000</span></div>
          <div class="litem done"><span class="chk on"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="nm">Minyak Goreng 2L</span><span class="pr">Rp 38.000</span></div>
          <div class="litem"><span class="chk"></span><span class="nm">Telur 1kg</span><span class="pr">Rp 28.000</span></div>
          <div class="litem"><span class="chk"></span><span class="nm">Sabun Cuci</span><span class="pr">Rp 22.000</span></div>
          <div class="litem"><span class="chk"></span><span class="nm">Kopi Sachet</span><span class="pr">Rp 15.500</span></div>
          <div class="total"><span class="lbl">Estimasi total belanja</span><span class="amt">Rp 171.500</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ MASALAH ============ -->
<section id="masalah" class="alt">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Masalah</span>
      <h2>Belanja bulanan sering bikin pusing, kan?</h2>
      <p>Catatan tercecer di chat, harga lupa, total di kasir bikin kaget — kami paham banget rasanya.</p>
    </div>
    <div class="grid g3 prob">
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
        <h3>Sering lupa barang</h3>
        <p>Sudah sampai rumah baru sadar ada kebutuhan penting yang belum kebeli.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg></div>
        <h3>Lupa harga bulan lalu</h3>
        <p>Nggak ingat harga barang sebelumnya, jadi susah membandingkan naik atau turun.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <h3>Total tak terduga</h3>
        <p>Nggak tahu perkiraan total sebelum ke toko, sering kaget pas di kasir.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v6h-6"/></svg></div>
        <h3>Pengeluaran membengkak</h3>
        <p>Belanja tanpa kontrol bikin budget bulanan jebol tanpa terasa.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg></div>
        <h3>Stok habis mendadak</h3>
        <p>Barang penting tiba-tiba habis padahal baru saja terasa masih ada.</p>
      </div>
      <div class="card reveal" style="display:flex;flex-direction:column;justify-content:center;background:var(--grad-soft);border:none">
        <h3 style="margin-bottom:6px">Saatnya berubah ✨</h3>
        <p style="color:var(--green-dark);font-weight:600">BelanjaKu hadir untuk menyelesaikan semua ini dalam satu aplikasi.</p>
      </div>
    </div>
    <!-- Visual: ilustrasi catatan tercecer / struk menumpuk -->
    <p style="display:none"><!-- GANTI: aset asli ilustrasi catatan belanja tercecer & struk menumpuk --></p>
  </div>
</section>

<!-- ============ SOLUSI ============ -->
<section id="solusi">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Solusi</span>
      <h2>BelanjaKu rapikan semuanya jadi <span class="grad-text">satu</span>.</h2>
      <p>Lima kapabilitas inti digabung dalam satu aplikasi sederhana — dari merencanakan, belanja, hingga memantau stok dan budget.</p>
    </div>
    <div class="hero-grid" style="align-items:center">
      <div class="grid reveal" style="gap:14px">
        <div class="card" style="display:flex;gap:14px;align-items:flex-start;padding:18px">
          <div class="ic" style="margin:0;width:44px;height:44px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
          <div><h3 style="font-size:1.05rem">Daftar belanja pintar</h3><p style="font-size:.9rem">Ingat item favorit & pembelian rutin otomatis.</p></div>
        </div>
        <div class="card" style="display:flex;gap:14px;align-items:flex-start;padding:18px">
          <div class="ic" style="margin:0;width:44px;height:44px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div>
          <div><h3 style="font-size:1.05rem">Histori harga</h3><p style="font-size:.9rem">Catat harga terakhir dan lihat tren naik/turun.</p></div>
        </div>
        <div class="card" style="display:flex;gap:14px;align-items:flex-start;padding:18px">
          <div class="ic" style="margin:0;width:44px;height:44px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h5"/></svg></div>
          <div><h3 style="font-size:1.05rem">Estimasi total belanja</h3><p style="font-size:.9rem">Tahu perkiraan biaya sebelum ke kasir.</p></div>
        </div>
        <div class="card" style="display:flex;gap:14px;align-items:flex-start;padding:18px">
          <div class="ic" style="margin:0;width:44px;height:44px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1z"/><path d="M10 12h4"/></svg></div>
          <div><h3 style="font-size:1.05rem">Manajemen stok rumah</h3><p style="font-size:.9rem">Pengingat otomatis saat stok menipis.</p></div>
        </div>
        <div class="card" style="display:flex;gap:14px;align-items:flex-start;padding:18px">
          <div class="ic" style="margin:0;width:44px;height:44px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
          <div><h3 style="font-size:1.05rem">Kontrol budget</h3><p style="font-size:.9rem">Bandingkan estimasi vs realisasi tiap bulan.</p></div>
        </div>
      </div>
      <div class="reveal">
        <!-- Visual solusi: before vs after -->
        <img src="https://placehold.co/800x680/E8F5EF/127A50?text=Sebelum+%E2%86%92+Sesudah%0ABelanjaKu" alt="Ilustrasi perbandingan belanja berantakan sebelum dan rapi sesudah memakai BelanjaKu" style="border-radius:var(--radius);box-shadow:var(--shadow)" />
        <!-- GANTI: aset asli komposisi before/after atau laptop & smartphone menampilkan aplikasi rapi -->
      </div>
    </div>
  </div>
</section>

<!-- ============ FITUR UTAMA (ZIGZAG) ============ -->
<section id="fitur" class="alt">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Fitur Utama</span>
      <h2>Semua yang kamu butuh untuk belanja cerdas</h2>
      <p>Lima fitur inti yang saling terhubung untuk pengalaman belanja bulanan paling rapi.</p>
    </div>

    <!-- 5.1 Daftar Belanja Pintar -->
    <div class="feat">
      <div class="feat-txt reveal">
        <div class="feat-num">FITUR 01</div>
        <h3>Daftar Belanja Pintar</h3>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Tambah item cepat: nama, kategori, jumlah</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Saran item dari belanja sebelumnya</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Template bulanan seperti “Belanja Awal Bulan”</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Tandai item yang sudah dibeli</li>
        </ul>
        <span class="value">Mengurangi lupa & mempercepat pembuatan daftar.</span>
      </div>
      <div class="reveal">
        <div class="browser" role="img" aria-label="Mockup fitur daftar belanja pintar">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/daftar</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Daftar Belanja</h4><span class="pill">+ Tambah item</span></div>
            <div class="litem"><span class="chk"></span><span class="nm">Gula Pasir 1kg</span><span class="pr">Dapur</span></div>
            <div class="litem done"><span class="chk on"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="nm">Susu UHT 1L</span><span class="pr">Dapur</span></div>
            <div class="litem"><span class="chk"></span><span class="nm">Pewangi Pakaian</span><span class="pr">Kebersihan</span></div>
            <div class="mock-row" style="margin-top:12px;background:var(--grad-soft)"><span class="tag">💡 Saran: Teh Celup (rutin)</span><span style="color:var(--green);font-weight:700">+ Tambah</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5.2 Histori Harga -->
    <div class="feat rev">
      <div class="feat-txt reveal">
        <div class="feat-num">FITUR 02</div>
        <h3>Histori Harga</h3>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Simpan harga terakhir tiap item</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Lihat perubahan harga dari bulan lalu</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Catatan tempat membeli</li>
        </ul>
        <span class="value">Tahu harga naik/turun & memperkirakan biaya.</span>
      </div>
      <div class="reveal">
        <div class="browser" role="img" aria-label="Mockup fitur histori harga dengan tren naik dan turun">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/histori</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Histori Harga</h4><span class="pill">Mei → Jun</span></div>
            <div class="mock-row"><span class="tag">Beras 5kg · Indomaret</span><span class="trend-up">Rp 68.000 ▲ 4%</span></div>
            <div class="mock-row"><span class="tag">Minyak 2L · Pasar</span><span class="trend-down">Rp 38.000 ▼ 6%</span></div>
            <div class="mock-row"><span class="tag">Telur 1kg · Toko Bu Ani</span><span class="trend-up">Rp 28.000 ▲ 2%</span></div>
            <div class="mock-row"><span class="tag">Gula 1kg · Supermarket</span><span class="trend-down">Rp 16.500 ▼ 3%</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5.3 Estimasi Total -->
    <div class="feat">
      <div class="feat-txt reveal">
        <div class="feat-num">FITUR 03</div>
        <h3>Estimasi Total Belanja</h3>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Hitung total otomatis dari histori harga</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Subtotal per kategori (dapur, kebersihan, dll)</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Peringatan jika melebihi budget</li>
        </ul>
        <span class="value">Tahu pengeluaran sebelum ke kasir.</span>
      </div>
      <div class="reveal">
        <div class="browser" role="img" aria-label="Mockup fitur estimasi total belanja per kategori">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/estimasi</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Estimasi per Kategori</h4></div>
            <div style="margin-bottom:12px"><div class="mock-row" style="margin-bottom:4px"><span class="tag">Dapur</span><span style="font-weight:700;color:var(--green-dark)">Rp 112.000</span></div><div class="bar-track"><div class="bar-fill" style="width:72%"></div></div></div>
            <div style="margin-bottom:12px"><div class="mock-row" style="margin-bottom:4px"><span class="tag">Kebersihan</span><span style="font-weight:700;color:var(--green-dark)">Rp 44.000</span></div><div class="bar-track"><div class="bar-fill" style="width:32%"></div></div></div>
            <div style="margin-bottom:8px"><div class="mock-row" style="margin-bottom:4px"><span class="tag">Lainnya</span><span style="font-weight:700;color:var(--green-dark)">Rp 15.500</span></div><div class="bar-track"><div class="bar-fill" style="width:14%"></div></div></div>
            <div class="total"><span class="lbl">Total estimasi</span><span class="amt">Rp 171.500</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5.4 Manajemen Stok -->
    <div class="feat rev">
      <div class="feat-txt reveal">
        <div class="feat-num">FITUR 04</div>
        <h3>Manajemen Stok Rumah</h3>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Catat stok setelah belanja</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Kurangi stok manual atau otomatis</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pengingat “stok hampir habis”</li>
        </ul>
        <span class="value">Kurangi kehabisan barang penting & pembelian berlebih.</span>
      </div>
      <div class="reveal">
        <div class="browser" role="img" aria-label="Mockup fitur manajemen stok rumah dengan pengingat stok menipis">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/stok</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Stok Rumah</h4><span class="pill">2 menipis</span></div>
            <div class="mock-row"><span class="tag">Beras</span><span style="color:var(--green);font-weight:700">Cukup · 4kg</span></div>
            <div class="mock-row"><span class="tag">Minyak Goreng</span><span style="color:#E0A100;font-weight:700">Sedang · 0,5L</span></div>
            <div class="mock-row" style="background:#FDECEC"><span class="tag">Sabun Cuci</span><span style="color:#D64545;font-weight:700">Hampir habis ⚠</span></div>
            <div class="mock-row" style="background:#FDECEC"><span class="tag">Kopi Sachet</span><span style="color:#D64545;font-weight:700">Hampir habis ⚠</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5.5 Kontrol Budget & Laporan -->
    <div class="feat">
      <div class="feat-txt reveal">
        <div class="feat-num">FITUR 05</div>
        <h3>Kontrol Budget &amp; Laporan</h3>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Tetapkan budget bulanan</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Bandingkan estimasi vs realisasi</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Grafik pengeluaran per kategori & per bulan</li>
        </ul>
        <span class="value">Kontrol pengeluaran & lihat pola belanja.</span>
      </div>
      <div class="reveal">
        <div class="browser" role="img" aria-label="Mockup fitur kontrol budget dengan grafik donat pengeluaran per kategori">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/budget</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Budget Juni</h4><span class="pill">68% terpakai</span></div>
            <div class="donut-wrap">
              <svg width="130" height="130" viewBox="0 0 42 42" aria-hidden="true">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#EAF2EE" stroke-width="6"/>
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#1E9E6A" stroke-width="6" stroke-dasharray="45 55" stroke-dashoffset="25"/>
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#2563EB" stroke-width="6" stroke-dasharray="28 72" stroke-dashoffset="-20"/>
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#60A5FA" stroke-width="6" stroke-dasharray="15 85" stroke-dashoffset="-48"/>
                <text x="21" y="20" text-anchor="middle" font-size="5" font-weight="700" fill="#14201B" font-family="Plus Jakarta Sans">Rp 1,2jt</text>
                <text x="21" y="26" text-anchor="middle" font-size="3" fill="#5B6B63" font-family="Inter">dari 1,8jt</text>
              </svg>
              <div class="legend">
                <div><span class="swatch" style="background:#1E9E6A"></span>Dapur — 45%</div>
                <div><span class="swatch" style="background:#2563EB"></span>Kebersihan — 28%</div>
                <div><span class="swatch" style="background:#60A5FA"></span>Lainnya — 15%</div>
                <div><span class="swatch" style="background:#EAF2EE"></span>Sisa budget — 12%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ CARA KERJA ============ -->
<section id="cara-kerja">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Cara Kerja</span>
      <h2>Cuma 3 langkah, belanja langsung terencana.</h2>
      <p>Dari membuat daftar hingga memantau budget — semuanya cepat dan intuitif.</p>
    </div>
    <div class="steps">
      <div class="step reveal">
        <div class="no">1</div>
        <div class="sic"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
        <h3>Buat daftar</h3>
        <p>Tambah item atau pilih dari histori/template, lalu lihat estimasi total otomatis.</p>
      </div>
      <div class="step reveal">
        <div class="no">2</div>
        <div class="sic"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="18" cy="21" r="1.5"/><path d="M2.5 3h2l2.6 13.4a1.5 1.5 0 0 0 1.5 1.1h9.3a1.5 1.5 0 0 0 1.5-1.2L21.5 7H6"/></svg></div>
        <h3>Belanja di toko</h3>
        <p>Tandai item yang sudah diambil, edit harga aktual bila berbeda, pantau total sementara.</p>
      </div>
      <div class="step reveal">
        <div class="no">3</div>
        <div class="sic"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div>
        <h3>Pantau stok &amp; budget</h3>
        <p>Lihat sisa budget & stok menipis di dashboard, tambahkan ke daftar berikutnya langsung dari pengingat.</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ SCREENSHOT PRODUK ============ -->
<section class="alt">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Tampilan Produk</span>
      <h2>Sederhana, cepat, dan enak dipakai.</h2>
      <p>Antarmuka bersih yang dirancang untuk dipakai sehari-hari oleh seluruh anggota keluarga.</p>
    </div>
    <div class="shots">
      <div class="shot reveal">
        <div class="browser">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/daftar</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Daftar Belanja</h4><span class="pill">8 item</span></div>
            <div class="litem done"><span class="chk on"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="nm">Beras 5kg</span><span class="pr">Rp 68.000</span></div>
            <div class="litem"><span class="chk"></span><span class="nm">Telur 1kg</span><span class="pr">Rp 28.000</span></div>
            <div class="litem"><span class="chk"></span><span class="nm">Sabun Mandi</span><span class="pr">Rp 18.000</span></div>
          </div>
        </div>
        <div class="cap"><h4>Daftar Belanja</h4><p>Tambah & tandai item dengan sekali ketuk.</p></div>
      </div>
      <div class="shot reveal">
        <div class="browser">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/estimasi</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Estimasi per Kategori</h4></div>
            <div style="margin-bottom:10px"><div class="mock-row" style="margin-bottom:4px"><span class="tag">Dapur</span><span style="font-weight:700;color:var(--green-dark)">Rp 112.000</span></div><div class="bar-track"><div class="bar-fill" style="width:72%"></div></div></div>
            <div><div class="mock-row" style="margin-bottom:4px"><span class="tag">Kebersihan</span><span style="font-weight:700;color:var(--green-dark)">Rp 44.000</span></div><div class="bar-track"><div class="bar-fill" style="width:32%"></div></div></div>
          </div>
        </div>
        <div class="cap"><h4>Estimasi Total</h4><p>Subtotal per kategori sebelum ke kasir.</p></div>
      </div>
      <div class="shot reveal">
        <div class="browser">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/budget</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Dashboard Budget</h4><span class="pill">68%</span></div>
            <div class="donut-wrap">
              <svg width="100" height="100" viewBox="0 0 42 42" aria-hidden="true">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#EAF2EE" stroke-width="6"/>
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#1E9E6A" stroke-width="6" stroke-dasharray="45 55" stroke-dashoffset="25"/>
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#2563EB" stroke-width="6" stroke-dasharray="28 72" stroke-dashoffset="-20"/>
              </svg>
              <div class="legend"><div><span class="swatch" style="background:#1E9E6A"></span>Dapur</div><div><span class="swatch" style="background:#2563EB"></span>Kebersihan</div><div><span class="swatch" style="background:#EAF2EE"></span>Sisa</div></div>
            </div>
          </div>
        </div>
        <div class="cap"><h4>Dashboard Budget</h4><p>Grafik pengeluaran per kategori & bulan.</p></div>
      </div>
      <div class="shot reveal">
        <div class="browser">
          <div class="browser-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="url">app.belanjaku.id/stok</span></div>
          <div class="browser-body">
            <div class="dash-head"><h4>Stok Rumah</h4><span class="pill">2 menipis</span></div>
            <div class="mock-row"><span class="tag">Beras</span><span style="color:var(--green);font-weight:700">Cukup</span></div>
            <div class="mock-row" style="background:#FDECEC"><span class="tag">Sabun Cuci</span><span style="color:#D64545;font-weight:700">Hampir habis ⚠</span></div>
            <div class="mock-row"><span class="tag">Minyak</span><span style="color:#E0A100;font-weight:700">Sedang</span></div>
          </div>
        </div>
        <div class="cap"><h4>Stok Rumah</h4><p>Pantau persediaan & pengingat menipis.</p></div>
      </div>
    </div>
  </div>
</section>

<!-- ============ BENEFIT ============ -->
<section>
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Manfaat</span>
      <h2>Apa yang kamu dapat dengan BelanjaKu.</h2>
      <p>Hasil nyata yang dirasakan rumah tangga setelah belanja jadi lebih terencana.</p>
    </div>
    <div class="grid g3">
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
        <h3>Belanja lebih terencana</h3>
        <p>Semua kebutuhan tercatat rapi — tidak ada lagi yang kelupaan.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <h3>Pengeluaran terkendali</h3>
        <p>Kurangi overspending hingga lebih dari 20% tiap bulan.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
        <h3>Hindari beli ganda</h3>
        <p>Tak ada lagi pembelian ganda atau belanja impulsif yang sia-sia.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
        <h3>Estimasi akurat</h3>
        <p>Selisih estimasi vs realisasi kurang dari 10%.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg></div>
        <h3>Daftar dalam &lt;2 menit</h3>
        <p>Buat daftar belanja super cepat lewat template & saran otomatis.</p>
      </div>
      <div class="card reveal">
        <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg></div>
        <h3>Bisa dipakai offline</h3>
        <p>Daftar belanja inti tetap jalan walau tanpa koneksi internet.</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ HARGA ============ -->
<section id="harga" class="alt">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Harga</span>
      <h2>Mulai gratis, tingkatkan saat butuh lebih.</h2>
      <p>Pilih paket yang sesuai kebutuhan rumah tanggamu. Bisa berhenti kapan saja.</p>
    </div>
    <div class="toggle-wrap reveal">
      <span id="lblMonth" class="active">Bulanan</span>
      <button class="switch" id="switch" aria-label="Ganti periode harga" role="switch" aria-checked="false"><span class="knob"></span></button>
      <span id="lblYear">Tahunan</span>
      <span class="save-badge">Hemat 20%</span>
    </div>
    <div class="price-grid">
      <!-- Gratis -->
      <div class="plan reveal">
        <h3>Gratis</h3>
        <p class="desc">Cakupan MVP untuk mulai belanja terencana.</p>
        <div class="price">Rp 0</div>
        <div class="per">selamanya</div>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Daftar belanja pintar</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Histori harga sederhana</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Estimasi total belanja</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Kontrol budget dasar</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>1 perangkat</li>
        </ul>
        <a href="#" class="btn btn-ghost">Mulai Gratis</a>
      </div>
      <!-- Plus -->
      <div class="plan pop reveal">
        <span class="pop-tag">Paling Populer</span>
        <h3>Plus</h3>
        <p class="desc">Untuk rumah tangga yang ingin kontrol penuh.</p>
        <div class="price" data-month="Rp 19.000" data-year="Rp 15.200"><span data-price>Rp 19.000</span><small>/bln</small></div>
        <div class="per" data-permonth="ditagih bulanan" data-peryear="ditagih tahunan, hemat 20%">ditagih bulanan</div>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Semua fitur Gratis</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Manajemen stok rumah lengkap</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pengingat stok habis</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Laporan pengeluaran detail</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Sinkronisasi multi-perangkat</li>
        </ul>
        <a href="#" class="btn btn-primary">Pilih Plus</a>
      </div>
      <!-- Keluarga -->
      <div class="plan reveal">
        <h3>Keluarga</h3>
        <p class="desc">Kolaborasi seluruh anggota keluarga.</p>
        <div class="price" data-month="Rp 29.000" data-year="Rp 23.200"><span data-price>Rp 29.000</span><small>/bln</small></div>
        <div class="per" data-permonth="ditagih bulanan" data-peryear="ditagih tahunan, hemat 20%">ditagih bulanan</div>
        <ul>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Semua fitur Plus</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Kolaborasi real-time keluarga</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Prediksi stok berbasis AI</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Barcode scanner</li>
          <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Integrasi promo & perbandingan harga</li>
        </ul>
        <a href="#" class="btn btn-ghost">Pilih Keluarga</a>
      </div>
    </div>
    <p class="note">Bisa berhenti kapan saja, tanpa kontrak.</p>
  </div>
</section>

<!-- ============ FAQ ============ -->
<section id="faq">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">FAQ</span>
      <h2>Pertanyaan yang sering ditanyakan</h2>
      <p>Masih ragu? Mungkin jawabannya ada di sini.</p>
    </div>
    <div class="faq-list">
      <div class="faq-item reveal">
        <button class="faq-q" aria-expanded="false">Apakah BelanjaKu gratis?<span class="chev"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>
        <div class="faq-a"><p>Ya, fitur inti gratis selamanya. Paket berbayar tersedia untuk fitur lanjutan seperti manajemen stok lengkap, laporan detail, dan kolaborasi keluarga.</p></div>
      </div>
      <div class="faq-item reveal">
        <button class="faq-q" aria-expanded="false">Apakah bisa dipakai tanpa internet?<span class="chev"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>
        <div class="faq-a"><p>Bisa. Fitur daftar belanja inti berjalan offline, dan data akan tersinkron otomatis saat kamu kembali online.</p></div>
      </div>
      <div class="faq-item reveal">
        <button class="faq-q" aria-expanded="false">Apakah datanya aman?<span class="chev"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>
        <div class="faq-a"><p>Data kamu dienkripsi saat disimpan maupun dikirim, sehingga informasi belanja dan budget tetap privat dan aman.</p></div>
      </div>
      <div class="faq-item reveal">
        <button class="faq-q" aria-expanded="false">Apakah harganya otomatis dari toko?<span class="chev"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>
        <div class="faq-a"><p>Harga diisi dan diedit oleh pengguna, lalu disimpan sebagai histori. Estimasi total memakai harga terakhir yang kamu catat.</p></div>
      </div>
      <div class="faq-item reveal">
        <button class="faq-q" aria-expanded="false">Bisakah dipakai bersama pasangan/keluarga?<span class="chev"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>
        <div class="faq-a"><p>Bisa, lewat paket Keluarga dengan kolaborasi real-time. Seluruh anggota bisa mengedit daftar dan melihat budget yang sama.</p></div>
      </div>
      <div class="faq-item reveal">
        <button class="faq-q" aria-expanded="false">Apakah ada aplikasi mobile?<span class="chev"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>
        <div class="faq-a"><p>Tersedia versi web dan mobile, dan datanya tersinkron antar perangkat sehingga kamu bisa lanjut belanja di mana saja.</p></div>
      </div>
    </div>
  </div>
</section>

<!-- ============ FINAL CTA ============ -->
<section>
  <div class="wrap">
    <div class="final reveal">
      <div class="deco d1" aria-hidden="true"></div>
      <div class="deco d2" aria-hidden="true"></div>
      <h2>Siap belanja lebih hemat bulan ini?</h2>
      <p>Mulai rencanakan belanja bulananmu hari ini — gratis, cepat, dan tanpa ribet.</p>
      <div class="hero-cta">
        <a href="#" class="btn btn-white">Mulai Gratis Sekarang
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="#cara-kerja" class="btn btn-outline-white">Lihat Demo</a>
      </div>
      <p class="note">Tanpa kartu kredit · Setup kurang dari 2 menit.</p>
    </div>
  </div>
</section>

<!-- ============ FOOTER ============ -->
<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <div class="logo">
          <span class="mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2C7 6 6 9 6 12a6 6 0 0 0 12 0c0-3-1-6-5-10z"/><path d="M11 22V12"/></svg></span>
          BelanjaKu
        </div>
        <p class="tagline">Belanja bulanan jadi hemat, terencana, dan nggak ada yang kelupaan.</p>
      </div>
      <div>
        <h4>Produk</h4>
        <ul>
          <li><a href="#solusi">Solusi</a></li>
          <li><a href="#fitur">Fitur</a></li>
          <li><a href="#harga">Harga</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
      </div>
      <div>
        <h4>Perusahaan</h4>
        <ul>
          <li><a href="#">Tentang</a></li>
          <li><a href="#">Kontak</a></li>
          <li><a href="#">Karier</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="#">Kebijakan Privasi</a></li>
          <li><a href="#">Syarat &amp; Ketentuan</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <p>© 2026 BelanjaKu. Dibuat untuk rumah tangga Indonesia.</p>
      <div class="socials">
        <a href="#" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>
        <a href="#" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
        <a href="#" aria-label="X"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16M20 4L4 20"/></svg></a>
        <a href="#" aria-label="TikTok"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4c1 2 3 3 5 3"/></svg></a>
      </div>
    </div>
  </div>
</footer>

`;

function Index() {
  useEffect(() => {
    
  // ===== Navbar scroll state =====
  const navbar=document.getElementById('navbar');
  window.addEventListener('scroll',()=>{navbar.classList.toggle('scrolled',window.scrollY>20)});

  // ===== Mobile menu =====
  const hb=document.getElementById('hamburger'),mm=document.getElementById('mobileMenu'),ov=document.getElementById('overlay');
  function toggleMenu(open){hb.classList.toggle('open',open);mm.classList.toggle('open',open);ov.classList.toggle('open',open);hb.setAttribute('aria-expanded',open)}
  hb.addEventListener('click',()=>toggleMenu(!mm.classList.contains('open')));
  ov.addEventListener('click',()=>toggleMenu(false));
  mm.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>toggleMenu(false)));

  // ===== Scroll reveal =====
  const io=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('show');io.unobserve(e.target)}})},{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // ===== Pricing toggle =====
  const sw=document.getElementById('switch'),lblM=document.getElementById('lblMonth'),lblY=document.getElementById('lblYear');
  sw.addEventListener('click',()=>{
    const year=sw.classList.toggle('year');
    sw.setAttribute('aria-checked',year);
    lblM.classList.toggle('active',!year);lblY.classList.toggle('active',year);
    document.querySelectorAll('.plan .price[data-month]').forEach(p=>{
      p.querySelector('[data-price]').textContent=year?p.dataset.year:p.dataset.month;
    });
    document.querySelectorAll('.per[data-permonth]').forEach(pr=>{
      pr.textContent=year?pr.dataset.peryear:pr.dataset.permonth;
    });
  });

  // ===== FAQ accordion =====
  document.querySelectorAll('.faq-item').forEach(item=>{
    const q=item.querySelector('.faq-q'),a=item.querySelector('.faq-a');
    q.addEventListener('click',()=>{
      const open=item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(o=>{o.classList.remove('open');o.querySelector('.faq-a').style.maxHeight=null;o.querySelector('.faq-q').setAttribute('aria-expanded','false')});
      if(!open){item.classList.add('open');a.style.maxHeight=a.scrollHeight+'px';q.setAttribute('aria-expanded','true')}
    });
  });

  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
    </>
  );
}
