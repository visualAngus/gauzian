<template>
    <button class="btn-add-event">
        <span class="plus">+</span>
        <span class="text">Créer</span>
    </button>
</template>
<script setup></script>
<style scoped>
.btn-add-event {
    display: flex;
    align-items: center;
    background-color: var(--color-white);
    gap: 0.5rem;
    padding: 0.8rem 1.2rem;
    color: var(--color-text);
    border: none;
    border-radius: 15px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.3s ease;
    height: 100%;
    max-width: 80%;
    width: fit-content;
    font-weight: 500;

    box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.3);

}
.btn-add-event:hover {
    background-color: var(--color-surface-muted);
    
}
.btn-add-event:active {
    background-color: var(--color-primary-soft);
    box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.2);
}
.plus {
    font-size: 1.8rem;
    font-weight: 500;
}
.text {
    font-size: 1rem;
    font-weight: 500;
}

@media (max-width: 768px) {
    .btn-add-event {
        padding: 0.6rem 1rem;
        font-size: 0.9rem;
    }
    .plus {
        font-size: 1.5rem;
    }
    .text {
        display: none;
    }
    
}

</style>