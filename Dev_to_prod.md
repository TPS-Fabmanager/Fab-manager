# Annexe : Guide de Création et Déploiement d'une Image Docker Applicative pour la Production

Ce document décrit le processus de création d'une image Docker à partir d'un code source applicatif modifié (par exemple, Fab-manager), son test, et les étapes pour son déploiement ou sa mise à jour en environnement de production en utilisant Docker Compose.

---

## 1. Objectif

L'objectif est de packager une application modifiée et ses dépendances dans une image Docker optimisée pour la production. Cette image sera ensuite déployée ou utilisée pour mettre à jour une instance existante de l'application, en assurant la cohérence et la reproductibilité de l'environnement.

---

## 2. Prérequis

- Docker et Docker Compose installés sur la machine de développement et sur le serveur de production.
- Le code source de l'application modifié et testé localement.
- Un Dockerfile adapté pour la production (voir section 3.1).
- Un compte sur un registre Docker (ex: Docker Hub, GitLab Container Registry, GitHub Packages) pour stocker l'image.
- Accès SSH au serveur de production avec les droits nécessaires.

---

## 3. Préparation et Création de l'Image Docker de Production

### 3.1. Adapter le Dockerfile pour la Production

Le Dockerfile doit être optimisé pour un environnement de production. Voici les points clés (la plupart sont déjà gérés par le Dockerfile de Fab-manager) :

