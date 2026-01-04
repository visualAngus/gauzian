<template>
  <header class="header">
    <div class="headerContent">
      <h1 class="logo">
        <NuxtLink to="/">{{ title }}</NuxtLink>
      </h1>
      <div class="userProfileContainer" @click="goProfile" title="Aller au profil">
        <div class="userInfo">
          <span class="userName">{{ userFullName }}</span>
        </div>
        <div class="avatarWrapper">
          <img
            v-if="!imageError && userId"
            class="userAvatar"
            :src="`/api/users/${userId}/profile-picture`"
            alt="Profil"
            @error="imageError = true"
          />
          <div v-else class="userAvatarPlaceholder">{{ initials }}</div>
          <div class="statusIndicator"></div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from '#app'

const props = defineProps({
  TITLE: { type: String, default: 'GAUZIAN' },
  userName: { type: String, default: 'User' },
})

const router = useRouter()
const imageError = ref(false)
const title = ref(props.TITLE || 'GAUZIAN')
const userId = ref(null)
const userFullName = ref(props.userName || 'User')

const initials = computed(() =>
  userFullName.value
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
)

const goProfile = () => {
  router.push('/profile')
}

onMounted(() => {
  if (props.userName && props.userName !== 'User') {
    userFullName.value = props.userName
    return
  }
  const storedUser = localStorage.getItem('userData')
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser)
      userId.value = parsed.id || parsed.user_id || null
      if (parsed.firstName || parsed.lastName) {
        userFullName.value = `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim()
      }
    } catch (e) {
      console.error('Erreur parsing userData:', e)
    }
  }
})
</script>

<style scoped>
.header {
  width: 100%;
  height: 70px;
  position: sticky;
  top: 0;
  z-index: 1000;
  background-color: rgba(248, 250, 252, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.headerContent {
  height: 100%;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #0B1120;
}

.logo a {
  text-decoration: none;
  color: inherit;
  transition: color 0.2s ease;
}

.logo a:hover {
  color: #F97316;
}

.userProfileContainer {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 50px;
  transition: all 0.2s ease;
}

.userProfileContainer:hover {
  background-color: #F1F5F9;
}

.userInfo {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.2;
}

.userName {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0B1120;
}

.avatarWrapper {
  position: relative;
  width: 42px;
  height: 42px;
}

.userAvatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.userAvatarPlaceholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #F97316, #FB923C);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  border: 2px solid white;
  box-shadow: 0 2px 5px rgba(249, 115, 22, 0.3);
}

.statusIndicator {
  position: absolute;
  bottom: 2px;
  right: 0;
  width: 10px;
  height: 10px;
  background-color: #10B981;
  border: 2px solid white;
  border-radius: 50%;
}
</style>
