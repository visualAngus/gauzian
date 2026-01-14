<template>
  <div class="folder-three" :data-folder-id="node.folder_id">
    <div class="div_name_bnt" :class="{ 'is-active-folder': activeId === node.folder_id }">
      <button class="tree-toggle" @click.stop="$emit('toggle', node)" v-if="(node.children?.length ?? 0) > 0 || !node.isLoaded">
        <span v-if="node.isLoading">⋯</span>
        <span v-else-if="(node.children?.length ?? 0) > 0 || !node.isLoaded">
          {{ node.isExpanded ? '▾' : '▸' }}
        </span>
        <span v-else>&nbsp;</span>
      </button>
      <a
        class="three-folder-name"
        :class="{ select_folder_three: activeId === node.folder_id }"
        @click.prevent="$emit('select', node)"
      >
        {{ node.metadata?.folder_name || "Dossier sans nom" }}
      </a>
    </div>
    <div class="div_enfants" v-show="node.isExpanded">
      <FolderTreeNode
        v-for="child in node.children"
        :key="child.folder_id"
        :node="child"
        :active-id="activeId"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({
  node: {
    type: Object,
    required: true,
  },
  activeId: {
    type: String,
    required: true,
  },
});

defineEmits(['select', 'toggle']);
</script>