- **Image de base** : Utiliser une image de base officielle et à jour pour votre langage/framework (ex: `ruby:2.6-slim` pour Rails, en s'assurant de la compatibilité avec Fab-manager 6.3). Les versions "slim" ou "alpine" sont souvent plus légères.
- **Variables d'environnement** : Définir les variables d'environnement pour le mode production :

    ```dockerfile
    ENV RAILS_ENV=production
    ENV RACK_ENV=production
    ENV NODE_ENV=production
    ```

- **Dépendances** : Installer uniquement les dépendances de production. Pour Ruby on Rails :

    ```dockerfile
    # Copier Gemfile et Gemfile.lock
    COPY Gemfile Gemfile.lock ./
    # Installer les gems sans les groupes development et test
    RUN bundle install --jobs $(nproc) --retry 3 --without development test
    ```

    Pour JavaScript (si applicable, et si les assets sont compilés dans l'image) :

    ```dockerfile
    # COPY package.json yarn.lock ./
    # RUN yarn install --production --frozen-lockfile
    ```

- **Copie du code source** :

    ```dockerfile
    COPY . .
    ```

- **Précompilation des assets** :

    ```dockerfile
    # S'assurer que SECRET_KEY_BASE est disponible si nécessaire pour assets:precompile
    # Peut être passé comme ARG au moment du build ou défini temporairement si une valeur factice suffit pour la compilation
    # ARG SECRET_KEY_BASE_ARG
    # ENV SECRET_KEY_BASE=$SECRET_KEY_BASE_ARG
    RUN bundle exec rails assets:precompile
    ```

- **Nettoyage (optionnel)** :

    ```dockerfile
    # Exemple pour Debian/Ubuntu
    # RUN apt-get clean && rm -rf /var/lib/apt/lists/*
    ```

- **Utilisateur non-root** :

    ```dockerfile
    # RUN useradd -m myappuser
    # USER myappuser
    ```

- **Point d'entrée (CMD ou ENTRYPOINT)** :

    ```dockerfile
    # CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
    ```

---

### 3.2. Utiliser un Fichier `.dockerignore`

Pour éviter d'inclure des fichiers inutiles ou sensibles dans le contexte de build et dans l'image finale, utilisez un fichier `.dockerignore` à la racine de votre projet. Exemples :

```
.git
.vscode/
.dockerignore
Dockerfile
README.md
log/*
tmp/*
node_modules/
.env
coverage/
.docker/
```

---

### 3.3. Construire l'Image (`docker build`)

Depuis la racine de votre projet (où se trouve le Dockerfile) :

```sh
docker build -t votre-registre/nom-image-prod:tag-version .
```

Exemple :

```sh
docker build -t moncomptegh/fabmanager-tps:6.3.1-prod .
```

Utilisez des tags clairs et versionnés (ex: `v1.0.0`, `release-20240521`). Évitez `latest` pour les déploiements en production.

---

## 4. Tester l'Image de Production en Local

Avant de pousser l'image, testez-la localement en simulant un environnement de production.

Lancer un conteneur avec les variables d'environnement de production :

```sh
docker run -d -p 3000:3000 \
  -e RAILS_ENV=production \
  -e DATABASE_URL="postgresql://user_dev:pass_dev@host.docker.internal:5432/fabmanager_dev_local" \
  -e SECRET_KEY_BASE="une_vraie_cle_secrete_pour_le_test" \
  --name test-prod-app \
  votre-registre/nom-image-prod:tag-version
```

- `host.docker.internal` peut être utilisé pour accéder aux services sur la machine hôte depuis le conteneur (sur Docker Desktop pour Mac/Windows).
- Adaptez l'URL de la base de données si vous testez avec une base de données conteneurisée séparée.

**Vérifications :**

- Consultez les logs :

    ```sh
    docker logs test-prod-app
    ```

- Accédez à l'application via [http://localhost:3000](http://localhost:3000).
- Testez les fonctionnalités clés et les modifications apportées.

Arrêter et supprimer le conteneur de test :

```sh
docker stop test-prod-app
docker rm test-prod-app
```

---

## 5. Pousser l'Image vers un Registre Docker

Une fois l'image validée :

- Connectez-vous à votre registre :

    ```sh
    docker login votre-registre.com
    ```

- Poussez l'image :

    ```sh
    docker push votre-registre/nom-image-prod:tag-version
    ```

---

## 6. Déploiement / Mise à Jour en Production avec Docker Compose

Ces étapes supposent une infrastructure de production existante gérée par Docker Compose.

1. **Connectez-vous au serveur de production via SSH.**
2. **Accédez au répertoire de votre application** (où se trouve le fichier `docker-compose.yml` de production) :

    ```sh
    cd /apps/fabmanager
    ```

3. **Mettez à jour `docker-compose.yml` (si nécessaire) :**

    Modifiez la directive `image` du service de votre application (nommé `fabmanager` dans cet exemple) pour pointer vers le nouveau tag de votre image :

    ```yaml
    services:
      fabmanager:
        image: votre-registre/nom-image-prod:nouveau-tag-version
        # ... autres configurations du service (ports, volumes, environment, depends_on, etc.)
    ```

4. **Tirez la nouvelle version de l'image spécifiée :**

    ```sh
    docker compose pull fabmanager
    ```

5. **Arrêtez le service applicatif en cours d'exécution :**

    ```sh
    docker compose stop fabmanager
    ```

6. **Supprimez les anciens assets** (si les assets sont gérés dans un volume et non uniquement dans l'image) :

    Cette étape est cruciale si vos assets sont compilés dans un volume qui persiste entre les déploiements et que vous voulez vous assurer que seuls les nouveaux assets sont servis.

    ```sh
    docker compose run --rm fabmanager sh -c "rm -Rf public/packs/* public/assets/*"
    ```

7. **Précompilez les nouveaux assets en utilisant la nouvelle image :**

    ```sh
    docker compose run --rm fabmanager bundle exec rails assets:precompile
    ```

    > Assurez-vous que les variables d'environnement nécessaires (comme `RAILS_ENV=production` et `SECRET_KEY_BASE`) sont disponibles pour cette commande, soit via les définitions du service `fabmanager` dans `docker-compose.yml`, soit en les passant explicitement avec l'option `-e` de `docker compose run`.

8. **Redémarrez l'ensemble des services (ou uniquement l'application si les autres n'ont pas changé) :**

    ```sh
    docker compose up -d --remove-orphans
    ```

    - `up -d` redémarre les services en mode détaché.
    - `--remove-orphans` supprime les conteneurs des services qui ne sont plus définis dans le fichier Compose.

9. **Vérifications post-déploiement :**

    - Consultez les logs de l'application :

        ```sh
        docker compose logs -f fabmanager
        ```

    - Testez l'application via son nom de domaine et vérifiez que les modifications et les nouvelles fonctionnalités sont actives.
    - Surveillez les performances et les erreurs potentielles.

---

## 7. Considérations Importantes

- **Sauvegardes** : Avant toute mise à jour majeure en production, assurez-vous d'avoir une sauvegarde récente et testée de votre base de données et de toutes vos données persistantes (volumes Docker).
- **Temps d'arrêt** : La séquence ci-dessus implique un court temps d'arrêt pendant que le service applicatif est arrêté, que les assets sont recompilés (si nécessaire), et que le service est redémarré. Pour des déploiements sans interruption, des stratégies plus avancées (blue/green, canary, rolling updates avec un orchestrateur comme Kubernetes) sont nécessaires.
- **Rollback** : Ayez une stratégie de retour en arrière claire en cas de problème après le déploiement. Cela implique généralement de pouvoir redéployer rapidement la version précédente de l'image (en changeant le tag dans `docker-compose.yml` et en relançant `docker compose pull fabmanager && docker compose up -d --remove-orphans fabmanager`).
- **Gestion des secrets** : Utilisez des méthodes sécurisées pour gérer les variables d'environnement sensibles en production (ex: Docker secrets, HashiCorp Vault, variables d'environnement injectées par le système d'hébergement ou un fichier `.env` sécurisé sur le serveur et non versionné).
- **Tests** : Des tests automatisés (unitaires, intégration, end-to-end) sont cruciaux pour s'assurer de la qualité avant de construire une image de production.

---

Ce guide fournit une base pour la création et le déploiement d'images Docker. Adaptez-le toujours aux spécificités de votre application, de votre workflow de compilation d'assets, et de votre infrastructure de production.