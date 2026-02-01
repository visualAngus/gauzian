<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
                <div class="modal-container">
                    <!-- Header -->
                    <div class="modal-header">
                        <h2 class="modal-title">Gérer les catégories</h2>
                        <button class="modal-close" @click="closeModal" aria-label="Fermer">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="modal-body">
                        <!-- Liste des catégories -->
                        <div class="categories-list">
                            <div
                                v-for="category in categories"
                                :key="category.id"
                                class="category-row"
                                :class="`category-${category.color}`"
                            >
                                <div class="category-info">
                                    <span class="category-initial">{{ category.icon }}</span>
                                    <span class="category-name">{{ category.name }}</span>
                                </div>
                                <div class="category-actions">
                                    <button
                                        class="btn-action btn-edit"
                                        @click="editCategory(category)"
                                    >
                                        Modifier
                                    </button>
                                    <button
                                        class="btn-action btn-delete"
                                        @click="confirmDelete(category)"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Formulaire d'ajout/édition -->
                        <div class="add-category-form">
                            <h3 class="form-title">
                                {{ editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}
                            </h3>

                            <div class="form-group">
                                <label class="form-label">Nom</label>
                                <input
                                    v-model="newCategoryName"
                                    type="text"
                                    class="form-input"
                                    placeholder="Ex: Rendez-vous"
                                    maxlength="30"
                                />
                            </div>

                            <div class="form-group">
                                <label class="form-label">Initiales (2 lettres)</label>
                                <input
                                    v-model="newCategoryIcon"
                                    type="text"
                                    class="form-input"
                                    placeholder="Ex: RV"
                                    maxlength="2"
                                    @input="newCategoryIcon = newCategoryIcon.toUpperCase()"
                                />
                            </div>

                            <div class="form-group">
                                <label class="form-label">Couleur</label>
                                <div class="color-grid">
                                    <button
                                        v-for="color in availableColors"
                                        :key="color.value"
                                        class="color-button"
                                        :class="{ active: newCategoryColor === color.value }"
                                        :style="{ backgroundColor: color.hex }"
                                        @click="newCategoryColor = color.value"
                                    >
                                        <svg v-if="newCategoryColor === color.value" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M13 4L6 11L3 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button
                                    v-if="editingCategory"
                                    class="btn btn-secondary"
                                    @click="cancelEdit"
                                >
                                    Annuler
                                </button>
                                <button
                                    class="btn btn-primary"
                                    @click="saveCategory"
                                    :disabled="!newCategoryName || !newCategoryIcon || newCategoryIcon.length !== 2"
                                >
                                    {{ editingCategory ? 'Modifier' : 'Ajouter' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useCategories } from '~/composables/agenda/useCategories';

const props = defineProps({
    isOpen: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['close']);

const {
    categories,
    addCustomCategory,
    removeCustomCategory,
    updateCustomCategory,
    getCategoryById
} = useCategories();

const newCategoryName = ref('');
const newCategoryIcon = ref('');
const newCategoryColor = ref('blue');
const editingCategory = ref(null);

const availableColors = [
    { value: 'blue', hex: '#4A90E2' },
    { value: 'green', hex: '#10B981' },
    { value: 'red', hex: '#EF4444' },
    { value: 'orange', hex: '#F59E0B' },
    { value: 'purple', hex: '#8B5CF6' },
    { value: 'teal', hex: '#14B8A6' },
    { value: 'pink', hex: '#EC4899' },
    { value: 'gray', hex: '#6B7280' }
];

const closeModal = () => {
    emit('close');
    resetForm();
};

const resetForm = () => {
    newCategoryName.value = '';
    newCategoryIcon.value = '';
    newCategoryColor.value = 'blue';
    editingCategory.value = null;
};

const editCategory = (category) => {
    editingCategory.value = category;
    newCategoryName.value = category.name;
    newCategoryIcon.value = category.icon;
    newCategoryColor.value = category.color;
};

const cancelEdit = () => {
    resetForm();
};

const saveCategory = () => {
    if (!newCategoryName.value || !newCategoryIcon.value || newCategoryIcon.value.length !== 2) {
        return;
    }

    if (editingCategory.value) {
        // Modification
        updateCustomCategory(editingCategory.value.id, {
            name: newCategoryName.value,
            icon: newCategoryIcon.value.toUpperCase(),
            color: newCategoryColor.value
        });
    } else {
        // Ajout
        addCustomCategory({
            name: newCategoryName.value,
            icon: newCategoryIcon.value.toUpperCase(),
            color: newCategoryColor.value
        });
    }

    resetForm();
};

const confirmDelete = (category) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${category.name}" ?`)) {
        removeCustomCategory(category.id);
    }
};

watch(() => props.isOpen, (isOpen) => {
    if (!isOpen) {
        resetForm();
    }
});
</script>

<style scoped>
/* Modal Overlay */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
}

.modal-container {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Modal Header */
.modal-header {
    padding: 24px 28px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.modal-title {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
}

.modal-close {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;
}

.modal-close:hover {
    background-color: #f3f4f6;
    color: #111827;
}

/* Modal Body */
.modal-body {
    padding: 24px 28px;
    overflow-y: auto;
    flex: 1;
}

/* Categories List */
.categories-list {
    margin-bottom: 32px;
}

.category-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border: 1px solid #e5e7eb;
    border-left: 3px solid;
    border-radius: 8px;
    margin-bottom: 8px;
}

.category-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.category-initial {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: inherit;
}

.category-name {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
}

.category-actions {
    display: flex;
    gap: 8px;
}

.btn-action {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-edit {
    background-color: #f3f4f6;
    color: #374151;
}

.btn-edit:hover:not(:disabled) {
    background-color: #e5e7eb;
}

.btn-edit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-delete {
    background-color: #fef2f2;
    color: #ef4444;
}

.btn-delete:hover {
    background-color: #fee2e2;
}

/* Category Colors */
.category-blue { border-left-color: #4A90E2; color: #4A90E2; }
.category-green { border-left-color: #10B981; color: #10B981; }
.category-red { border-left-color: #EF4444; color: #EF4444; }
.category-orange { border-left-color: #F59E0B; color: #F59E0B; }
.category-purple { border-left-color: #8B5CF6; color: #8B5CF6; }
.category-teal { border-left-color: #14B8A6; color: #14B8A6; }
.category-pink { border-left-color: #EC4899; color: #EC4899; }
.category-gray { border-left-color: #6B7280; color: #6B7280; }

/* Add Category Form */
.add-category-form {
    padding: 20px;
    background-color: #f9fafb;
    border-radius: 12px;
}

.form-title {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin: 0 0 20px 0;
}

.form-group {
    margin-bottom: 16px;
}

.form-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
}

.form-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #111827;
    background-color: #ffffff;
    transition: all 0.2s;
}

.form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.color-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 8px;
}

.color-button {
    width: 100%;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.color-button:hover {
    transform: scale(1.1);
}

.color-button.active {
    border-color: #111827;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
}

.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background-color: #3b82f6;
    color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-secondary {
    background-color: #f3f4f6;
    color: #374151;
}

.btn-secondary:hover {
    background-color: #e5e7eb;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
    transition: transform 0.3s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
    transform: scale(0.95);
}

/* Responsive */
@media (max-width: 768px) {
    .modal-container {
        max-height: 100vh;
        border-radius: 0;
    }

    .color-grid {
        grid-template-columns: repeat(4, 1fr);
    }
}
</style>
