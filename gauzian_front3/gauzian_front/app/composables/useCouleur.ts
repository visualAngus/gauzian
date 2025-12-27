// ✅ export const (Nommé)
export const useCouleur = () => {
  return useState('couleur', () => 'red')
}

// ❌ export default (Ne marchera pas avec l'auto-import par nom)
// export default function() { ... }