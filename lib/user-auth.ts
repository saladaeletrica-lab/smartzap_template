/**
 * User Authentication System for Single-Tenant DaaS
 * 
 * Simple auth using MASTER_PASSWORD from environment variable
 * - No password hashing needed (password stored in Vercel env)
 * - httpOnly + Secure cookies for sessions
 * - Rate limiting for brute force protection
 * 
 * MIGRATED: Now uses Supabase (PostgreSQL) instead of Turso
 */

import { cookies } from 'next/headers'
import { supabase } from './supabase'

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_COOKIE_NAME = 'smartzap_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

// ============================================================================
// TYPES
// ============================================================================

export interface Company {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
}

export interface UserAuthResult {
  success: boolean
  error?: string
  company?: Company
  user?: any // Supabase user info
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Upsert a setting in the database
 */
async function upsertSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString()
  await supabase
    .from('settings')
    .upsert({ key, value, updated_at: now }, { onConflict: 'key' })
}

/**
 * Get a setting from the database
 */
async function getSetting(key: string): Promise<{ value: string; updated_at: string } | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value, updated_at')
    .eq('key', key)
    .single()

  if (error || !data) return null
  return data
}

/**
 * Delete a setting from the database
 */
async function deleteSetting(key: string): Promise<void> {
  await supabase.from('settings').delete().eq('key', key)
}

/**
 * Check if setup is completed (company exists)
 */
export async function isSetupComplete(): Promise<boolean> {
  // RADICAL FIX: Just check the env var instead of database
  // The database queries are failing and causing loops
  console.log('🔍 [isSetupComplete] SETUP_COMPLETE env:', process.env.SETUP_COMPLETE)
  return process.env.SETUP_COMPLETE === 'true'
}

/**
 * Get company info
 */
export async function getCompany(): Promise<Company | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['company_id', 'company_name', 'company_email', 'company_phone', 'company_created_at'])

    if (error || !data || data.length === 0) return null

    const settings: Record<string, string> = {}
    data.forEach((row: any) => {
      settings[row.key] = row.value
    })

    if (!settings.company_name) return null

    return {
      id: settings.company_id || 'default',
      name: settings.company_name,
      email: settings.company_email || '',
      phone: settings.company_phone || '',
      createdAt: settings.company_created_at || new Date().toISOString()
    }
  } catch {
    return null
  }
}

// ============================================================================
// SETUP (First-time configuration)
// ============================================================================

/**
 * Complete initial setup - create company, email, phone
 * Password is handled via MASTER_PASSWORD env var
 */
export async function completeSetup(
  companyName: string,
  email: string,
  phone: string
): Promise<UserAuthResult> {
  // Validate inputs
  if (!companyName || companyName.trim().length < 2) {
    return { success: false, error: 'Nome da empresa deve ter pelo menos 2 caracteres' }
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'E-mail inválido' }
  }

  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return { success: false, error: 'Telefone inválido' }
  }

  try {
    const now = new Date().toISOString()
    // Use existing company_id if available, otherwise create new
    const existingId = await getSetting('company_id')
    const companyId = existingId?.value || crypto.randomUUID()

    // Save company info using parallel upserts
    await Promise.all([
      upsertSetting('company_id', companyId),
      upsertSetting('company_name', companyName.trim()),
      upsertSetting('company_email', email.trim().toLowerCase()),
      upsertSetting('company_phone', phone.replace(/\D/g, '')),
      upsertSetting('company_created_at', now)
    ])

    // Create session after setup, we may not have JWT yet without login
    // we'll pass a dummy token or wait for user to explicitly login. We'll skip session creation here
    // so they are forced to do an actual login with the email/password we will configure in setup.
    // await createSession('')

    return {
      success: true,
      company: {
        id: companyId,
        name: companyName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
        createdAt: now
      }
    }
  } catch (error) {
    console.error('Setup error:', error)
    return { success: false, error: 'Erro ao salvar configuração' }
  }
}

// ============================================================================
// LOGIN / LOGOUT
// ============================================================================

/**
 * Attempt login with email and password
 * Implements fallback migration for old MASTER_PASSWORD users
 */
