# Intégration Ollama

## Vue d'ensemble

Tarifique intègre Ollama pour fournir des capacités d'IA locale et cloud. Ollama permet d'exécuter des modèles de langage (LLM) soit localement sur votre machine, soit via un service cloud géré.

## Modes de déploiement

### 1. Ollama Local

Exécutez les modèles directement sur votre infrastructure.

**Avantages:**
- Contrôle total des données
- Pas de coûts API récurrents
- Latence réduite
- Confidentialité maximale

**Prérequis:**
- Installation d'Ollama sur votre serveur
- Ressources matérielles suffisantes (GPU recommandé)
- Configuration réseau appropriée

**Installation:**

```bash
# Linux / macOS
curl -fsSL https://ollama.com/install.sh | sh

# Démarrer le service
ollama serve

# Télécharger un modèle
ollama pull llama3.2
ollama pull mistral
```

**Configuration dans Tarifique:**

1. Accédez à Admin → AI Providers
2. Ajoutez une nouvelle configuration Ollama Local
3. URL par défaut: `http://localhost:11434`
4. Testez la connexion

### 2. Ollama Cloud

Utilisez le service cloud géré pour une mise en œuvre simplifiée.

**Avantages:**
- Aucune infrastructure à gérer
- Mise à l'échelle automatique
- Disponibilité 24/7
- Modèles pré-chargés

**Configuration:**

1. Créez un compte sur [ollama.com](https://ollama.com)
2. Obtenez votre clé API
3. Dans Tarifique, configurez Ollama Cloud avec votre clé

## Modèles disponibles

### Modèles recommandés pour Tarifique

| Modèle | Taille | Cas d'usage | Performance |
|--------|--------|-------------|-------------|
| llama3.2 | 3B | Analyse rapide, classification | ⚡⚡⚡ |
| mistral | 7B | Analyse détaillée, enrichissement | ⚡⚡ |
| gemma2 | 9B | Analyse complexe, raisonnement | ⚡ |

### Télécharger des modèles

```bash
# Modèle léger pour analyses rapides
ollama pull llama3.2

# Modèle équilibré (recommandé)
ollama pull mistral

# Modèle avancé pour analyses approfondies
ollama pull gemma2
```

## Cas d'usage dans Tarifique

### 1. Enrichissement automatique

Ollama peut analyser les descriptions produits et extraire:
- Caractéristiques techniques
- Matériaux et compositions
- Dimensions et poids
- Informations de sécurité

**Exemple:**

```typescript
// Enrichissement via Ollama
const enrichmentPrompt = `Analyse ce produit et extrait les informations clés:
${productDescription}

Format de sortie JSON:
{
  "specifications": {},
  "materials": [],
  "dimensions": {},
  "safety_info": []
}`;

const response = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    model: 'mistral',
    prompt: enrichmentPrompt,
    stream: false
  })
});
```

### 2. Classification automatique

Classement des produits dans les taxonomies Amazon/Google.

### 3. Détection de mapping

Identification automatique des colonnes dans les fichiers fournisseurs.

### 4. Génération de descriptions

Création de descriptions marketing optimisées SEO.

## Configuration avancée

### Paramètres de génération

```json
{
  "model": "mistral",
  "temperature": 0.7,
  "top_p": 0.9,
  "top_k": 40,
  "num_predict": 2048,
  "repeat_penalty": 1.1
}
```

**Paramètres recommandés par cas d'usage:**

| Cas d'usage | Temperature | Top_p | Top_k |
|-------------|-------------|-------|-------|
| Classification | 0.1 | 0.5 | 10 |
| Enrichissement | 0.7 | 0.9 | 40 |
| Génération créative | 1.0 | 0.95 | 50 |

### Gestion de la mémoire

Pour optimiser les performances:

```bash
# Limiter la mémoire GPU utilisée
OLLAMA_MAX_LOADED_MODELS=2 ollama serve

# Définir la mémoire maximale par modèle
OLLAMA_MAX_QUEUE=512 ollama serve
```

## Monitoring

### Dashboard de santé

Tarifique inclut un dashboard de monitoring Ollama:
- État de connexion (online/offline/degraded)
- Temps de réponse moyens
- Modèles chargés
- Métriques d'utilisation

Accès: Admin → Système → Ollama Health

### Métriques à surveiller

1. **Response Time**: < 5000ms pour expérience optimale
2. **Availability**: > 99% recommandé
3. **Memory Usage**: surveiller pour éviter OOM
4. **GPU Utilization**: 70-90% optimal

## Résolution de problèmes

### Problème: "Connection refused"

**Solution:**
```bash
# Vérifier que le service est actif
systemctl status ollama

# Redémarrer si nécessaire
systemctl restart ollama
```

### Problème: "Out of memory"

**Solution:**
```bash
# Utiliser un modèle plus petit
ollama pull llama3.2  # 3B au lieu de 7B

# Ou augmenter la mémoire GPU disponible
nvidia-smi  # Vérifier l'utilisation GPU
```

### Problème: Réponses lentes

**Solutions:**
1. Utiliser un modèle plus léger
2. Activer le GPU si disponible
3. Réduire `num_predict`
4. Augmenter les ressources système

## Sécurité

### Bonnes pratiques

1. **Authentification**: Protégez l'accès à Ollama avec un reverse proxy
2. **Réseau**: Limitez l'accès uniquement aux services autorisés
3. **Données**: Les données ne quittent jamais votre infrastructure en mode local
4. **Logs**: Activez les logs pour audit

### Configuration sécurisée

```nginx
# Exemple de configuration Nginx
location /ollama/ {
    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    proxy_pass http://localhost:11434/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Performance

### Optimisations

1. **Préchargement des modèles:**
```bash
# Précharger au démarrage
ollama run mistral ""
```

2. **Cache des embeddings:** Activer pour réduire les temps de génération

3. **Batch processing:** Grouper les requêtes similaires

### Benchmarks

| Configuration | Tokens/sec | Latence P95 |
|---------------|-----------|-------------|
| CPU (16 cores) | 10-20 | ~3000ms |
| GPU (RTX 3090) | 100-150 | ~500ms |
| Cloud (géré) | 80-120 | ~800ms |

## Support

### Resources

- Documentation officielle: https://ollama.com/docs
- GitHub: https://github.com/ollama/ollama
- Discord: https://discord.gg/ollama

### Contact Tarifique

Pour toute question spécifique à l'intégration Ollama dans Tarifique:
- Email: support@tarifique.com
- Documentation: https://docs.tarifique.com

## Changelog

### v1.0.0 (2025-01-15)
- Intégration initiale Ollama Local
- Support Ollama Cloud
- Dashboard de monitoring
- Configuration des prompts personnalisés

### Roadmap

- [ ] Support multi-modèles simultanés
- [ ] Fine-tuning personnalisé
- [ ] Intégration avec vector databases
- [ ] API de génération d'embeddings
