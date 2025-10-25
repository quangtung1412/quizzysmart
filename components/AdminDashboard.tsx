import React, { useState } from 'react';
import { api } from '../src/api';
import Overview from './admin/Overview';
import UserManagement from './admin/UserManagement';
import TestManagement from './admin/TestManagement';
import KnowledgeManagement from './admin/KnowledgeManagement';
import ModelUsageStats from './admin/ModelUsageStats';
import AiSearchHistory from './admin/AiSearchHistory';
import SubscriptionPlanManagement from './admin/SubscriptionPlanManagement';
import SubscriptionManagement from './admin/SubscriptionManagement';
import SystemSettings from './admin/SystemSettings';
import { Question } from '../types';

type AdminTab = 'overview' | 'users' | 'tests' | 'knowledge' | 'categories' | 'settings' | 'model-usage' | 'ai-history' | 'subscription-plans' | 'subscriptions';

interface AdminDashboardProps {
  userEmail: string;
  onBack: () => void;
  knowledgeBases: any[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ userEmail, onBack, knowledgeBases }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSaveNewBase = async (name: string, questions: Question[]) => {
    try {
      await api.adminCreateKnowledgeBase({ name, questions, creatorEmail: userEmail });
    } catch (error: any) {
      console.error('Failed to create knowledge base:', error);
      if (error?.message?.includes('API 401')) {
        alert('Bạn cần đăng nhập lại (401).');
      } else if (error?.message?.includes('API 403')) {
        alert('Bạn không có quyền tạo cơ sở kiến thức (403).');
      } else {
        alert('Không thể tạo cơ sở kiến thức.');
      }
      throw error;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'users':
        return <UserManagement />;
      case 'tests':
        return <TestManagement />;
      case 'knowledge':
        return <KnowledgeManagement onSaveNewBase={handleSaveNewBase} />;
      case 'model-usage':
        return <ModelUsageStats onBack={() => setActiveTab('overview')} />;
      case 'ai-history':
        return <AiSearchHistory />;
      case 'subscription-plans':
        return <SubscriptionPlanManagement />;
      case 'subscriptions':
        return <SubscriptionManagement />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <Overview />;
    }
  };

  const TabButton: React.FC<{ tab: AdminTab; label: string; icon: string }> = ({ tab, label, icon }) => (
    <button
      onClick={() => {
        setActiveTab(tab);
        setSidebarOpen(false); // Close mobile sidebar when tab is selected
      }}
      className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg flex items-center space-x-3 transition-colors min-h-[44px] ${activeTab === tab ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
        }`}
    >
      <span className="text-lg flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 shadow-lg transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">Admin Panel</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="p-4 space-y-2">
          <TabButton tab="overview" label="Tổng quan" icon="📊" />
          <TabButton tab="users" label="Quản lý người dùng" icon="👥" />
          <TabButton tab="tests" label="Quản lý bài thi" icon="📝" />
          <TabButton tab="knowledge" label="Quản lý kiến thức" icon="📚" />
          <TabButton tab="subscription-plans" label="Quản lý gói" icon="💎" />
          <TabButton tab="subscriptions" label="Quản lý Subscriptions" icon="🎫" />
          <TabButton tab="model-usage" label="AI Model Stats" icon="🤖" />
          <TabButton tab="ai-history" label="AI Search History" icon="🔍" />
          <TabButton tab="categories" label="Quản lý chuyên mục" icon="📂" />
          <TabButton tab="settings" label="Cài đặt hệ thống" icon="⚙️" />
          <div className="border-t border-slate-200 pt-4 mt-4">
            <button
              onClick={onBack}
              className="w-full text-left px-4 py-3 text-sm font-medium rounded-lg flex items-center space-x-3 text-slate-600 hover:bg-slate-100 transition-colors min-h-[44px]"
            >
              <span className="text-lg flex-shrink-0">🏠</span>
              <span className="truncate">Về trang chính</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Mobile header with hamburger menu */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Mở menu" title="Mở menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-slate-800 truncate px-2">Admin Dashboard</h1>
            <button
              onClick={onBack}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Về trang chính" title="Về trang chính"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m0 0V11a1 1 0 011-1h2a1 1 0 011 1v10m0 0h3a1 1 0 001-1V10M9 21h6" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
