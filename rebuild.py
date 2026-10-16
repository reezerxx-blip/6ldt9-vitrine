#!/usr/bin/env python3
"""Reconstruit le site 6.LDT.9 a partir du dossier de tri LDTclothing-tri.

Usage :
    python rebuild.py                      (tri par defaut, site = dossier du script)
    python rebuild.py --tri CHEMIN --out CHEMIN_SITE

Python 3.12 + Pillow. Les photos d'origine ne sont jamais modifiees.
Regenere assets/img, assets/thumbs, catalog.json et les blocs entre
les reperes <!--GEN:...--> de index.html. Rien n'est ecrit si une erreur survient
pendant la conversion des images.
"""
import argparse, html, json, re, shutil, sys, tempfile
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

HERE = Path(__file__).resolve().parent
DEFAULT_TRI = Path(r"C:\Users\rumin\Documents\LDTclothing-tri")
EXTS = {".jpg", ".jpeg"}
MAX_SIDE, QUALITY, THUMB, WEBP_Q = 1280, 82, 240, 72

# (dossier, sous-dossier) -> (vetement, couleur)
FOLDERS = {
    ("01-veste-softshell", "coloris-noir-rouge"): ("veste", "rouge"),
    ("01-veste-softshell", "coloris-noir-bleu"): ("veste", "bleu"),
    ("02-tshirt", "noir"): ("tshirt", "noir"),
    ("02-tshirt", "bleu-roi"): ("tshirt", "bleu"),
    ("02-tshirt", "blanc"): ("tshirt", "blanc"),
    ("03-cagoule", "noir"): ("cagoule", "noir"),
    # 04-lookbook volontairement ignore (lookbook supprime du site, dossier laisse intact sur disque)
}
# valeurs de repli si l'ancien catalog.json est absent : (vetement, couleur) -> (nomCouleur, bg, accent)
DEFAULT_PAL = {
    ("veste", "rouge"): ("Noir et rouge", "#1A0B0C", "#E10600"),
    ("veste", "bleu"): ("Noir et bleu roi", "#0A1230", "#2F5BFF"),
    ("tshirt", "noir"): ("Noir", "#121214", "#9A9AA2"),
    ("tshirt", "bleu"): ("Bleu roi", "#0B1A3D", "#2F5BFF"),
    ("tshirt", "blanc"): ("Blanc", "#26262B", "#F2F0EA"),
    ("cagoule", "noir"): ("Noir", "#121214", "#9A9AA2"),
}
VESTE_TXT = {"rouge": ("Noir et rouge", "Veste · rouge"), "bleu": ("Noir et bleu", "Veste · bleu")}
TEE = {  # couleur -> (valeur, libelle, pastille, fond de section)
    "noir": ("noir", "Noir", "#17171A", "#121214"),
    "bleu": ("bleu roi", "Bleu roi", "#1F3FA8", "#10245C"),
    "blanc": ("blanc", "Blanc", "#ECE9E1", "#DAD7CF"),
}
UNIFORM = True  # cadre/grade commun des photos (body.uniform) ; False = retour a l'etat d'avant
PRIX = {"veste": "69,99 €", "tshirt": "29,99 €", "cagoule": "19,99 €"}
PRIX_BARRE = {"tshirt": "32,99 €", "cagoule": "24,99 €"}  # ancien prix affiche barre (effet promo)


def prix_html(cle):
    """Prix affiche ; si un ancien prix existe, il est barre a cote du prix actuel."""
    if cle not in PRIX_BARRE:
        return PRIX[cle]
    return (f'<s class="price__old"><span class="sr-only">Ancien prix : </span>{PRIX_BARRE[cle]}</s> '
            f'<span class="price__now">{PRIX[cle]}</span>')
LEAD_VESTE = "Imperméable, coupe-vent et logo réfléchissant."
GEN_RE = lambda name: re.compile(r"(<!--GEN:%s-->)(.*?)(<!--/GEN:%s-->)" % (name, name), re.S)


def esc(s):
    return html.escape(s, quote=True)


