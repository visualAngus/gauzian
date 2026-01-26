<template>
  <div class="share-item">
    <h3>
      Dites nous avec qui vous voulez partager
      <a id="item_name">{{ itemName }}</a
      >.
    </h3>
    <div class="input--contact">
      <div
        v-for="contact in contacts"
        :key="contact.id"
        class="input--contact__personne"
        :title="contact.email"
      >
        <span class="personne-name">
          {{ contact.name || contact.email }}
        </span>

        <button
          class="remove-contact"
          @click.stop="removeContact(contact.id)"
          aria-label="Supprimer"
        >
          ×
        </button>
      </div>

      <input
        type="email"
        placeholder="Entrez l'email"
        ref="inputRef"
        @input="validateEmail($event.target.value.trim())"
        @keyup.enter="verifyEmail($event)"
      />
    </div>

    <div class="access_level">
        <label for="access_select">Niveau d'accès :</label>
        <select id="access_select" v-model="accessLevel">
          <option value="owner">Propriétaire</option>
          <option value="editor">Éditeur</option>
          <option value="viewer" selected>Lecteur</option>
        </select>
    </div>

    <div style="text-align: center; margin-top: 8px">
      <button class="close-btn" @click="closeWithContacts">Partager</button>
      <!-- annuler -->
      <button
        class="close-btn"
        @click="emit('annuler', [], accessLevel)"
        style="margin-left: 8px"
      >
        Annuler
      </button>
    </div>
  </div>
</template>

<script setup>
const inputRef = ref(null);

const props = defineProps({
  itemName: {
    type: String,
    required: true,
    default: "Élément sans nom",
  },
  itemId: {
    type: String,
    required: true,
  },
});
const contacts = ref([]);
const accessLevel = ref('read');

const validateEmail = (email) => {
  // RFC 5322 compliant email regex (simplifié mais plus strict)
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const final = re.test(email);

  if (inputRef.value) {
    inputRef.value.style.color = final ? "var(--color-success)" : "var(--color-pastel-danger)";
  }

  return final;
};

const removeContact = (id) => {
  contacts.value = contacts.value.filter((c) => c.id !== id);
};

const verifyEmail = (event) => {
  const email = event.target.value.trim();

  if (!email) {
    return;
  }

  if (!validateEmail(email)) {
    alert("Veuillez entrer une adresse email valide.");
    return;
  }

  // Vérifier les doublons
  if (contacts.value.some(c => c.email.toLowerCase() === email.toLowerCase())) {
    alert("Ce contact est déjà dans la liste.");
    event.target.value = "";
    if (inputRef.value) {
      inputRef.value.style.color = "";
    }
    return;
  }

  contacts.value.push({ id: Date.now(), name: "", email: email });
  event.target.value = "";
  if (inputRef.value) {
    inputRef.value.style.color = "";
  }
};

// emit
const emit = defineEmits(["close", "annuler"]);

const closeWithContacts = () => {
  const input = inputRef.value;
  if (input && input.value.trim() !== "") {
    const email = input.value.trim();
    if (validateEmail(email)) {
      // Vérifier les doublons avant d'ajouter
      if (!contacts.value.some(c => c.email.toLowerCase() === email.toLowerCase())) {
        contacts.value.push({ id: Date.now(), name: "", email: email });
      }
      input.value = "";
      if (inputRef.value) {
        inputRef.value.style.color = "";
      }
    }
  }

  // Ne pas permettre de partager sans contacts
  if (contacts.value.length === 0) {
    alert("Veuillez ajouter au moins un contact.");
    return;
  }

  emit("close", contacts.value, accessLevel);
};
</script>
<style scoped>
.share-item {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  background: var(--color-white);
  padding: 22px 24px;
  width: 420px;
  max-width: 90vw;

  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;

  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media screen and (max-width: 480px) {
  .share-item {
    width: 90vw;
    padding: 16px 18px;
  }
}

/* Titre */
.share-item h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-neutral-900);
}

#item_name {
  color: var(--color-primary);
  font-weight: 700;
  text-decoration: none;
}

/* Zone input globale */
.input--contact {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;

  padding: 10px 12px;
  border-radius: 10px;
  background-color: var(--color-surface-soft);
  border: 1px solid #ddd;

  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.input--contact:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(80, 140, 255, 0.15);
}

/* Chips contact */
.input--contact__personne {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  background-color: #e8f0ff;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;

  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  position: relative;
}

/* Tooltip email */
.input--contact__personne:hover::after {
  content: attr(title);
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);

  background-color: #333;
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  z-index: 10;
}

.personne-name {
  white-space: nowrap;
}

/* Champ email */
input[type="email"] {
  flex: 1;
  min-width: 160px;

  border: none;
  background: transparent;
  outline: none;

  font-size: 14px;
  padding: 6px 4px;
  color: var(--color-neutral-900);
}

input[type="email"]::placeholder {
  color: var(--color-text-muted);
}

.remove-contact {
  background: none;
  border: none;
  margin-left: 4px;
  cursor: pointer;

  font-size: 14px;
  line-height: 1;
  color: var(--color-neutral-500);
  opacity: 0.6;
  margin-top: 0px;
  padding: 0;
  transition:
    opacity 0.15s ease,
    color 0.15s ease;
}

.input--contact__personne:hover .remove-contact {
  opacity: 1;
}

.remove-contact:hover {
  color: var(--color-danger-strong);
}

.share-item .close-btn {
  padding: 10px 16px;
  background-color: var(--color-neutral-900);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}

.share-item .close-btn:hover {
  background-color: var(--color-primary);
}

.share-item .close-btn:active {
  transform: translateY(1px);
}

/* Access Level */
.access_level {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.access_level label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-neutral-900);
}

.access_level select {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background-color: var(--color-surface-soft);
  color: var(--color-neutral-900);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.access_level select:hover {
  border-color: var(--color-primary);
}

.access_level select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(80, 140, 255, 0.15);
}
</style>
