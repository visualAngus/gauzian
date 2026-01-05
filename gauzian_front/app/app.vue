<template>
  <div class="container">
    <h1>Test API Gauzian</h1>
    
    <div class="section">
      <h2>Register</h2>
      <form @submit.prevent="register">
        <input v-model="registerForm.username" placeholder="Username" required />
        <input v-model="registerForm.email" type="email" placeholder="Email" required />
        <input v-model="registerForm.password" type="password" placeholder="Password" required />
        <button type="submit">Register</button>
      </form>
    </div>

    <div class="section">
      <h2>Login</h2>
      <form @submit.prevent="login">
        <input v-model="loginForm.email" type="email" placeholder="Email" required />
        <input v-model="loginForm.password" type="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
    </div>

    <div v-if="token" class="section">
      <h2>Token</h2>
      <p style="word-break: break-all;">{{ token }}</p>
      <button @click="testProtected">Test Protected Route</button>
    </div>

    <div v-if="response" class="section">
      <h2>Response</h2>
      <pre>{{ response }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const API_URL = 'gauzian.pupin.fr/api'

const registerForm = ref({
  username: '',
  email: '',
  password: ''
})

const loginForm = ref({
  email: '',
  password: ''
})

const token = ref('')
const response = ref('')

const register = async () => {
  console.log('Registering with', registerForm.value)
  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registerForm.value)
    })
    const data = await res.json()
    response.value = JSON.stringify(data, null, 2)
    if (data.token) {
      token.value = data.token
    }
  } catch (error) {
    response.value = `Error: ${error.message}`
  }
}

const login = async () => {
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginForm.value)
    })
    const data = await res.json()
    response.value = JSON.stringify(data, null, 2)
    if (data.token) {
      token.value = data.token
    }
  } catch (error) {
    response.value = `Error: ${error.message}`
  }
}

const testProtected = async () => {
  try {
    const res = await fetch(`${API_URL}/protected`, {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })
    const data = await res.json()
    response.value = JSON.stringify(data, null, 2)
  } catch (error) {
    response.value = `Error: ${error.message}`
  }
}
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h1 {
  color: #2c3e50;
  margin-bottom: 30px;
}

.section {
  background: #f5f5f5;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 8px;
}

h2 {
  color: #34495e;
  margin-top: 0;
}

form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

button {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background: #2980b9;
}

pre {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
