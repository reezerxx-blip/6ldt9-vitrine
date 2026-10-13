# AUDIT 6.LDT.9 (reviewer, 2026-10-14) — captures : shots/audit-*.jpg
Méthode : skill seo-page appliqué ; autres skills non rechargés (budget tokens) mais critères SEO/impeccable/taste appliqués à la main. Mesures JS getBoundingClientRect à 1280/768/375.

## Scores /100
SEO technique 38 · Contenu/schema 25 · Alignements 62 · Logos/titres 55 · Motion 78 · Perf 60 · **Global ~53**

## Constats mesurés
- Aucun <h1> (hero = img logo). H2 : 112px (1280), 69px (768), 48px (375) : hiérarchie OK sinon, « Veste / Softshell » forcé par <br>.
- Marges : .wrap = 16px gauche/droite à tous les formats (trop serré à 1280), mais logo header et logo hero = 32px (1280/768) ; globe hero et globe footer = 16px. 3 alignements gauche différents (16/32).
- Logo header : 144×23 (1280/768) mais 64×10 à 375 (illisible). Hero logo 720px/660px/323px. Globe hero 333/300/165, footer 132. Marque répétée 3 fois dans le 1er écran (header, globe, wordmark géant), le wordmark chevauche la moto/jambes (pas le visage).
- Mobile 375 : topbar fixe transparente, le contenu (swatches, globe) passe sous le nav sans fond : collision visible (audit-375-veste.jpg). Image gallery déborde -15/+390px (scale parallax), pas de scroll horizontal (sw=vw).
- Cibles : nav 44px OK, .more 44px OK, swatch 48px OK, .skip 42px, lightbox__x et thumbs hidden = 0 (normal). Focus-visible défini, prefers-reduced-motion présent.
- Eyebrow 12px #B9B5AD sur fond sombre : contraste ok (~9:1) mais corps 10px/12px trop petit (HUD « IMG 01 / 05 »).
- Aucun robots.txt, sitemap.xml, canonical, OG, Twitter, JSON-LD, manifest, apple-touch-icon ; favicon = logo-6ldt9.png 1781×281 (rectangle 25 Ko, illisible en 16px).
- Images : 31 JPEG de 70-350 Ko (total ~5,5 Mo), aucun WebP/AVIF, pas de srcset ; thumbs 120×200 affichées 56×88 (OK). Alt répétitifs (« vue porté » = faute, identique x7), noms de fichiers corrects. Hero bgfx 207 Ko 1410×2000 fetchpriority=high OK.
- Scripts : GSAP+ScrollTrigger+Lenis+Three r128 (~700 Ko, CDN tiers) sans defer ; Google Fonts (3 familles) bloquant ; preloader masque le LCP.
- Landmarks OK (header, nav, main, footer, skip). Prix en texte, pas d'achat : conforme vitrine.

