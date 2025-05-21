# Annexe : Guide de Création et Mise à Jour d'une Image Docker Personnalisée pour Fabmanager en Production

Ce document décrit le processus de création d'une image Docker à partir d'un code source modifié de Fabmanager, son intégration avec les mises à jour officielles via Git, et les étapes pour son test et son déploiement en environnement de production en utilisant Docker Compose.

---

## 1. Objectif

L'objectif est de maintenir une image Docker personnalisée pour Fabmanager, intégrant vos modifications spécifiques tout en incorporant les mises à jour de la version officielle. Cette image sera testée localement, poussée vers un registre Docker, et déployée ou mise à jour en production, garantissant la cohérence et la reproductibilité de l'environnement.

---

## 2. Prérequis

- Docker et Docker Compose installés sur la machine de développement et le serveur de production.
- Le code source modifié de Fabmanager, hébergé dans un dépôt Git (ex. : GitHub, GitLab).
- Accès au dépôt officiel de Fabmanager ([https://github.com/sleede/fab-manager](https://github.com/sleede/fab-manager)).
- Un Dockerfile adapté pour la production (basé sur celui fourni par Fabmanager ou modifié).
- Un compte sur un registre Docker (ex. : Docker Hub, GitLab Container Registry) pour stocker l'image.
- Accès SSH au serveur de production avec les droits nécessaires.
- Connaissance de base de Git pour gérer les fusions et résoudre les conflits.

---

## 3. Préparation et Création de l'Image Docker de Production

### 3.1. Configurer le Dépôt Git pour Intégrer les Mises à Jour Officielles

Pour intégrer les mises à jour de la version officielle tout en conservant vos modifications, utilisez Git pour gérer votre code personnalisé et fusionner les changements officiels.

**Initialisez un dépôt Git dans votre répertoire de code modifié (si ce n'est pas déjà fait) :**

```sh
git init
git add .
git commit -m "Initialisation du code personnalisé de Fabmanager"
```

**Poussez votre code vers un dépôt distant (ex. : GitHub) :**

```sh
git remote add origin https://github.com/TPS-Fabmanager/Fab-manager.git
git push -u origin main
```

**Ajoutez le dépôt officiel comme remote :**

```sh
git remote add upstream https://github.com/sleede/fab-manager.git
```

**Récupérez les mises à jour officielles :**

```sh
git fetch upstream
```

**Fusionnez les mises à jour dans votre branche principale :**

```sh
git checkout main
git merge upstream/main
```

Résolvez les conflits si nécessaire (Git signalera les fichiers en conflit). Modifiez ces fichiers, puis marquez-les comme résolus :

```sh
git add fichier_conflit
git commit
```

**Poussez les changements fusionnés vers votre dépôt :**

```sh
git push origin main
```

---

### 3.2. Adapter le Dockerfile pour la Production

Utilisez le Dockerfile fourni par Fabmanager comme base, en vous assurant qu'il est optimisé pour la production. Voici les points clés à vérifier ou ajouter :

- **Image de base** : Utilisez une image légère compatible avec Fabmanager (ex. : `ruby:2.6-slim` pour Fabmanager 6.3).
- **Variables d'environnement** :

    ```dockerfile
    ENV RAILS_ENV=production
    ENV RACK_ENV=production
    ENV NODE_ENV=production
    ```

- **Dépendances** : Installez uniquement les dépendances nécessaires :

    ```dockerfile
    COPY Gemfile Gemfile.lock ./
    RUN bundle install --jobs $(nproc) --retry 3 --without development test
    ```

- **Copie du code source** :

    ```dockerfile
    COPY . .
    ```

- **Précompilation des assets** :

    ```dockerfile
    RUN bundle exec rails assets:precompile
    ```

- **Utilisateur non-root (optionnel, si non présent dans le Dockerfile officiel)** :

    ```dockerfile
    RUN useradd -m fabmanager
    USER fabmanager
    ```

- **Point d'entrée** :

    ```dockerfile
    CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
    ```

Vérifiez le Dockerfile officiel de Fabmanager ([lien](https://github.com/sleede/fab-manager/blob/master/Dockerfile)) pour vous assurer que ces configurations sont déjà incluses ou pour les adapter si nécessaire.

---

### 3.3. Utiliser un Fichier `.dockerignore`

Créez un fichier `.dockerignore` à la racine de votre projet pour exclure les fichiers inutiles ou sensibles :

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
```

---

### 3.4. Construire l'Image Docker

Depuis la racine de votre projet (où se trouve le Dockerfile) :

```sh
docker build -t votre-registre/fabmanager-prod:tag-version .
```

Exemple :

```sh
docker build -t moncomptegh/fabmanager-prod:6.3.1-custom .
```

Utilisez des tags versionnés (ex. : `6.3.1-custom`, `release-20250521`) pour une meilleure traçabilité.

---

## 4. Tester l'Image de Production en Local

Testez l'image localement pour valider vos modifications et les mises à jour fusionnées.

**Lancez un conteneur de test :**

```sh
docker run -d -p 3000:3000 \
  -e RAILS_ENV=production \
  -e DATABASE_URL="postgresql://user_dev:pass_dev@host.docker.internal:5432/fabmanager_dev_local" \
  -e SECRET_KEY_BASE="une_vraie_cle_secrete_pour_le_test" \
  --name test-fabmanager-prod \
  votre-registre/fabmanager-prod:tag-version
```

**Vérifiez les logs :**

```sh
docker logs test-fabmanager-prod
```

**Testez l'application :**

- Accédez à [http://localhost:3000](http://localhost:3000).
- Vérifiez que vos modifications personnalisées et les fonctionnalités mises à jour fonctionnent correctement.

**Arrêtez et supprimez le conteneur de test :**

```sh
docker stop test-fabmanager-prod
docker rm test-fabmanager-prod
```

---

## 5. Pousser l'Image vers un Registre Docker

**Connectez-vous à votre registre :**

```sh
docker login votre-registre.com
```

**Poussez l'image :**

```sh
docker push votre-registre/fabmanager-prod:tag-version
```

---

## 6. Déploiement / Mise à Jour en Production avec Docker Compose

Ces étapes supposent que votre environnement de production utilise Docker Compose.

1. **Connectez-vous au serveur de production via SSH.**
2. **Accédez au répertoire de l'application :**

    ```sh
    cd /apps/fabmanager
    ```

3. **Mettez à jour `docker-compose.yml` :**  
   Modifiez la directive `image` du service `fabmanager` pour pointer vers le nouveau tag :

    ```yaml
    services:
      fabmanager:
        image: votre-registre/fabmanager-prod:tag-version
        # ... autres configurations
    ```

4. **Tirez la nouvelle image :**

    ```sh
    docker compose pull fabmanager
    ```

5. **Arrêtez le service applicatif :**

    ```sh
    docker compose stop fabmanager
    ```

6. **Supprimez les anciens assets (si nécessaire) :**  
   Si les assets sont stockés dans un volume persistant :

    ```sh
    docker compose run --rm fabmanager sh -c "rm -Rf public/packs/* public/assets/*"
    ```

7. **Précompilez les nouveaux assets :**

    ```sh
    docker compose run --rm fabmanager bundle exec rails assets:precompile
    ```

8. **Redémarrez les services :**

    ```sh
    docker compose up -d --remove-orphans
    ```

9. **Vérifications post-déploiement :**

    - Consultez les logs :

        ```sh
        docker compose logs -f fabmanager
        ```

    - Testez l'application via son URL publique.
    - Vérifiez que les modifications et les mises à jour sont opérationnelles.

---

## 7. Considérations Importantes

- **Sauvegardes** : Sauvegardez la base de données et les volumes avant toute mise à jour.
- **Temps d'arrêt** : Le processus implique un court temps d'arrêt. Pour des déploiements sans interruption, envisagez des stratégies avancées (ex. : blue/green deployments).
- **Rollback** : Conservez les anciennes images et versions de `docker-compose.yml` pour un retour en arrière rapide si nécessaire.
- **Gestion des secrets** : Utilisez des variables d'environnement sécurisées (ex. : fichier `.env` non versionné ou Docker secrets).
- **Tests** : Exécutez des tests automatisés avant de construire l'image pour garantir la qualité.

---

Ce guide fournit une méthode claire pour maintenir une image Docker personnalisée de Fabmanager à jour avec la version officielle. Adaptez-le aux spécificités de votre infrastructure et de vos modifications.