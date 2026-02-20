/**
 * Composable pour gérer le partage automatique des fichiers/dossiers
 * dans les dossiers partagés (propagation des permissions)
 */
import { encryptWithPublicKey } from '~/utils/crypto'
import { useFetchWithAuth } from '~/composables/useFetchWithAuth';

export function useAutoShare(API_URL) {
  const { fetchWithAuth } = useFetchWithAuth();

  /**
   * Recupere la liste des utilisateurs ayant acces a un dossier parent
   */
  const getFolderSharedUsers = async (folderId) => {
    try {
      const response = await fetchWithAuth(`/drive/folder/${folderId}/shared_users`, {
        method: 'GET'
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.shared_users || []
    } catch (error) {
      console.error('Error fetching folder shared users:', error)
      return []
    }
  }

  /**
   * Propage automatiquement les permissions d'un fichier nouvellement cree
   * aux utilisateurs ayant acces au dossier parent
   */
  const propagateFileAccess = async (fileId, folderId, fileKey) => {
    if (!folderId || !API_URL) {
      return { success: true, propagated: false }
    }

    try {
      const sharedUsers = await getFolderSharedUsers(folderId)

      if (sharedUsers.length === 0) {
        return { success: true, propagated: false }
      }

      const userKeys = []
      for (const user of sharedUsers) {
        try {
          // encryptWithPublicKey(publicKeyPem, data)
          const encryptedKey = await encryptWithPublicKey(user.public_key, fileKey)

          userKeys.push({
            user_id: user.user_id,
            encrypted_key: encryptedKey,
            access_level: user.access_level
          })
        } catch (error) {
          console.error(`Failed to encrypt key for user ${user.username}:`, error)
        }
      }

      if (userKeys.length === 0) {
        return { success: true, propagated: false }
      }

      const response = await fetchWithAuth('/drive/propagate_file_access', {
        method: 'POST',
        body: JSON.stringify({
          file_id: fileId,
          user_keys: userKeys
        })
      })

      if (!response.ok) {
        throw new Error('Failed to propagate file access')
      }

      return {
        success: true,
        propagated: true,
        userCount: userKeys.length
      }
    } catch (error) {
      console.error('Error propagating file access:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Propage automatiquement les permissions d'un dossier nouvellement cree
   * aux utilisateurs ayant acces au dossier parent
   */
  const propagateFolderAccess = async (folderId, parentFolderId, folderKey) => {
    if (!parentFolderId || !API_URL) {
      return { success: true, propagated: false }
    }

    try {
      const sharedUsers = await getFolderSharedUsers(parentFolderId)

      if (sharedUsers.length === 0) {
        return { success: true, propagated: false }
      }

      const userKeys = []
      for (const user of sharedUsers) {
        try {
          // encryptWithPublicKey(publicKeyPem, data)
          const encryptedKey = await encryptWithPublicKey(user.public_key, folderKey)

          userKeys.push({
            user_id: user.user_id,
            encrypted_key: encryptedKey,
            access_level: user.access_level
          })
        } catch (error) {
          console.error(`Failed to encrypt key for user ${user.username}:`, error)
        }
      }

      if (userKeys.length === 0) {
        return { success: true, propagated: false }
      }

      const response = await fetchWithAuth('/drive/propagate_folder_access', {
        method: 'POST',
        body: JSON.stringify({
          folder_id: folderId,
          user_keys: userKeys
        })
      })

      if (!response.ok) {
        throw new Error('Failed to propagate folder access')
      }

      return {
        success: true,
        propagated: true,
        userCount: userKeys.length
      }
    } catch (error) {
      console.error('Error propagating folder access:', error)
      return { success: false, error: error.message }
    }
  }

  return {
    getFolderSharedUsers,
    propagateFileAccess,
    propagateFolderAccess
  }
}
