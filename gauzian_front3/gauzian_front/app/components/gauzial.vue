<template>
    <div :class="[styles.floater, className, { [styles.loading]: isLoadingPage }]">
        <div
            ref="bodyRef"
            :class="styles.body"
            :style="isLoadingPage ? {} : {
                transform: `perspective(800px) rotateX(${look.x}deg) rotateY(${look.y}deg)`
            }"
        >
            <div :class="[styles.face, { [styles.angry]: !isRequestGood }]">
                <div :class="styles.eyesRow">
                    <!-- Left Eye -->
                    <div :class="[styles.eye, { [styles.closed]: isBlinking }]">
                        <div
                            :class="styles.pupil"
                            :style="isLoadingPage ? {} : {
                                transform: `translate(${pupilLeft.x}px, ${pupilLeft.y}px)`,
                                transition: lookAway ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.1s'
                            }"
                        >
                            <div :class="styles.glint"></div>
                        </div>
                    </div>

                    <!-- Right Eye -->
                    <div :class="[styles.eye, { [styles.closed]: isBlinking }]">
                        <div
                            :class="styles.pupil"
                            :style="isLoadingPage ? {} : {
                                transform: `translate(${pupilRight.x}px, ${pupilRight.y}px)`,
                                transition: lookAway ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.1s'
                            }"
                        >
                            <div :class="styles.glint"></div>
                        </div>
                    </div>
                </div>

                <!-- Mouth -->
                <div :class="[styles.mouth, { [styles.sad]: isUnhappy }]"></div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
import styles from './gauzial.module.css';

const props = defineProps({
    className: { type: String, default: '' },
    lookAway: { type: Boolean, default: false },
    isUnhappy: { type: Boolean, default: false },
    isRequestGood: { type: Boolean, default: true },
    isLoadingPage: { type: Boolean, default: false }
});

const look = reactive({ x: 0, y: 0 });
// Pupils indépendants pour chaque œil
const pupilLeft = reactive({ x: 0, y: 0 });
const pupilRight = reactive({ x: 0, y: 0 });
const isBlinking = ref(false);
const bodyRef = ref(null);
const lastMousePosition = ref({ x: 0, y: 0 });

onMounted(() => {
    if (typeof window !== 'undefined') {
        lastMousePosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
});

const calculatePosition = (clientX, clientY) => {
    if (!bodyRef.value) return;

    const { left, top, width, height } = bodyRef.value.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const x = (clientX - centerX) / (window.innerWidth / 2);
    const y = (clientY - centerY) / (window.innerHeight / 2);

    look.x = -y * 15;
    look.y = x * 15;
    
    // Chaque œil suit indépendamment la souris
    pupilLeft.x = x * 8;
    pupilLeft.y = y * 8;
    pupilRight.x = x * 8;
    pupilRight.y = y * 8;
};

const handleMouseMove = (e) => {
    if (!bodyRef.value || props.lookAway || props.isLoadingPage) return;
    lastMousePosition.value = { x: e.clientX, y: e.clientY };
    calculatePosition(e.clientX, e.clientY);
};

const handleMouseDown = () => {
    if (!props.lookAway && !props.isLoadingPage) isBlinking.value = true;
};

const handleMouseUp = () => {
    if (!props.lookAway && !props.isLoadingPage) isBlinking.value = false;
};

watch([() => props.lookAway, () => props.isLoadingPage], () => {
    if (props.isLoadingPage) return;
    if (props.lookAway) {
        look.x = 0;
        look.y = -18;
        pupilLeft.x = -12;
        pupilLeft.y = -8;
        pupilRight.x = -12;
        pupilRight.y = -8;
        return;
    }
    calculatePosition(lastMousePosition.value.x, lastMousePosition.value.y);
}, { immediate: true });

onMounted(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mouseup', handleMouseUp);
});
</script>