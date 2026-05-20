# Gestionnaire de tâches collaboratif

Projet minimal pour une to-do list collaborative avec API REST, authentification, tags et priorités.

## Fonctionnalités

- CRUD complet des tâches
- Inscription / connexion des utilisateurs
- Partage et collaboration autour des tâches
- Sélection des collaborateurs depuis la liste des utilisateurs existants
- Catégorisation avec priorité et tags
- API REST pour les tâches
- Interface responsive

## Installation

1. Ouvrir un terminal dans le dossier du projet
2. Installer les dépendances :

```bash
npm install
```

3. Démarrer le serveur :

```bash
npm start
```

4. Ouvrir `http://localhost:3000` dans le navigateur

## Docker

1. Construire l image Docker :

```bash
docker build -t gestionnaire-taches .
```

2. Lancer le conteneur :

```bash
docker run -p 3000:3000 --name gestionnaire-taches gestionnaire-taches
```

3. Ouvrir `http://localhost:3000` dans le navigateur

> Vous pouvez aussi démarrer avec Docker Compose :
>
> ```bash
docker-compose up --build
> ```

## Structure

- `server.js` : point d entrée du serveur Express
- `db.js` : initialisation SQLite et helpers SQL
- `routes/auth.js` : routes d authentification
- `routes/tasks.js` : routes CRUD des tâches
- `public/` : interface frontend

## Notes

- Le token JWT est stocké localement dans le navigateur
- Les tâches sont liées à l utilisateur connecté
- La base de données SQLite est créée dans `data.sqlite`