## Correctifs priorisés
**P0**
1. rebuild.py (template head) : ajouter canonical placeholder, og:title/description/image/url/locale, twitter:card summary_large_image, apple-touch-icon, manifest. Créer og-image 1200×630.
2. rebuild.py (hero) : ajouter un vrai <h1> (visually-hidden ou visible « 6.LDT.9 — Streetwear moto, Lyon ») ; passer `.hero__logo` en alt="" si h1 présent ; ajouter une phrase d'accroche (hero__tag existe en CSS, non utilisé).
3. rebuild.py : JSON-LD @graph Organization/Brand + ClothingStore (Lyon, email, sameAs Instagram) + 3 Product sans « offers » (description, image, color, brand ; prix dans le texte).
4. Créer robots.txt et sitemap.xml (racine ; URL placeholder) + favicon carré 32/180/512 depuis logo-globe.png.
5. css/style.css `.topbar` : fond `rgb(18 18 20 / .72)` + backdrop-filter blur sous 768px (ou après scroll via classe en js/main.js) ; `.topbar__logo img` min-width 96px sur mobile (actuellement 64×10).
6. css/style.css : unifier la gouttière : `--gut: clamp(16px, 4vw, 48px)` pour .topbar, .wrap, .hero__in, .globe--hero, .footer__in, .look-track (aujourd'hui 16/32 mélangés).

**P1**
7. Convertir les 31 images en WebP/AVIF (<picture> ou srcset 480/900) dans rebuild.py (templates .gallery__main, .cag__grid, .look-track) ; cible <120 Ko, 5,5→~2 Mo.
8. Alt descriptifs et variés (« Veste softshell noir et rouge portée devant une moto de trial, Lyon »), corriger « vue porté » → « portée » dans catalog.json/rebuild.py.
9. Fonts : réduire à 2 familles (retirer JetBrains Mono ou sous-ensemble), `<link rel=preload>` du woff2 Barlow ; Three.js : charger globe.js en `defer` et seulement quand le globe est visible (IntersectionObserver) ; passer r128 → build module récent, ou auto-héberger les libs.
10. `<script defer>` sur gsap/lenis/three/globe/main (rebuild.py bas de page) ; preloader : durée max 1,2 s, ne pas masquer le hero au-delà du LCP.
11. Logos : fixer 3 tailles de référence (header 144, hero ≤ 55 % largeur, globe hero 240) ; supprimer la duplication (retirer le globe texte du hero OU le wordmark) ; vérifier que le wordmark ne passe jamais sur le casque (css `.hero__in`, `object-position` de .bgfx__img).
12. Titres : retirer les `<br>` dans h2 (rebuild.py) → `text-wrap: balance` sur `.display` ; ajouter `scroll-margin-top: 72px` aux sections (ancres cachées sous topbar fixe).
13. `.eyebrow`/HUD : min 12px, interlettrage mesuré ; `.skip` hauteur 44px.
14. Section « À propos » (3 lignes, ADN lyonnais, quais du Rhône) + zone contact lisible ; ajouter NAP complet (ville, pays) pour seo-local ; lien Google Maps si lieu public.

**P2**
15. `og:image` par produit, `meta theme-color` clair/sombre, `<meta name="color-scheme" content="dark">`.
16. CLS : width/height déjà posés (OK) ; réserver la hauteur des strips ; `contain-intrinsic-size` sur sections lazy.
17. Preconnect cdnjs/jsdelivr ; SRI + crossorigin sur CDN ; headers cache à la mise en prod.
18. llms.txt court, page 404.html, `hreflang` inutile (FR seul).
19. Lookbook : légendes (figcaption) pour texte indexable ; compteur 01–05 aria-live.
20. Curseur custom et marquee : respecter reduced-motion et pointer:coarse.

## Verdict « manque quoi pour 5000 € »
Direction artistique et motion déjà premium (cohérence rouge/bleu, scroll, globe). Il manque : 1) la couche technique de livraison (SEO/OG/schema/robots/sitemap/favicon/manifest) qui est à zéro ; 2) une grille et gouttière unique (16 vs 32 px) et un header mobile lisible ; 3) du contenu textuel (h1, accroche, à propos, légendes) : la page est quasi muette ; 4) la performance (5,5 Mo de JPEG, 700 Ko de libs tierces, polices bloquantes) ; 5) la cohérence des logos (une seule marque dominante par écran). Après P0+P1 : ~85/100.


