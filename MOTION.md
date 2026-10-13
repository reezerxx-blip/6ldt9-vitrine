# MOTION 6.LDT.9 : direction HUD sobre (v2, motion renforcé)

Pipeline réellement invoqué : find-animation-opportunities + animation-vocabulary (plan), gpt-taste + animate + emil-design-eng (conception), apple-design (finesse), animation-performance (audit), improve-animations (correction), impeccable (critique manuelle, sans écriture de PRODUCT.md).
Tokens (CSS et miroir JS dans main.js) : --ease-out (.23,1,.32,1), --ease-in-out (.77,0,.175,1), --ease-spring (.34,1.56,.64,1, uniquement pastilles et icône CTA), --dur-micro 120 / short 200 / med 350 / long 600 ms, --dur-ambient 7 s.
Accent de section : --sec-accent (data-accent des pastilles) colore cadre HUD, rideau et indicateur.

## Ajoutés
1. Sections veste et t-shirt épinglées (ScrollTrigger pin, desktop >= 1024 x 680) : le scroll feuillette les photos du coloris (volet clip-path du bas vers le haut, 0,55 viewport par photo). Clic sur miniature = défilement jusqu'à la photo.
2. Changement de coloris : rideau de la couleur (scaleX, 280 ms entrée, 450 ms sortie), swap sous le rideau, glitch 180 ms (translate), grain 280 ms (opacité) ; le fond de page suit.
3. Grain bref aussi à chaque changement de fond au scroll.
4. Titres révélés ligne par ligne (masque, 120 ms entre lignes).
5. Cadre photo multi-couches : cadre décalé (parallax inverse), photo (+-3,5 %), compteur HUD ; tilt 3D 3 deg max (desktop) avec décalage du cadre HUD.
6. Indicateur de section HUD 01/02/03 à droite (>= 768 px), progression par section.
7. Aimantation des CTA Instagram à moins de 48 px du bord ; icône Instagram qui se redessine au survol (stroke) ; appui scale .97 ; curseur qui devient point sur liens.
8. Entrée de page chorégraphiée après le préchargeur : globe, logo en volet gauche-droite, header en cascade, indicateur Défiler.
9. Hero qui sort en scrub (logo, globe) ; globe qui tourne avec le scroll (window.__gs.spin) en plus de sa rotation continue.
Conservés : globe 3D, fond photo fixe, couleur de fond par section, scan, coins, spot souris, count-up, scanlines, halo.

## Rejetés
- Marquee / bandeau défilant (refus d'Olivier).
- Changement de coloris pendant le pin (confusion avec le scroll) : les coloris restent un choix explicite.
- Pin sur la cagoule (2 photos seulement) : parallax décalé à la place.
- Pin sous 1024 px ou écran bas : saccade et cadre hors écran, dégrade en galerie classique avec volet au clic.
- Curseur custom plein écran, flou animé, glitch long (> 200 ms), spring sur le contenu : gadgets ou coûteux.
- Pin horizontal des miniatures : les miniatures sont cliquées dix fois par visite, feedback minimal seulement.

## Garde-fous
transform / opacity / clip-path (composite) ; aucun will-change ; ambiance en pause hors écran (IntersectionObserver) ; blend du grade coupé sous 768 px ; hover sous (hover:hover)(pointer:fine) ; mobile : pas de pin, pas de tilt, pas d'indicateur.
prefers-reduced-motion : JS d'animation non chargé (aucun pin, parallax, rideau, grain), contenu et prix finaux visibles, fondus simples.

## UNIFORMITE-PHOTOS (annulable)
Bloc CSS délimité /* === UNIFORMITE-PHOTOS début/fin === */ dans css/style.css, actif via <body class="uniform"> : ratio 9/14, cover, grade commun (contraste, saturation, teinte soft-light de la section, vignette), ombre et filet uniques, cadre HUD.
Pour annuler : mettre UNIFORM = False dans rebuild.py puis `python rebuild.py` (la classe disparaît, tout le bloc est inerte). Les photos d'allure studio (coins unis, ratio > 0,65, ici t-shirt bleu roi 2 et 4) sont dézoomées au build : prolongement des bords sur un canvas 9/14, sources intactes.
