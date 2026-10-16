# A faire (SEO)

Adresse officielle actuelle : `https://reezerxx-blip.github.io/6ldt9-vitrine` (GitHub Pages).
Canonical, og:url, og:image, twitter:image, JSON-LD, sitemap.xml et robots.txt l'utilisent deja.

1. **Google Search Console** : ajouter la propriete "prefixe d'URL" `https://reezerxx-blip.github.io/6ldt9-vitrine/`, envoyer `sitemap.xml`, demander l'indexation de la page d'accueil. Sur GitHub Pages, le `robots.txt` du sous-dossier n'est pas lu par Google : le sitemap doit etre envoye a la main dans la Search Console.
2. **Google Business Profile** : creer la fiche (marque de Lyon, lien Instagram, site), puis ajouter l'URL de la fiche dans `sameAs` du JSON-LD (`head_block()` dans `rebuild.py`). Ne pas publier d'adresse ou de telephone : le seul contact est Instagram.
3. **Lien depuis Instagram** : mettre l'adresse du site dans la bio Instagram (premier lien entrant, aide l'indexation).
4. **Texte de marque** : ajouter un court paragraphe "A propos" (histoire de la marque, Lyon, moto), environ 100 a 150 mots. La page compte ~240 mots visibles, c'est peu.
5. **Vrai domaine (plus tard)** : changer `SITE` dans `rebuild.py`, la ligne `Sitemap:` de `robots.txt` et la balise `<loc>` de `sitemap.xml`, puis regenerer.
