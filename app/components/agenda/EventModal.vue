<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
                <div class="modal-container">
                    <!-- Header -->
                    <div class="modal-header">
                        <h2 class="modal-title">
                            {{ isEditMode ? 'Modifier l\'événement' : 'Nouvel événement' }}
                        </h2>
                        <button class="modal-close" @click="closeModal" aria-label="Fermer">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="modal-body">
                        <!-- Titre -->
                        <div class="form-group">
                            <label for="event-title" class="form-label">
                                Titre <span class="required">*</span>
                            </label>
                            <input
                                id="event-title"
                                v-model="formData.title"
                                type="text"
                                class="form-input"
                                placeholder="Entrez le titre de l'événement"
                                :class="{ 'input-error': errors.title }"
                                @input="clearError('title')"
                            />
                            <span v-if="errors.title" class="error-message">{{ errors.title }}</span>
                        </div>

                        <!-- Description -->
                        <div class="form-group">
                            <label for="event-description" class="form-label">Description</label>
                            <textarea
                                id="event-description"
                                v-model="formData.description"
                                class="form-textarea"
                                placeholder="Ajoutez une description (optionnel)"
                                rows="3"
                            ></textarea>
                        </div>

                        <!-- Checkbox Événement multi-jours -->
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    v-model="formData.isMultiDay"
                                    class="checkbox-input"
                                    @change="handleMultiDayChange"
                                />
                                <span class="checkbox-text">Événement sur plusieurs jours</span>
                            </label>
                        </div>

                        <!-- Date unique ou dates multiples -->
                        <div v-if="!formData.isMultiDay" class="form-row">
                            <div class="form-group">
                                <label for="event-day" class="form-label">
                                    Jour <span class="required">*</span>
                                </label>
                                <select
                                    id="event-day"
                                    v-model.number="formData.dayId"
                                    class="form-select"
                                    :class="{ 'input-error': errors.dayId }"
                                    @change="clearError('dayId')"
                                >
                                    <option :value="null">Sélectionner un jour</option>
                                    <option v-for="day in availableDays" :key="day.dayId" :value="day.dayId">
                                        {{ day.dayName }} {{ day.dayNumber }} {{ getMonthName(day.month) }}
                                    </option>
                                </select>
                                <span v-if="errors.dayId" class="error-message">{{ errors.dayId }}</span>
                            </div>
                        </div>

                        <div v-else class="form-row">
                            <div class="form-group">
                                <label for="event-start-day" class="form-label">
                                    Jour de début <span class="required">*</span>
                                </label>
                                <select
                                    id="event-start-day"
                                    v-model.number="formData.startDayId"
                                    class="form-select"
                                    :class="{ 'input-error': errors.startDayId }"
                                    @change="clearError('startDayId')"
                                >
                                    <option :value="null">Sélectionner un jour</option>
                                    <option v-for="day in availableDays" :key="day.dayId" :value="day.dayId">
                                        {{ day.dayName }} {{ day.dayNumber }} {{ getMonthName(day.month) }}
                                    </option>
                                </select>
                                <span v-if="errors.startDayId" class="error-message">{{ errors.startDayId }}</span>
                            </div>

                            <div class="form-group">
                                <label for="event-end-day" class="form-label">
                                    Jour de fin <span class="required">*</span>
                                </label>
                                <select
                                    id="event-end-day"
                                    v-model.number="formData.endDayId"
                                    class="form-select"
                                    :class="{ 'input-error': errors.endDayId }"
                                    @change="clearError('endDayId')"
                                >
                                    <option :value="null">Sélectionner un jour</option>
                                    <option
                                        v-for="day in availableDays"
                                        :key="day.dayId"
                                        :value="day.dayId"
                                        :disabled="formData.startDayId !== null && day.dayId < formData.startDayId"
                                    >
                                        {{ day.dayName }} {{ day.dayNumber }} {{ getMonthName(day.month) }}
                                    </option>
                                </select>
                                <span v-if="errors.endDayId" class="error-message">{{ errors.endDayId }}</span>
                            </div>
                        </div>

                        <!-- Checkbox Toute la journée -->
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    v-model="formData.isAllDay"
                                    class="checkbox-input"
                                    @change="handleAllDayChange"
                                />
                                <span class="checkbox-text">Toute la journée</span>
                            </label>
                        </div>

                        <div v-if="!formData.isAllDay" class="form-row">
                            <div class="form-group">
                                <label for="event-start-hour" class="form-label">
                                    Début <span class="required">*</span>
                                </label>
                                <select
                                    id="event-start-hour"
                                    v-model.number="formData.startHour"
                                    class="form-select"
                                    :class="{ 'input-error': errors.startHour }"
                                    @change="clearError('startHour')"
                                >
                                    <option :value="null">Heure de début</option>
                                    <option v-for="hour in 24" :key="hour - 1" :value="hour - 1">
                                        {{ formatHour(hour - 1) }}
                                    </option>
                                </select>
                                <span v-if="errors.startHour" class="error-message">{{ errors.startHour }}</span>
                            </div>

                            <div class="form-group">
                                <label for="event-end-hour" class="form-label">
                                    Fin <span class="required">*</span>
                                </label>
                                <select
                                    id="event-end-hour"
                                    v-model.number="formData.endHour"
                                    class="form-select"
                                    :class="{ 'input-error': errors.endHour }"
                                    @change="clearError('endHour')"
                                >
                                    <option :value="null">Heure de fin</option>
                                    <option
                                        v-for="hour in 24"
                                        :key="hour"
                                        :value="hour"
                                        :disabled="!formData.isMultiDay && formData.startHour !== null && hour <= formData.startHour"
                                    >
                                        {{ formatHour(hour) }}
                                    </option>
                                </select>
                                <span v-if="errors.endHour" class="error-message">{{ errors.endHour }}</span>
                            </div>
                        </div>

                        <!-- Catégorie -->
                        <div class="form-group">
                            <label class="form-label">
                                Catégorie <span class="required">*</span>
                            </label>
                            <div class="category-grid">
                                <button
                                    v-for="cat in categories"
                                    :key="cat.id"
                                    type="button"
                                    class="category-button"
                                    :class="{
                                        'category-active': formData.category === cat.id,
                                        [`category-${cat.color}`]: formData.category === cat.id
                                    }"
                                    @click="selectCategory(cat.id)"
                                >
                                    <span class="category-icon">{{ cat.icon }}</span>
                                    <span class="category-name">{{ cat.name }}</span>
                                </button>
                            </div>
                            <span v-if="errors.category" class="error-message">{{ errors.category }}</span>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="modal-footer">
                        <button
                            v-if="isEditMode"
                            class="btn btn-danger"
                            @click="handleDelete"
                        >
                            Supprimer
                        </button>
                        <div class="modal-footer-actions">
                            <button class="btn btn-secondary" @click="closeModal">
                                Annuler
                            </button>
                            <button class="btn btn-primary" @click="handleSubmit">
                                {{ isEditMode ? 'Enregistrer' : 'Créer' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useCategories } from '~/composables/agenda/useCategories';

const props = defineProps({
    isOpen: {
        type: Boolean,
        default: false
    },
    event: {
        type: Object,
        default: null
    },
    defaultDayId: {
        type: Number,
        default: null
    },
    defaultStartHour: {
        type: Number,
        default: null
    },
    availableDays: {
        type: Array,
        required: true
    }
});

const emit = defineEmits(['close', 'save', 'delete']);

const { categories, getCategoryById } = useCategories();

// Catégorie par défaut (toujours "other")
const defaultCategory = computed(() => {
    return 'other';
});

const defaultColor = computed(() => {
    const cat = getCategoryById(defaultCategory.value);
    return cat ? cat.color : 'blue';
});

// Form data
const formData = ref({
    title: '',
    description: '',
    dayId: null,
    startDayId: null,
    endDayId: null,
    startHour: null,
    endHour: null,
    isAllDay: false,
    isMultiDay: false,
    category: defaultCategory.value,
    color: defaultColor.value
});

// Errors
const errors = ref({});

// Mode
const isEditMode = computed(() => !!props.event);

// Watchers
watch(() => props.isOpen, (isOpen) => {
    if (isOpen) {
        resetForm();
        if (props.event) {
            // Mode édition
            const isMultiDay = props.event.isMultiDay || (props.event.startDayId !== props.event.endDayId);
            formData.value = {
                title: props.event.title,
                description: props.event.description || '',
                dayId: props.event.dayId,
                startDayId: props.event.startDayId || props.event.dayId,
                endDayId: props.event.endDayId || props.event.dayId,
                startHour: props.event.startHour,
                endHour: props.event.endHour,
                isAllDay: props.event.isAllDay || false,
                isMultiDay: isMultiDay,
                category: props.event.category || 'other',
                color: props.event.color || 'blue'
            };
        } else {
            // Mode création avec valeurs par défaut
            if (props.defaultDayId !== null) {
                formData.value.dayId = props.defaultDayId;
                formData.value.startDayId = props.defaultDayId;
                formData.value.endDayId = props.defaultDayId;
            }
            if (props.defaultStartHour !== null) {
                formData.value.startHour = props.defaultStartHour;
                formData.value.endHour = Math.min(props.defaultStartHour + 1, 24);
            }
        }

        // Ajouter listener pour Echap
        window.addEventListener('keydown', handleEscapeKey);
    } else {
        // Retirer listener pour Echap
        window.removeEventListener('keydown', handleEscapeKey);
    }
});

// Gestion de la touche Echap
const handleEscapeKey = (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
};

// Methods
const closeModal = () => {
    emit('close');
};

const resetForm = () => {
    formData.value = {
        title: '',
        description: '',
        dayId: null,
        startDayId: null,
        endDayId: null,
        startHour: null,
        endHour: null,
        isAllDay: false,
        isMultiDay: false,
        category: defaultCategory.value,
        color: defaultColor.value
    };
    errors.value = {};
};

const handleAllDayChange = () => {
    if (formData.value.isAllDay) {
        // Réinitialiser les heures quand on active "toute la journée"
        formData.value.startHour = 0;
        formData.value.endHour = 24;
        clearError('startHour');
        clearError('endHour');
    } else {
        // Remettre des valeurs par défaut quand on désactive
        if (props.defaultStartHour !== null) {
            formData.value.startHour = props.defaultStartHour;
            formData.value.endHour = Math.min(props.defaultStartHour + 1, 24);
        } else {
            formData.value.startHour = null;
            formData.value.endHour = null;
        }
    }
};

const handleMultiDayChange = () => {
    if (formData.value.isMultiDay) {
        // Initialiser avec le jour sélectionné si disponible
        if (formData.value.dayId !== null) {
            formData.value.startDayId = formData.value.dayId;
            formData.value.endDayId = formData.value.dayId;
        }
        clearError('dayId');
    } else {
        // Remettre à jour dayId avec startDayId
        if (formData.value.startDayId !== null) {
            formData.value.dayId = formData.value.startDayId;
        }
        clearError('startDayId');
        clearError('endDayId');
    }
};

const clearError = (field) => {
    if (errors.value[field]) {
        delete errors.value[field];
    }
};

const selectCategory = (categoryId) => {
    formData.value.category = categoryId;
    const category = categories.value.find(c => c.id === categoryId);
    if (category) {
        formData.value.color = category.color;
    }
    clearError('category');
};

const validate = () => {
    errors.value = {};

    if (!formData.value.title || formData.value.title.trim().length === 0) {
        errors.value.title = 'Le titre est obligatoire';
    }

    // Validation des jours selon le mode
    if (formData.value.isMultiDay) {
        if (formData.value.startDayId === null) {
            errors.value.startDayId = 'Veuillez sélectionner un jour de début';
        }
        if (formData.value.endDayId === null) {
            errors.value.endDayId = 'Veuillez sélectionner un jour de fin';
        }
        if (formData.value.startDayId !== null && formData.value.endDayId !== null) {
            if (formData.value.endDayId < formData.value.startDayId) {
                errors.value.endDayId = 'Le jour de fin doit être après le jour de début';
            }
        }
    } else {
        if (formData.value.dayId === null) {
            errors.value.dayId = 'Veuillez sélectionner un jour';
        }
    }

    // Valider les heures seulement si ce n'est pas "toute la journée"
    if (!formData.value.isAllDay) {
        if (formData.value.startHour === null) {
            errors.value.startHour = 'Veuillez sélectionner une heure de début';
        }

        if (formData.value.endHour === null) {
            errors.value.endHour = 'Veuillez sélectionner une heure de fin';
        }

        if (formData.value.startHour !== null && formData.value.endHour !== null) {
            // Pour les événements multi-jours, l'heure de fin peut être <= heure de début (jour différent)
            if (!formData.value.isMultiDay && formData.value.endHour <= formData.value.startHour) {
                errors.value.endHour = 'L\'heure de fin doit être après l\'heure de début';
            }
        }
    }

    if (!formData.value.category) {
        errors.value.category = 'Veuillez sélectionner une catégorie';
    }

    return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
    if (!validate()) {
        return;
    }

    let eventData;
    if (formData.value.isMultiDay) {
        // Événement multi-jours
        eventData = {
            title: formData.value.title.trim(),
            description: formData.value.description,
            startDayId: formData.value.startDayId,
            endDayId: formData.value.endDayId,
            dayId: formData.value.startDayId, // Pour compatibilité
            startHour: formData.value.startHour,
            endHour: formData.value.endHour,
            isAllDay: formData.value.isAllDay,
            isMultiDay: true,
            category: formData.value.category,
            color: formData.value.color
        };
    } else {
        // Événement sur un seul jour
        eventData = {
            title: formData.value.title.trim(),
            description: formData.value.description,
            dayId: formData.value.dayId,
            startDayId: formData.value.dayId,
            endDayId: formData.value.dayId,
            startHour: formData.value.startHour,
            endHour: formData.value.endHour,
            isAllDay: formData.value.isAllDay,
            isMultiDay: false,
            category: formData.value.category,
            color: formData.value.color
        };
    }

    if (isEditMode.value) {
        emit('save', { id: props.event.id, updates: eventData });
    } else {
        emit('save', eventData);
    }

    closeModal();
};

const handleDelete = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
        emit('delete', props.event.id);
        closeModal();
    }
};

