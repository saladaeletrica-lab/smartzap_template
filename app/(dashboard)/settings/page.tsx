'use client'

import { useState } from 'react'
import { useSettingsController } from '@/hooks/useSettings'
import { SettingsView } from '@/components/features/settings/SettingsView'
import { SetupWizardView } from '@/components/features/settings/SetupWizardView'
import { UsagePanel } from '@/components/UsagePanel'
import { useUsage } from '@/hooks/useUsage'
import { UsersSettings } from '@/components/features/settings/UsersSettings'

export default function SettingsPage() {
  const controller = useSettingsController()
  const { usage, isLoading: usageLoading, refetch: refetchUsage } = useUsage()
  const [skipWizard, setSkipWizard] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'team'>('general')

  // Show Setup Wizard if infrastructure is not ready (Redis + QStash)
  // User can skip to settings if they want to configure WhatsApp anyway
  const showWizard = controller.needsSetup && !skipWizard

  if (showWizard) {
    return (
      <SetupWizardView
        steps={controller.setupSteps}
        isLoading={controller.systemHealthLoading}
        onRefresh={controller.refreshSystemHealth}
        onContinueToSettings={
          controller.infrastructureReady
            ? () => setSkipWizard(true)
            : undefined
        }
        allConfigured={controller.allConfigured}
      />
    )
  }

  return (
    <div>
      {/* Header - fora do grid */}
      <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Configurações</h1>
      <p className="text-gray-400 mb-6">Gerencie sua conexão com a WhatsApp Business API e sua equipe</p>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/10 pb-4 mb-8">
        <button 
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          Geral
        </button>
        <button 
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'team' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          Equipe
        </button>
      </div>

      {/* Grid responsivo: mobile=1col, xl=3col */}
      <div className="flex flex-col xl:flex-row gap-8">
        {/* Settings Main Content */}
        <div className="flex-1 min-w-0 xl:max-w-3xl">
          {activeTab === 'general' ? (
          <SettingsView
            settings={controller.settings}
            setSettings={controller.setSettings}
            isLoading={controller.isLoading}
            isSaving={controller.isSaving}
            onSave={controller.onSave}
            onSaveSettings={controller.onSaveSettings}
            onDisconnect={controller.onDisconnect}
            accountLimits={controller.accountLimits}
            tierName={controller.tierName}
            limitsError={controller.limitsError}
            limitsErrorMessage={controller.limitsErrorMessage}
            limitsLoading={controller.limitsLoading}
            onRefreshLimits={controller.refreshLimits}
            webhookUrl={controller.webhookUrl}
            webhookToken={controller.webhookToken}
            webhookStats={controller.webhookStats}
            phoneNumbers={controller.phoneNumbers}
            phoneNumbersLoading={controller.phoneNumbersLoading}
            onRefreshPhoneNumbers={controller.refreshPhoneNumbers}
            onSetWebhookOverride={controller.setWebhookOverride}
            onRemoveWebhookOverride={controller.removeWebhookOverride}
            availableDomains={controller.availableDomains}

            webhookPath={controller.webhookPath}
            // AI Settings
            aiSettings={controller.aiSettings}
            aiSettingsLoading={controller.aiSettingsLoading}
            saveAIConfig={controller.saveAIConfig}
            removeAIKey={controller.removeAIKey}
            isSavingAI={controller.isSavingAI}
            // Test Contact - Supabase
            testContact={controller.testContact}
            saveTestContact={controller.saveTestContact}
            removeTestContact={controller.removeTestContact}
            isSavingTestContact={controller.isSavingTestContact}
            hideHeader
          />
          ) : (
            <UsersSettings />
          )}
        </div>

        {/* Usage Panel - sidebar alinhado ao topo */}
        <div className="w-full xl:w-80 flex-shrink-0">
          <UsagePanel
            usage={usage}
            isLoading={usageLoading}
            onRefresh={refetchUsage}
          />
        </div>
      </div>
    </div>
  )
}
