<template>
    <div v-if="allDayEvents.length > 0" class="all-day-events">
        <div class="all-day-label">Toute la journée</div>
        <div class="all-day-grid" :style="{ '--grid-columns': displayDays.length }">
            <div
                v-for="event in allDayEvents"
                :key="event.id"
                class="all-day-event"
                :class="`event-${event.color || 'blue'}`"
                :style="{
                    gridColumn: 2 + displayDays.findIndex(d => d.dayId === event.dayId)
                }"
                @click="handleEventClick(event)"
            >
                <span class="all-day-event-title">{{ event.title }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    events: {
        type: Array,
        required: true
    },
    displayDays: {
        type: Array,
        required: true
    }
});

const emit = defineEmits(['event-click']);

const allDayEvents = props.events.filter(e => e.isAllDay);

const handleEventClick = (event) => {
    emit('event-click', event);
};
</script>

<style scoped>
.all-day-events {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #e5e7eb;
    background-color: #fafafa;
}

.all-day-label {
    flex-shrink: 0;
    width: 60px;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 12px;
    text-align: right;
}

.all-day-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(var(--grid-columns, 7), 1fr);
    gap: 4px;
    align-items: start;
}

.all-day-event {
    padding: 6px 10px;
    background-color: #5B7FE8;
    border-radius: 4px;
    border-left: 3px solid #3D5FC4;
    cursor: pointer;
    transition: all 0.2s;
}

.all-day-event:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    filter: brightness(1.05);
}

.all-day-event-title {
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Event Colors */
.event-blue { background: #4A90E2; border-left-color: #2E5C8A; }
.event-green { background: #10B981; border-left-color: #047857; }
.event-red { background: #EF4444; border-left-color: #991B1B; }
.event-orange { background: #F59E0B; border-left-color: #B45309; }
.event-purple { background: #8B5CF6; border-left-color: #5B21B6; }
.event-teal { background: #14B8A6; border-left-color: #0F766E; }
.event-pink { background: #EC4899; border-left-color: #9F1239; }
.event-gray { background: #6B7280; border-left-color: #374151; }
</style>
