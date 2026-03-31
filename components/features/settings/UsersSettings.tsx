'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Mail, Shield, User as UserIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  email: string
  role: string
  created_at: string
  last_sign_in_at?: string
}

export function UsersSettings() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Falha ao obter usuários')
      const data = await res.json()
      if (data.users) {
        setUsers(data.users)
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar equipe')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserEmail || !newUserPassword) {
      toast.error('Preencha os dados obrigatórios')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUserEmail, password: newUserPassword, role: 'user' })
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar')
      
      toast.success('Usuário adicionado com sucesso')
      setNewUserEmail('')
      setNewUserPassword('')
      setIsAdding(false)
      fetchUsers()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveUser = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário do acesso?')) return

    try {
      const res = await fetch(`/api/users?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erro ao remover')

      toast.success('Usuário removido da equipe')
      fetchUsers()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  if (isLoading && users.length === 0) {
    return <div className="text-gray-400 animate-pulse flex items-center gap-2"><Loader2 className="animate-spin w-4 h-4"/> Carregando equipe...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserIcon size={20} className="text-emerald-400" />
            Membros da Equipe
          </h2>
          <p className="text-sm text-gray-400 mt-1">Gerencie os acessos ao Smartzap</p>
        </div>
        
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Convidar Membro
        </button>
      </div>

      {isAdding && (
        <div className="glass-panel p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 animate-in slide-in-from-top-4">
          <h3 className="text-white font-medium mb-4">Adicionar Novo Membro</h3>
          <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">E-mail de acesso</label>
              <input 
                type="email" 
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Senha Inicial Provisória</label>
              <input 
                type="text" 
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Senha segura..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:ring-emerald-500 focus:border-emerald-500"
                required
                minLength={6}
              />
            </div>
            <div className="flex items-end gap-2 pb-0.5 mt-4 sm:mt-0">
              <button 
                type="button" 
                className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5"
                onClick={() => setIsAdding(false)}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-white text-black font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/> : null}
                Adicionar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Permissão</th>
                <th className="px-6 py-4 hidden sm:table-cell">Criado em</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 font-medium border border-white/10">
                        {u.email[0].toUpperCase()}
                      </div>
                      <div className="font-medium text-white flex flex-col">
                        {u.email}
                        {u.last_sign_in_at && (
                          <span className="text-xs text-gray-500 font-normal">
                            Visto: {new Date(u.last_sign_in_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-zinc-800 text-gray-300 border-white/10'}`}>
                      {u.role === 'admin' ? <Shield size={12}/> : <UserIcon size={12}/>}
                      {u.role === 'admin' ? 'Administrador' : 'Membro'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleRemoveUser(u.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors inline-block"
                      title="Remover acesso"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              
              {users.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Nenhum outro usuário cadastrado neste ambiente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