export async function loginUser(password: string, email?: string): Promise<UserAuthResult> {
  if (!password) {
    return { success: false, error: 'Senha é obrigatória' }
  }

  // Check rate limiting
  const isLocked = await checkRateLimiting()
  if (isLocked) {
    return { success: false, error: 'Muitas tentativas. Tente novamente em 15 minutos.' }
  }

  try {
    // Migration: Get master password and company email if we need fallback
    const masterPassword = process.env.MASTER_PASSWORD
    const isMasterFallback = !!masterPassword && password === masterPassword
    
    // Resolve which email to use
    let targetEmail = email;
    if (!targetEmail) {
      const company = await getCompany();
      targetEmail = company?.email;
    }

    if (!targetEmail) {
      return { success: false, error: 'E-mail é obrigatório para logar' }
    }

    // Use Supabase built-in auth to sign in
    // Note: since the backend doesn't inherently use PKCE flow (we parse token manually), 
    // we use standard email/password grant. We use .admin to bypass RLS issues on login.
    const { data: authData, error: authError } = await supabase.admin.auth.signInWithPassword({
      email: targetEmail.trim(),
      password
    })

    if (authError) {
      // MIGRATION STRATEGY: user might not exist in Supabase Auth yet
      // If the password matches MASTER_PASSWORD, we auto-create the user!
      if (isMasterFallback) {
        console.log(`[LOGIN] MIGRATION: Auto-creating admin user for ${targetEmail}`);
        const { error: createError } = await supabase.admin.auth.admin.createUser({
          email: targetEmail.trim(),
          password,
          email_confirm: true,
          user_metadata: { role: 'admin' }
        })

        if (!createError) {
          // Now login again
          const retryAuth = await supabase.admin.auth.signInWithPassword({
            email: targetEmail.trim(),
            password
          })
          
          if (retryAuth.error || !retryAuth.data.session) {
             await recordFailedAttempt()
             return { success: false, error: 'Falha durante a migração da conta.' }
          }
          
          await clearFailedAttempts()
          await createSession(retryAuth.data.session.access_token)
          const company = await getCompany()
          return { success: true, company: company || undefined, user: retryAuth.data.user }
        } else {
             console.error('[LOGIN] MIGRATION FAILED:', createError)
        }
      }

      await recordFailedAttempt()
      return { success: false, error: 'E-mail ou senha incorretos' }
    }

    if (!authData.session) {
      await recordFailedAttempt()
      return { success: false, error: 'Falha ao autenticar sessão com Supabase' }
    }

    // Clear failed attempts on success
    await clearFailedAttempts()

    // Create session (now saving the Supabase JWT instead of a UUID)
    await createSession(authData.session.access_token)

    const company = await getCompany()
    return { success: true, company: company || undefined, user: authData.user }

  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'Erro interno ao processar login' }
  }
}

/**
 * Logout - destroy session
 */
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (token) {
     // Optional: Call supabase sign out if we want to invalidate it on server
     await supabase.admin.auth.signOut()
  }
  cookieStore.delete(SESSION_COOKIE_NAME)
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new session using Supabase JWT Access Token
 */
async function createSession(jwtToken: string): Promise<void> {
  const cookieStore = await cookies()

  // Set cookie with JWT
  cookieStore.set(SESSION_COOKIE_NAME, jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/'
  })
}

/**
 * Validate current session and return user if active
 */
export async function validateSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionToken) return false

    // We no longer query our own db 'settings' for a session token
    // We let Supabase validate the token signature and expiration
    const { data, error } = await supabase.admin.auth.getUser(sessionToken)
    
    if (error || !data.user) {
       console.log('🔍 [validateSession] Token was invalid or expired');
       // Clean up stale cookir
       await logoutUser()
       return false
    }

    return true
  } catch (error) {
    console.warn('🔍 [validateSession] Exception:', error)
    return false
  }
}

/**
 * Helper to get currently logged user safely in server components
 */
export async function getCurrentSessionUser() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!sessionToken) return null;

  const { data } = await supabase.admin.auth.getUser(sessionToken)
  return data?.user || null
}

/**
 * Get auth status for client
 * OPTIMIZED: Parallelized queries for better performance
 */
export async function getUserAuthStatus(): Promise<{
  isSetup: boolean
  isAuthenticated: boolean
  company: Company | null
  user: any | null
}> {
  console.log('🔍 [getUserAuthStatus] === START ===')
  // Run in parallel instead of sequentially!
  console.log('🔍 [getUserAuthStatus] Calling isSetupComplete and validateSession...')
  const [isSetup, isAuthenticated] = await Promise.all([
    isSetupComplete(),
    validateSession()
  ])
  console.log('🔍 [getUserAuthStatus] isSetup:', isSetup)
  console.log('🔍 [getUserAuthStatus] isAuthenticated:', isAuthenticated)

  // Only fetch company if authenticated 
  console.log('🔍 [getUserAuthStatus] Fetching company and user...')
  const company = isAuthenticated ? await getCompany() : null
  const user = isAuthenticated ? await getCurrentSessionUser() : null
  console.log('🔍 [getUserAuthStatus] company:', company ? `Found: ${company.name}` : 'null')

  const result = { isSetup, isAuthenticated, company, user }
  console.log('🔍 [getUserAuthStatus] Final result:', isAuthenticated ? 'Authenticated' : 'Not Authenticated')
  return result
}

// ============================================================================
// RATE LIMITING (Brute Force Protection)
// ============================================================================

async function checkRateLimiting(): Promise<boolean> {
  try {
    const setting = await getSetting('login_attempts')
    if (!setting) return false

    const attempts = parseInt(setting.value) || 0
    const lastAttempt = new Date(setting.updated_at)
    const now = new Date()

    // Reset if lockout period passed
    if (now.getTime() - lastAttempt.getTime() > LOCKOUT_DURATION) {
      await clearFailedAttempts()
      return false
    }

    return attempts >= MAX_LOGIN_ATTEMPTS
  } catch {
    return false
  }
}

async function recordFailedAttempt(): Promise<void> {
  // Get current count
  const setting = await getSetting('login_attempts')
  const currentAttempts = setting ? parseInt(setting.value) || 0 : 0

  await upsertSetting('login_attempts', (currentAttempts + 1).toString())
}

async function clearFailedAttempts(): Promise<void> {
  await deleteSetting('login_attempts')
}

// ============================================================================
// PASSWORD INFO
// ============================================================================

/**
 * Password is managed via MASTER_PASSWORD environment variable in Vercel.
 * To change the password:
 * 1. Go to Vercel Dashboard
 * 2. Project Settings > Environment Variables
 * 3. Update MASTER_PASSWORD
 * 4. Redeploy
 */
