import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatView } from './components/ChatView';
import { DocumentManager } from './components/DocumentManager';
import { ApiStatusModal } from './components/ApiStatusModal';
import { DocumentRecord } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'consultation' | 'library'>('consultation');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        totalDocs={documents.length}
      />

      <main className="flex-1">
        {activeTab === 'consultation' && (
          <ChatView onNavigateToLibrary={() => setActiveTab('library')} />
        )}

        {activeTab === 'library' && (
          <DocumentManager documents={documents} onRefresh={fetchDocuments} />
        )}
      </main>

      <ApiStatusModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
