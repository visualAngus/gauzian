<template>
    <main>
        <div class="main--left--section"></div>

    </main>

</template>
<script setup>
import { defineComponent } from "vue";
</script>
<style scoped>
main{
    display: flex;
    width: 100%;
    height: calc(100vh - 88px);
}
.main--left--section{
    width: 300px;
    height: 100%;
    padding: 0 25px;
    background-color: hotpink;
}

</style>