def scan(tri):
    """Retourne la liste des photos : dict(path, idx, src, vetement, couleur)."""
    out = []
    for (top, sub), (vet, col) in FOLDERS.items():
        d = tri / top / sub
        if not d.is_dir():
            continue
        for f in sorted(d.iterdir()):
            if f.is_file() and f.suffix.lower() in EXTS:
                m = re.match(r"^(\d+)(?:_(.*)|\..*)$", f.name)
                idx, src = (int(m.group(1)), m.group(2) or f.name) if m else (10**6, f.name)
                out.append(dict(path=f, idx=idx, src=src, vetement=vet, couleur=col))
    out.sort(key=lambda p: (p["vetement"], p["couleur"], p["idx"], p["src"]))
    return out


FRAME = 9 / 14      # ratio du cadre commun (css .gallery__main)
AIR = 0.88          # part de la largeur occupee par la photo "dezoomee"


def dezoom(im):
    """Photo plus large que le cadre (ratio > 0,65) sur fond uni (maquette studio) :
    on la cale entiere sur un canvas au ratio du cadre, fond = couleur des coins.
    Autres photos : inchangees."""
    w, h = im.size
    if w / h <= 0.65:
        return im
    n = max(4, min(w, h) // 60)
    boxes = [(0, 0), (w - n, 0), (0, h - n), (w - n, h - n)]
    means = []
    for x, y in boxes:
        b = im.crop((x, y, x + n, y + n)).convert("RGB").tobytes()
        px = list(zip(b[0::3], b[1::3], b[2::3]))
        m = tuple(sum(p[c] for p in px) / len(px) for c in range(3))
        sd = max((sum((p[c] - m[c]) ** 2 for p in px) / len(px)) ** .5 for c in range(3))
        if sd > 6:
            return im  # coin non uniforme : vraie scene, on garde le recadrage cover
        means.append(m)
    if max(abs(a[c] - b[c]) for a in means for b in means for c in range(3)) > 14:
        return im
    bg = tuple(round(sum(m[c] for m in means) / 4) for c in range(3))
    cw = w / AIR
    ch = cw / FRAME
    if ch < h / AIR * 0.999:
        ch = h / AIR
        cw = ch * FRAME
    cw, ch = round(cw), round(ch)
    pl, pt = (cw - w) // 2, (ch - h) // 2
    # marges = bords de la photo prolonges (pas de couture), puis flou leger sur les marges seules
    v = Image.new("RGB", (w, ch), bg)
    v.paste(im.crop((0, 0, w, 1)).resize((w, pt + 1)), (0, 0))
    v.paste(im.crop((0, h - 1, w, h)).resize((w, ch - pt - h + 1)), (0, pt + h - 1))
    cv = Image.new("RGB", (cw, ch), bg)
    cv.paste(v.crop((0, 0, 1, ch)).resize((pl + 1, ch)), (0, 0))
    cv.paste(v.crop((w - 1, 0, w, ch)).resize((cw - pl - w + 1, ch)), (pl + w - 1, 0))
    cv.paste(v, (pl, 0))
    soft = cv.filter(ImageFilter.GaussianBlur(24))
    mask = Image.new("L", (cw, ch), 255)
    mask.paste(0, (pl + 24, pt + 24, pl + w - 24, pt + h - 24))
    cv = Image.composite(soft, cv, mask.filter(ImageFilter.GaussianBlur(10)))
    cv.paste(im.crop((24, 24, w - 24, h - 24)), (pl + 24, pt + 24))
    return cv


def convert(photos, tmp):
    n = {}
    for p in photos:
        k = (p["vetement"], p["couleur"])
        n[k] = n.get(k, 0) + 1
        name = f"{p['vetement']}-{p['couleur']}-{n[k]:02d}.webp"
        with Image.open(p["path"]) as im:
            im = dezoom(ImageOps.exif_transpose(im).convert("RGB"))
            full = im.copy()
            full.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            full.save(tmp / "img" / name, "WEBP", quality=WEBP_Q, method=6)
            p["w"], p["h"] = full.size
            th = im.copy()
            th.thumbnail((THUMB, THUMB), Image.LANCZOS)
            th.save(tmp / "thumbs" / name, "WEBP", quality=WEBP_Q, method=6)
            p["tw"], p["th"] = th.size
        p["name"] = name


def old_info(out):
    """Anciennes infos : plan par photo source, palette par (vetement, couleur)."""
    plans, pal = {}, dict(DEFAULT_PAL)
    c = out / "catalog.json"
    if c.exists():
        try:
            for e in json.loads(c.read_text(encoding="utf8")):
                plans[e["src"]] = e.get("plan", "porte")
                pal.setdefault((e["vetement"], e["couleur"]), (e["nomCouleur"], e["bg"], e["accent"]))
                pal[(e["vetement"], e["couleur"])] = (e["nomCouleur"], e["bg"], e["accent"])
        except Exception as ex:  # catalogue illisible : on garde les valeurs par defaut
            print("Avertissement : ancien catalog.json illisible (%s)" % ex)
    return plans, pal


NOM = {"veste": "Veste softshell", "tshirt": "T-shirt", "cagoule": "Cagoule"}
PLAN_ALT = {"porte": "portée", "portrait": "en portrait", "detail": "en détail"}


def alt(p):
    nom = NOM[p["vetement"]]
    plan = PLAN_ALT.get(p["plan"], "portée")
    return f"{nom} 6.LDT.9 {p['nomCouleur'].lower()}, photo {p['pos']} sur {p['tot']}, {plan}"


def img(p, extra=""):
    return (f'<img {extra}src="assets/img/{p["name"]}" alt="{esc(alt(p))}" width="{p["w"]}" height="{p["h"]}" '
            f'loading="lazy" decoding="async">')


def thumb(p, i, total, current=False):
    cur = ' aria-current="true"' if current else ""
    return (f'<button class="thumb" type="button" role="listitem" data-full="assets/img/{p["name"]}" '
            f'data-alt="{esc(alt(p))}"{cur} aria-label="Voir la photo {i} sur {total}">'
            f'<img src="assets/thumbs/{p["name"]}" alt="" width="{p["tw"]}" height="{p["th"]}" loading="lazy" decoding="async"></button>')


def group(photos, vet, col=None):
    return [p for p in photos if p["vetement"] == vet and (col is None or p["couleur"] == col)]


def more_link():
    return (f'<a class="more cta" href="{IG_URL}" target="_blank" rel="noopener noreferrer">{IG_SVG}'
            f'<span>Commander sur Instagram</span></a>')


# coloris veste : couleur -> (valeur, libelle, pastille, fond de section ; None = fond du catalogue)
VESTE = {
    "rouge": ("rouge", "Noir / Rouge", "linear-gradient(135deg,#17171A 50%,#E10600 50%)", None),
    "bleu": ("bleu", "Noir / Bleu", "linear-gradient(135deg,#17171A 50%,#2F5BFF 50%)", None),
}


def product_section(photos, vet, sid, title, eyebrow, cols_def, order, lead, prix, cls):
    """Un produit unique, coloris en pastilles (affichage seulement : change photo, planche et fond)."""
    cols = [c for c in order if group(photos, vet, c)]
    if not cols:
        return ""
    first = group(photos, vet, cols[0])
    bg0 = cols_def[cols[0]][3] or first[0]["bg"]
    sw, strips = [], []
    for k, c in enumerate(cols):
        val, lab, pastille, bg = cols_def[c]
        ps = group(photos, vet, c)
        bg = bg or ps[0]["bg"]
        chk = " checked" if k == 0 else ""
        sw.append(f'<label class="swatch"><input type="radio" name="{sid}" value="{val}" data-label="{lab}" data-bg="{bg}" data-accent="{ps[0]['accent']}"{chk}>'
                  f'<span style="--sw:{pastille}"></span><b>{lab}</b></label>')
        th = "\n".join(thumb(p, i, len(ps), i == 1) for i, p in enumerate(ps, 1))
        hid = "" if k == 0 else " hidden"
        strips.append(f'<div class="gallery__strip color-strip" data-color="{val}" role="list" data-lenis-prevent{hid}>\n{th}\n</div>')
    first_lab = cols_def[cols[0]][1]
    if len(cols) > 1:
        swatches = (f'<fieldset class="swatches"><legend>Coloris : <span class="swatch-name">{first_lab}</span></legend>\n'
                    + "\n".join(sw) + "\n</fieldset>")
    else:
        swatches = f'<p class="lead">Coloris : {first_lab}</p>'
    rev = " split--rev" if vet == "tshirt" else ""
    main_img = img(first[0], f'id="{sid}-img" ')
    strips_html = "\n".join(strips)
    nb = f"{len(cols)} coloris" if len(cols) > 1 else "1 coloris"
    return f'''<section class="color-block {cls}" id="{sid}" data-product data-bg="{bg0}" aria-labelledby="h-{sid}">
<div class="wrap split{rev}">
<div class="gallery" data-gallery="g-{sid}">
<figure class="gallery__main">{main_img}</figure>
{strips_html}
</div>
<div class="split__text">
<p class="eyebrow">{eyebrow} · {nb}</p>
<h2 id="h-{sid}" class="display">{title}</h2>
<p class="lead">{lead}</p>
{swatches}
<div class="buy">
<p class="price">{prix}</p>
{more_link()}
</div>
</div></div></section>'''


def veste_section(photos):
    return product_section(photos, "veste", "veste", "Veste Softshell", "Veste", VESTE, ("rouge", "bleu"),
                           LEAD_VESTE, PRIX["veste"], "vest")


def tee_section(photos):
    return product_section(photos, "tshirt", "tshirt", "T-shirt 6.LDT.9", "T-shirt", TEE, ("noir", "bleu", "blanc"),
                           "Coton dense, logo brodé.", prix_html("tshirt"), "tee")


def cag_section(photos):
    ps = group(photos, "cagoule")
    if not ps:
        return ""
    figs = "\n".join(f'<figure{" class=\"cag__b\"" if i == 2 else ""}>{img(p)}</figure>' for i, p in enumerate(ps, 1))
    return f'''<section class="color-block cag" id="cagoule" data-bg="{ps[0]['bg']}" aria-labelledby="h-cag">
<div class="wrap">
<div class="cag__head"><p class="eyebrow">Cagoule · noir</p><h2 id="h-cag" class="display">Cagoule</h2></div>
<div class="cag__grid">
{figs}
<div class="cag__buy"><div class="buy">
<p class="price">{prix_html("cagoule")}</p>
{more_link()}
</div></div>
</div></div></section>'''


# Packs : photos = montages provisoires des photos produits (a remplacer par de vraies photos de packs)
PACKS = [
    dict(n=1, slug="tshirt-cagoule", tag="Le petit pack pour commencer",
         items=["1 T-shirt au choix", "1 cagoule"], old="49,98 €", prix="44,99 €", eco="4,99 €",
         photos=["tshirt-bleu-01", "cagoule-noir-01"], alt="Pack 1 6.LDT.9 : t-shirt bleu roi et cagoule noire"),
    dict(n=2, slug="veste-tshirt", tag="L’association parfaite",
         items=["1 veste au choix", "1 T-shirt au choix"], old="99,98 €", prix="89,99 €", eco="9,99 €",
         photos=["veste-bleu-01", "tshirt-noir-01"], alt="Pack 2 6.LDT.9 : veste softshell noir et bleu, t-shirt noir"),
    dict(n=3, slug="veste-tshirt-cagoule", tag="Le look complet à prix réduit",
         items=["1 veste au choix", "1 T-shirt au choix", "1 cagoule"], old="119,97 €", prix="104,99 €", eco="14,98 €",
         photos=["veste-rouge-01", "tshirt-noir-02", "cagoule-noir-01"],
         alt="Pack 3 6.LDT.9 : veste softshell noir et rouge, t-shirt noir et cagoule noire"),
    dict(n=4, slug="double-veste-cagoule-offerte", tag="2 vestes achetées = 1 cagoule offerte",
         items=["2 vestes au choix, modèles mélangeables", "1 cagoule offerte"], old="159,97 €", prix="139,98 €", eco="19,99 €",
         note="Offre valable dans la limite des stocks disponibles.", badge="Cagoule offerte",
         photos=["veste-rouge-02", "veste-bleu-02", "cagoule-noir-02"],
         alt="Pack 4 6.LDT.9 : deux vestes softshell, rouge et bleue, et cagoule noire offerte"),
]
PACK_W, PACK_H, PACK_GAP, PACK_BG = 960, 1200, 8, (18, 18, 20)


def pack_name(pk):
    return f"pack-{pk['n']}-{pk['slug']}.webp"


def _cover(im, w, h, fy=0.3):
    """Recadrage 'cover' ; fy = position verticale du cadrage (0 = haut)."""
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - w) // 2, round((im.height - h) * fy)
    return im.crop((l, t, l + w, t + h))


