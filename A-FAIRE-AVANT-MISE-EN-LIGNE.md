# A faire avant la mise en ligne

Le domaine est un placeholder : `DOMAINE-A-DEFINIR.example`.

1. **Domaine** : dans `rebuild.py`, ligne `SITE = "https://DOMAINE-A-DEFINIR.example"`, mettre le vrai domaine, puis lancer `python rebuild.py`. Cela met a jour le JSON-LD (url, logo, image, @id) dans `index.html`.
2. **Canonical, og:url, og:image, twitter:image** : dans `rebuild.py`, fonction `head_block()`, les 4 balises sont en commentaire HTML (`<!-- TODO domaine -->`). Les decommenter, puis `python rebuild.py`.
3. **og:image** : l'image est `og-image.jpg` (1200x630) a la racine ; l'URL absolue sera `https://VRAI-DOMAINE/og-image.jpg`.
4. **sitemap.xml** : remplacer le domaine dans la balise `<loc>` (et supprimer le commentaire TODO).
5. **robots.txt** : remplacer le domaine dans la ligne `Sitemap:`.
6. **Google Search Console** : ajouter la propriete du domaine, envoyer `sitemap.xml`, demander l'indexation de la page d'accueil.
7. **Google Business Profile** : creer la fiche (marque de Lyon, lien Instagram, site), puis ajouter l'URL de la fiche dans `sameAs` du JSON-LD (`head_block()` dans `rebuild.py`). Ne pas publier d'adresse ou de telephone : le seul contact est Instagram.
8. **Hebergement** : HTTPS obligatoire, cache long sur `assets/` et `css/`, `js/`.