## Tour 1 (fixer, 2026-10-14) - captures shots/fix1-{1280,768,375}-*.jpg
Fait (rebuild.py + css + main.js) :
- [x] P0-1 head : meta OG/Twitter, theme-color, color-scheme, icons, manifest ; canonical/og:url/og:image en commentaire TODO (domaine inconnu, placeholder DOMAINE-A-DEFINIR.example)
- [x] P0-2 h1 .sr-only « 6.LDT.9 : streetwear moto, Lyon » ; logo hero alt="" ; aucune accroche visible
- [x] P0-3 JSON-LD @graph Organization+ClothingStore (Lyon, sameAs Instagram) + 3 Product sans offers
- [x] P0-4 robots.txt, sitemap.xml (placeholder), site.webmanifest, favicon.ico/16/32, apple-touch-icon, icons 192/512, og-image.jpg 1200x630
- [x] P0-5 topbar : fond + blur sous 768 ; logo 180x28 a 375 (2 lignes : logo+Instagram / menu)
- [x] P0-6 gouttiere unique --gut/--edge : tout aligne a 48 (1280), 31 (768), 16 (375)
- [x] P1-7 images en WebP (5,8 Mo -> 3,2 Mo, thumbs 240px), width/height reels (pas de <picture>, pas necessaire)
- [x] P1-8 alt descriptifs uniques (« Veste softshell 6.LDT.9 noir et rouge, photo 2 sur 5, portee »)
- [x] P1-10 scripts defer ; preloader max 1,2 s
- [x] P1-12 <br> retires des h2 + text-wrap balance/pretty ; scroll-margin-top
- [x] P1-13 HUD 12px, .skip 44px
- [x] P1-11 partiel : logo header 144, hero 720 (<=55 % non fait)
Demandes Olivier : Instagram @6.ldt.9 seul contact (header + footer, icone SVG, plus d email) ; CTA « Commander sur Instagram » sous chaque produit ; lookbook supprime (section, menu, liens ; dossier 04-lookbook ignore, LISEZMOI du tri mis a jour).
Pas fait : P1-9 (fonts 2 familles, three lazy), P1-14 (a propos), P2. Skill impeccable non invoque.
Verifie : 0 erreur console, 0 image cassee, pas de scroll horizontal 1280/768/375.


## Tour 2 (reviewer + finisher, 2026-10-14) - captures shots/final-{1280,768,375}-NN.jpg (tout le scroll)
Skills impeccable (critique) et seo-technical charges ; mesures Playwright 1280/768/375.

### Corrige
- Header mobile (<= 560 px) : une seule ligne, logo 156x25 + icone Instagram 44x44, menu masque (3 sections, page courte) ; plus de 2e ligne.
- Images : photos 1600 px/q76 -> 1280 px/q72 ; hero-bw.jpg -> WebP 85 Ko + variante mobile 49 Ko (srcset, preload). Poids total images + thumbs 3,2 Mo -> 1,37 Mo ; chargement initial ~330 Ko (hero + libs + css), le reste en lazy.
- Polices : DM Sans 700 retire (inutilise), 3 familles/5 graisses, display=swap, preconnect ; preconnect CDN scripts. Scripts tous en defer (three.js ne bloque pas le rendu).
- Footer : icone Instagram alignee avec le texte (flex, line-height) ; CTA « Commander sur Instagram » ne passe plus sur 2 lignes a 768 (grille cagoule 3 colonnes seulement >= 1024, nowrap).
- CLS mesure : 0 aux 3 largeurs. Console 0 erreur, 0 requete en echec, 0 image cassee, pas de scroll horizontal, 0 cible < 44 px. rebuild.py idempotent (hash index.html et catalog.json identiques apres 2 runs).
- A-FAIRE-AVANT-MISE-EN-LIGNE.md : liste des endroits du domaine placeholder.

### Scores /100
SEO technique 82 (plafonne par domaine placeholder : canonical/og:image/sitemap non actifs) · Contenu/schema 68 · Alignements 90 · Logos/titres 82 · Motion 85 · Perf 84 · **Global ~82**

### Ce qui separe encore d'un rendu a 5000 EUR
1. Domaine reel + canonical/OG actifs + Search Console (bloque le SEO, pas le design).
2. Contenu : une seule page quasi sans texte ; ni a propos, ni descriptions de matiere/tailles/entretien (interdit par la regle « vitrine pure » partiellement), ni accroche : le SEO local/contenu reste faible par choix.
3. Polices et libs sur CDN tiers (Google Fonts, cdnjs, jsdelivr) : auto-heberger (woff2 + gsap/lenis/three) donnerait ~+5 en perf et RGPD ; non fait (telechargement de fichiers a valider).
4. Hero : le wordmark geant chevauche les jambes du pilote et double le globe/logo header (3 marques au premier ecran).
5. Pas de photos produit detourees/studio : galeries heterogenes (lumiere, cadrage) qui trahissent l'amateur.
6. Menu masque en mobile (choix de lisibilite) ; pas de page 404, pas de test Lighthouse reel en conditions 4G.