def make_pack_images(out):
    """Montage par pack a partir des photos produits deja generees dans assets/img."""
    W, H, G = PACK_W, PACK_H, PACK_GAP
    half = (W - G) // 2
    for pk in PACKS:
        srcs = [out / "assets" / "img" / f"{n}.webp" for n in pk["photos"]]
        if len(srcs) == 2:  # deux colonnes
            boxes = [(0, 0, half, H), (W - half, 0, W, H)]
        else:  # grande colonne a gauche, deux cases empilees a droite
            hh = (H - G) // 2
            boxes = [(0, 0, half, H), (W - half, 0, W, hh), (W - half, H - hh, W, H)]
        cv = Image.new("RGB", (W, H), PACK_BG)
        for src, (x0, y0, x1, y1) in zip(srcs, boxes):
            with Image.open(src) as im:
                cv.paste(_cover(im.convert("RGB"), x1 - x0, y1 - y0), (x0, y0))
        cv.save(out / "assets" / "img" / pack_name(pk), "WEBP", quality=WEBP_Q, method=6)


def pack_card(pk):
    items = "".join(f"<li>{esc(i)}</li>" for i in pk["items"])
    note = f'\n<p class="pack__note">{esc(pk["note"])}</p>' if pk.get("note") else ""
    badge = f'<span class="pack__badge">{esc(pk["badge"])}</span>' if pk.get("badge") else ""
    hot = " pack--hot" if pk.get("badge") else ""
    return f'''<article class="pack{hot}" aria-labelledby="h-pack-{pk["n"]}">
<figure class="pack__fig">{badge}<img src="assets/img/{pack_name(pk)}" alt="{esc(pk["alt"])}" width="{PACK_W}" height="{PACK_H}" loading="lazy" decoding="async"></figure>
<div class="pack__body">
<h3 id="h-pack-{pk["n"]}" class="pack__title">Pack {pk["n"]}</h3>
<p class="pack__tag">{esc(pk["tag"])}</p>
<ul class="pack__items">{items}</ul>
<div class="buy">
<p class="price"><s class="price__old"><span class="sr-only">Prix normal : </span>{pk["old"]}</s> <span class="price__now">{pk["prix"]}</span></p>
<p class="pack__eco">Économie : {pk["eco"]}</p>{note}
{more_link()}
</div></div></article>'''