const formatHour = (hour) => {
    return `${hour.toString().padStart(2, '0')}:00`;
};

const getMonthName = (monthIndex) => {
    const monthNames = [
        'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
        'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
    ];
    return monthNames[monthIndex];
};
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

/* Modal Container */
.modal-container {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 600px;
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

/* Form Styles */
.form-group {
    margin-bottom: 20px;
}

.form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 8px;
}

.required {
    color: #ef4444;
}

.form-input,
.form-textarea,
.form-select {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #111827;
    background-color: #ffffff;
    transition: all 0.2s;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
}

.input-error {
    border-color: #ef4444;
}

.error-message {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    color: #ef4444;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

/* Checkbox */
.checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
    transition: all 0.2s;
}

.checkbox-label:hover {
    background-color: #f3f4f6;
}

.checkbox-input {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #3b82f6;
}

.checkbox-text {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    user-select: none;
}

/* Category Grid */
.category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
}

.category-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 8px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.2s;
}

.category-button:hover {
    border-color: #d1d5db;
    background-color: #f9fafb;
}

.category-active {
    border-color: currentColor;
    background-color: currentColor;
}

.category-active .category-icon,
.category-active .category-name {
    color: #ffffff;
}

.category-icon {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #374151;

}

.category-name {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
}

/* Category Colors */
.category-blue { border-color: #4A90E2; background-color: #4A90E2; }
.category-green { border-color: #10B981; background-color: #10B981; }
.category-red { border-color: #EF4444; background-color: #EF4444; }
.category-orange { border-color: #F59E0B; background-color: #F59E0B; }
.category-purple { border-color: #8B5CF6; background-color: #8B5CF6; }
.category-teal { border-color: #14B8A6; background-color: #14B8A6; }
.category-pink { border-color: #EC4899; background-color: #EC4899; }
.category-gray { border-color: #6B7280; background-color: #6B7280; }

/* Modal Footer */
.modal-footer {
    padding: 20px 28px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.modal-footer-actions {
    display: flex;
    gap: 12px;
}

/* Buttons */
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

.btn-primary:hover {
    background-color: #2563eb;
}

.btn-secondary {
    background-color: #f3f4f6;
    color: #374151;
}

.btn-secondary:hover {
    background-color: #e5e7eb;
}

.btn-danger {
    background-color: #ef4444;
    color: #ffffff;
}

.btn-danger:hover {
    background-color: #dc2626;
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

    .form-row {
        grid-template-columns: 1fr;
    }

    .category-grid {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }
}
</style>
