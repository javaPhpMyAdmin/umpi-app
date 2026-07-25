/**
 * Password strength validation — shared between web and mobile.
 *
 * Rules: 8+ chars, 1 uppercase, 1 lowercase, 1 number.
 * Score: 0-4 (one per rule passed).
 */

export interface PasswordStrength {
  valid: boolean
  score: number
  label: string
  checks: { label: string; passed: boolean }[]
}

export function validatePassword(password: string): PasswordStrength {
  const checks = [
    { label: 'Al menos 8 caracteres', passed: password.length >= 8 },
    { label: 'Una letra mayúscula', passed: /[A-Z]/.test(password) },
    { label: 'Una letra minúscula', passed: /[a-z]/.test(password) },
    { label: 'Un número', passed: /[0-9]/.test(password) },
  ]
  const passed = checks.filter((c) => c.passed).length
  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte']
  return {
    valid: passed === checks.length,
    score: passed,
    label: labels[passed],
    checks,
  }
}