def packs_section():
    cards = "\n".join(pack_card(pk) for pk in PACKS)
    return f'''<section class="color-block packs" id="packs" data-bg="#121214" aria-labelledby="h-packs">
<div class="wrap">
<div class="cag__head"><p class="eyebrow">Packs</p><h2 id="h-packs" class="display">Pack du moment</h2></div>
<div class="packs__grid">
{cards}
</div>
</div></section>'''


def nav(photos):
    items = [("veste", "Veste", "veste"),
             ("tshirt", "T-shirt", "tshirt"), ("cagoule", "Cagoule", "cagoule")]
    links = "".join(f'<a href="#{h}">{t}</a>' for h, t, v in items if group(photos, v))
    return links + '<a href="#packs">Packs</a>'



SITE = "https://DOMAINE-A-DEFINIR.example"  # TODO Olivier : remplacer par le vrai domaine (index.html, robots.txt, sitemap.xml)
IG_URL = "https://www.instagram.com/6.ldt.9/"
DEV_URL = "https://reezerxx-blip.github.io/vitrine-developpeur/"
IG_SVG = ('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" '
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
          '<rect pathLength="1" x="3" y="3" width="18" height="18" rx="5"/><circle pathLength="1" cx="12" cy="12" r="4.2"/>'
          '<circle cx="17.4" cy="6.6" r=".6" fill="currentColor"/></svg>')
