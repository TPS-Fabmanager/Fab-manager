Guide d'Installation de Fab-manager en Environnement de Développement avec Docker
Ce document détaille les étapes nécessaires à la mise en place d'un environnement de développement pour Fab-manager en utilisant Docker et Docker Compose. Il est à noter que cette procédure est technique ; pour une utilisation en production sans modification du code source, la méthode d'installation en production est à privilégier.

1. Prérequis Généraux et Configuration Initiale
Avant de commencer, assurez-vous que votre système d'exploitation est compatible (Ubuntu LTS 16.04+, Debian 8+ sur architecture x86 64-bits sont officiellement supportés).

Installation de RVM (Ruby Version Manager) :
Installez RVM en suivant la documentation officielle. Puis, installez la version de Ruby spécifiée dans le fichier .ruby-version à la racine du projet Fab-manager.

Installation de NVM (Node Version Manager) :
Installez NVM en vous référant à son guide d'installation officiel. Utilisez ensuite NVM pour installer la version de Node.js indiquée dans le fichier .nvmrc du projet.

Installation de Yarn :
Installez Yarn, le gestionnaire de paquets pour les dépendances frontend. La méthode d'installation peut varier selon votre système d'exploitation ; consultez la documentation officielle de Yarn.

Installation de Docker :
Installez une version récente de Docker Engine. Bien que votre système puisse proposer Docker via ses dépôts, cette version peut être obsolète. Référez-vous à la documentation officielle de Docker pour l'installation.

Configuration des droits Docker (Linux) :
Pour utiliser Docker sans sudo, ajoutez votre utilisateur actuel au groupe docker :

sudo groupadd docker # Si le groupe n'existe pas déjà
sudo usermod -aG docker $(whoami)

Un redémarrage de la session ou du système (sudo reboot) est nécessaire pour que ces changements prennent effet.

Récupération du Projet Fab-manager :
Clonez le dépôt Git du projet :

git clone https://github.com/TPS-Fabmanager/Fab-manager.git

Mise en Place des Dépendances Docker :
Placez-vous dans le répertoire du projet (cd fab-manager).

Attention pour macOS X : Il est impératif de modifier au préalable les fichiers de configuration Docker situés dans docker/development/ pour utiliser le "port binding" au lieu du "ip-based binding". Cela s'effectue en décommentant les directives ports et en commentant les directives networks dans le fichier docker-compose.yml (ou son équivalent pour le développement). Le fichier hosts doit également être ajusté en conséquence.

En cas d'erreur ERROR: Pool overlaps with other one on this address space : Modifiez les fichiers /etc/hosts et docker-compose.yml pour changer le réseau de 172.18.y.z à 172.x.y.z, où x est un identifiant de réseau non utilisé.

Exécutez les commandes suivantes pour configurer les services Docker :

cat docker/development/hosts | sudo tee -a /etc/hosts # Ajoute les hôtes nécessaires
mkdir -p .docker/elasticsearch/config
cp docker/development/docker-compose.yml .docker/ # Copie la configuration Docker Compose adaptée au développement
cp setup/elasticsearch.yml .docker/elasticsearch/config # Configuration Elasticsearch
cp setup/log4j2.properties .docker/elasticsearch/config # Configuration des logs Elasticsearch
cd .docker
docker-compose up -d # Démarre les services en arrière-plan
cd - # Retour au répertoire racine du projet

Installation des Autres Dépendances Système :

Pour Ubuntu/Debian :

# Sur Ubuntu 18.04 server, activer le dépôt "universe" si nécessaire
sudo add-apt-repository universe
sudo apt-get update
sudo apt-get install libpq-dev imagemagick

Pour macOS X :

brew install imagemagick libpq # Assurez-vous que libpq est lié si nécessaire

Pour les autres systèmes, installez les paquets équivalents pour ImageMagick et les bibliothèques de développement PostgreSQL.

Initialisation et Vérification de RVM et NVM :
Assurez-vous que les bonnes versions de Ruby et Node.js sont actives pour le projet :

# Naviguez dans le répertoire fab-manager si vous n'y êtes pas déjà
rvm use $(cat .ruby-version)@fab-manager --create # Crée et utilise le gemset si nécessaire
rvm current | grep -q "$(cat .ruby-version)@fab-manager" && echo "RVM OK"
# Doit afficher RVM OK
nvm use
node --version | grep -q "$(cat .nvmrc)" && echo "NVM OK"
# Doit afficher NVM OK

Si l'une des commandes n'affiche pas "OK", essayez d'exécuter rvm use ou nvm use manuellement.

Installation de Bundler :
Installez Bundler dans le gemset RVM courant :

gem install bundler

Installation des Dépendances du Projet :
Installez les gems Ruby et les paquets JavaScript :

bundle install
yarn install

Configuration de l'Application :
Créez les fichiers de configuration par défaut et adaptez-les à votre environnement :

cp config/database.yml.default config/database.yml
cp env.example .env
# Éditez le fichier .env avec vos paramètres (clés API, etc.)
# Utilisez votre éditeur de texte favori, par exemple :
# nano .env
# vi .env

Consultez la documentation environment.md du projet Fab-manager pour les détails de configuration des variables d'environnement.

Création et Initialisation des Bases de Données :

Attention : N'exécutez PAS rails db:setup, car cela ne lancerait pas certaines instructions SQL brutes nécessaires.

Note : Le mot de passe administrateur doit avoir une longueur comprise entre 8 et 128 caractères (configurable dans config/initializers/devise.rb).

# Pour l'environnement de développement
rails db:create
rails db:schema:load
ADMIN_EMAIL='votre_email_admin' ADMIN_PASSWORD='votre_mot_de_passe_admin' rails db:seed
rails fablab:es:build_stats # Construction initiale des statistiques pour Elasticsearch

# Pour l'environnement de test (si nécessaire)
RAILS_ENV=test rails db:create
RAILS_ENV=test rails db:schema:load

Activation d'Overcommit (optionnel mais recommandé) :
Overcommit est un outil pour gérer et exécuter des hooks Git.

overcommit --install

Création du Répertoire pour les PID de Sidekiq :
Sidekiq utilise ce répertoire pour stocker les identifiants de ses processus.

mkdir -p tmp/pids

Démarrage du Serveur de Développement :
Utilisez Foreman (ou un équivalent comme bin/dev si fourni par les versions récentes de Rails) pour lancer le serveur :

foreman start -p 5000 
# Ou, si vous utilisez le script bin/dev (souvent pour Rails 7+) :
# ./bin/dev

Le port par défaut est souvent 3000 ou 5000. Adaptez si nécessaire.

Accès à l'Application :
Vous devriez maintenant pouvoir accéder à votre instance locale de Fab-manager via http://localhost:5000 (ou le port configuré) dans votre navigateur web.

Connexion Administrateur :
Connectez-vous avec les identifiants administrateur définis lors de l'étape db:seed.

Vérification des Emails (MailCatcher) :
En environnement de développement, les emails envoyés par la plateforme sont interceptés par MailCatcher. Pour les visualiser, ouvrez http://fabmanager-mailcatcher:1080 (ou l'adresse configurée dans votre docker-compose.yml pour MailCatcher, souvent http://localhost:1080 si MailCatcher tourne localement ou est exposé sur ce port par Docker).

Ce guide couvre les étapes principales pour mettre en place un environnement de développement fonctionnel pour Fab-manager. Des ajustements peuvent être nécessaires en fonction de votre système d'exploitation spécifique et de la version exacte de Fab-manager que vous utilisez.