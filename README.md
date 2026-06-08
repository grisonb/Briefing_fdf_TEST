# Briefing FDF — automatisation des NOTAMs NATS

L'application peut demander au NAS de se connecter à NATS, de sélectionner le favori de briefing configuré, de générer le PIB et de renvoyer son PDF. Le PDF est ensuite analysé dans le navigateur par le mécanisme existant.

## 1. Préparer le service sur le NAS

Le NAS doit prendre en charge Docker Compose (Synology Container Manager, QNAP Container Station, Unraid ou Docker standard).

```bash
cd server
cp .env.example .env
```

Éditer `server/.env` et renseigner au minimum :

```dotenv
NATS_USERNAME=votre_login
NATS_PASSWORD=votre_mot_de_passe
NATS_FAVORITE_NAME=PELICANDROMES
```

Ne jamais ajouter `server/.env` à Git. Le fichier est déjà ignoré par `.gitignore`.

Lancer ensuite le conteneur :

```bash
cd server
docker compose up -d --build
```

Vérifier son état :

```bash
curl http://ADRESSE_DU_NAS:8080/health
```

La réponse attendue est :

```json
{"ok":true,"service":"briefing-fdf-nats-server"}
```

## 2. Configurer l'application

Dans la section **Importation NOTAMs** :

1. ouvrir **Adresse du service NATS sur le NAS** ;
2. saisir par exemple `http://192.168.1.20:8080` ;
3. cliquer sur **Enregistrer** ;
4. cliquer sur **Télécharger automatiquement via le NAS**.

Si l'application et l'API sont publiées sous le même domaine au moyen d'un reverse proxy, laisser l'adresse vide. L'application appellera `/api/nats/notams` sur son propre domaine.

## 3. HTTPS et reverse proxy

Une page publiée en HTTPS ne peut généralement pas appeler une API NAS en HTTP. La configuration recommandée est donc :

- `https://briefing.exemple.fr/` vers les fichiers statiques de l'application ;
- `https://briefing.exemple.fr/api/nats/` vers `http://nats-notams:8080/api/nats/` ;
- `https://briefing.exemple.fr/health` vers `http://nats-notams:8080/health`.

Limiter également `ALLOWED_ORIGINS` au domaine de l'application :

```dotenv
ALLOWED_ORIGINS=https://briefing.exemple.fr
```

Ne pas exposer directement le port 8080 sur Internet sans authentification ou filtrage réseau.

## 4. Adaptation aux changements du portail NATS

Le serveur recherche les champs et boutons NATS à l'aide de plusieurs libellés usuels. Si NATS modifie son HTML, les sélecteurs peuvent être adaptés dans `server/.env` sans modifier le programme :

```dotenv
NATS_USERNAME_SELECTOR=input[name="j_username"]
NATS_PASSWORD_SELECTOR=input[name="j_password"]
NATS_LOGIN_BUTTON_SELECTOR=button[type="submit"]
NATS_AERODROME_PIB_SELECTOR=
NATS_FAVORITES_BUTTON_SELECTOR=
NATS_FAVORITE_SELECTOR=
NATS_GENERATE_SELECTOR=
NATS_PRINT_PDF_SELECTOR=
```

Pour diagnostiquer un échec, consulter les journaux :

```bash
cd server
docker compose logs -f nats-notams
```

Le serveur sérialise les demandes : une seule automatisation NATS est exécutée à la fois. La session est conservée dans `server/data/nats-storage-state.json`, tandis que les identifiants restent exclusivement dans l'environnement du conteneur.

## 5. Sécurité

- Changer tout mot de passe qui a déjà été publié dans un fichier HTML ou dans l'historique Git.
- Ne jamais placer les identifiants NATS dans `index.html`, une URL ou le stockage du navigateur.
- Restreindre l'accès à l'API au réseau privé, au VPN ou à un reverse proxy authentifié.
- Vérifier que l'automatisation est compatible avec les droits et conditions d'utilisation du compte NATS.
- Conserver l'import manuel comme solution de secours opérationnelle.