DESC = "6.LDT.9, marque lyonnaise de streetwear moto : veste softshell, t-shirt et cagoule."


def head_block():
    prods = []
    for nom, desc, img_, col in (
            ("Veste softshell 6.LDT.9", "Veste softshell imperméable et coupe-vent, logo réfléchissant. Coloris noir et rouge, noir et bleu.", "veste-rouge-01", "Noir et rouge, noir et bleu"),
            ("T-shirt 6.LDT.9", "T-shirt en coton dense, logo brodé. Coloris noir et bleu roi.", "tshirt-noir-01", "Noir, bleu roi"),
            ("Cagoule 6.LDT.9", "Cagoule noire 6.LDT.9.", "cagoule-noir-01", "Noir")):
        prods.append({"@type": "Product", "name": nom, "description": desc, "color": col,
                      "image": f"{SITE}/assets/img/{img_}.webp", "brand": {"@id": SITE + "/#org"}})
    for pk in PACKS:
        prods.append({"@type": "Product", "name": f"Pack {pk['n']} 6.LDT.9",
                      "description": f"{pk['tag']} : " + ", ".join(pk["items"]) + ".",
                      "image": f"{SITE}/assets/img/{pack_name(pk)}", "brand": {"@id": SITE + "/#org"},
                      "offers": {"@type": "Offer", "price": pk["prix"].replace(" €", "").replace(",", "."),
                                 "priceCurrency": "EUR", "availability": "https://schema.org/InStock", "url": SITE + "/#packs"}})
    graph = [{"@type": ["Organization", "ClothingStore"], "@id": SITE + "/#org", "name": "6.LDT.9",
              "description": DESC, "url": SITE + "/", "logo": SITE + "/assets/icons/icon-512.png",
              "image": SITE + "/og-image.jpg",
              "address": {"@type": "PostalAddress", "addressLocality": "Lyon", "addressCountry": "FR"},
              "sameAs": [IG_URL]}] + prods
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return f"""
<title>6.LDT.9 | Streetwear moto, Lyon</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#121214">
<meta name="color-scheme" content="dark">
<link rel="icon" href="favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" sizes="32x32" href="assets/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="assets/icons/favicon-16.png">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" as="image" href="assets/img/hero-bw-m.webp" imagesrcset="assets/img/hero-bw-m.webp 1000w, assets/img/hero-bw.webp 1410w" imagesizes="100vw" fetchpriority="high">
<!-- TODO domaine : decommenter et remplacer {SITE} par le vrai domaine -->
<!-- <link rel="canonical" href="{SITE}/"> -->
<!-- <meta property="og:url" content="{SITE}/"> -->
<!-- <meta property="og:image" content="{SITE}/og-image.jpg"> -->
<!-- <meta name="twitter:image" content="{SITE}/og-image.jpg"> -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="6.LDT.9">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="6.LDT.9 | Streetwear moto, Lyon">
<meta property="og:description" content="{DESC}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Logo 6.LDT.9 sur fond sombre">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="6.LDT.9 | Streetwear moto, Lyon">
<meta name="twitter:description" content="{DESC}">
<script type="application/ld+json">
{ld}
</script>
"""


