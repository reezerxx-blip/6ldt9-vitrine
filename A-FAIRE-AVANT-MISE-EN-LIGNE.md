# A faire (SEO)

Adresse officielle : `https://6ldt9.vercel.app` (Vercel, redeploye a chaque push sur `main`).
Canonical, og:url, og:image, twitter:image, JSON-LD, sitemap.xml et robots.txt l'utilisent.

1. **Google Search Console** : ajouter la propriete "prefixe d'URL" `https://6ldt9.vercel.app/` (verification par balise HTML ou fichier), envoyer `sitemap.xml`, demander l'indexation de la page d'accueil.
2. **Copie GitHub Pages** : le site est aussi publie sur `reezerxx-blip.github.io/6ldt9-vitrine`. La balise canonical renvoie vers Vercel, donc Google gardera Vercel ; pour eviter tout doublon, desactiver GitHub Pages (Settings > Pages du depot) si elle ne sert pas.
3. **Lien depuis Instagram** : mettre `6ldt9.vercel.app` dans la bio Instagram.
4. **Google Business Profile** : creer la fiche (marque de Lyon, lien Instagram, site), puis ajouter l'URL de la fiche dans `sameAs` du JSON-LD (`head_block()` dans `rebuild.py`). Ne pas publier d'adresse ou de telephone : le seul contact est Instagram.
5. **Texte de marque** : ajouter un court paragraphe "A propos" (histoire de la marque, Lyon, moto), environ 100 a 150 mots. La page compte ~240 mots visibles, c'est peu.
6. **Vrai domaine (plus tard)** : le brancher dans Vercel, puis changer `SITE` dans `rebuild.py`, la ligne `Sitemap:` de `robots.txt` et la balise `<loc>` de `sitemap.xml`, et regenerer.
