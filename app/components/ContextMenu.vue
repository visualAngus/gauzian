<template>
  <div id="div_pannel_right_click" ref="contextMenuRef">
    <a
      v-for="menuItem in visibleItems"
      :key="menuItem.action"
      @click.stop="handleClick(menuItem)"
    >
      {{ menuItem.label }}
    </a>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  clickedItem: {
    type: Object,
    default: null
  },
  activeFolderId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['action', 'close'])

const contextMenuRef = ref(null)

// Configuration déclarative du menu
const menuConfig = [
  // Items pour les dossiers/fichiers
  {
    label: 'Nouveau dossier',
    action: 'createFolder',
    condition: (item, folderId) => 
      (item?.dataset?.itemType === 'folder' || item === null) && 
      folderId !== 'corbeille'
  },
  {
    label: 'Télécharger',
    action: 'download',
    condition: (item, folderId) => 
      item?.dataset && 
      ['file', 'folder'].includes(item.dataset.itemType) && 
      folderId !== 'corbeille'
  },
  {
    label: 'Renommer',
    action: 'rename',
    condition: (item, folderId) => 
      item?.dataset && 
      ['file', 'folder'].includes(item.dataset.itemType) && 
      folderId !== 'corbeille'
  },
  {
    label: 'Restaurer',
    action: 'restore',
    condition: (item, folderId) => 
      item?.dataset && 
      ['file', 'folder'].includes(item.dataset.itemType) && 
      folderId === 'corbeille'
  },
  {
    label: 'Supprimer',
    action: 'delete',
    condition: (item, folderId) => 
      item?.dataset && 
      ['file', 'folder'].includes(item.dataset.itemType)
  },
  {
    label: 'Propriétés',
    action: 'properties',
    condition: (item, folderId) => 
      item?.dataset && 
      ['file', 'folder'].includes(item.dataset.itemType)
  },
  {
    label: 'Partager',
    action: 'share',
    condition: (item, folderId) => 
      item?.dataset && 
      ['file', 'folder'].includes(item.dataset.itemType) && 
      folderId !== 'corbeille'
  },
  // Items pour l'espace vide uniquement
  {
    label: 'Importer des fichiers',
    action: 'importFiles',
    condition: (item, folderId) => 
      item === null && 
      folderId !== 'corbeille'
  }
]

// Filtrer les items visibles selon les conditions
const visibleItems = computed(() => {
  return menuConfig.filter(item => 
    item.condition(props.clickedItem, props.activeFolderId)
  )
})

const handleClick = (menuItem) => {
  emit('action', {
    action: menuItem.action,
    item: props.clickedItem
  })
  emit('close')
}

// Exposer le ref interne pour que le parent puisse contrôler la visibilité
defineExpose({
  get $el() { return contextMenuRef.value }
})
</script>

<style scoped>
#div_pannel_right_click {
  display: none;
  position: fixed;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 180px;
  padding: 4px 0;
}

#div_pannel_right_click a {
  display: block;
  padding: 8px 16px;
  color: #333;
  text-decoration: none;
  cursor: pointer;
  font-size: 14px;
}

#div_pannel_right_click a:hover {
  background: #f5f5f5;
  color: #000;
}
</style>
