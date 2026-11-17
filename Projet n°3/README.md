# IoT Dashboard Builder

Un dashboard **universel en glisser-déposer** pour la formation IoT : les étudiants
construisent leur tableau de bord **à la souris, sans écrire une ligne de code**.

- 100 % HTML / CSS / JavaScript (fichiers séparés) — **aucune installation, aucun internet requis**
- Un **seul broker MQTT** pour tout le dashboard (préconfiguré par le formateur)
- Chaque composant se lie à **son propre topic** en cliquant dessus
- Thème clair, couleurs modifiables, sauvegarde automatique

## Démarrage

1. Dézippez le dossier.
2. Ouvrez **`index.html`** dans Chrome / Edge / Firefox (double-clic, pas besoin de serveur web).

## Configuration du broker (formateur — une seule fois)

Ouvrez **`js/config.js`** et modifiez l'adresse :

```js
broker: { url: 'ws://localhost:9001', username: '', password: '' }
```

- Dashboard sur le **même PC** que Mosquitto : `ws://localhost:9001`
- Dashboard sur **un autre PC** (hotspot) : `ws://IP_DU_PC:9001` (ex. `ws://192.168.137.1:9001`)
- `lockBroker: true` cache le bouton « Broker » pour que les étudiants ne puissent pas le changer.

> Le navigateur ne parle pas au port MQTT classique (1883) : il faut un port **WebSocket**.
> Avec Mosquitto, ajoutez dans `mosquitto.conf` :
>
> ```
> listener 1883
> protocol mqtt
>
> listener 9001
> protocol websockets
>
> allow_anonymous true
> ```
>
> puis relancez Mosquitto. Vos ESP32 continuent d'utiliser le port 1883 normalement.

## Utilisation (étudiants)

1. **Ajouter** : glissez un composant depuis la colonne de gauche (ou cliquez dessus).
2. **Lier** : cliquez sur le composant → panneau de droite → section **🔗 Liaison MQTT**.
   Tapez le topic, ou cliquez sur **📡 Choisir** : la liste des topics reçus du broker s'affiche, un clic suffit.
3. **Déplacer / redimensionner** : tirez le composant, ou ses poignées bleues (droite, bas, coin).
4. **Colorer** : section **🎨 Apparence** (palette claire + sélecteur libre).
5. **Tester** : bouton **▶ Aperçu** (les interrupteurs, boutons et curseurs deviennent actifs).
6. **Sauvegarder** : automatique dans le navigateur ; **💾 Exporter** / **📂 Importer** pour un fichier `.json`.

Pas de broker sous la main ? Le bouton **🧪 Démo** simule des données pour tester la mise en page.

### Composants disponibles

| Groupe | Composants |
|---|---|
| Affichage | Valeur, Jauge, Barre/Niveau (horizontale ou thermomètre), Voyant LED, Tableau de topics, Journal de messages |
| Graphiques | Courbe, Aire, Barres, Anneau — **plusieurs topics séparés par une virgule = plusieurs courbes** |
| Contrôle | Interrupteur, Bouton, Curseur, Envoi de texte (publient vers le broker) |
| Décor | Texte, Formes (rectangle, arrondi, cercle, triangle, lignes) |

### Astuces

- **Message JSON** (ex. `{"temp":23.5,"hum":60}`) : renseignez *Champ JSON* = `temp` (ou `data.temp` pour un champ imbriqué).
- **Alertes** : Valeur, Jauge et Barre changent de couleur au-dessus / en dessous d'un seuil.
- **Jokers MQTT** : le Tableau et le Journal acceptent `+` et `#` (ex. `lab/#`).
- **Interrupteur** : renseignez aussi le *topic d'état* pour que l'interrupteur suive l'état réel de l'actionneur.
- Raccourcis : `Suppr` supprimer · `Ctrl+D` dupliquer · `Ctrl+Z / Ctrl+Y` annuler / rétablir · flèches = déplacer.

## Structure du projet

```
iot-dashboard/
├── index.html            page principale
├── css/style.css         thème clair
├── js/
│   ├── config.js         ← broker préconfiguré (à modifier par le formateur)
│   ├── mqtt-manager.js   connexion MQTT unique + abonnements
│   ├── widgets.js        tous les composants (ajoutez les vôtres ici)
│   ├── editor.js         glisser-déposer, redimensionnement, panneau, historique
│   └── app.js            barre d'outils, réglages, mode démo
└── libs/                 MQTT.js et Chart.js en local (fonctionne hors ligne)
```

### Ajouter un nouveau composant

Dans `js/widgets.js`, copiez un bloc `def('value', {...})` : donnez-lui un nom, des `props`
(valeurs par défaut), des `fields` (ce qui apparaît dans le panneau) et une fonction `mount()`
qui dessine le composant et renvoie `{ update(info) }` appelée à chaque message reçu.

## Dépannage

| Symptôme | Solution |
|---|---|
| Pastille rouge « Erreur » / « Déconnecté » | Vérifiez que Mosquitto a le `listener 9001` + `protocol websockets`, et l'adresse `ws://…` (bouton ⚙️ Broker). |
| Connecté mais aucun topic dans « 📡 Choisir » | Aucun message reçu : vérifiez que l'ESP32 publie bien sur ce broker. |
| Page ouverte en `https://` | Un site https ne peut pas utiliser `ws://` (mélange bloqué). Ouvrez le fichier en local (`file://`) ou en `http://`. |
| Un composant affiche `--` | Le message n'est pas un nombre : utilisez *Champ JSON* si c'est du JSON. |

Licence : libre pour la formation. Bibliothèques incluses : MQTT.js (MIT), Chart.js (MIT).
