import crypto from 'crypto'

/**
 * Chave de criptografia - deve estar em variável de ambiente
 * Gere uma chave segura com: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 16 bytes para AES
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const TAG_POSITION = SALT_LENGTH + IV_LENGTH
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH

/**
 * Valida se a chave de criptografia está configurada
 */
function validateKey(): void {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY não está configurada ou é muito curta. ' +
      'Configure uma chave de pelo menos 32 caracteres na variável de ambiente ENCRYPTION_KEY.'
    )
  }
}

/**
 * Deriva uma chave de 32 bytes a partir da chave de criptografia
 */
function deriveKey(): Buffer {
  validateKey()
  // Usar PBKDF2 para derivar uma chave de 32 bytes
  return crypto.pbkdf2Sync(ENCRYPTION_KEY, 'salt', 100000, 32, 'sha256')
}

/**
 * Criptografa uma string usando AES-256-GCM
 * @param text - Texto a ser criptografado
 * @returns String criptografada em formato base64
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Texto não pode ser vazio')
  }

  try {
    const key = deriveKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const salt = crypto.randomBytes(SALT_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(text, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    const tag = cipher.getAuthTag()

    // Combinar: salt + iv + tag + encrypted
    const combined = Buffer.concat([salt, iv, tag, encrypted])
    
    return combined.toString('base64')
  } catch (error) {
    throw new Error(`Erro ao criptografar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}

/**
 * Descriptografa uma string criptografada com AES-256-GCM
 * @param encryptedText - Texto criptografado em formato base64
 * @returns Texto descriptografado
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Texto criptografado não pode ser vazio')
  }

  try {
    const key = deriveKey()
    const combined = Buffer.from(encryptedText, 'base64')

    // Extrair componentes
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
    const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
    const encrypted = combined.subarray(ENCRYPTED_POSITION)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    // Se falhar, pode ser um texto antigo em Base64 (compatibilidade)
    if (error instanceof Error && error.message.includes('bad decrypt')) {
      try {
        // Tentar descriptografar como Base64 antigo (compatibilidade)
        return atob(encryptedText)
      } catch {
        throw new Error('Falha ao descriptografar: formato inválido ou chave incorreta')
      }
    }
    throw new Error(`Erro ao descriptografar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}

/**
 * Migra senhas antigas (Base64) para o novo formato criptografado
 * @param oldEncrypted - Senha antiga em Base64
 * @returns Senha descriptografada (para re-criptografar)
 */
export function migrateOldPassword(oldEncrypted: string): string {
  try {
    return atob(oldEncrypted)
  } catch {
    throw new Error('Falha ao migrar senha antiga')
  }
}
