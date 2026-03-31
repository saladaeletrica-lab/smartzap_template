/**
 * Users API
 * 
 * Manage users (Subaccounts/Team Members) via Supabase Admin API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserAuthStatus } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase'

// Edge runtime is usually okay, but Supabase auth admin operations sometimes prefer Node if relying on specific crypto
export const runtime = 'nodejs' 

export async function GET() {
  try {
    const { isAuthenticated, user } = await getUserAuthStatus()
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const adminClient = supabase.admin
    if (!adminClient) throw new Error('Supabase admin não configurado')

    // List all users. 
    // IMPORTANT: This uses the service_role key to bypass RLS and get all users.
    const { data, error } = await adminClient.auth.admin.listUsers()

    if (error) throw error

    // Map to a safer object (exclude hashes etc)
    const users = data.users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      role: u.user_metadata?.role || 'user'
    }))

    return NextResponse.json({ success: true, users })
  } catch (error: any) {
    console.error('List users error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao listar usuários' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAuthenticated } = await getUserAuthStatus()
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { email, password, role = 'user' } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    const adminClient = supabase.admin
    if (!adminClient) throw new Error('Supabase admin não configurado')

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role }
    })

    if (error) {
      // Handle known Supabase errors
      if (error.message.includes('already registered')) {
         return NextResponse.json({ error: 'E-mail já está em uso' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role
      }
    })
  } catch (error: any) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao criar usuário' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { isAuthenticated, user } = await getUserAuthStatus()
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
    }

    if (user?.id === userId) {
      return NextResponse.json({ error: 'Não é possível excluir o próprio usuário' }, { status: 400 })
    }

    const adminClient = supabase.admin
    if (!adminClient) throw new Error('Supabase admin não configurado')

    const { error } = await adminClient.auth.admin.deleteUser(userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao excluir usuário' },
      { status: 500 }
    )
  }
}