def header_block(nav_html):
    return (f'<a class="topbar__logo" href="#hero" aria-label="6.LDT.9, accueil"><img src="assets/img/logo-6ldt9.png" alt="6.LDT.9" width="1781" height="281"></a>\n'
            f'<nav aria-label="Principal"><!--GEN:nav-->{nav_html}<!--/GEN:nav--></nav>'
            f'<a class="ig ig--top" href="{IG_URL}" target="_blank" rel="noopener noreferrer" aria-label="Instagram 6.ldt.9">{IG_SVG}</a>')


def hero_block():
    return ('\n<div class="hero__shade"></div>\n'
            '<div class="globe globe--hero" data-globe data-parallax data-accent aria-hidden="true"></div>\n'
            '<div class="hero__in">\n'
            '<h1 class="sr-only">6.LDT.9 : streetwear moto, Lyon</h1>\n'
            '<img class="hero__logo" src="assets/img/logo-6ldt9.png" alt="" width="1781" height="281" fetchpriority="high">\n'
            '</div>\n'
            '<a class="scroll" href="#veste"><span>Défiler</span><i aria-hidden="true"></i></a>\n')


def footer_block():
    return (f'\n<div class="globe globe--foot" data-globe aria-hidden="true"></div>\n'
            f'<p>Lyon, France<br>BORN IN LYON. BUILT FOR THE STREETS<br>StreetWear &amp; culture urbaine</p>\n'
            f'<p><a class="ig ig--foot" href="{IG_URL}" target="_blank" rel="noopener noreferrer" aria-label="Instagram 6.ldt.9">{IG_SVG}<span>@6.ldt.9</span></a><br>'
            f'<a href="#hero">Retour en haut</a></p>\n'
            f'<p class="small">© 2026 6.LDT.9. Vitrine.<br>'
            f'<a class="credit" href="{DEV_URL}" target="_blank" rel="noopener noreferrer">Site conçu par Olivier <span aria-hidden="true">↗</span></a></p>\n')


