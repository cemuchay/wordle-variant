import { describe, it, expect } from 'vitest'
import { obfuscateWord, deobfuscateWord, encryptGuesses, decryptGuesses } from '../../lib/game-logic'

describe('obfuscateWord / deobfuscateWord', () => {
   const word = 'TRACE'
   const salt = 'test-salt-123'

   it('round-trips correctly', () => {
      const obfuscated = obfuscateWord(word, salt)
      expect(obfuscated).not.toBe(word)
      const deobfuscated = deobfuscateWord(obfuscated, salt)
      expect(deobfuscated).toBe(word)
   })

   it('produces different output with different salt', () => {
      const a = obfuscateWord(word, 'first-salt-key')
      const b = obfuscateWord(word, 'second-salt-ky')
      expect(a).not.toBe(b)
   })

   it('is deterministic with same salt', () => {
      const a = obfuscateWord(word, salt)
      const b = obfuscateWord(word, salt)
      expect(a).toBe(b)
   })

   it('returns empty string for empty input', () => {
      expect(deobfuscateWord('', salt)).toBe('')
   })

   it('returns input for non-base64 garbage', () => {
      const result = deobfuscateWord('~~~not-base64~~~', salt)
      expect(result).toBe('~~~not-base64~~~')
   })
})

describe('encryptGuesses / decryptGuesses', () => {
   const guesses = [{ letter: 'T', status: 'correct' }]
   const key = 'secret-key'

   it('round-trips correctly', () => {
      const encrypted = encryptGuesses(guesses, key)
      expect(encrypted).toMatch(/^enc:/)
      const decrypted = decryptGuesses(encrypted, key)
      expect(decrypted).toEqual(guesses)
   })

   it('returns null for null input', () => {
      expect(encryptGuesses(null as any, key)).toBeNull()
   })

   it('returns plaintext when key is empty', () => {
      const result = encryptGuesses(guesses, '')
      expect(result).toBe(JSON.stringify(guesses))
   })

   it('handles legacy unencrypted format', () => {
      const json = JSON.stringify(guesses)
      const decrypted = decryptGuesses(json, key)
      expect(decrypted).toEqual(guesses)
   })

   it('returns [] for missing encrypted string', () => {
      expect(decryptGuesses(null as any, key)).toEqual([])
   })

   it('returns [] when key is missing for encrypted data', () => {
      const encrypted = encryptGuesses(guesses, key)
      const decrypted = decryptGuesses(encrypted, '')
      expect(decrypted).toEqual([])
   })
})
