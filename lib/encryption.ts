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

  // Tentar decodificar Base64 primeiro para verificar o tamanho
  let combined: Buffer
  try {
    combined = Buffer.from(encryptedText, 'base64')
  } catch {
    throw new Error('Texto não é um Base64 válido')
  }

  const minSizeForNewFormat = ENCRYPTED_POSITION + 1 // Pelo menos 1 byte de dados criptografados
  
  // Se o tamanho for muito pequeno, provavelmente é Base64 antigo (senha simples)
  if (combined.length < minSizeForNewFormat) {
    try {
      // Tentar como Base64 antigo (senha simples codificada)
      const decoded = atob(encryptedText)
      // Validar que é texto válido (não binário) e parece uma senha
      if (decoded && decoded.length > 0 && /^[\x20-\x7E]*$/.test(decoded)) {
        return decoded
      }
    } catch (base64Error) {
      // Se falhar, continuar para tentar formato novo
    }
  }

  // Tentar descriptografar com o formato novo (AES-256-GCM)
  try {
    const key = deriveKey()

    // Verificar se o tamanho é suficiente para o formato novo
    if (combined.length < minSizeForNewFormat) {
      throw new Error('Tamanho insuficiente para formato de criptografia novo')
    }

    // Extrair componentes
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
    const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
    const encrypted = combined.subarray(ENCRYPTED_POSITION)

    // Verificar se o IV tem o tamanho correto
    if (iv.length !== IV_LENGTH) {
      throw new Error('IV com tamanho incorreto')
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    // Se falhar, pode ser um texto antigo em Base64 (compatibilidade)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Erros comuns que indicam formato antigo ou chave incorreta
    const isOldFormatError = 
      errorMessage.includes('bad decrypt') ||
      errorMessage.includes('Invalid initialization vector') ||
      errorMessage.includes('Unsupported state') ||
      errorMessage.includes('Invalid tag') ||
      errorMessage.includes('Tamanho insuficiente') ||
      errorMessage.includes('IV com tamanho incorreto')
    
    if (isOldFormatError) {
      try {
        // Tentar descriptografar como Base64 antigo (compatibilidade)
        const decoded = atob(encryptedText)
        // Verificar se o resultado parece ser uma senha válida (não é binário)
        if (decoded && decoded.length > 0 && /^[\x20-\x7E]*$/.test(decoded)) {
          return decoded
        }
        throw new Error('Resultado do Base64 não parece ser uma senha válida')
      } catch (base64Error) {
        const base64ErrorMsg = base64Error instanceof Error ? base64Error.message : String(base64Error)
        throw new Error(`Falha ao descriptografar: formato inválido ou chave incorreta. Erro original: ${errorMessage}. Erro Base64: ${base64ErrorMsg}`)
      }
    }
    throw new Error(`Erro ao descriptografar: ${errorMessage}`)
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