def patch_html(path, photos):
    s = path.read_text(encoding="utf8")
    main = "\n".join(x for x in (veste_section(photos), tee_section(photos), cag_section(photos), packs_section()) if x)
    for name, content in (("head", head_block()), ("header", header_block(nav(photos))), ("hero", hero_block()),
                          ("footer", footer_block()), ("main", "\n" + main + "\n")):
        rx = GEN_RE(name)
        if not rx.search(s):
            raise SystemExit(f"Repere <!--GEN:{name}--> introuvable dans {path}")
        s = rx.sub(lambda m: m.group(1) + content + m.group(3), s)
    # uniformite des photos : classe sur <body> (UNIFORM = False pour annuler, voir MOTION.md)
    s = re.sub(r"<body[^>]*>", '<body class="uniform">' if UNIFORM else "<body>", s, count=1)
    path.write_text(s, encoding="utf8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tri", type=Path, default=DEFAULT_TRI)
    ap.add_argument("--out", type=Path, default=HERE)
    ap.add_argument("--packs-only", action="store_true", help="regenere seulement les montages des packs")
    a = ap.parse_args()
    tri, out = a.tri.resolve(), a.out.resolve()
    if a.packs_only:
        make_pack_images(out)
        print(f"OK : {len(PACKS)} montages de packs")
        return
    if not tri.is_dir():
        raise SystemExit(f"Dossier de tri introuvable : {tri}")
    photos = scan(tri)
    if not photos:
        raise SystemExit("Aucune photo dans le dossier de tri : rien n'est modifie.")
    plans, pal = old_info(out)
    for p in photos:
        p["nomCouleur"], p["bg"], p["accent"] = pal[(p["vetement"], p["couleur"])]
        p["plan"] = plans.get(p["src"], "porte")
    cnt, seen = {}, {}
    for p in photos:
        k = (p["vetement"], p["couleur"]); cnt[k] = cnt.get(k, 0) + 1
    for p in photos:
        k = (p["vetement"], p["couleur"]); seen[k] = seen.get(k, 0) + 1
        p["pos"], p["tot"] = seen[k], cnt[k]
    tmp = Path(tempfile.mkdtemp(prefix="rebuild_", dir=out))
    try:
        (tmp / "img").mkdir(); (tmp / "thumbs").mkdir()
        convert(photos, tmp)
        for sub in ("img", "thumbs"):
            d = out / "assets" / sub
            d.mkdir(parents=True, exist_ok=True)
            for f in d.iterdir():  # supprime seulement les anciennes photos generees (pas hero/logo)
                if re.match(r"^(veste|tshirt|cagoule|lookbook)-[a-z]+-\d+\.(jpg|webp)$", f.name):
                    f.unlink()
            for f in (tmp / sub).iterdir():
                shutil.move(str(f), d / f.name)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    make_pack_images(out)
    cat = [dict(src=p["src"], dest=f"assets/img/{p['name']}", thumb=f"assets/thumbs/{p['name']}",
                vetement=p["vetement"], couleur=p["couleur"], nomCouleur=p["nomCouleur"],
                bg=p["bg"], accent=p["accent"], plan=p["plan"]) for p in photos]
    (out / "catalog.json").write_text(json.dumps(cat, ensure_ascii=False, indent=1), encoding="utf8")
    patch_html(out / "index.html", photos)
    counts = {}
    for p in photos:
        k = f"{p['vetement']}/{p['couleur']}"
        counts[k] = counts.get(k, 0) + 1
    print(f"OK : {len(photos)} photos")
    for k, v in sorted(counts.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    sys.exit(main())
